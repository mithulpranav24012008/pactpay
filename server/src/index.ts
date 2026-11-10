import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  db, getContract, getMilestone, listMilestones, logEvent, setContract, setMilestone, type Milestone,
} from "./db.js";
import * as paypal from "./paypal.js";
import { runCheck } from "./verify.js";
import { draftContract, explainCheck, ContractDraft } from "./agent.js";

const app = express();
app.use(cors());
app.use(express.json());

const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:4000";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";
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
  res.json({ ok: true, paypal: paypal.paypalConfigured(), claude: Boolean(process.env.ANTHROPIC_API_KEY) });
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

app.post("/api/contracts", (req, res) => {
  const body = CreateContract.parse(req.body);
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
    const auth = await paypal.authorizeOrder(c.paypal_order_id);
    setContract(id, { authorization_id: auth.authorizationId, status: "funded" });
    logEvent(id, "funded", `${c.total} ${c.currency} held in escrow`, undefined, auth);
  }
  res.redirect(`${WEB_URL}/?contract=${id}&funded=1`);
});

// ---------- milestones ----------
async function release(m: Milestone, reason: string) {
  const c = getContract(m.contract_id)!;
  if (!c.authorization_id) throw new Error("Contract is not funded");
  const others = listMilestones(c.id).filter((x) => x.id !== m.id && !["released", "rejected"].includes(x.status));
  const cap = await paypal.captureMilestone(c.authorization_id, c.currency, m.amount, others.length === 0, m.id);
  logEvent(c.id, "captured", `Captured ${m.amount} ${c.currency} for "${m.title}"`, m.id, cap);
  const payout = await paypal.payoutToWorker({
    milestoneId: m.id, email: c.worker_paypal_email, currency: c.currency, amount: m.amount,
    note: `${c.title} - ${m.title}: ${reason}`,
  });
  setMilestone(m.id, { status: "released", capture_id: cap.captureId, payout_batch_id: payout.batchId });
  logEvent(c.id, "released", `Paid ${m.amount} ${c.currency} to ${c.worker_name}`, m.id, payout);
  await finishIfDone(c.id);
}

async function finishIfDone(contractId: string) {
  const ms = listMilestones(contractId);
  if (!ms.every((m) => ["released", "rejected"].includes(m.status))) return;
  const c = getContract(contractId)!;
  const anyRejected = ms.some((m) => m.status === "rejected");
  const lastWasRejected = ms.reduce((a, b) => (a.updated_at > b.updated_at ? a : b)).status === "rejected";
  if (anyRejected && lastWasRejected && c.authorization_id) {
    // No final capture happened, so the rest of the hold is still open: hand it back.
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
  const { submission } = z.object({ submission: z.string().min(1) }).parse(req.body);
  const m = getMilestone(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  const c = getContract(m.contract_id)!;
  if (c.status !== "funded") return res.status(409).json({ error: "Contract must be funded before work is submitted" });
  if (["released", "rejected"].includes(m.status)) return res.status(409).json({ error: `milestone already ${m.status}` });
  setMilestone(m.id, { submission, status: "submitted" });
  logEvent(c.id, "submitted", `${c.worker_name} submitted "${m.title}"`, m.id, { submission });
  res.json(await verifyMilestone(m.id));
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
  res.json(await verifyMilestone(m.id));
});

// Human override: the client can release despite a failed check, or reject and get that share back.
app.post("/api/milestones/:id/override", async (req, res) => {
  const { action, reason } = z.object({ action: z.enum(["release", "reject"]), reason: z.string().min(3) }).parse(req.body);
  const m = getMilestone(req.params.id);
  if (!m) return res.status(404).json({ error: "not found" });
  if (["released", "rejected"].includes(m.status)) return res.status(409).json({ error: `milestone already ${m.status}` });
  logEvent(m.contract_id, "override", `Client chose to ${action}: ${reason}`, m.id);
  if (action === "release") await release(m, `Approved by client: ${reason}`);
  else {
    setMilestone(m.id, { status: "rejected" });
    await finishIfDone(m.contract_id);
  }
  res.json(contractView(m.contract_id));
});

// ---------- errors ----------
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "invalid request", issues: err.issues });
  if (err instanceof paypal.PayPalError) return res.status(502).json({ error: err.message, op: err.op });
  console.error(err);
  res.status(500).json({ error: (err as Error).message ?? "internal error" });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`PactPay API on http://localhost:${port}`));
