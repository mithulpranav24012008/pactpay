// Native <dialog> sheets: draft a contract, override a milestone, ask the AI arbitrator.
// Esc closes, focus returns to the opener, and every field has a visible label.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Contract, DraftMilestone, Milestone } from '../types';
import { api, type DisputeVerdict } from '../lib/api';
import { cents, money } from '../lib/escrow';

function Sheet({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`sheet ${wide ? 'sheet-wide' : ''}`} onClose={onClose} aria-label={title}>
      <header className="sheet-head">
        <h2>{title}</h2>
        <button className="btn btn-sm" onClick={onClose} aria-label="Close">Close</button>
      </header>
      {children}
    </dialog>
  );
}

const BLANK: DraftMilestone = { title: '', amount: '', check_type: 'github_ci', check_config: { repo: '' }, acceptance: '' };
const toLocal = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

export function DraftDialog({ open, onClose, onCreated, onError }: {
  open: boolean; onClose: () => void; onCreated: (c: Contract) => void; onError: (m: string) => void;
}) {
  const [step, setStep] = useState<'brief' | 'edit'>('brief');
  const [brief, setBrief] = useState('Implement slugify(text) in github.com/mithulpranav24012008/pactpay-demo-job with passing CI, then publish its status page at https://github.com/mithulpranav24012008/pactpay-demo-job so it answers 200.');
  const [budget, setBudget] = useState('100');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [client, setClient] = useState('Build Agent');
  const [worker, setWorker] = useState('');
  const [email, setEmail] = useState('');
  const [ms, setMs] = useState<DraftMilestone[]>([{ ...BLANK }]);

  useEffect(() => { if (open) setStep('brief'); }, [open]);

  const total = ms.reduce((s, m) => s + cents(m.amount || 0), 0);
  const set = (i: number, patch: Partial<DraftMilestone>) => setMs((xs) => xs.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const setCfg = (i: number, patch: Record<string, unknown>) => setMs((xs) => xs.map((m, j) => (j === i ? { ...m, check_config: { ...m.check_config, ...patch } } : m)));

  const draft = async () => {
    setBusy(true);
    try {
      const d = await api.draft(brief, `${budget} USD`);
      setTitle(d.title); setDescription(d.description);
      setMs(d.milestones.map((m) => ({ ...m, check_config: m.check_config ?? {} })));
      setStep('edit');
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  };

  const create = async () => {
    const bad = ms.find((m) => !m.title.trim() || !/^\d+(\.\d{1,2})?$/.test(m.amount.trim()) || cents(m.amount) <= 0);
    if (bad) return onError('Every milestone needs a title and a positive amount like 50 or 49.99.');
    setBusy(true);
    try {
      const c = await api.create({
        title, description, currency: 'USD', client_name: client, worker_name: worker, worker_paypal_email: email,
        milestones: ms.map((m) => ({ ...m, amount: m.amount.trim(), due_at: m.due_at || null })),
      });
      onCreated(c);
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} title={step === 'brief' ? 'Draft a contract' : 'Check the contract'} onClose={onClose} wide>
      {step === 'brief' ? (
        <form className="sheet-body" onSubmit={(e) => { e.preventDefault(); draft(); }}>
          <label className="lbl" htmlFor="d-brief">The job, in plain English</label>
          <textarea id="d-brief" className="field area" rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} />
          <label className="lbl" htmlFor="d-budget">Budget in USD</label>
          <input id="d-budget" className="field" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
          <p className="hint">Gemini splits the job into milestones a machine can check. Nothing is created or charged until you confirm.</p>
          <footer className="sheet-foot">
            <button type="button" className="btn" onClick={() => { setMs([{ ...BLANK }]); setStep('edit'); }}>Write it myself</button>
            <button className="btn btn-primary" disabled={busy || brief.trim().length < 10}>{busy ? 'Drafting…' : 'Draft milestones'}</button>
          </footer>
        </form>
      ) : (
        <form className="sheet-body" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <div className="grid2">
            <div><label className="lbl" htmlFor="d-title">Title</label><input id="d-title" className="field" required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><label className="lbl" htmlFor="d-client">Client</label><input id="d-client" className="field" required value={client} onChange={(e) => setClient(e.target.value)} /></div>
            <div><label className="lbl" htmlFor="d-worker">Worker</label><input id="d-worker" className="field" required value={worker} onChange={(e) => setWorker(e.target.value)} /></div>
            <div><label className="lbl" htmlFor="d-email">Worker's PayPal email</label><input id="d-email" type="email" className="field" required placeholder="worker@their-paypal.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <label className="lbl" htmlFor="d-desc">Description</label>
          <textarea id="d-desc" className="field area" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />

          <h3 className="sheet-sub">Milestones <span className="muted num">{money(total)} in total</span></h3>
          {ms.map((m, i) => (
            <fieldset key={i} className="draft-ms">
              <legend className="sr-only">Milestone {i + 1}</legend>
              <div className="draft-row">
                <input aria-label={`Milestone ${i + 1} title`} className="field" placeholder="What gets delivered" value={m.title} onChange={(e) => set(i, { title: e.target.value })} />
                <select aria-label={`Milestone ${i + 1} check`} className="field" value={m.check_type} onChange={(e) => set(i, { check_type: e.target.value as DraftMilestone['check_type'] })}>
                  <option value="github_ci">CI passes on a PR</option>
                  <option value="http">URL answers</option>
                  <option value="manual">Client approves</option>
                </select>
                <input aria-label={`Milestone ${i + 1} amount in USD`} className="field num" inputMode="decimal" placeholder="50.00" value={m.amount} onChange={(e) => set(i, { amount: e.target.value })} />
                <button type="button" className="btn btn-sm" disabled={ms.length === 1} onClick={() => setMs((xs) => xs.filter((_, j) => j !== i))}>Remove</button>
              </div>
              <div className="draft-row">
                {m.check_type === 'github_ci' && (
                  <input aria-label={`Milestone ${i + 1} repository`} className="field" placeholder="Repository the PR must be in: owner/name" value={m.check_config.repo ?? ''} onChange={(e) => setCfg(i, { repo: e.target.value })} />
                )}
                {m.check_type === 'http' && (
                  <input aria-label={`Milestone ${i + 1} URL`} className="field" placeholder="https://… that must answer 200" value={m.check_config.url ?? ''} onChange={(e) => setCfg(i, { url: e.target.value, expect_status: 200 })} />
                )}
                <input aria-label={`Milestone ${i + 1} deadline`} type="datetime-local" className="field" value={toLocal(m.due_at)}
                  onChange={(e) => set(i, { due_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
              </div>
              <input aria-label={`Milestone ${i + 1} acceptance`} className="field" placeholder="Pays out when…" value={m.acceptance} onChange={(e) => set(i, { acceptance: e.target.value })} />
            </fieldset>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setMs((xs) => [...xs, { ...BLANK }])}>Add a milestone</button>
          <footer className="sheet-foot">
            <button type="button" className="btn" onClick={() => setStep('brief')}>Back</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : `Create contract for ${money(total)}`}</button>
          </footer>
        </form>
      )}
    </Sheet>
  );
}

export function OverrideDialog({ milestone, currency, initial, onClose, onDone, onError }: {
  milestone: Milestone | null; currency: string; initial?: 'release' | 'reject'; onClose: () => void; onDone: () => void; onError: (m: string) => void;
}) {
  const [action, setAction] = useState<'release' | 'reject'>('release');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAction(initial ?? 'release'); setReason(''); }, [milestone, initial]);
  if (!milestone) return <Sheet open={false} title="" onClose={onClose}>{null}</Sheet>;
  const captured = !!milestone.capture_id;
  const amt = money(cents(milestone.amount), currency);
  return (
    <Sheet open title={`Override “${milestone.title}”`} onClose={onClose}>
      <form className="sheet-body" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try { await api.override(milestone.id, action, reason); onDone(); } catch (err) { onError((err as Error).message); } finally { setBusy(false); }
      }}>
        <div className="choice" role="radiogroup" aria-label="Decision">
          <label className={action === 'release' ? 'is-on' : ''}>
            <input type="radio" name="act" checked={action === 'release'} onChange={() => setAction('release')} />
            Pay the worker {amt} anyway
          </label>
          <label className={action === 'reject' ? 'is-on' : ''} aria-disabled={captured}>
            <input type="radio" name="act" disabled={captured} checked={action === 'reject'} onChange={() => setAction('reject')} />
            Reject and return {amt} to the client
          </label>
        </div>
        {captured && <p className="hint" id="ov-hint">This milestone's money is already captured, so it can only be paid out.</p>}
        <label className="lbl" htmlFor="ov-reason">Reason (kept in the audit trail)</label>
        <input id="ov-reason" className="field" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        <footer className="sheet-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || reason.trim().length < 3}>{busy ? 'Working…' : action === 'release' ? `Pay ${amt}` : `Return ${amt}`}</button>
        </footer>
      </form>
    </Sheet>
  );
}

const REC: Record<DisputeVerdict['recommendation'], string> = {
  release: 'Release the payment', reject: 'Reject and refund', partial_settlement: 'Split the payment', cure_window: 'Give the worker more time',
};

export function DisputeDialog({ milestone, onClose, onDecide, onError }: {
  milestone: Milestone | null; onClose: () => void; onDecide: (a: 'release' | 'reject') => void; onError: (m: string) => void;
}) {
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<DisputeVerdict | null>(null);
  useEffect(() => { setStatement(''); setV(null); }, [milestone]);
  if (!milestone) return <Sheet open={false} title="" onClose={onClose}>{null}</Sheet>;
  return (
    <Sheet open title={`Ask the arbitrator about “${milestone.title}”`} onClose={onClose}>
      <form className="sheet-body" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try { setV(await api.dispute(milestone.id, statement)); } catch (err) { onError((err as Error).message); } finally { setBusy(false); }
      }}>
        <label className="lbl" htmlFor="dp-st">What is the disagreement?</label>
        <textarea id="dp-st" className="field area" rows={3} value={statement} onChange={(e) => setStatement(e.target.value)}
          placeholder="The tests fail only on punctuation; the rest of the work is done." />
        <p className="hint">Gemini reads the contract, the check evidence and your statement and recommends an outcome. It cannot move money; you decide.</p>
        {v && (
          <div className="verdict" aria-live="polite">
            <p className="verdict-head">{REC[v.recommendation]}{v.recommendation === 'partial_settlement' ? `: ${v.recommended_split_pct}% to the worker` : ''}</p>
            <p>{v.verdict_summary}</p>
            <p className="muted">{v.detailed_analysis}</p>
            <ul>{v.action_plan.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        <footer className="sheet-foot">
          {v && <button type="button" className="btn" onClick={() => onDecide('reject')}>Reject…</button>}
          {v && <button type="button" className="btn" onClick={() => onDecide('release')}>Release…</button>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Weighing the evidence…' : v ? 'Ask again' : 'Get a recommendation'}</button>
        </footer>
      </form>
    </Sheet>
  );
}
