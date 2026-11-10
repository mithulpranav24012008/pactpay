import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  db, getContract, getMilestone, listMilestones, logEvent, setContract, setMilestone, type Milestone,
} from "./db.js";
import * as paypal from "./paypal.js";
import { runCheck } from "./verify.js";
import { draftContract, explainCheck, mediateDispute, ContractDraft, aiConfigured } from "./agent.js";

const app = express();
app.use(cors());
app.use(express.json());

const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:4000";
// In production the API also serves the built dashboard, so both live on PUBLIC_URL.
const WEB_DIST = fileURLToPath(new URL("../../web/dist", import.meta.url));
const SERVE_WEB = existsSync(WEB_DIST) && process.env.NODE_ENV === "production";
const WEB_URL = process.env.WEB_URL ?? (SERVE_WEB ? PUBLIC_URL : "http://localhost:5173");
const cents = (v: string) => Math.round(Number(v) * 100);
const money = (c: number) => (c / 100).toFixed(2);

function contractView(id: string) {
  const c = getContract(id);
  if (!c) return undefined;
  const milestones = listMilestones(id).map((m) => ({
    ...m,
    check_config: JSON.parse(m.check_config),
    evidence: m.evidence ? JSON.parse(m.evidence) : null,
  }));
  const released = milestones.filter((m) => m.status === "released").reduce((s, m) => s + cents(m.amount), 0);
  const returned = milestones.filter((m) => m.status === "rejected").reduce((s, m) => s + cents(m.amount), 0);
  const held = c.authorization_id && c.status === "funded" ? cents(c.total) - released - returned : 0;
  return { ...c, milestones, totals: { released: money(released), held: money(held), returned: money(returned) } };
}

// ---------- health ----------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, paypal: paypal.paypalConfigured(), ai: aiConfigured(), claude: aiConfigured() });
});

// ---------- agent: plain-English brief -> draft contract ----------
app.post("/api/agent/draft", async (req, res) => {
  const { brief, budget } = z.object({ brief: z.string().min(10), budget: z.string() }).parse(req.body);
  res.json(await draftContract(brief, budget));
});

// ---------- contracts ----------
const CreateContract = ContractDraft.extend({
  client_name: z.string(),
  worker_name: z.string(),
  worker_paypal_email: z.string().email(),
});

const AMOUNT = /^\d+(\.\d{1,2})?$/;

app.post("/api/contracts", (req, res) => {
  const body = CreateContract.parse(req.body);
  const bad = body.milestones.find((m) => !AMOUNT.test(m.amount.trim()) || cents(m.amount) <= 0);
  if (bad) return res.status(400).json({ error: `Milestone "${bad.title}" needs a positive amount like 50 or 49.99 (got "${bad.amount}")` });
  const id = `ct_${randomUUID().slice(0, 8)}`;
  const total = body.milestones.reduce((s, m) => s + cents(m.amount), 0);
  db.prepare(`INSERT INTO contracts (id, title, description, client_name, worker_name, worker_paypal_email, currency, total)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, body.title, body.description, body.client_name, body.worker_name, body.worker_paypal_email, body.currency || "USD", money(total));
  body.milestones.forEach((m, i) => {
    db.prepare(`INSERT INTO milestones (id, contract_id, position, title, amount, check_type, check_config)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(`ms_${randomUUID().slice(0, 8)}`, id, i + 1, m.title, money(cents(m.amount)), m.check_type,
        JSON.stringify({ ...m.check_config, acceptance: m.acceptance }));
  });
  logEvent(id, "created", `Contract drafted: ${body.milestones.length} milestones, ${money(total)} ${body.currency || "USD"}`);
  res.status(201).json(contractView(id));
});

app.get("/api/contracts", (_req, res) => {
  const ids = db.prepare("SELECT id FROM contracts ORDER BY created_at DESC").all() as { id: string }[];
  res.json(ids.map(({ id }) => contractView(id)));
});

app.get("/api/contracts/:id", (req, res) => {
  const view = contractView(req.params.id);
  view ? res.json(view) : res.status(404).json({ error: "not found" });
});

app.get("/api/contracts/:id/events", (req, res) => {
  res.json(db.prepare("SELECT * FROM events WHERE contract_id = ? ORDER BY id DESC").all(req.params.id));
});

app.get("/api/events", (_req, res) => {
  res.json(db.prepare("SELECT * FROM events ORDER BY id DESC LIMIT 200").all());
});

// ---------- funding: client approves in PayPal, funds are authorized (held) ----------
app.post("/api/contracts/:id/fund", async (req, res) => {
  const c = getContract(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  if (c.status !== "draft" && c.status !== "awaiting_payment") return res.status(409).json({ error: `contract is ${c.status}` });
  const { orderId, approveUrl } = await paypal.createEscrowOrder({
    contractId: c.id, description: c.title, currency: c.currency, total: c.total,
    returnUrl: `${PUBLIC_URL}/api/paypal/return?contract=${c.id}`,
    cancelUrl: `${WEB_URL}/?contract=${c.id}&cancelled=1`,
  });
  setContract(c.id, { paypal_order_id: orderId, status: "awaiting_payment" });
  logEvent(c.id, "funding_started", `Waiting for the client to approve ${c.total} ${c.currency} in PayPal`, undefined, { orderId });
  res.json({ orderId, approveUrl });
});

app.get("/api/paypal/return", async (req, res) => {
  const id = String(req.query.contract ?? "");
  const c = getContract(id);
  if (!c?.paypal_order_id) return res.status(404).send("Unknown contract");
  if (!c.authorization_id) {
    try {
      const auth = await paypal.authorizeOrder(c.paypal_order_id);
      setContract(id, { authorization_id: auth.authorizationId, status: "funded" });
      logEvent(id, "funded", `${c.total} ${c.currency} held in escrow`, undefined, auth);
    } catch (e) {
      logEvent(id, "error", `Funding did not complete: ${(e as Error).message}`);
      return res.redirect(`${WEB_URL}/?contract=${id}&fund_error=1`);
    }
  }
  res.redirect(`${WEB_URL}/?contract=${id}&funded=1`);
});

// ---------- milestones ----------
// One money operation per milestone at a time (double clicks, two tabs).
const busy = new Set<string>();
async function exclusive<T>(id: string, res: express.Response, fn: () => Promise<T>) {
  if (busy.has(id)) return void res.status(409).json({ error: "This milestone is already being processed" });
  busy.add(id);
  try {
    res.json(await fn());
  } finally {
    busy.delete(id);
  }
}

async function release(m: Milestone, reason: string) {
  const c = getContract(m.contract_id)!;
  if (!c.authorization_id) throw new Error("Contract is not funded");
  let captureId = m.capture_id;
  if (!captureId) {
    const others = listMilestones(c.id).filter((x) => x.id !== m.id && !["released", "rejected"].includes(x.status));
    const cap = await paypal.captureMilestone(c.authorization_id, c.currency, m.amount, others.length === 0, m.id);
    captureId = cap.captureId;
    setMilestone(m.id, { capture_id: captureId }); // kept even if the payout below fails; a retry only re-sends the payout
    logEvent(c.id, "captured", `Captured ${m.amount} ${c.currency} for "${m.title}"`, m.id, cap);
  }
  const payout = await paypal.payoutToWorker({
    milestoneId: m.id, email: c.worker_paypal_email, currency: c.currency, amount: m.amount,
    note: `${c.title} - ${m.title}: ${reason}`,
  });
  setMilestone(m.id, { status: "released", capture_id: captureId, payout_batch_id: payout.batchId });
  logEvent(c.id, "released", `Paid ${m.amount} ${c.currency} to ${c.worker_name}`, m.id, payout);
  await finishIfDone(c.id, false);
}

// settledByReject: the milestone that closed the contract was rejected. In that case no capture
// carried final_capture=true, so whatever is still authorized must be voided back to the client.
async function finishIfDone(contractId: string, settledByReject: boolean) {
  const ms = listMilestones(contractId);
  if (!ms.every((m) => ["released", "rejected"].includes(m.status))) return;
  const c = getContract(contractId)!;
  if (settledByReject && c.authorization_id) {
    try {
      await paypal.voidAuthorization(c.authorization_id);
      logEvent(contractId, "voided", "Remaining held funds released back to the client");
    } catch (e) {
      logEvent(contractId, "error", `Could not void the remaining hold: ${(e as Error).message}`);
    }
  }
  setContract(contractId, { status: "completed" });
  logEvent(contractId, "completed", "All milestones settled");
}

app.post("/api/milestones/:id/submit", async (req, res) => {
  const { submission } = z.object({ submission: z.string().trim().min(1) }).parse(req.body);
  const m = getMilestone(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  const c = getContract(m.contract_id)!;
  if (c.status !== "funded") return res.status(409).json({ error: "Contract must be funded before work is submitted" });
  if (["released", "rejected"].includes(m.status)) return res.status(409).json({ error: `milestone already ${m.status}` });
  if (m.capture_id) return res.status(409).json({ error: "This milestone already passed and its money is captured; use retry to resend the payout" });
  await exclusive(m.id, res, async () => {
    setMilestone(m.id, { submission, status: "submitted" });
    logEvent(c.id, "submitted", `${c.worker_name} submitted "${m.title}"`, m.id, { submission });
    return verifyMilestone(m.id);
  });
});

async function verifyMilestone(id: string) {
  const m = getMilestone(id)!;
  setMilestone(id, { status: "verifying" });
  const result = await runCheck(m.check_type, m.check_config, m.submission ?? "");
  const explanation = await explainCheck(m.title, result.passed, result.summary, result.evidence);
  setMilestone(id, {
    status: result.passed ? "passed" : "failed",
    evidence: JSON.stringify(result.evidence),
    ai_summary: explanation,
  });
  logEvent(m.contract_id, result.passed ? "verified" : "verification_failed", result.summary, id, { explanation });
  if (result.passed) {
    try {
      await release(getMilestone(id)!, result.summary);
    } catch (e) {
      logEvent(m.contract_id, "error", `Release failed: ${(e as Error).message}`, id);
      setMilestone(id, { status: "passed" });
      throw e;
    }
  }
  return { result, explanation, contract: contractView(m.contract_id) };
}

app.post("/api/milestones/:id/verify", async (req, res) => {
  const m = getMilestone(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  if (!m.submission) return res.status(409).json({ error: "nothing submitted yet" });
  if (["released", "rejected"].includes(m.status)) return res.status(409).json({ error: `milestone already ${m.status}` });
  await exclusive(m.id, res, async () => {
    // Money already captured (the payout failed last time): don't re-judge the work, just pay.
    if (m.capture_id) {
      await release(m, "Retrying payout for a milestone that already passed");
      return { result: { passed: true, summary: "Payout retried", evidence: null }, explanation: m.ai_summary, contract: contractView(m.contract_id) };
    }
    return verifyMilestone(m.id);
  });
});

// Human override: the client can release despite a failed check, or reject and get that share back.
app.post("/api/milestones/:id/override", async (req, res) => {
  const { action, reason } = z.object({ action: z.enum(["release", "reject"]), reason: z.string().min(3) }).parse(req.body);
  const m = getMilestone(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  if (["released", "rejected"].includes(m.status)) return res.status(409).json({ error: `milestone already ${m.status}` });
  if (getContract(m.contract_id)!.status !== "funded") return res.status(409).json({ error: "Contract is not funded" });
  if (action === "reject" && m.capture_id)
    return res.status(409).json({ error: "This milestone's money is already captured, so it can't be refunded by rejecting; release it instead" });
  await exclusive(m.id, res, async () => {
    logEvent(m.contract_id, "override", `Client chose to ${action}: ${reason}`, m.id);
    if (action === "release") await release(m, `Approved by client: ${reason}`);
    else {
      setMilestone(m.id, { status: "rejected" });
      await finishIfDone(m.contract_id, true);
    }
    return contractView(m.contract_id);
  });
});

// Autonomous AI Dispute Mediation: evaluates evidence and suggests fair settlement
app.post("/api/milestones/:id/dispute", async (req, res) => {
  const { statement } = z.object({ statement: z.string().default("") }).parse(req.body);
  const m = getMilestone(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  const c = getContract(m.contract_id);
  if (!c) return res.status(404).json({ error: "contract not found" });

  let evidence: unknown = null;
  try {
    evidence = m.evidence ? JSON.parse(m.evidence) : null;
  } catch {
    evidence = m.evidence;
  }

  let cfg: any = {};
  try {
    cfg = m.check_config ? JSON.parse(m.check_config) : {};
  } catch {
    cfg = {};
  }

  try {
    const recommendation = await mediateDispute({
      contractTitle: c.title,
      contractDescription: c.description,
      milestoneTitle: m.title,
      milestoneAmount: m.amount,
      acceptance: cfg.acceptance || "Automated check pass",
      evidence,
      disputeStatement: statement,
    });

    logEvent(c.id, "dispute_mediated", `AI Arbitrator issued verdict for "${m.title}": ${recommendation.verdict_summary}`, m.id, recommendation);
    res.json({ ...recommendation, milestone_id: m.id });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Confirmed PayPal Payout Status: query live status from PayPal Sandbox
app.get("/api/milestones/:id/payout-status", async (req, res) => {
  const m = getMilestone(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  if (!m.payout_batch_id) return res.status(404).json({ error: "No payout batch ID for this milestone" });

  try {
    const batch = await paypal.getPayoutBatch(m.payout_batch_id);
    const item = batch.items?.[0];
    res.json({
      batch_id: batch.batch_header.payout_batch_id,
      batch_status: batch.batch_header.batch_status,
      time_created: batch.batch_header.time_created,
      time_completed: batch.batch_header.time_completed,
      transaction_status: item?.transaction_status || batch.batch_header.batch_status,
      fee: item?.payout_item_fee?.value || "0.00",
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- dashboard (production) ----------
if (SERVE_WEB) {
  app.use(express.static(WEB_DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(`${WEB_DIST}/index.html`));
}

// ---------- errors ----------
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "invalid request", issues: err.issues });
  if (err instanceof paypal.PayPalError) return res.status(502).json({ error: err.message, op: err.op });
  console.error(err);
  res.status(500).json({ error: (err as Error).message ?? "internal error" });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`PactPay API on http://localhost:${port}`));
