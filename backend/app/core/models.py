from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import uuid
from datetime import datetime, timezone

class MilestoneStatus(str, Enum):
    PENDING = "PENDING"              # Created, waiting for contract escrow funding
    FUNDED = "FUNDED"                # Client deposited funds into PayPal escrow
    SUBMITTED = "SUBMITTED"          # Worker submitted deliverable
    VERIFYING = "VERIFYING"          # Automated checks currently executing
    VERIFIED = "VERIFIED"            # Automated check passed, approved for release
    REJECTED = "REJECTED"            # Automated check failed
    DISBURSED = "DISBURSED"          # PayPal payout executed successfully to worker
    DISPUTED = "DISPUTED"            # Flagged for human arbitrator review

class VerificationType(str, Enum):
    GITHUB_CI = "GITHUB_CI"          # Checks commit status / workflow runs
    API_HEALTH = "API_HEALTH"        # HTTP test probe against endpoint
    TEST_SUITE = "TEST_SUITE"        # Executes local/containerized unit tests
    DETERMINISTIC = "DETERMINISTIC"  # Checks file hash, payload schema, or assertion

class ContractStatus(str, Enum):
    DRAFT = "DRAFT"
    AWAITING_ESCROW = "AWAITING_ESCROW"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    DISPUTED = "DISPUTED"
    CANCELLED = "CANCELLED"

class DeliverableSubmission(BaseModel):
    summary: str
    artifact_url: Optional[str] = None
    telemetry_data: Optional[Dict[str, Any]] = None
    submitted_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class VerificationReport(BaseModel):
    passed: bool
    runner: str
    logs: List[str] = []
    duration_ms: int = 0
    executed_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    details: Optional[Dict[str, Any]] = None

class Milestone(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contract_id: str
    order_index: int
    title: str
    description: str
    amount: float
    currency: str = "USD"
    status: MilestoneStatus = MilestoneStatus.PENDING
    verification_type: VerificationType
    verification_criteria: Dict[str, Any] = {}
    deliverable: Optional[DeliverableSubmission] = None
    verification_report: Optional[VerificationReport] = None
    paypal_payout_id: Optional[str] = None
    payout_timestamp: Optional[str] = None

class ContractCreateRequest(BaseModel):
    title: str
    description: str
    client_name: str
    client_email: str
    worker_name: str
    worker_paypal_email: str
    currency: str = "USD"
    milestones: List[Dict[str, Any]]

class Contract(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    client_name: str
    client_email: str
    worker_name: str
    worker_paypal_email: str
    total_amount: float
    currency: str = "USD"
    status: ContractStatus = ContractStatus.DRAFT
    paypal_order_id: Optional[str] = None
    paypal_auth_id: Optional[str] = None
    paypal_capture_id: Optional[str] = None
    milestones: List[Milestone] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
