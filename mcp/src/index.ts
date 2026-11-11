#!/usr/bin/env -S npx tsx
// PactPay MCP server: lets any MCP-capable AI agent hire and pay through PactPay escrow.
// It talks to a running PactPay API (PACTPAY_URL, default http://localhost:4000).
// Money never moves on the agent's word alone: a human approves funding in PayPal,
// and payouts happen only when PactPay's deterministic checks pass.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = (process.env.PACTPAY_URL ?? "http://localhost:4000").replace(/\/$/, "");

async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data?.error ?? `PactPay API ${res.status}`);
  return data as T;
}

const ok = (summary: string, data?: unknown) => ({
  content: [{ type: "text" as const, text: data === undefined ? summary : `${summary}\n\n${JSON.stringify(data, null, 2)}` }],
});
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }] });

/** A compact view an agent can reason over without the raw evidence blobs. */
function brief(c: any) {
  return {
    id: c.id, title: c.title, status: c.status, created_via: c.created_via,
    worker: c.worker_name, paid_via: c.payout_rail, total: `${c.total} ${c.currency}`, totals: c.totals,
    milestones: c.milestones.map((m: any) => ({
      id: m.id, title: m.title, amount: m.amount, check: m.check_type, status: m.status,
      due_at: m.due_at, verdict: m.ai_summary, payout_status: m.payout_status,
    })),
  };
}

const Milestone = z.object({
  title: z.string(),
  amount: z.string().describe('Decimal string, e.g. "50.00"'),
  check_type: z.enum(["github_ci", "http", "manual"]),
  check_config: z.object({
    repo: z.string().optional().describe("github_ci: owner/name the pull request must be in"),
    require_merged: z.boolean().optional(),
    url: z.string().optional().describe("http: URL that must answer"),
    expect_status: z.number().optional(),
    expect_text: z.string().optional(),
  }).default({}),
  acceptance: z.string().describe("What must be true for this milestone to pay out"),
  due_at: z.string().optional().describe("Optional deadline, ISO 8601 with offset. Missed deadline = share refunded to the client"),
});

const server = new McpServer({ name: "pactpay", version: "1.0.0" });

server.registerTool("draft_contract", {
  title: "Draft an escrow contract",
  description: "Turn a plain-English job brief and budget into a draft contract with machine-checkable milestones. Nothing is created or charged; review the draft, then call create_contract.",
  inputSchema: { brief: z.string().min(10), budget: z.string().describe('e.g. "100 USD"') },
}, async ({ brief: text, budget }) => {
  try { return ok("Draft ready. Review it, adjust if needed, then call create_contract.", await api("POST", "/api/agent/draft", { brief: text, budget })); }
  catch (e) { return fail(e); }
});

server.registerTool("create_contract", {
  title: "Create an escrow contract",
  description: "Create a PactPay contract between a client and a worker. Amounts must add up to what the client will fund. Returns the contract id.",
  inputSchema: {
    title: z.string(), description: z.string().default(""), currency: z.string().default("USD"),
    client_name: z.string(), worker_name: z.string(),
    payout_rail: z.enum(["paypal", "venmo"]).default("paypal").describe("Pay the worker by PayPal email or by Venmo (US mobile number, USD only)"),
    worker_paypal_email: z.string().email().optional().describe("Required for payout_rail=paypal"),
    worker_venmo_phone: z.string().optional().describe("Required for payout_rail=venmo: worker's US mobile number"),
    milestones: z.array(Milestone).min(1),
  },
}, async (args) => {
  try {
    const c = await api("POST", "/api/contracts", { ...args, created_via: "mcp" });
    return ok(`Created ${c.id} for ${c.total} ${c.currency}. Next: fund_contract (a human approves the payment in PayPal).`, brief(c));
  } catch (e) { return fail(e); }
});

server.registerTool("fund_contract", {
  title: "Get the PayPal funding link",
  description: "Start funding a contract. Returns a PayPal approval link that a human must open and approve; the money is then held in escrow (authorized, not captured). Agents cannot approve payments themselves.",
  inputSchema: { contract_id: z.string() },
}, async ({ contract_id }) => {
  try {
    const r = await api("POST", `/api/contracts/${contract_id}/fund`);
    return ok(`Ask the client to approve the payment here, then check contract_status until status is "funded":\n${r.approveUrl}`, r);
  } catch (e) { return fail(e); }
});

server.registerTool("submit_work", {
  title: "Submit a milestone for verification",
  description: "Submit work for one milestone: a GitHub pull request URL for github_ci checks, or a URL for http checks. PactPay runs the check; if it passes, the milestone's share is captured and paid to the worker via PayPal Payouts. If it fails, the money stays held and the result explains why.",
  inputSchema: { milestone_id: z.string(), submission: z.string().describe("PR URL or deployed URL") },
}, async ({ milestone_id, submission }) => {
  try {
    const r = await api("POST", `/api/milestones/${milestone_id}/submit`, { submission });
    const verdict = r.result.passed ? "PASSED, payment released to the worker" : "FAILED, money stays held";
    return ok(`${verdict}. ${r.result.summary}\n${r.explanation ?? ""}`, brief(r.contract));
  } catch (e) { return fail(e); }
});

server.registerTool("contract_status", {
  title: "Contract status",
  description: "Current state of a contract: funding status, each milestone's status and verdict, deadlines, payout confirmation, and how much is held, released and returned.",
  inputSchema: { contract_id: z.string() },
}, async ({ contract_id }) => {
  try { const c = await api("GET", `/api/contracts/${contract_id}`); return ok(`${c.id} is ${c.status}.`, brief(c)); }
  catch (e) { return fail(e); }
});

server.registerTool("list_contracts", {
  title: "List contracts",
  description: "All PactPay contracts, newest first, with status and money held/released.",
  inputSchema: {},
}, async () => {
  try {
    const cs = await api<any[]>("GET", "/api/contracts");
    return ok(`${cs.length} contract(s).`, cs.map((c) => ({ id: c.id, title: c.title, status: c.status, total: `${c.total} ${c.currency}`, totals: c.totals, created_via: c.created_via })));
  } catch (e) { return fail(e); }
});

await server.connect(new StdioServerTransport());
console.error(`PactPay MCP server ready (API: ${API})`);
