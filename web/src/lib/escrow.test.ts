import { test } from 'node:test';
import assert from 'node:assert/strict';
import { book, dueText, finding, money, poseOf, vaultSegments } from './escrow.ts';
import type { Contract, Milestone } from '../types.ts';

const ms = (over: Partial<Milestone>): Milestone => ({
  id: 'ms_1', contract_id: 'ct_1', position: 1, title: 'Slugify PR', amount: '60.00', check_type: 'github_ci',
  check_config: {}, submission: null, status: 'pending', evidence: null, ai_summary: null, capture_id: null,
  payout_batch_id: null, updated_at: '', ...over,
});
const ct = (over: Partial<Contract>): Contract => ({
  id: 'ct_1', title: 'Slugify + status page', description: '', client_name: 'Build Agent', worker_name: 'Sam',
  worker_paypal_email: 'sam@sandbox-worker.test', currency: 'USD', total: '100.00', status: 'funded', paypal_order_id: null,
  authorization_id: 'A', created_at: '', totals: { held: '100.00', released: '0.00', returned: '0.00' },
  milestones: [ms({}), ms({ id: 'ms_2', position: 2, title: 'Status page', amount: '40.00', check_type: 'http' })], ...over,
});

test('money formats with separators, two decimals and an optional sign', () => {
  assert.equal(money(123450), '$1,234.50');
  assert.equal(money(6000, 'USD', true), '+$60.00');
  assert.equal(money(-2000, 'USD', true), '−$20.00');
  assert.equal(money(0, 'USD', true), '$0.00');
});

test('segments are proportional to amounts and cover the ring minus the gaps', () => {
  const s = vaultSegments(ct({}), 0.1);
  const sweep = s.map((x) => x.end - x.start);
  assert.ok(Math.abs(sweep[0] / sweep[1] - 60 / 40) < 1e-9);
  assert.ok(Math.abs(sweep[0] + sweep[1] + 0.2 - Math.PI * 2) < 1e-9);
  assert.ok(Math.abs(s[0].end - Math.PI / 2) < 1e-9);
});

test('pose follows where the money is', () => {
  const c = ct({});
  assert.equal(poseOf(ms({ status: 'released' }), c), 'released');
  assert.equal(poseOf(ms({ status: 'rejected' }), c), 'returned');
  assert.equal(poseOf(ms({ status: 'failed' }), c), 'failed');
  assert.equal(poseOf(ms({}), ct({ status: 'awaiting_payment' })), 'unfunded');
  assert.equal(poseOf(ms({ status: 'verifying' }), c), 'checking');
});

test('book sums the contracts as shown', () => {
  const b = book([ct({}), ct({ id: 'ct_2', status: 'completed', created_via: 'mcp', totals: { held: '0.00', released: '12.00', returned: '8.00' }, total: '20.00' })]);
  assert.deepEqual(b, { held: 10000, released: 1200, returned: 800, volume: 12000, funded: 1, agent: 1 });
  assert.equal(b.held + b.released + b.returned, b.volume);
});

test('due text reads both ways', () => {
  const now = Date.parse('2026-11-11T10:00:00Z');
  assert.equal(dueText('2026-11-11T13:12:00Z', now), 'due in 3 h 12 m');
  assert.equal(dueText('2026-11-14T10:00:00Z', now), 'due in 3 d');
  assert.equal(dueText('2026-11-11T09:46:00Z', now), 'overdue by 14 m');
});

test('finding leads with a failed check before deadlines', () => {
  const c = ct({ milestones: [ms({ status: 'failed' }), ms({ id: 'ms_2', position: 2, amount: '40.00', due_at: '2026-11-11T11:00:00Z' })] });
  const f = finding([c], Date.parse('2026-11-11T10:00:00Z'));
  assert.equal(f.milestoneId, 'ms_1');
  assert.match(f.text, /failed its check; \$60\.00 stays held/);
});
