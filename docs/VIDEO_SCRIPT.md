# PactPay demo video (target 2:45, hard limit 3:00)

No copyrighted music. Record at 1080p. Use the sandbox accounts set up for testing.
Before recording: fresh database (`rm server/pactpay.db`), servers running, logged out of PayPal in the browser.

| Time | Screen | Voice-over |
| --- | --- | --- |
| 0:00-0:15 | Title card: "PactPay: escrow that pays when the work is proven" | "AI agents are starting to hire people and other agents. But who holds the money? Pay first and the client takes the risk. Pay after and the worker does." |
| 0:15-0:30 | Dashboard, empty | "PactPay holds the money in PayPal and releases it milestone by milestone, only when a machine-checkable test passes. The AI never decides whether money moves. Checks do." |
| 0:30-0:55 | Draft modal: paste brief "Implement slugify() in pactpay-demo-job with passing tests, then deploy a status page. Budget $100." Click Draft | "A client, or a client's agent, describes the job. Gemini turns it into a contract: two milestones, each with a check a computer can run, CI on a pull request and a live URL." |
| 0:55-1:20 | Click Fund with PayPal, log in as client, choose card, approve. Back on dashboard: Funded, $100 held | "The client funds it through PayPal. We use the Orders API with intent AUTHORIZE, so the $100 is held, not taken." |
| 1:20-1:50 | Submit PR #1 URL. Status Failed, Gemini explanation, $100 still held. Briefly show PR #1 red on GitHub | "The worker submits a first attempt. CI fails. PactPay holds the money, and Gemini explains exactly why to both sides." |
| 1:50-2:10 | Submit PR #2. Status Released, $60 released, $40 held. Cut to worker's PayPal sandbox activity: +$60 | "The fix passes CI. PactPay captures that milestone's $60 from the hold and pays the worker instantly with PayPal Payouts." |
| 2:10-2:30 | Split screen: Claude (or any MCP agent) calling `create_contract`, `fund_contract`, `submit_work`; dashboard shows the new row with the "Agent (MCP)" badge and "Paid ✓ confirmed by PayPal" | "And it isn't only for people. Through our MCP server, an AI agent can post a job, hand a human the PayPal link, and watch the work get verified and paid. It can never approve a payment itself." |
| 2:30-2:40 | Milestone with "Overdue → Refunded", audit feed with deadline_refund and voided | "Miss a deadline and that share goes back to the client automatically." |
| 2:35-2:50 | Title card: "PayPal Server SDK · Orders · Payments · Payouts · Gemini · AG Grid" + repo URL | "PactPay: trust for agent commerce, built on PayPal. The code is open source on GitHub." |
