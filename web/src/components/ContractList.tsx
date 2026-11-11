// The pinned column: the whole book at the top, then every contract with what it holds.
// Filters and the selected contract are marked by the style's one move: a 1px accent line.
import { useState } from 'react';
import type { Contract } from '../types';
import { book, cents, money, STATUS_LABEL } from '../lib/escrow';

const FILTERS = [
  { id: 'all', label: 'All', test: (_: Contract) => true },
  { id: 'funded', label: 'Held', test: (c: Contract) => c.status === 'funded' },
  { id: 'waiting', label: 'Unfunded', test: (c: Contract) => c.status === 'draft' || c.status === 'awaiting_payment' },
  { id: 'settled', label: 'Settled', test: (c: Contract) => c.status === 'completed' },
  { id: 'agent', label: 'Agents', test: (c: Contract) => c.created_via === 'mcp' },
] as const;

export function ContractList({ contracts, selectedId, onSelect }: { contracts: Contract[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const b = book(contracts);
  const shown = contracts.filter(FILTERS.find((f) => f.id === filter)!.test);
  return (
    <section className="card book" aria-labelledby="book-h">
      <header className="book-head">
        <h2 id="book-h">Held in escrow</h2>
        <p className="book-figure num">{money(b.held)}</p>
        <dl className="book-split">
          <div><dt>Paid out</dt><dd className="num">{money(b.released)}</dd></div>
          <div><dt>Returned</dt><dd className="num">{money(b.returned)}</dd></div>
          <div><dt>Holding money</dt><dd className="num">{b.funded} of {contracts.length}</dd></div>
          <div><dt>Opened by agents</dt><dd className="num">{b.agent}</dd></div>
        </dl>
      </header>
      <div className="tabs" role="tablist" aria-label="Filter contracts">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className="tab" onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <ul className="book-list">
        {shown.map((c) => (
          <li key={c.id}>
            <button className={`book-row ${c.id === selectedId ? 'is-selected' : ''}`} onClick={() => onSelect(c.id)} aria-current={c.id === selectedId}>
              <span className="book-title">
                {c.title}
                {c.created_via === 'mcp' && <span className="tag">Agent</span>}
              </span>
              <span className="book-val num">{money(cents(c.status === 'funded' ? c.totals.held : c.total), c.currency)}</span>
              <span className="book-sub">{c.worker_name} · {STATUS_LABEL[c.status] ?? c.status}</span>
              <span className="book-sub num">
                {c.status === 'funded' ? `held of ${money(cents(c.total), c.currency)}`
                  : c.status === 'completed' ? `${money(cents(c.totals.released), c.currency)} paid` : 'not held yet'}
              </span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="muted empty">Nothing in this view.</li>}
      </ul>
    </section>
  );
}
