import React, { useMemo } from 'react';
import { AgCharts } from 'ag-charts-react';
import { AgChartOptions } from 'ag-charts-community';
import { Contract } from '../types';
import { BarChart3, PieChart } from 'lucide-react';

interface AnalyticsChartsProps {
  contracts: Contract[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ contracts }) => {
  // Chart 1: Escrow Liquidity Distribution by Contract
  const liquidityChartOptions = useMemo<AgChartOptions>(() => {
    const data = contracts.map((c) => ({
      contract: c.title.length > 18 ? `${c.title.slice(0, 16)}...` : c.title,
      held: parseFloat(c.totals?.held || '0'),
      released: parseFloat(c.totals?.released || '0'),
      returned: parseFloat(c.totals?.returned || '0'),
    }));

    return {
      theme: 'ag-default-dark',
      background: { fill: 'transparent' },
      data,
      title: {
        text: 'Escrow Liquidity by Contract ($ USD)',
        color: '#e2e8f0',
        fontSize: 13,
        fontWeight: 'bold',
      },
      series: [
        {
          type: 'bar',
          xKey: 'contract',
          yKey: 'held',
          yName: 'Held in Escrow',
          fill: '#06b6d4',
          stroke: '#0891b2',
        },
        {
          type: 'bar',
          xKey: 'contract',
          yKey: 'released',
          yName: 'Paid Out',
          fill: '#10b981',
          stroke: '#059669',
        },
        {
          type: 'bar',
          xKey: 'contract',
          yKey: 'returned',
          yName: 'Refunded / Voided',
          fill: '#f43f5e',
          stroke: '#e11d48',
        },
      ],
      axes: [
        {
          type: 'category',
          position: 'bottom',
          label: { color: '#94a3b8', fontSize: 10, rotation: -20 },
        },
        {
          type: 'number',
          position: 'left',
          label: {
            color: '#94a3b8',
            fontSize: 10,
            formatter: (params) => `$${params.value}`,
          },
          gridLine: { style: [{ stroke: '#1e293b', lineDash: [3, 3] }] },
        },
      ],
      legend: {
        position: 'top',
        item: {
          label: { color: '#cbd5e1', fontSize: 11 },
          marker: { shape: 'circle', size: 8 },
        },
      },
    };
  }, [contracts]);

  // Chart 2: Milestone Status Distribution
  const statusChartOptions = useMemo<AgChartOptions>(() => {
    let releasedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let refundedCount = 0;

    for (const c of contracts) {
      for (const m of c.milestones || []) {
        if (m.status === 'released') releasedCount++;
        else if (m.status === 'failed' || m.status === 'rejected') failedCount++;
        else if (m.status === 'refunded') refundedCount++;
        else pendingCount++;
      }
    }

    const data = [
      { status: 'Paid & Settled', count: releasedCount, fill: '#10b981' },
      { status: 'Active / Pending', count: pendingCount, fill: '#06b6d4' },
      { status: 'Refunded (Deadline)', count: refundedCount, fill: '#f59e0b' },
      { status: 'Failed / Disputed', count: failedCount, fill: '#f43f5e' },
    ].filter((d) => d.count > 0);

    return {
      theme: 'ag-default-dark',
      background: { fill: 'transparent' },
      data: data.length > 0 ? data : [{ status: 'No Milestones', count: 1, fill: '#334155' }],
      title: {
        text: 'Milestone Settlement Breakdown',
        color: '#e2e8f0',
        fontSize: 13,
        fontWeight: 'bold',
      },
      series: [
        {
          type: 'pie',
          angleKey: 'count',
          legendItemKey: 'status',
          calloutLabelKey: 'status',
          sectorLabelKey: 'count',
          innerRadiusRatio: 0.55,
          fills: data.length > 0 ? data.map((d) => d.fill) : ['#334155'],
          strokes: ['#0f172a'],
          sectorLabel: {
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: 11,
          },
          calloutLabel: {
            color: '#94a3b8',
            fontSize: 10,
          },
        },
      ],
      legend: {
        position: 'bottom',
        item: {
          label: { color: '#cbd5e1', fontSize: 11 },
          marker: { shape: 'circle', size: 8 },
        },
      },
    };
  }, [contracts]);

  if (contracts.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1 */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-800/80 mb-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            AG Charts: Capital Allocation
          </span>
          <span className="text-[10px] bg-cyan-950/70 border border-cyan-700/50 text-cyan-300 px-1.5 py-0.5 rounded ml-auto">
            AG Grid Community
          </span>
        </div>
        <div className="h-64 w-full">
          <AgCharts options={liquidityChartOptions} />
        </div>
      </div>

      {/* Chart 2 */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-800/80 mb-2">
          <PieChart className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            AG Charts: Milestone Settlement
          </span>
          <span className="text-[10px] bg-purple-950/70 border border-purple-700/50 text-purple-300 px-1.5 py-0.5 rounded ml-auto">
            Live Telemetry
          </span>
        </div>
        <div className="h-64 w-full">
          <AgCharts options={statusChartOptions} />
        </div>
      </div>
    </div>
  );
};
