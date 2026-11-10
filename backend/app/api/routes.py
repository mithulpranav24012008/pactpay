from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any
from pydantic import BaseModel
from backend.app.core.models import Contract, Milestone, ContractCreateRequest, DeliverableSubmission
from backend.app.core.database import db
from backend.app.services.escrow_engine import escrow_engine

router = APIRouter()

class OverrideRequest(BaseModel):
    approve: bool
    reason: str
    reviewer: str = "Admin Arbitrator"

@router.post("/contracts", response_model=Contract)
async def create_contract(req: ContractCreateRequest):
    return await escrow_engine.create_contract(req)

@router.get("/contracts", response_model=List[Contract])
async def list_contracts():
    return await db.list_contracts()

@router.get("/contracts/{contract_id}", response_model=Contract)
async def get_contract(contract_id: str):
    contract = await db.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract

@router.post("/contracts/{contract_id}/fund", response_model=Contract)
async def fund_contract(contract_id: str):
    try:
        return await escrow_engine.fund_contract_escrow(contract_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/contracts/{contract_id}/milestones/{milestone_id}/submit")
async def submit_milestone(contract_id: str, milestone_id: str, submission: DeliverableSubmission):
    try:
        res = await escrow_engine.process_milestone_submission(contract_id, milestone_id, submission)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/contracts/{contract_id}/milestones/{milestone_id}/override", response_model=Milestone)
async def override_milestone(contract_id: str, milestone_id: str, req: OverrideRequest):
    try:
        return await escrow_engine.human_override(
            contract_id=contract_id,
            milestone_id=milestone_id,
            approve=req.approve,
            reason=req.reason,
            reviewer=req.reviewer
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/audit/logs")
async def get_audit_logs(limit: int = Query(default=50, le=200)):
    return await db.get_audit_logs(limit=limit)

@router.get("/escrow/summary")
async def get_escrow_summary():
    contracts = await db.list_contracts()
    total_locked = 0.0
    total_disbursed = 0.0
    total_pending = 0.0
    
    for c in contracts:
        for m in c.milestones:
            if m.status in ["FUNDED", "SUBMITTED", "VERIFYING", "REJECTED"]:
                total_locked += m.amount
            elif m.status == "DISBURSED":
                total_disbursed += m.amount
            elif m.status == "PENDING":
                total_pending += m.amount

    return {
        "active_contracts": len([c for c in contracts if c.status == "ACTIVE"]),
        "completed_contracts": len([c for c in contracts if c.status == "COMPLETED"]),
        "total_contracts": len(contracts),
        "total_escrow_locked_usd": round(total_locked, 2),
        "total_disbursed_usd": round(total_disbursed, 2),
        "total_pending_funding_usd": round(total_pending, 2)
    }
