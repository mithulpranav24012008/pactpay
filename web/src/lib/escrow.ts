// Pure escrow logic for the dashboard: money, milestone poses, the vault layout and the
// sentences the screen leads with. No React, no three.js, so it can be tested on its own.
import type { Contract, Milestone } from '../types';

export const cents = (v: string | number | null | undefined) => Math.round(Number(v ?? 0) * 100);

/** "$1,234.50" with a fixed two decimals; signed when asked ("+$60.00", "−$20.00"). */
export function money(c: number, currency = 'USD', signed = false) {
  const abs = Math.abs(c) / 100;
  const body = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sym = currency === 'USD' ? '$' : `${currency} `;
  const sign = signed ? (c > 0 ? '+' : c < 0 ? '−' : '') : c < 0 ? '−' : '';
  return `${sign}${sym}${body}`;
}

/** Where a milestone's money is, which drives its place in the vault. */
export type Pose = 'unfunded' | 'held' | 'checking' | 'failed' | 'released' | 'returned';

export function poseOf(m: Milestone, c: Contract): Pose {
  if (m.status === 'released') return 'released';
  if (m.status === 'rejected' || m.status === 'refunded') return 'returned';
  if (c.status === 'draft' || c.status === 'awaiting_payment' || c.status === 'cancelled') return 'unfunded';
  if (m.status === 'failed') return 'failed';
  if (m.status === 'submitted' || m.status === 'verifying' || m.status === 'passed') return 'checking';
  return 'held';
}

export const POSE_LABEL: Record<Pose, string> = {
  unfunded: 'Not funded',
  held: 'Held',
  checking: 'Checking',
  failed: 'Check failed, held',
  released: 'Paid out',
  returned: 'Returned to client',
};

/** One ring segment per milestone: angles proportional to amount, a fixed gap between segments. */
export interface Segment {
  id: string;
  start: number; // radians
  end: number;
  pose: Pose;
  amount: number; // cents
}

export function vaultSegments(c: Contract, gap = 0.06): Segment[] {
  const ms = [...c.milestones].sort((a, b) => a.position - b.position);
  const total = ms.reduce((s, m) => s + cents(m.amount), 0);
  if (!ms.length || total <= 0) return [];
  const usable = Math.PI * 2 - gap * ms.length;
  let a = Math.PI / 2; // first milestone starts at 12 o'clock and runs clockwise
  return ms.map((m) => {
    const sweep = (usable * cents(m.amount)) / total;
    const seg = { id: m.id, start: a - sweep, end: a, pose: poseOf(m, c), amount: cents(m.amount) };
    a -= sweep + gap;
    return seg;
  });
}

/** The pose as numbers the 3D scene animates towards. Lift is height, push is outward offset. */
export function poseTarget(p: Pose) {
  switch (p) {
    case 'released': return { lift: 0.48, push: 0.14, opacity: 1 };
    case 'returned': return { lift: 0, push: 0.34, opacity: 0.9 }; // slides out of the vault, back toward the client
    case 'checking': return { lift: 0.18, push: 0, opacity: 1 };
    case 'failed': return { lift: 0.06, push: 0, opacity: 1 };
    case 'unfunded': return { lift: 0, push: 0, opacity: 0.35 };
    default: return { lift: 0, push: 0, opacity: 1 };
  }
}

export interface Book {
  held: number;
  released: number;
  returned: number;
  volume: number;
  funded: number; // contracts holding money now
  agent: number; // contracts opened by an AI agent
}

/** Totals across contracts, summed from each contract's own figures as shown. */
export function book(cs: Contract[]): Book {
  return cs.reduce(
    (b, c) => ({
      held: b.held + cents(c.totals?.held),
      released: b.released + cents(c.totals?.released),
      returned: b.returned + cents(c.totals?.returned),
      volume: b.volume + cents(c.total),
      funded: b.funded + (c.status === 'funded' ? 1 : 0),
      agent: b.agent + (c.created_via === 'mcp' ? 1 : 0),
    }),
    { held: 0, released: 0, returned: 0, volume: 0, funded: 0, agent: 0 },
  );
}

/** "due in 3 h 12 m", "due in 2 d", "overdue by 14 m". */
export function dueText(dueAt: string | null | undefined, now = Date.now()) {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - now;
  const abs = Math.abs(ms);
  const m = Math.floor(abs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const span = d >= 2 ? `${d} d` : h >= 1 ? `${h} h ${m % 60} m` : `${m} m`;
  return ms >= 0 ? `due in ${span}` : `overdue by ${span}`;
}

/** The one fact that most needs attention right now, with the milestone it points at. */
export function finding(cs: Contract[], now = Date.now()): { text: string; contractId?: string; milestoneId?: string } {
  for (const c of cs) for (const m of c.milestones)
    if (c.status === 'funded' && m.status === 'failed')
      return { text: `“${m.title}” failed its check; ${money(cents(m.amount), c.currency)} stays held until it passes or you decide.`, contractId: c.id, milestoneId: m.id };
  const due = cs
    .filter((c) => c.status === 'funded')
    .flatMap((c) => c.milestones.filter((m) => m.due_at && !['released', 'rejected'].includes(m.status)).map((m) => ({ c, m })))
    .sort((a, b) => +new Date(a.m.due_at!) - +new Date(b.m.due_at!))[0];
  if (due)
    return { text: `Next deadline: “${due.m.title}” is ${dueText(due.m.due_at, now)}; if it misses, ${money(cents(due.m.amount), due.c.currency)} goes back to the client.`, contractId: due.c.id, milestoneId: due.m.id };
  const waiting = cs.find((c) => c.status === 'awaiting_payment' || c.status === 'draft');
  if (waiting) return { text: `“${waiting.title}” is not funded yet; nothing is held until the client approves it in PayPal.`, contractId: waiting.id };
  const b = book(cs);
  if (cs.length) return { text: `Nothing needs you: ${money(b.released)} paid out, ${money(b.returned)} returned, ${money(b.held)} held.` };
  return { text: 'No contracts yet. Draft one from a plain-English brief.' };
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  awaiting_payment: 'Awaiting PayPal approval',
  funded: 'Funded',
  completed: 'Settled',
  cancelled: 'Cancelled',
};
