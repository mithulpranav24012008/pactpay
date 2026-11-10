from datetime import datetime, timezone
from typing import Dict, Any, Optional
from backend.app.core.models import (
    Contract, Milestone, ContractStatus, MilestoneStatus,
    ContractCreateRequest, DeliverableSubmission
)
from backend.app.core.database import db
from backend.app.services.paypal_client import paypal_client
from backend.app.services.verifier import verifier

class EscrowEngine:
    async def create_contract(self, req: ContractCreateRequest) -> Contract:
        contract = Contract(
            title=req.title,
            description=req.description,
            client_name=req.client_name,
            client_email=req.client_email,
            worker_name=req.worker_name,
            worker_paypal_email=req.worker_paypal_email,
            total_amount=sum(m.get("amount", 0.0) for m in req.milestones),
            currency=req.currency,
            status=ContractStatus.AWAITING_ESCROW
        )

        milestones = []
        for idx, m_data in enumerate(req.milestones):
            m = Milestone(
                contract_id=contract.id,
                order_index=idx + 1,
                title=m_data.get("title", f"Milestone #{idx + 1}"),
                description=m_data.get("description", ""),
                amount=float(m_data.get("amount", 0.0)),
                currency=req.currency,
                status=MilestoneStatus.PENDING,
                verification_type=m_data.get("verification_type", "DETERMINISTIC"),
                verification_criteria=m_data.get("verification_criteria", {})
            )
            milestones.append(m)

        contract.milestones = milestones
        await db.save_contract(contract)
        await db.log_event(contract.id, None, "CONTRACT_CREATED", {
            "title": contract.title,
            "total_amount": contract.total_amount,
            "milestone_count": len(milestones)
        })
        return contract

    async def fund_contract_escrow(self, contract_id: str) -> Contract:
        contract = await db.get_contract(contract_id)
        if not contract:
            raise ValueError(f"Contract {contract_id} not found")

        # 1. Create PayPal Order (Authorize Intent)
        order_resp = await paypal_client.create_escrow_order(
            amount=contract.total_amount,
            currency=contract.currency,
            contract_id=contract.id
        )
        contract.paypal_order_id = order_resp.get("id")

        # 2. Authorize payment (locks funds in client account for escrow)
        auth_resp = await paypal_client.authorize_order(contract.paypal_order_id)
        try:
            auth_id = auth_resp["purchase_units"][0]["payments"]["authorizations"][0]["id"]
            contract.paypal_auth_id = auth_id
        except (KeyError, IndexError):
            contract.paypal_auth_id = f"AUTH-{contract.paypal_order_id}"

        # 3. Capture into platform escrow vault
        capture_resp = await paypal_client.capture_authorization(contract.paypal_auth_id, contract.total_amount, contract.currency)
        contract.paypal_capture_id = capture_resp.get("id")

        # 4. Activate contract and fund all milestones
        contract.status = ContractStatus.ACTIVE
        contract.updated_at = datetime.now(timezone.utc).isoformat()
        for m in contract.milestones:
            m.status = MilestoneStatus.FUNDED

        await db.save_contract(contract)
        await db.log_event(contract.id, None, "ESCROW_FUNDED", {
            "order_id": contract.paypal_order_id,
            "auth_id": contract.paypal_auth_id,
            "capture_id": contract.paypal_capture_id,
            "amount_locked": contract.total_amount
        })
        return contract

    async def process_milestone_submission(
        self, contract_id: str, milestone_id: str, submission: DeliverableSubmission
    ) -> Dict[str, Any]:
        contract = await db.get_contract(contract_id)
        if not contract:
            raise ValueError(f"Contract {contract_id} not found")

        milestone = next((m for m in contract.milestones if m.id == milestone_id), None)
        if not milestone:
            raise ValueError(f"Milestone {milestone_id} not found in contract")

        milestone.deliverable = submission
        milestone.status = MilestoneStatus.VERIFYING
        await db.save_contract(contract)

        await db.log_event(contract.id, milestone.id, "DELIVERABLE_SUBMITTED", {
            "summary": submission.summary
        })

        # Run automated verification
        report = await verifier.verify(milestone, submission)
        milestone.verification_report = report

        if report.passed:
            milestone.status = MilestoneStatus.VERIFIED
            await db.log_event(contract.id, milestone.id, "VERIFICATION_PASSED", {
                "runner": report.runner,
                "duration_ms": report.duration_ms
            })

            # Automated PayPal Payout disbursement
            payout_resp = await paypal_client.disburse_payout(
                recipient_email=contract.worker_paypal_email,
                amount=milestone.amount,
                currency=milestone.currency,
                note=f"PactPay milestone payout for '{milestone.title}'",
                milestone_id=milestone.id
            )

            milestone.paypal_payout_id = payout_resp.get("payout_item_id") or payout_resp.get("batch_header", {}).get("payout_batch_id")
            milestone.payout_timestamp = datetime.now(timezone.utc).isoformat()
            milestone.status = MilestoneStatus.DISBURSED

            await db.log_event(contract.id, milestone.id, "PAYOUT_DISBURSED", {
                "amount": milestone.amount,
                "receiver": contract.worker_paypal_email,
                "payout_id": milestone.paypal_payout_id
            })

            # Check if all milestones completed
            if all(m.status == MilestoneStatus.DISBURSED for m in contract.milestones):
                contract.status = ContractStatus.COMPLETED
                await db.log_event(contract.id, None, "CONTRACT_COMPLETED", {
                    "total_disbursed": contract.total_amount
                })
        else:
            milestone.status = MilestoneStatus.REJECTED
            await db.log_event(contract.id, milestone.id, "VERIFICATION_FAILED", {
                "runner": report.runner,
                "reason": report.logs[-1] if report.logs else "Verification checks failed"
            })

        contract.updated_at = datetime.now(timezone.utc).isoformat()
        await db.save_contract(contract)
        return {
            "contract": contract,
            "milestone": milestone,
            "report": report
        }

    async def human_override(
        self, contract_id: str, milestone_id: str, approve: bool, reason: str, reviewer: str = "Admin Arbitrator"
    ) -> Milestone:
        contract = await db.get_contract(contract_id)
        if not contract:
            raise ValueError(f"Contract {contract_id} not found")

        milestone = next((m for m in contract.milestones if m.id == milestone_id), None)
        if not milestone:
            raise ValueError(f"Milestone {milestone_id} not found")

        if approve:
            milestone.status = MilestoneStatus.VERIFIED
            payout_resp = await paypal_client.disburse_payout(
                recipient_email=contract.worker_paypal_email,
                amount=milestone.amount,
                currency=milestone.currency,
                note=f"PactPay manual override payout: {reason}",
                milestone_id=milestone.id
            )
            milestone.paypal_payout_id = payout_resp.get("payout_item_id") or payout_resp.get("batch_header", {}).get("payout_batch_id")
            milestone.payout_timestamp = datetime.now(timezone.utc).isoformat()
            milestone.status = MilestoneStatus.DISBURSED

            await db.log_event(contract.id, milestone.id, "MANUAL_OVERRIDE_APPROVED", {
                "reviewer": reviewer,
                "reason": reason,
                "payout_id": milestone.paypal_payout_id
            })
        else:
            milestone.status = MilestoneStatus.DISPUTED
            await db.log_event(contract.id, milestone.id, "MANUAL_OVERRIDE_DISPUTED", {
                "reviewer": reviewer,
                "reason": reason
            })

        contract.updated_at = datetime.now(timezone.utc).isoformat()
        await db.save_contract(contract)
        return milestone

escrow_engine = EscrowEngine()
