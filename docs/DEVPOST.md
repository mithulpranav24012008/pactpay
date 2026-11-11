# Devpost submission text

## Tagline
Milestone escrow for people and AI agents: PayPal holds the money, and it is released only when the work passes a machine-checkable test.

## Inspiration
AI agents can now write code, buy services and hire freelancers. Money is the missing piece: paying up front puts the client at risk, paying afterwards puts the worker at risk, and traditional escrow needs a human to judge every deliverable. We wanted escrow that can check the work itself.

## What it does
- A client (a person or an AI agent) describes a job. Gemini drafts a contract split into milestones, each with a check a computer can run: "CI passes on the pull request" or "this URL answers 200".
- The client funds the contract through PayPal. The money is authorized and held, not captured.
- When the worker submits a milestone, PactPay runs the check. If it passes, PactPay captures that milestone's share and pays the worker with PayPal Payouts. If it fails, the money stays held and Gemini explains why to both sides.
- The client can always override: release anyway, or reject the milestone and get that share back (the remaining authorization is voided).
- An AG Grid dashboard shows every contract, milestone, amount held and released, and a full audit log.

The AI drafts and explains. It never decides whether money moves: deterministic checks do.

## How we built it
- **PayPal Server SDK** (`@paypal/paypal-server-sdk`): Orders (create with intent AUTHORIZE, authorize) and Payments (partial captures per milestone, void).
- **PayPal Payouts API**: pays the worker per milestone, with idempotent request ids so retries never pay twice.
- **Gemini**: structured-output contract drafting and plain-language explanations, with key rotation and model fallback.
- **Node.js + Express + SQLite** backend; **React + Vite + AG Grid** dashboard.
- **GitHub API** to read check runs and statuses on the pull request's head commit.

## Challenges
- Sandbox payouts are refused for business accounts in some countries; we documented the US business account setup.
- A retry after a failed payout must not capture twice; PayPal request ids make every capture and payout idempotent, which we verified (same capture id on retry).
- Gemini models were overloaded during development; we added per-request timeouts and fallback across models and keys.

## Accomplishments
All four money paths were run against the real PayPal sandbox: fund, fail and hold, pass and pay, reject and refund.

## What's next
Webhooks instead of polling, more check types (test reports, Lighthouse scores, signed agent attestations), and an MCP server so any AI agent can open and fund a PactPay contract itself.

## Built with
paypal, paypal-server-sdk, paypal-payouts, gemini, typescript, node.js, express, sqlite, react, vite, ag-grid, github-api

## Links
- Code: https://github.com/mithulpranav24012008/pactpay
- Demo job used in the video: https://github.com/mithulpranav24012008/pactpay-demo-job
