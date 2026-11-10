import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
import time
from httpx import AsyncClient, ASGITransport
from backend.app.main import app

# Terminal styling
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

async def run_simulation():
    print(f"\n{BOLD}{CYAN}===================================================================={RESET}")
    print(f"{BOLD}{CYAN}       PACTPAY: AUTONOMOUS AGENT ESCROW & VERIFICATION DEMO         {RESET}")
    print(f"{BOLD}{CYAN}===================================================================={RESET}\n")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Create Contract
        print(f"{BOLD}[Step 1] Client Agent posting autonomous contract...{RESET}")
        contract_data = {
            "title": "Autonomous Liquidity Monitoring Agent",
            "description": "Multi-agent task: Build and test microservice with real-time telemetry",
            "client_name": "Synthetix-Buyer-Agent",
            "client_email": "buyer-agent@synthetix.ai",
            "worker_name": "Aether-Developer-Agent",
            "worker_paypal_email": "aether-dev-sandbox@example.com",
            "currency": "USD",
            "milestones": [
                {
                    "title": "Milestone 1: Deliver Core Microservice & CI",
                    "description": "Implement container and pass automated test suite",
                    "amount": 400.0,
                    "verification_type": "GITHUB_CI",
                    "verification_criteria": {
                        "repo": "aether/liquidity-monitor",
                        "required_checks": ["build", "unit-tests", "security-audit"]
                    }
                },
                {
                    "title": "Milestone 2: Production Health & Schema Validation",
                    "description": "Expose live health probe and pass schema assertions",
                    "amount": 600.0,
                    "verification_type": "DETERMINISTIC",
                    "verification_criteria": {
                        "required_keys": ["status", "uptime", "version", "signature"]
                    }
                }
            ]
        }
        res = await client.post("/api/v1/contracts", json=contract_data)
        contract = res.json()
        contract_id = contract["id"]
        m1_id = contract["milestones"][0]["id"]
        m2_id = contract["milestones"][1]["id"]
        print(f"  {GREEN}✔ Contract Created:{RESET} ID: {contract_id} | Total: ${contract['total_amount']} USD")
        time.sleep(0.5)

        # Step 2: Fund Escrow via PayPal
        print(f"\n{BOLD}[Step 2] Locking $1,000 USD in PayPal Escrow (Auth & Capture)...{RESET}")
        res = await client.post(f"/api/v1/contracts/{contract_id}/fund")
        funded = res.json()
        print(f"  {GREEN}✔ PayPal Order ID:{RESET} {funded['paypal_order_id']}")
        print(f"  {GREEN}✔ PayPal Auth ID:{RESET}  {funded['paypal_auth_id']}")
        print(f"  {GREEN}✔ Escrow Status:{RESET}   {funded['status']} (Funds locked in PactPay platform vault)")
        time.sleep(0.5)

        # Step 3: Milestone 1 Submission & Passing Verification
        print(f"\n{BOLD}[Step 3] Worker Agent submits Milestone 1 deliverable (PR with Green CI)...{RESET}")
        sub1 = {
            "summary": "Completed PR #108: Implemented microservice with full test coverage",
            "artifact_url": "https://github.com/aether/liquidity-monitor/pull/108",
            "telemetry_data": {
                "commit_sha": "7f8a9b2c3d4e",
                "force_failure_checks": []
            }
        }
        res = await client.post(f"/api/v1/contracts/{contract_id}/milestones/{m1_id}/submit", json=sub1)
        res1 = res.json()
        print(f"  {CYAN}⚡ Arbitrator Verifier:{RESET} {res1['report']['runner']} (Duration: {res1['report']['duration_ms']}ms)")
        for log in res1["report"]["logs"]:
            print(f"     {log}")
        print(f"  {GREEN}✔ Verification Status:{RESET} {res1['milestone']['status']}")
        print(f"  {GREEN}✔ Automated PayPal Payout Executed:{RESET} Batch {res1['milestone']['paypal_payout_id']} -> ${res1['milestone']['amount']} to {funded['worker_paypal_email']}")
        time.sleep(0.5)

        # Step 4: Milestone 2 Submission with Intentional Failure
        print(f"\n{BOLD}[Step 4] Worker Agent submits Milestone 2 deliverable with incomplete schema (Dramatic Fail)...{RESET}")
        sub2_fail = {
            "summary": "Deployed draft endpoint, schema signature missing",
            "telemetry_data": {
                "status": "online",
                "uptime": 3600
                # Missing 'version' and 'signature'
            }
        }
        res = await client.post(f"/api/v1/contracts/{contract_id}/milestones/{m2_id}/submit", json=sub2_fail)
        res2 = res.json()
        print(f"  {CYAN}⚡ Arbitrator Verifier:{RESET} {res2['report']['runner']}")
        for log in res2["report"]["logs"]:
            print(f"     {log}")
        print(f"  {RED}✖ Verification Status:{RESET} {res2['milestone']['status']} (Funds remain securely held in escrow)")
        time.sleep(0.5)

        # Step 5: Human Arbitrator Override & Resolution
        print(f"\n{BOLD}[Step 5] Human Arbitrator Review & Override...{RESET}")
        override_req = {
            "approve": True,
            "reason": "Cryptographic signature validated out-of-band via developer GPG key",
            "reviewer": "Senior Arbitrator (namikazeluffy)"
        }
        res = await client.post(f"/api/v1/contracts/{contract_id}/milestones/{m2_id}/override", json=override_req)
        m2_final = res.json()
        print(f"  {GREEN}✔ Override Approved:{RESET} {override_req['reason']}")
        print(f"  {GREEN}✔ Final PayPal Payout Released:{RESET} Batch {m2_final['paypal_payout_id']} -> ${m2_final['amount']} USD")
        time.sleep(0.5)

        # Step 6: Summary
        res = await client.get("/api/v1/escrow/summary")
        summary = res.json()
        print(f"\n{BOLD}{CYAN}===================================================================={RESET}")
        print(f"{BOLD}{CYAN}                     PACTPAY PLATFORM SUMMARY                       {RESET}")
        print(f"{BOLD}{CYAN}===================================================================={RESET}")
        print(f"  Total Contracts:      {summary['total_contracts']}")
        print(f"  Active Contracts:     {summary['active_contracts']}")
        print(f"  Total Disbursed:      ${summary['total_disbursed_usd']} USD")
        print(f"  Escrow Balance:       ${summary['total_escrow_locked_usd']} USD")
        print(f"{BOLD}{GREEN}✔ End-to-end autonomous escrow and payout cycle completed successfully!{RESET}\n")

if __name__ == "__main__":
    asyncio.run(run_simulation())
