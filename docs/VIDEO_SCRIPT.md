# PactPay demo video (target 2:45, hard limit 3:00)

No copyrighted music (silence or a YouTube Audio Library track). Record at 1080p, browser full screen, zoom 100%.
Upload to YouTube as **Public**.

## Before recording
1. Clean dashboard: old test contracts moved to a backup (ask Claude), servers running (`npm run dev:server`, `npm run dev:web`).
2. Log out of PayPal in the browser. Have the client sandbox login ready (in pactpay-devpost-testing.txt).
3. Open in tabs: the dashboard, and PR #1 and PR #2 of pactpay-demo-job on GitHub.
4. The first check takes up to ~20 s while Gemini writes its verdict: cut that wait in editing.

## Shots
| Time | On screen | Say |
| --- | --- | --- |
| 0:00–0:15 | Empty PactPay dashboard | "AI agents can now hire people and other agents. But who holds the money? Pay first and the client takes the risk; pay after and the worker does." |
| 0:15–0:25 | Hover the empty vault | "PactPay is escrow on PayPal that pays only when the work is proven. The AI never decides whether money moves. Tests do." |
| 0:25–0:50 | Draft a contract → brief is pre-filled → Draft milestones → the two milestones appear (CI on a PR, a URL that must answer) → set worker → Create | "A client, or a client's agent, describes the job. Gemini turns it into milestones a computer can check: CI must pass on a pull request, and a page must answer." |
| 0:50–1:10 | Fund $100 with PayPal → log in as the client → pay → back on the dashboard: "money is now held", vault fills blue | "The client funds it through PayPal. We authorize, not capture, so the $100 is held, not taken." |
| 1:10–1:35 | Paste PR #1 → Submit work → slice turns amber, Gemini's verdict, $100 still held. Quick cut to PR #1 red on GitHub | "The worker's first attempt fails CI. The money stays held, and Gemini explains why to both sides." |
| 1:35–2:00 | Paste PR #2 → Submit again → slice lifts out navy, "$50 paid", "PayPal payout confirmed" | "The fix passes. PactPay captures just that milestone's $50 and pays the worker with PayPal Payouts, and confirms with PayPal that it landed." |
| 2:00–2:25 | Terminal or Claude calling the MCP tools (create_contract → fund_contract link → submit_work), then the dashboard row with the "Agent" tag | "Agents can use it too. Through our MCP server an AI agent posts the job, hands a human the PayPal link, and watches the work get verified and paid. It can never approve a payment itself." |
| 2:25–2:40 | Ledger (AG Grid) and "Where the money went" (AG Charts); point at Override / Ask the arbitrator | "Every dollar is tracked. Miss a deadline and that share goes back automatically. If there's a dispute, the AI arbitrator recommends, and the client decides." |
| 2:40–2:50 | Title card: "PactPay · PayPal Server SDK · Payouts · Gemini · AG Grid · MCP" + github.com/mithulpranav24012008/pactpay | "PactPay: trust for agent commerce, built on PayPal. Open source on GitHub." |
