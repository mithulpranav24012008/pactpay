// PactPay overview: where every escrowed dollar is, and what needs you next.
// Layout (desktop): 55px rail · 32px pad · 306px book column · 24px gap · fluid detail column.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Contract, EventLog, Milestone } from './types';
import { api, type Health } from './lib/api';
import { cents, finding, money, STATUS_LABEL } from './lib/escrow';
import { ContractList } from './components/ContractList';
import { VaultCard } from './components/Vault';
import { Milestones } from './components/Milestones';
import { Activity } from './components/Activity';
import { Ledger } from './components/Ledger';
import { Flows } from './components/Flows';
import { DisputeDialog, DraftDialog, OverrideDialog } from './components/Dialogs';
import { ErrorBoundary } from './components/ErrorBoundary';

const REPO = 'https://github.com/mithulpranav24012008/pactpay';

function Mark() {
  // The vault seen from above: three segments, one lifted out (paid).
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <path d="M16 4a12 12 0 0 1 11.6 9H22a6 6 0 0 0-6-3.6z" fill="#f2f2f3" transform="translate(1.2 -1.2)" />
      <path d="M27.6 15A12 12 0 0 1 9 26.4l2.9-4.9A6 6 0 0 0 22 15z" fill="#4a8ad6" />
      <path d="M7.4 25.3A12 12 0 0 1 14 4.1V10a6 6 0 0 0-3.7 10.4z" fill="#3a3a3e" />
    </svg>
  );
}

const useReducedMotion = () => {
  const q = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [r, setR] = useState(q?.matches ?? false);
  useEffect(() => {
    if (!q) return;
    const f = () => setR(q.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, [q]);
  return r;
};

export function App() {
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [notice, setNotice] = useState<{ tone: 'pos' | 'neg' | 'warn'; text: string } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [overriding, setOverriding] = useState<{ m: Milestone; action?: 'release' | 'reject' } | null>(null);
  const [disputing, setDisputing] = useState<Milestone | null>(null);
  const [funding, setFunding] = useState(false);
  const [now, setNow] = useState(Date.now());
  const reduced = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const cs = await api.contracts();
      setContracts(cs);
      setLoadError(null);
      setSelected((s) => (s && cs.some((c) => c.id === s) ? s : cs[0]?.id ?? null));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    api.health().then(setHealth).catch(() => setHealth({ ok: false, paypal: false, ai: false }));
    const p = new URLSearchParams(location.search);
    const id = p.get('contract');
    if (id) setSelected(id);
    if (p.get('funded') === '1') setNotice({ tone: 'pos', text: 'PayPal approved the payment. The money is now held in escrow.' });
    if (p.get('cancelled') === '1') setNotice({ tone: 'warn', text: 'Funding was cancelled in PayPal. Nothing was charged.' });
    if (p.get('fund_error') === '1') setNotice({ tone: 'neg', text: 'PayPal could not hold the payment. Nothing was charged; try funding again.' });
    if (id) history.replaceState(null, '', location.pathname);
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  useEffect(() => {
    if (!selected) return setEvents([]);
    api.events(selected).then(setEvents).catch(() => setEvents([]));
  }, [selected, contracts]);

  const contract = contracts?.find((c) => c.id === selected) ?? null;
  const lead = useMemo(() => finding(contracts ?? [], now), [contracts, now]);
  const fail = (text: string) => setNotice({ tone: 'neg', text });

  const fund = async () => {
    if (!contract) return;
    setFunding(true);
    try { location.href = (await api.fund(contract.id)).approveUrl; } catch (e) { fail((e as Error).message); setFunding(false); }
  };

  const open = (contractId: string, milestoneId?: string) => {
    setSelected(contractId);
    setMilestone(milestoneId ?? null);
    document.getElementById('contract')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="shell">
      <nav className="rail" aria-label="PactPay">
        <a className="rail-mark" href="#top" aria-label="PactPay overview"><Mark /></a>
        <a className="rail-link is-active" href="#top" aria-label="Escrow overview" title="Escrow overview">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></svg>
        </a>
        <a className="rail-link" href="#ledger" aria-label="Ledger" title="Ledger">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </a>
        <a className="rail-link" href={`${REPO}/blob/master/docs/openapi.yaml`} target="_blank" rel="noreferrer" aria-label="API reference" title="API reference">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /></svg>
        </a>
        <a className="rail-link" href={`${REPO}#-for-ai-agents-pactpay-mcp-server`} target="_blank" rel="noreferrer" aria-label="Connect an AI agent (MCP)" title="Connect an AI agent (MCP)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="7" width="14" height="11" rx="3" /><path d="M12 3v4M9 12h.01M15 12h.01" /></svg>
        </a>
        <div className="rail-status" aria-label="Connections">
          <span className={`dot ${health?.paypal ? 'on' : ''}`} title={health?.paypal ? 'PayPal sandbox connected' : 'PayPal not configured'} />
          <span className={`dot ${health?.ai ? 'on' : ''}`} title={health?.ai ? 'Gemini connected' : 'Gemini not configured'} />
        </div>
      </nav>

      <main className="canvas" id="top">
        <header className="title-row">
          <div>
            <h1>PactPay escrow</h1>
            <p className="lead">
              {lead.contractId ? <button className="link lead-link" onClick={() => open(lead.contractId!, lead.milestoneId)}>{lead.text}</button> : lead.text}
            </p>
          </div>
          <div className="title-tools">
            <span className="muted conn">PayPal sandbox {health?.paypal ? 'connected' : 'not configured'} · Gemini {health?.ai ? 'connected' : 'off'}</span>
            <button className="btn btn-primary" onClick={() => setDrafting(true)}>Draft a contract</button>
          </div>
        </header>

        {notice && (
          <div className={`notice notice-${notice.tone}`} role="status">
            <span>{notice.text}</span>
            <button className="link" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        )}

        {loadError && !contracts && <div className="notice notice-neg" role="alert">Cannot reach the PactPay API: {loadError}. Start it with npm run dev:server.</div>}
        {!contracts && !loadError && <div className="loading" aria-busy="true">Loading contracts…</div>}

        {contracts && (
          <div className="board">
            <ContractList contracts={contracts} selectedId={selected} onSelect={(id) => open(id)} />

            <div className="detail">
              {contract ? (
                <section className="card contract" id="contract" aria-labelledby="ct-h">
                  <header className="contract-head">
                    <div>
                      <h2 id="ct-h">{contract.title}{contract.created_via === 'mcp' && <span className="tag">Opened by an AI agent</span>}</h2>
                      <p className="muted">
                        {contract.client_name} pays {contract.worker_name} · {STATUS_LABEL[contract.status] ?? contract.status}
                        {' · '}<span className="num">{money(cents(contract.totals.released), contract.currency)}</span> paid,{' '}
                        <span className="num">{money(cents(contract.totals.returned), contract.currency)}</span> returned
                      </p>
                    </div>
                    {(contract.status === 'draft' || contract.status === 'awaiting_payment') && (
                      <button className="btn btn-primary" onClick={fund} disabled={funding}>
                        {funding ? 'Opening PayPal…' : `Fund ${money(cents(contract.total), contract.currency)} with PayPal`}
                      </button>
                    )}
                  </header>
                  <div className="contract-body">
                    <ErrorBoundary label="Vault">
                      <VaultCard contract={contract} selectedId={milestone} hoveredId={hovered}
                        onSelect={setMilestone} onHover={setHovered} reduced={reduced} />
                    </ErrorBoundary>
                    <Milestones
                      contract={contract} selectedId={milestone} hoveredId={hovered} now={now}
                      onSelect={setMilestone} onHover={setHovered} onChanged={load} onError={fail}
                      onOverride={(m) => setOverriding({ m })} onDispute={setDisputing}
                    />
                  </div>
                </section>
              ) : (
                <section className="card contract empty-state" id="contract">
                  <h2>No contract selected</h2>
                  <p className="muted">Draft one from a plain-English brief; Gemini proposes milestones a machine can check.</p>
                  <button className="btn btn-primary" onClick={() => setDrafting(true)}>Draft a contract</button>
                </section>
              )}

              <div className="pair">
                <ErrorBoundary label="Chart"><Flows contracts={contracts} /></ErrorBoundary>
                <Activity events={events} />
              </div>
            </div>

            <div id="ledger" className="ledger-wrap">
              <ErrorBoundary label="Ledger"><Ledger contracts={contracts} onOpen={open} /></ErrorBoundary>
            </div>
          </div>
        )}
      </main>

      <DraftDialog open={drafting} onClose={() => setDrafting(false)} onError={fail}
        onCreated={(c) => { setDrafting(false); load(); open(c.id); setNotice({ tone: 'pos', text: `Created “${c.title}”. Fund it with PayPal to hold the money.` }); }} />
      <OverrideDialog milestone={overriding?.m ?? null} initial={overriding?.action} currency={contract?.currency ?? 'USD'}
        onClose={() => setOverriding(null)} onError={fail} onDone={() => { setOverriding(null); load(); }} />
      <DisputeDialog milestone={disputing} onClose={() => setDisputing(null)} onError={fail}
        onDecide={(a) => { const m = disputing; setDisputing(null); if (m) setOverriding({ m, action: a }); }} />
    </div>
  );
}
