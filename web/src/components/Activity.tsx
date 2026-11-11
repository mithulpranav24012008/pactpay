// The contract's audit trail in the product's own words: every PayPal call, check and decision.
import type { EventLog } from '../types';

const WORD: Record<string, string> = {
  created: 'Drafted', funding_started: 'Funding', funded: 'Funded', submitted: 'Submitted', verified: 'Check passed',
  verification_failed: 'Check failed', captured: 'Captured', released: 'Paid out', payout_status: 'PayPal',
  override: 'Override', voided: 'Hold voided', deadline_refund: 'Deadline', completed: 'Settled',
  dispute_mediated: 'Arbitrator', error: 'Error',
};
const TONE: Record<string, string> = { verification_failed: 'warn', error: 'neg', deadline_refund: 'neg', voided: 'neg', released: 'pos', verified: 'pos' };

const time = (s: string) => {
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export function Activity({ events }: { events: EventLog[] }) {
  return (
    <section className="card activity" aria-labelledby="act-h">
      <header className="card-head">
        <h2 id="act-h">Audit trail</h2>
        <span className="muted num">{events.length} events</span>
      </header>
      <ol className="act-list">
        {events.slice(0, 12).map((e) => (
          <li key={e.id} className={`act act-${TONE[e.kind] ?? 'plain'}`}>
            <span className="act-kind">{WORD[e.kind] ?? e.kind}</span>
            <span className="act-msg">{e.message}</span>
            <time className="act-time num">{time(e.created_at)}</time>
          </li>
        ))}
        {!events.length && <li className="muted empty">No events yet.</li>}
      </ol>
    </section>
  );
}
