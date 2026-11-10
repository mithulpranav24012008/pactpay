import httpx
import base64
import time
import uuid
from typing import Dict, Any, Optional
from backend.app.core.config import settings

class PayPalClient:
    def __init__(self):
        self.base_url = settings.PAYPAL_BASE_URL
        self.client_id = settings.PAYPAL_CLIENT_ID
        self.client_secret = settings.PAYPAL_CLIENT_SECRET
        self._cached_token: Optional[str] = None
        self._token_expires_at: float = 0

    @property
    def is_mock(self) -> bool:
        return (
            not self.client_id or 
            self.client_id.startswith("mock_") or 
            not self.client_secret or 
            self.client_secret.startswith("mock_")
        )

    async def get_access_token(self) -> str:
        if self.is_mock:
            return f"mock_access_token_{int(time.time())}"

        if self._cached_token and time.time() < self._token_expires_at:
            return self._cached_token

        auth_str = f"{self.client_id}:{self.client_secret}"
        encoded_auth = base64.b64encode(auth_str.encode()).decode()

        headers = {
            "Authorization": f"Basic {encoded_auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {"grant_type": "client_credentials"}

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/v1/oauth2/token",
                headers=headers,
                data=data,
                timeout=10.0
            )
            resp.raise_for_status()
            res_data = resp.json()
            self._cached_token = res_data["access_token"]
            self._token_expires_at = time.time() + res_data.get("expires_in", 3600) - 60
            return self._cached_token

    async def create_escrow_order(self, amount: float, currency: str = "USD", contract_id: str = "") -> Dict[str, Any]:
        """Creates a PayPal Order with AUTHORIZE intent to lock client funds in escrow."""
        if self.is_mock:
            order_id = f"ORDER-MOCK-{uuid.uuid4().hex[:8].upper()}"
            return {
                "id": order_id,
                "status": "CREATED",
                "intent": "AUTHORIZE",
                "links": [
                    {
                        "href": f"https://www.sandbox.paypal.com/checkoutnow?token={order_id}",
                        "rel": "approve",
                        "method": "GET"
                    }
                ]
            }

        token = await self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "intent": "AUTHORIZE",
            "purchase_units": [
                {
                    "reference_id": contract_id,
                    "description": f"PactPay Escrow Deposit for Contract {contract_id}",
                    "amount": {
                        "currency_code": currency,
                        "value": f"{amount:.2f}"
                    }
                }
            ],
            "application_context": {
                "brand_name": "PactPay AI Escrow",
                "user_action": "CONTINUE"
            }
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/v2/checkout/orders",
                headers=headers,
                json=payload,
                timeout=15.0
            )
            resp.raise_for_status()
            return resp.json()

    async def authorize_order(self, order_id: str) -> Dict[str, Any]:
        """Authorizes the payment, locking client funds without capturing immediately."""
        if self.is_mock:
            auth_id = f"AUTH-MOCK-{uuid.uuid4().hex[:8].upper()}"
            return {
                "id": order_id,
                "status": "COMPLETED",
                "purchase_units": [
                    {
                        "payments": {
                            "authorizations": [
                                {
                                    "id": auth_id,
                                    "status": "CREATED",
                                    "expiration_time": "2026-11-20T12:00:00Z"
                                }
                            ]
                        }
                    }
                ]
            }

        token = await self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/v2/checkout/orders/{order_id}/authorize",
                headers=headers,
                timeout=15.0
            )
            resp.raise_for_status()
            return resp.json()

    async def capture_authorization(self, auth_id: str, amount: Optional[float] = None, currency: str = "USD") -> Dict[str, Any]:
        """Captures locked escrow funds when milestones commence."""
        if self.is_mock:
            return {
                "id": f"CAPTURE-MOCK-{uuid.uuid4().hex[:8].upper()}",
                "status": "COMPLETED"
            }

        token = await self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {}
        if amount is not None:
            payload["amount"] = {
                "currency_code": currency,
                "value": f"{amount:.2f}"
            }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/v2/payments/authorizations/{auth_id}/capture",
                headers=headers,
                json=payload,
                timeout=15.0
            )
            resp.raise_for_status()
            return resp.json()

    async def disburse_payout(
        self, 
        recipient_email: str, 
        amount: float, 
        currency: str = "USD", 
        note: str = "PactPay Milestone Completion Payout",
        milestone_id: str = ""
    ) -> Dict[str, Any]:
        """Disburses milestone funds directly to worker's PayPal/Venmo address via PayPal Payouts API."""
        if self.is_mock:
            batch_id = f"PAYOUT-BATCH-{uuid.uuid4().hex[:8].upper()}"
            item_id = f"ITEM-{uuid.uuid4().hex[:8].upper()}"
            return {
                "batch_header": {
                    "payout_batch_id": batch_id,
                    "batch_status": "SUCCESS",
                    "sender_batch_header": {
                        "sender_batch_id": f"batch_{milestone_id}_{int(time.time())}"
                    }
                },
                "payout_item_id": item_id,
                "status": "SUCCESS"
            }

        token = await self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        sender_batch_id = f"pactpay_{milestone_id}_{int(time.time())}"
        payload = {
            "sender_batch_header": {
                "sender_batch_id": sender_batch_id,
                "email_subject": "You have received a milestone payment via PactPay!",
                "email_message": note
            },
            "items": [
                {
                    "recipient_type": "EMAIL",
                    "amount": {
                        "value": f"{amount:.2f}",
                        "currency": currency
                    },
                    "note": note,
                    "receiver": recipient_email,
                    "sender_item_id": f"item_{milestone_id}"
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/v1/payments/payouts",
                headers=headers,
                json=payload,
                timeout=15.0
            )
            resp.raise_for_status()
            return resp.json()

paypal_client = PayPalClient()
