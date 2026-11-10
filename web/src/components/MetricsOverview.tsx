import React from 'react';
import { Lock, ArrowUpRight, Shield, Layers } from 'lucide-react';
import { Contract } from '../types';

interface MetricsOverviewProps {
  contracts: Contract[];
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ contracts }) => {
  const totalHeld = contracts.reduce((acc, c) => acc + (parseFloat(c.totals?.held || '0') || 0), 0);
  const totalReleased = contracts.reduce((acc, c) => acc + (parseFloat(c.totals?.released || '0') || 0), 0);
  const activeContracts = contracts.filter(c => c.status === 'funded').length;
  const completedContracts = contracts.filter(c => c.status === 'completed').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700/80 transition">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>Funds In Escrow</span>
          <Lock className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-cyan-400 font-mono">
          ${totalHeld.toFixed(2)} <span className="text-xs text-slate-500 font-sans">USD</span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Held via PayPal Authorizations
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700/80 transition">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>Disbursed via Payouts</span>
          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-emerald-400 font-mono">
          ${totalReleased.toFixed(2)} <span className="text-xs text-slate-500 font-sans">USD</span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Automated milestone releases
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700/80 transition">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>Active Escrow Jobs</span>
          <Shield className="w-4 h-4 text-blue-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-blue-400 font-mono">
          {activeContracts} <span className="text-xs text-slate-500 font-sans">/ {contracts.length}</span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Funded & awaiting deliverables
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700/80 transition">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>Completed Contracts</span>
          <Layers className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-indigo-400 font-mono">
          {completedContracts}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          100% verified & settled
        </div>
      </div>
    </div>
  );
};
