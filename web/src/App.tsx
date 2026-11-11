import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MetricsOverview } from './components/MetricsOverview';
import { ContractMatrix } from './components/ContractMatrix';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ContractDetailView } from './components/ContractDetailView';
import { DraftContractModal } from './components/DraftContractModal';
import { Contract } from './types';
import { CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  useEffect(() => {
    // Check URL parameters for PayPal return callback (?contract=...&funded=1 / cancelled=1 / fund_error=1)
    const params = new URLSearchParams(window.location.search);
    const contractParam = params.get('contract');
    const fundedParam = params.get('funded');
    const cancelledParam = params.get('cancelled');
    const fundErrorParam = params.get('fund_error');

    if (contractParam) {
      setSelectedContractId(contractParam);
      if (fundedParam === '1') {
        setToast({ type: 'success', message: `Contract ${contractParam} successfully funded via PayPal Escrow!` });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (cancelledParam === '1') {
        setToast({ type: 'warning', message: `PayPal funding for contract ${contractParam} was cancelled. Escrow not funded.` });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (fundErrorParam === '1') {
        setToast({ type: 'error', message: `PayPal funding failed for contract ${contractParam}. Please retry.` });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    fetchContracts(false);
    const interval = setInterval(() => fetchContracts(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchContracts = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch('/api/contracts');
      if (res.ok) {
        const data: Contract[] = await res.json();
        setContracts(data);
        if (data.length > 0) {
          setSelectedContractId((prev) => (prev && data.some((c) => c.id === prev) ? prev : data[0].id));
        }
      }
    } catch (e) {
      console.error('Error fetching contracts:', e);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  const selectedContract = contracts.find((c) => c.id === selectedContractId) || contracts[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        onOpenCreate={() => setIsCreateModalOpen(true)}
        onRefresh={() => fetchContracts(false)}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* PayPal Notification Toast Banner */}
        {toast && (
          <div
            className={`border px-4 py-3 rounded-xl flex items-center justify-between shadow-lg transition ${
              toast.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : toast.type === 'warning'
                ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-xs hover:text-white underline ml-4 flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top KPIs */}
        <MetricsOverview contracts={contracts} />

        {/* AG Charts: Live Visual Telemetry */}
        <ErrorBoundary label="Charts">
          <AnalyticsCharts contracts={contracts} />
        </ErrorBoundary>

        {/* AG Grid Contract Matrix */}
        <ContractMatrix
          contracts={contracts}
          selectedContractId={selectedContractId}
          onSelectContract={(c) => setSelectedContractId(c.id)}
        />

        {/* Selected Contract Detail Inspector & Actions */}
        {selectedContract ? (
          <ContractDetailView
            contract={selectedContract}
            onRefresh={() => fetchContracts(false)}
          />
        ) : (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 bg-blue-500/10 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">No Escrow Contracts Found</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                Draft a new autonomous contract with Gemini AI or seed demo contracts to test PayPal Escrow authorization, capture, and payouts.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-2.5 text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl shadow-lg shadow-blue-500/20 transition"
            >
              Draft Contract with AI
            </button>
          </div>
        )}
      </main>

      {/* AI Contract Drafter Modal */}
      <DraftContractModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onContractCreated={(id) => {
          fetchContracts(false);
          setSelectedContractId(id);
        }}
      />
    </div>
  );
};
