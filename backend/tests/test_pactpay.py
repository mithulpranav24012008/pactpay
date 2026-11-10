import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.database import db

@pytest.mark.asyncio
async def test_full_pactpay_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a Contract with 2 milestones
        create_payload = {
            "title": "Build Autonomous Payment Agent",
            "description": "Develop and deploy an AI agent with PayPal integration",
            "client_name": "ClientAgent-Alpha",
            "client_email": "client-alpha@agentic.ai",
            "worker_name": "DevAgent-Omega",
            "worker_paypal_email": "dev-omega-sandbox@example.com",
            "currency": "USD",
            "milestones": [
                {
                    "title": "Milestone 1: Core API & CI",
                    "description": "Build backend endpoints and pass all automated CI checks",
                    "amount": 250.0,
                    "verification_type": "GITHUB_CI",
                    "verification_criteria": {
                        "repo": "pactpay/core-agent",
                        "required_checks": ["build", "unit-tests"]
                    }
                },
                {
                    "title": "Milestone 2: Service Health Probe",
                    "description": "Deploy service and verify live HTTP 200 health probe",
                    "amount": 500.0,
                    "verification_type": "API_HEALTH",
                    "verification_criteria": {
                        "target_url": "https://api-m.sandbox.paypal.com/v1/oauth2/token",
                        "expected_status": 200
                    }
                }
            ]
        }
        res = await client.post("/api/v1/contracts", json=create_payload)
        assert res.status_code == 200
        contract = res.json()
        assert contract["total_amount"] == 750.0
        assert contract["status"] == "AWAITING_ESCROW"
        assert len(contract["milestones"]) == 2
        contract_id = contract["id"]
        m1_id = contract["milestones"][0]["id"]
        m2_id = contract["milestones"][1]["id"]

        # 2. Fund Contract via PayPal Escrow (Auth & Capture)
        res = await client.post(f"/api/v1/contracts/{contract_id}/fund")
        assert res.status_code == 200
        funded_contract = res.json()
        assert funded_contract["status"] == "ACTIVE"
        assert funded_contract["paypal_order_id"] is not None
        assert funded_contract["paypal_auth_id"] is not None
        assert funded_contract["milestones"][0]["status"] == "FUNDED"

        # 3. Submit Deliverable for Milestone 1 (Passing CI)
        m1_submission = {
            "summary": "Completed PR #42 with all CI checks passing",
            "artifact_url": "https://github.com/pactpay/core-agent/pull/42",
            "telemetry_data": {
                "commit_sha": "a1b2c3d4e5f6",
                "force_failure_checks": []
            }
        }
        res = await client.post(f"/api/v1/contracts/{contract_id}/milestones/{m1_id}/submit", json=m1_submission)
        assert res.status_code == 200
        m1_result = res.json()
        assert m1_result["report"]["passed"] is True
        assert m1_result["milestone"]["status"] == "DISBURSED"
        assert m1_result["milestone"]["paypal_payout_id"] is not None

        # 4. Submit Deliverable for Milestone 2 with Forced Failure
        m2_submission_fail = {
            "summary": "PR submitted with broken endpoint",
            "artifact_url": "http://invalid-non-existent-host-domain.fake/health",
            "telemetry_data": {
                "mock_simulate_pass": False
            }
        }
        res = await client.post(f"/api/v1/contracts/{contract_id}/milestones/{m2_id}/submit", json=m2_submission_fail)
        assert res.status_code == 200
        m2_result = res.json()
        assert m2_result["report"]["passed"] is False
        assert m2_result["milestone"]["status"] == "REJECTED"

        # 5. Human Arbitrator Override (Approve after manual review)
        override_payload = {
            "approve": True,
            "reason": "Verified manually via staging curl trace; vendor DNS was pending",
            "reviewer": "Arbitrator-namikazeluffy"
        }
        res = await client.post(f"/api/v1/contracts/{contract_id}/milestones/{m2_id}/override", json=override_payload)
        assert res.status_code == 200
        m2_overridden = res.json()
        assert m2_overridden["status"] == "DISBURSED"
        assert m2_overridden["paypal_payout_id"] is not None

        # 6. Verify Contract Summary & Audit Logs
        res = await client.get("/api/v1/escrow/summary")
        assert res.status_code == 200
        summary = res.json()
        assert summary["total_contracts"] >= 1
        assert summary["total_disbursed_usd"] >= 750.0

        res = await client.get("/api/v1/audit/logs")
        assert res.status_code == 200
        logs = res.json()
        assert len(logs) > 0
