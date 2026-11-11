// AG Charts: where every escrowed dollar went, per contract (held, paid out, returned), drawn to the
// terminal style: ink for paid, accent for held, red for returned, no gridline clutter.
import { useMemo } from 'react';
import { AgCharts } from 'ag-charts-react';
import type { AgChartOptions } from 'ag-charts-community';
import type { Contract } from '../types';
import { cents } from '../lib/escrow';

const short = (s: string) => (s.length > 16 ? `${s.slice(0, 15)}…` : s);

export function Flows({ contracts }: { contracts: Contract[] }) {
  const options = useMemo<AgChartOptions>(() => ({
    background: { visible: false },
    padding: { top: 8, right: 8, bottom: 4, left: 4 },
    data: [...contracts].reverse().map((c) => ({
      contract: short(c.title),
      held: cents(c.totals.held) / 100,
      paid: cents(c.totals.released) / 100,
      returned: cents(c.totals.returned) / 100,
    })),
    series: [
      { type: 'bar', direction: 'horizontal', xKey: 'contract', yKey: 'paid', yName: 'Paid out', stacked: true, fill: '#f2f2f3', strokeWidth: 0 },
      { type: 'bar', direction: 'horizontal', xKey: 'contract', yKey: 'held', yName: 'Held', stacked: true, fill: '#4a8ad6', strokeWidth: 0 },
      { type: 'bar', direction: 'horizontal', xKey: 'contract', yKey: 'returned', yName: 'Returned', stacked: true, fill: '#e5566f', strokeWidth: 0 },
    ],
    axes: {
      x: { type: 'category', position: 'left', label: { color: '#8a8c92', fontSize: 12, fontFamily: 'Public Sans' }, line: { enabled: false } },
      y: {
        type: 'number', position: 'bottom',
        label: { color: '#8a8c92', fontSize: 12, fontFamily: 'Public Sans', formatter: ({ value }: { value: number }) => `$${value}` },
        gridLine: { style: [{ stroke: '#222224', lineDash: [] }] },
      },
    },
    legend: { position: 'top', item: { label: { color: '#bdbdc0', fontSize: 12, fontFamily: 'Public Sans' }, marker: { shape: 'square', size: 8 } } },
  }) as AgChartOptions, [contracts]);

  return (
    <section className="card flows" aria-labelledby="flows-h">
      <header className="card-head">
        <h2 id="flows-h">Where the money went</h2>
        <span className="muted">by contract, USD</span>
      </header>
      <div className="flows-chart" style={{ height: Math.max(180, contracts.length * 34 + 70) }}>
        {contracts.length ? <AgCharts options={options} /> : <p className="muted empty">No contracts yet.</p>}
      </div>
    </section>
  );
}
