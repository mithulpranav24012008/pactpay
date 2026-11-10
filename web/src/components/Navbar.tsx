import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, RefreshCw, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';

interface NavbarProps {
  onOpenCreate: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreate, onRefresh, isRefreshing }) => {
  const [health, setHealth] = useState<{ ok: boolean; paypal: boolean; ai: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => setHealth({ ok: false, paypal: false, ai: false }));
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                PactPay
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> PayPal AI Hackathon
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
                AG Grid Matrix
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Escrow & Deliverable Verification for Agentic Commerce</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {health && (
            <div className="hidden md:flex items-center space-x-3 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono">
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${health.paypal ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                <span className="text-slate-400">PayPal {health.paypal ? 'Sandbox' : 'Simulated'}</span>
              </div>
              <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-800">
                <span className={`w-2 h-2 rounded-full ${health.ai ? 'bg-purple-400' : 'bg-slate-500'}`} />
                <span className="text-slate-400">Gemini Arbitrator</span>
              </div>
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition"
            title="Refresh contracts"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={onOpenCreate}
            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-lg shadow-md shadow-blue-500/20 transition flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Draft Contract</span>
          </button>
        </div>
      </div>
    </header>
  );
};
