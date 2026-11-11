// The selected contract's milestones: what each must prove, where its money is, and the action
// that moves it (submit work, re-check, override, ask the AI arbitrator, confirm the payout).
import { useEffect, useRef, useState } from 'react';
import type { Contract, Milestone } from '../types';
import { cents, dueText, money, poseOf, POSE_LABEL } from '../lib/escrow';
import { api } from '../lib/api';

const CHECK_LABEL = { github_ci: 'CI on a pull request', http: 'Live URL answers', manual: 'Client approves' } as const;

function target(m: Milestone) {
  const c = m.check_config ?? {};
  if (m.check_type === 'github_ci') return c.repo ? `in ${c.repo}` : 'any repository';
  if (m.check_type === 'http') return c.url ? `${c.url} → ${c.expect_status ?? 200}` : 'URL from the worker';
  return '';
}

interface Props {
  contract: Contract;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
  onOverride: (m: Milestone) => void;
  onDispute: (m: Milestone) => void;
  now: number;
}

export function Milestones({ contract, selectedId, hoveredId, onSelect, onHover, onChanged, onError, onOverride, onDispute, now }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const rows = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (selectedId) rows.current[selectedId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try { await fn(); onChanged(); } catch (e) { onError((e as Error).message); } finally { setBusy(null); }
  };

  const funded = contract.status === 'funded';
  const ms = [...contract.milestones].sort((a, b) => a.position - b.position);

  return (
    <ol className="ms-list">
      {ms.map((m) => {
        const pose = poseOf(m, contract);
        const open = funded && !['released', 'rejected'].includes(m.status);
        const due = open ? dueText(m.due_at, now) : null;
        const overdue = due?.startsWith('overdue');
        const value = drafts[m.id] ?? m.submission ?? '';
        const working = busy === m.id || m.status === 'verifying';
        return (
          <li
            key={m.id}
            ref={(el) => { rows.current[m.id] = el; }}
            className={`ms ${m.id === selectedId ? 'is-selected' : ''} ${m.id === hoveredId ? 'is-hovered' : ''}`}
            onMouseEnter={() => onHover(m.id)}
            onMouseLeave={() => onHover(null)}
          >
            <button className="ms-head" onClick={() => onSelect(m.id)} aria-pressed={m.id === selectedId}>
              <span className="ms-title">{m.title}</span>
              <span className="ms-amount num">{money(cents(m.amount), contract.currency)}</span>
              <span className="ms-sub">{CHECK_LABEL[m.check_type]} {target(m)}</span>
              <span className={`pill pill-${pose}`}>{POSE_LABEL[pose]}</span>
            </button>

            {m.capture_id && m.status !== 'released' && (
              <p className="ms-meta"><span className="neg">Captured from the client, but the payout to the worker failed. Retry the payout.</span></p>
            )}
            {(due || m.payout_status) && (
              <p className="ms-meta">
                {due && <span className={overdue ? 'neg' : ''}>{due}{overdue ? ', refund on the next sweep' : ''}</span>}
                {m.payout_status && (
                  <span>
                    PayPal payout {m.payout_status === 'SUCCESS' ? 'confirmed' : m.payout_status.toLowerCase()}
                    {m.payout_status !== 'SUCCESS' && (
                      <button className="link" disabled={working} onClick={() => run(m.id, () => api.payoutStatus(m.id))}>Check again</button>
                    )}
                  </span>
                )}
              </p>
            )}

            {m.ai_summary && <p className="ms-verdict">{m.ai_summary}</p>}

            {open && (
              <form
                className="ms-actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!value.trim()) return onError(m.check_type === 'github_ci' ? 'Paste the pull request URL first.' : 'Paste the URL first.');
                  run(m.id, () => api.submit(m.id, value.trim()));
                }}
              >
                {m.check_type !== 'manual' && !m.capture_id && (
                  <>
                    <label className="sr-only" htmlFor={`sub-${m.id}`}>
                      {m.check_type === 'github_ci' ? 'Pull request URL' : 'Deployed URL'} for {m.title}
                    </label>
                    <input
                      id={`sub-${m.id}`}
                      className="field"
                      value={value}
                      placeholder={m.check_type === 'github_ci' ? 'https://github.com/owner/repo/pull/2' : 'https://their-app.onrender.com/health'}
                      onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                      disabled={working}
                    />
                    <button className="btn btn-primary" disabled={working} type="submit">
                      {working ? 'Checking…' : m.submission ? 'Submit again' : 'Submit work'}
                    </button>
                  </>
                )}
                {m.capture_id && (
                  <button className="btn btn-primary" type="button" disabled={working} onClick={() => run(m.id, () => api.verify(m.id))}>
                    {working ? 'Paying…' : 'Retry payout'}
                  </button>
                )}
                <button className="btn" type="button" disabled={working} onClick={() => onOverride(m)}>Override</button>
                {m.status === 'failed' && (
                  <button className="btn" type="button" disabled={working} onClick={() => onDispute(m)}>Ask the arbitrator</button>
                )}
              </form>
            )}
          </li>
        );
      })}
    </ol>
  );
}
