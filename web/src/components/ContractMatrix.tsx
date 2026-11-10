import React, { useMemo, useState, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, RowClickedEvent } from 'ag-grid-community';
import { Contract } from '../types';
import { Table, Search, Download } from 'lucide-react';

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

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="px-5 py-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Table className="w-4 h-4 text-cyan-400" />
          <h2 className="font-bold text-white text-sm tracking-tight">Active Contracts Matrix</h2>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
            {contracts.length}
          </span>
        </div>
        
        {/* Search & Export Toolbar */}
        <div className="flex items-center space-x-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Search contracts..."
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans w-44 sm:w-56"
            />
          </div>
          <button
            onClick={handleExportCsv}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded-lg flex items-center space-x-1.5 transition"
            title="Export grid data as CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>
      <div className="ag-theme-quartz-dark w-full h-[360px]">
        <AgGridReact<Contract>
          ref={gridRef}
          rowData={contracts}
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
