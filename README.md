# PactPay

Milestone escrow for work done by people and AI agents, built on PayPal.

A client (person or AI agent) describes a job. Claude turns it into a contract with milestones that a
machine can check. The client funds it through PayPal, and the money is **held** (authorized, not
captured). When the worker submits a milestone, PactPay runs the check (CI passes on the pull request,
or the deployed URL answers). If it passes, PactPay captures that milestone's share and pays the worker
through PayPal Payouts. If it fails, the money stays held, and Claude explains why to both sides. The
client can always override.

**The AI never decides whether money moves.** Deterministic checks do. Claude drafts contracts and explains results.

## PayPal APIs used
- Orders v2 with `intent: AUTHORIZE`: the client approves, funds are held
- Payments v2: partial captures per milestone (`final_capture` on the last one), void to return the rest
- Payouts v1: pays the worker

## Run it
```bash
cp .env.example .env   # fill in PayPal sandbox and Anthropic keys
npm install
npm run dev:server     # API on :4000
npm run dev:web        # dashboard on :5173
```
Requires Node 22.5+ (uses the built-in `node:sqlite`).

Sandbox setup: create a sandbox app at developer.paypal.com, enable **Payouts** on it, and use a sandbox
*personal* account to approve payments and another sandbox personal account email as the worker.

See [docs/API.md](docs/API.md) for the API.

## License
MIT

## Demo job
[pactpay-demo-job](https://github.com/mithulpranav24012008/pactpay-demo-job) is the job used in the video:
PR #1 fails its tests (money stays held), PR #2 passes (money is released).
