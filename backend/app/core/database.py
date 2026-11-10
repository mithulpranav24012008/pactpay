import json
import os
import asyncio
from typing import Dict, List, Optional
from backend.app.core.models import Contract, Milestone

class InMemoryDB:
    def __init__(self, persist_file: str = "pactpay_state.json"):
        self.persist_file = persist_file
        self.contracts: Dict[str, Contract] = {}
        self.audit_logs: List[Dict] = []
        self._lock = asyncio.Lock()
        self.load()

    def load(self):
        if os.path.exists(self.persist_file):
            try:
                with open(self.persist_file, "r") as f:
                    data = json.load(f)
                    for item in data.get("contracts", []):
                        contract = Contract(**item)
                        self.contracts[contract.id] = contract
                    self.audit_logs = data.get("audit_logs", [])
            except Exception as e:
                print(f"[DB] Error loading state: {e}")

    def save(self):
        try:
            with open(self.persist_file, "w") as f:
                json.dump({
                    "contracts": [c.model_dump() for c in self.contracts.values()],
                    "audit_logs": self.audit_logs
                }, f, indent=2)
        except Exception as e:
            print(f"[DB] Error saving state: {e}")

    async def get_contract(self, contract_id: str) -> Optional[Contract]:
        async with self._lock:
            return self.contracts.get(contract_id)

    async def list_contracts(self) -> List[Contract]:
        async with self._lock:
            return list(self.contracts.values())

    async def save_contract(self, contract: Contract):
        async with self._lock:
            self.contracts[contract.id] = contract
            self.save()

    async def log_event(self, contract_id: str, milestone_id: Optional[str], event_type: str, details: Dict):
        async with self._lock:
            entry = {
                "timestamp": asyncio.get_event_loop().time(),
                "contract_id": contract_id,
                "milestone_id": milestone_id,
                "event_type": event_type,
                "details": details
            }
            self.audit_logs.append(entry)
            self.save()

    async def get_audit_logs(self, limit: int = 50) -> List[Dict]:
        async with self._lock:
            return self.audit_logs[-limit:]

db = InMemoryDB()
