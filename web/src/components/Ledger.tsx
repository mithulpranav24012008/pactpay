// Every milestone across every contract in one AG Grid ledger: where its money is, what it must
// prove, its deadline and its PayPal payout. Quick search, CSV and JSON export.
import { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, RowClickedEvent } from 'ag-grid-community';
import type { Contract } from '../types';
import { cents, money, poseOf, POSE_LABEL, STATUS_LABEL } from '../lib/escrow';

interface Row {
  contractId: string;
  milestoneId: string;
  contract: string;
  milestone: string;
  worker: string;
  via: string;
  check: string;
  amount: number;
  where: string;
  contractStatus: string;
  due: string;
  payout: string;
}

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export function Ledger({ contracts, onOpen }: { contracts: Contract[]; onOpen: (contractId: string, milestoneId: string) => void }) {
  const grid = useRef<AgGridReact<Row>>(null);
  const [q, setQ] = useState('');

  const rows = useMemo<Row[]>(() => contracts.flatMap((c) =>
    [...c.milestones].sort((a, b) => a.position - b.position).map((m) => ({
      contractId: c.id,
      milestoneId: m.id,
      contract: c.title,
      milestone: m.title,
      worker: c.worker_name,
      via: c.created_via === 'mcp' ? 'AI agent (MCP)' : 'Dashboard',
      check: m.check_type === 'github_ci' ? 'CI' : m.check_type === 'http' ? 'URL' : 'Manual',
      amount: cents(m.amount),
      where: POSE_LABEL[poseOf(m, c)],
      contractStatus: STATUS_LABEL[c.status] ?? c.status,
      due: fmtDate(m.due_at),
      payout: m.payout_status ?? '—',
    }))), [contracts]);

  const cols = useMemo<ColDef<Row>[]>(() => [
    { field: 'contract', headerName: 'Contract', flex: 1.4, minWidth: 180 },
    { field: 'milestone', headerName: 'Milestone', flex: 1.2, minWidth: 150 },
    { field: 'worker', headerName: 'Worker', flex: 1, minWidth: 120 },
    { field: 'via', headerName: 'Opened by', width: 140 },
    { field: 'check', headerName: 'Check', width: 92 },
    { field: 'where', headerName: 'Money', width: 170 },
    { field: 'amount', headerName: 'Amount', width: 120, type: 'rightAligned', cellClass: ['num', 'ag-right-aligned-cell'],
      valueFormatter: (p) => money(p.value ?? 0) },
    { field: 'due', headerName: 'Deadline', width: 130 },
    { field: 'payout', headerName: 'PayPal payout', width: 130 },
  ], []);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(contracts, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pactpay-ledger.json' });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="card ledger" aria-labelledby="ledger-h">
      <header className="card-head">
        <h2 id="ledger-h">Ledger</h2>
        <span className="muted num">{rows.length} milestones in {contracts.length} contracts</span>
        <div className="card-tools">
          <label className="sr-only" htmlFor="ledger-q">Search the ledger</label>
          <input id="ledger-q" className="field field-sm" placeholder="Search contracts, workers, money…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-sm" onClick={() => grid.current?.api.exportDataAsCsv({ fileName: 'pactpay-ledger.csv' })}>CSV</button>
          <button className="btn btn-sm" onClick={exportJson}>JSON</button>
        </div>
      </header>
      <div className="ag-theme-quartz pactpay-grid">
        <AgGridReact<Row>
          ref={grid}
          rowData={rows}
          columnDefs={cols}
          quickFilterText={q}
          rowHeight={42}
          headerHeight={38}
          domLayout="autoHeight"
          pagination
          paginationPageSize={8}
          paginationPageSizeSelector={[8, 20, 50]}
          getRowId={(p) => p.data.milestoneId}
          onRowClicked={(e: RowClickedEvent<Row>) => e.data && onOpen(e.data.contractId, e.data.milestoneId)}
        />
      </div>
    </section>
  );
}
