import React, { useMemo, useState, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, RowClickedEvent } from 'ag-grid-community';
import { Contract } from '../types';
import { Table, Search, Download, FileJson, Zap, ShieldCheck, TrendingUp, Layers } from 'lucide-react';

interface ContractMatrixProps {
  contracts: Contract[];
  selectedContractId: string | null;
  onSelectContract: (contract: Contract) => void;
}

export const ContractMatrix: React.FC<ContractMatrixProps> = ({
  contracts,
  selectedContractId,
  onSelectContract,
}) => {
  const gridRef = useRef<AgGridReact<Contract>>(null);
  const [quickFilter, setQuickFilter] = useState('');
  const [filterChip, setFilterChip] = useState<'all' | 'mcp' | 'funded' | 'awaiting' | 'completed'>('all');

  const kpis = useMemo(() => {
    let totalVolume = 0;
    let totalHeld = 0;
    let totalReleased = 0;
    let agentCount = 0;

    for (const c of contracts) {
      totalVolume += parseFloat(c.total || '0');
      totalHeld += parseFloat(c.totals?.held || '0');
      totalReleased += parseFloat(c.totals?.released || '0');
      if (c.created_via === 'mcp') agentCount++;
    }

    return {
      totalVolume: totalVolume.toFixed(2),
      totalHeld: totalHeld.toFixed(2),
      totalReleased: totalReleased.toFixed(2),
      agentPct: contracts.length > 0 ? Math.round((agentCount / contracts.length) * 100) : 0,
      agentCount,
    };
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    if (filterChip === 'mcp') return contracts.filter((c) => c.created_via === 'mcp');
    if (filterChip === 'funded') return contracts.filter((c) => c.status === 'funded');
    if (filterChip === 'awaiting') return contracts.filter((c) => c.status === 'awaiting_payment' || c.status === 'draft');
    if (filterChip === 'completed') return contracts.filter((c) => c.status === 'completed');
    return contracts;
  }, [contracts, filterChip]);

  const columnDefs = useMemo<ColDef<Contract>[]>(() => [
    {
      field: 'id',
      headerName: 'Contract ID',
      width: 140,
      cellRenderer: (params: any) => (
        <span className="font-mono text-xs font-semibold text-slate-400">
          {params.value}
        </span>
      ),
    },
    {
      field: 'title',
      headerName: 'Contract & Deliverables',
      flex: 2,
      cellRenderer: (params: any) => (
        <div className="flex flex-col justify-center h-full py-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-white truncate">{params.value}</span>
            {params.data?.created_via === 'mcp' && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-950/70 border border-purple-500/40 text-purple-300 px-1.5 py-0.5 rounded">
                ⚡ Agent (MCP)
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 truncate">{params.data?.description}</span>
        </div>
      ),
    },
    {
      field: 'client_name',
      headerName: 'Client',
      width: 140,
      cellRenderer: (params: any) => (
        <span className="text-xs font-medium text-slate-300">{params.value}</span>
      ),
    },
    {
      field: 'worker_name',
      headerName: 'Worker',
      width: 140,
      cellRenderer: (params: any) => (
        <div className="flex flex-col justify-center h-full">
          <span className="text-xs font-medium text-slate-300">{params.value}</span>
          <span className="text-[10px] text-slate-500 font-mono truncate">{params.data?.worker_paypal_email}</span>
        </div>
      ),
    },
    {
      field: 'total',
      headerName: 'Total Value',
      width: 130,
      cellRenderer: (params: any) => (
        <span className="font-mono font-bold text-slate-100">
          ${parseFloat(params.value || '0').toFixed(2)} {params.data?.currency}
        </span>
      ),
    },
    {
      headerName: 'Held / Released',
      width: 160,
      cellRenderer: (params: any) => {
        const held = params.data?.totals?.held || '0.00';
        const released = params.data?.totals?.released || '0.00';
        return (
          <div className="flex items-center space-x-1.5 text-xs font-mono">
            <span className="text-cyan-400 font-semibold">${held}</span>
            <span className="text-slate-600">/</span>
            <span className="text-emerald-400 font-semibold">${released}</span>
          </div>
        );
      },
    },
    {
      headerName: 'Escrow Progress',
      width: 140,
      cellRenderer: (params: any) => {
        const total = parseFloat(params.data?.total || '0');
        const released = parseFloat(params.data?.totals?.released || '0');
        const pct = total > 0 ? Math.min(100, Math.round((released / total) * 100)) : 0;
        return (
          <div className="flex flex-col justify-center h-full space-y-1">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-400">Settled</span>
              <span className="text-emerald-400 font-bold">{pct}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      cellRenderer: (params: any) => {
        const statusColors: Record<string, string> = {
          draft: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
          awaiting_payment: 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse',
          funded: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
          completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          cancelled: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        };
        const cls = statusColors[params.value] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
        return (
          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border uppercase tracking-wide ${cls}`}>
            {params.value?.replace('_', ' ')}
          </span>
        );
      },
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  const onRowClicked = (event: RowClickedEvent<Contract>) => {
    if (event.data) {
      onSelectContract(event.data);
    }
  };

  const handleExportCsv = () => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `pactpay-contracts-${new Date().toISOString().slice(0, 10)}.csv`,
    });
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(contracts, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `pactpay-audit-${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-0">
      {/* AG Grid Financial KPI Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 bg-slate-950/60 border-b border-slate-800 text-xs">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Volume</div>
            <div className="text-sm font-bold font-mono text-white">${kpis.totalVolume} USD</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 flex items-center space-x-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Held in Escrow</div>
            <div className="text-sm font-bold font-mono text-cyan-400">${kpis.totalHeld} USD</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paid Out</div>
            <div className="text-sm font-bold font-mono text-emerald-400">${kpis.totalReleased} USD</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 flex items-center space-x-3">
          <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Agentic Escrows</div>
            <div className="text-sm font-bold font-mono text-purple-300">
              {kpis.agentCount} ({kpis.agentPct}%)
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar & Filter Presets */}
      <div className="px-5 py-3 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Preset Filter Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
          <button
            onClick={() => setFilterChip('all')}
            className={`px-2.5 py-1 rounded-lg border transition ${
              filterChip === 'all'
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({contracts.length})
          </button>
          <button
            onClick={() => setFilterChip('mcp')}
            className={`px-2.5 py-1 rounded-lg border transition flex items-center space-x-1 ${
              filterChip === 'mcp'
                ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-purple-300'
            }`}
          >
            <Zap className="w-3 h-3 text-purple-400" />
            <span>Agent (MCP)</span>
          </button>
          <button
            onClick={() => setFilterChip('funded')}
            className={`px-2.5 py-1 rounded-lg border transition ${
              filterChip === 'funded'
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-cyan-300'
            }`}
          >
            Funded
          </button>
          <button
            onClick={() => setFilterChip('awaiting')}
            className={`px-2.5 py-1 rounded-lg border transition ${
              filterChip === 'awaiting'
                ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-amber-300'
            }`}
          >
            Awaiting
          </button>
          <button
            onClick={() => setFilterChip('completed')}
            className={`px-2.5 py-1 rounded-lg border transition ${
              filterChip === 'completed'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-emerald-300'
            }`}
          >
            Completed
          </button>
        </div>
        
        {/* Search & Export Toolbar */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Quick search matrix..."
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans w-40 sm:w-48"
            />
          </div>
          <button
            onClick={handleExportCsv}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded-lg flex items-center space-x-1 transition"
            title="Export as CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={handleExportJson}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded-lg flex items-center space-x-1 transition"
            title="Export audit as JSON"
          >
            <FileJson className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">JSON</span>
          </button>
        </div>
      </div>
      <div className="ag-theme-quartz-dark w-full h-[360px]">
        <AgGridReact<Contract>
          ref={gridRef}
          rowData={filteredContracts}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilter}
          rowSelection="single"
          getRowClass={(params) => (params.data?.id === selectedContractId ? 'bg-cyan-950/40 border-l-4 border-cyan-400' : '')}
          onRowClicked={onRowClicked}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 20, 50]}
          rowHeight={64}
        />
      </div>
    </div>
  );
};
