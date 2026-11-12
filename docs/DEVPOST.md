# Devpost submission (copy each block into the matching field)

## Project name
PactPay

## Tagline (Elevator pitch)
Escrow for people and AI agents: PayPal holds the money, and code releases it only when the work passes a test.

## Built with (tags)
paypal, paypal-server-sdk, paypal-payouts, gemini, typescript, node.js, express, sqlite, react, vite, three.js, react-three-fiber, ag-grid, ag-charts, model-context-protocol, github-api, postman, openapi

## Links
- Code: https://github.com/mithulpranav24012008/pactpay
- Demo job used in the video: https://github.com/mithulpranav24012008/pactpay-demo-job
- Video: (your YouTube link)

---

## Inspiration
AI agents can now write code, buy services and hire freelancers. Money is the missing piece. Paying up front puts the client at risk, paying afterwards puts the worker at risk, and traditional escrow needs a person to judge every delivery, which does not work when the buyer is an AI. We wanted escrow that checks the work itself and pays the moment it is proven.

## What it does
- **Describe the job.** A client (a person, or an AI agent) writes a brief and a budget. Gemini turns it into a contract split into milestones, each with a test a computer can run: "CI passes on the pull request" or "this URL answers 200", with an optional deadline.
- **Fund it with PayPal.** The client approves the payment in PayPal checkout. PactPay only authorizes it: the money is held, not taken.
- **Deliver and get paid.** The worker submits a pull request or a URL. PactPay runs the check. If it passes, PactPay captures exactly that milestone's share and pays the worker with PayPal Payouts, then keeps asking PayPal until the payout is confirmed. If it fails, the money stays held and Gemini explains why in plain words to both sides.
- **Deadlines refund automatically.** A milestone that misses its deadline goes back to the client with no one stepping in.
- **People stay in charge.** The client can release anyway or reject a milestone (its share is returned by voiding the rest of the hold). In a dispute, an AI arbitrator reads the contract, the evidence and both sides and recommends an outcome, but it cannot move money.
- **AI agents can use it directly.** Our MCP server gives any agent (Claude, Cursor and others) tools to draft and create a contract, get the PayPal link for a human to approve, submit work and watch it get paid. An agent can never approve a payment itself.
- **See where every dollar is.** A PayPal-style dashboard with a live 3D escrow vault (each milestone is a ring segment sized by its amount: held sits in the vault, paid lifts out, refunded slides away), an AG Grid ledger with search and CSV/JSON export, AG Charts of where the money went, and a full audit trail.

**The rule that makes it trustworthy: the AI never decides whether money moves. Deterministic checks do.**

## How we built it
- **PayPal Server SDK** (`@paypal/paypal-server-sdk`): Orders (create with intent AUTHORIZE, authorize after approval) and Payments (one partial capture per milestone with `final_capture` on the last, authorization status, void).
- **PayPal Payouts API** pays the worker per milestone; every capture and payout carries a PayPal-Request-Id so retries never charge or pay twice.
- **Gemini** with structured output drafts contracts, explains check results and arbitrates disputes, with key rotation, model fallback and a 45-second budget.
- **GitHub API** reads the check runs on the pull request's head commit, and the PR must be in the repository the contract names.
- **Node.js + Express + SQLite** backend with a background sweep for deadlines and payout confirmation.
- **React + Vite** dashboard with **React Three Fiber** (rendered on demand), **AG Grid** and **AG Charts**; escrow rules live in a tested module separate from the 3D code.
- **MCP server** (Model Context Protocol SDK) for AI agents; **OpenAPI spec and Postman collection** for the API.

## Challenges we ran into
- **Payouts and country rules.** Sandbox payouts are refused from business accounts in some countries; we documented the US business-account setup.
- **A race that could strand money.** If a client rejected one milestone while another was being paid, the leftover hold was never returned. We reproduced it in the sandbox and fixed it by asking PayPal for the authorization's real status before voiding; PayPal now reports the hold as voided.
- **Never paying twice.** A payout can fail after the capture succeeded; retries reuse the capture and only resend the payout.
- **Keeping the check honest.** A worker could have submitted any green pull request on GitHub, or a URL pointing at our own network. Checks are now bound to the contract's repository and to public addresses only.
- **Gemini under load.** Models were overloaded at times; per-request timeouts, fallback across models and keys, and an overall time budget keep the app responsive.

## Accomplishments that we're proud of
- Every money path runs end to end against the real PayPal sandbox: fund, fail and hold, pass and pay, reject and refund, deadline refund, and the reject-during-payment race.
- An AI agent hired a worker and paid them through PactPay with only one human click: approving the payment.
- Three rounds of bug hunting fixed 17 issues; the final pass was clean (typecheck, tests, build, logs, edge-case inputs).

## What we learned
Escrow is mostly about the edges: partial captures, idempotency, expiring holds and races. And an AI is most useful here when it explains and drafts, while plain code decides when money moves.

## What's next for PactPay
PayPal webhooks instead of polling, more check types (test reports, Lighthouse scores, signed agent attestations), partial releases for split decisions, authentication and roles for clients and workers, and a hosted version so any agent can open an escrow over MCP.

---

## Testing instructions (private field for judges)
Paste the contents of `pactpay-devpost-testing.txt` from the Desktop.
