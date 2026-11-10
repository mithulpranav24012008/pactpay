import { DatabaseSync } from "node:sqlite";

export const db = new DatabaseSync(process.env.DB_PATH ?? "pactpay.db");

db.exec(`
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  worker_paypal_email TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  total TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  paypal_order_id TEXT,
  authorization_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  amount TEXT NOT NULL,
  check_type TEXT NOT NULL,
  check_config TEXT NOT NULL DEFAULT '{}',
  submission TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  evidence TEXT,
  ai_summary TEXT,
  capture_id TEXT,
  payout_batch_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id TEXT NOT NULL,
  milestone_id TEXT,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Columns added after the first release; ALTER is a no-op error when they already exist.
for (const sql of [
  "ALTER TABLE milestones ADD COLUMN due_at TEXT",
  "ALTER TABLE milestones ADD COLUMN payout_status TEXT",
  "ALTER TABLE contracts ADD COLUMN created_via TEXT NOT NULL DEFAULT 'web'",
]) {
  try { db.exec(sql); } catch { /* column exists */ }
}

export type ContractStatus = "draft" | "awaiting_payment" | "funded" | "completed" | "cancelled";
export type MilestoneStatus =
  | "pending" | "submitted" | "verifying" | "passed" | "failed" | "released" | "rejected";

export interface Contract {
  id: string; title: string; description: string; client_name: string; worker_name: string;
  worker_paypal_email: string; currency: string; total: string; status: ContractStatus;
  paypal_order_id: string | null; authorization_id: string | null; created_at: string;
  created_via: string;
}
export interface Milestone {
  id: string; contract_id: string; position: number; title: string; amount: string;
  check_type: "github_ci" | "http" | "manual"; check_config: string; submission: string | null;
  status: MilestoneStatus; evidence: string | null; ai_summary: string | null;
  capture_id: string | null; payout_batch_id: string | null; updated_at: string;
  due_at: string | null; payout_status: string | null;
}

export function logEvent(contractId: string, kind: string, message: string, milestoneId?: string, data?: unknown) {
  db.prepare("INSERT INTO events (contract_id, milestone_id, kind, message, data) VALUES (?, ?, ?, ?, ?)")
    .run(contractId, milestoneId ?? null, kind, message, data === undefined ? null : JSON.stringify(data));
}

export const getContract = (id: string) =>
  db.prepare("SELECT * FROM contracts WHERE id = ?").get(id) as unknown as Contract | undefined;
export const getMilestone = (id: string) =>
  db.prepare("SELECT * FROM milestones WHERE id = ?").get(id) as unknown as Milestone | undefined;
export const listMilestones = (contractId: string) =>
  db.prepare("SELECT * FROM milestones WHERE contract_id = ? ORDER BY position").all(contractId) as unknown as Milestone[];

export function setContract(id: string, fields: Partial<Contract>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  db.prepare(`UPDATE contracts SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
    .run(...(Object.values(fields) as any[]), id);
}
export function setMilestone(id: string, fields: Partial<Milestone>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  db.prepare(`UPDATE milestones SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .run(...(Object.values(fields) as any[]), id);
}
