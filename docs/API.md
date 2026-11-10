# PactPay API (server on :4000)

All JSON. Money is a decimal string ("60.00").

## Agent
- `POST /api/agent/draft` `{brief, budget}` -> draft `{title, description, currency, milestones:[{title, amount, check_type, check_config, acceptance}]}`. Show it, let the user edit, then create.

## Contracts
- `POST /api/contracts` draft + `{client_name, worker_name, worker_paypal_email}` -> Contract
- `GET /api/contracts` -> Contract[]
- `GET /api/contracts/:id` -> Contract
- `GET /api/contracts/:id/events`, `GET /api/events` -> activity log (newest first)
- `POST /api/contracts/:id/fund` -> `{orderId, approveUrl}`. Send the browser to `approveUrl`. After approval PayPal returns to the server, which holds the funds and redirects to `WEB_URL/?contract=<id>&funded=1`.

Contract: `{id, title, description, client_name, worker_name, worker_paypal_email, currency, total, status, paypal_order_id, authorization_id, created_at, totals:{released, held, returned}, milestones: Milestone[]}`
Contract status: `draft -> awaiting_payment -> funded -> completed`

## Milestones
- `POST /api/milestones/:id/submit` `{submission}` (a PR URL for `github_ci`, a URL for `http`) -> runs the check right away -> `{result:{passed, summary, evidence}, explanation, contract}`
- `POST /api/milestones/:id/verify` -> runs the check again (e.g. CI was still running)
- `POST /api/milestones/:id/override` `{action: "release"|"reject", reason}` -> Contract (client's human override)

Milestone: `{id, contract_id, position, title, amount, check_type: github_ci|http|manual, check_config, submission, status, evidence, ai_summary, capture_id, payout_batch_id, updated_at}`
Milestone status: `pending -> submitted -> verifying -> passed -> released`, or `failed` (money stays held; resubmit or override), or `rejected` (that share goes back to the client).

## Health
- `GET /api/health` -> `{ok, paypal, claude}` (whether keys are configured)
