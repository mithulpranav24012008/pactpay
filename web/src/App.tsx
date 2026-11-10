import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MetricsOverview } from './components/MetricsOverview';
import { ContractMatrix } from './components/ContractMatrix';
import { ContractDetailView } from './components/ContractDetailView';
import { DraftContractModal } from './components/DraftContractModal';
import { Contract } from './types';
import { CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fundedToast, setFundedToast] = useState<string | null>(null);

  useEffect(() => {
    // Check URL parameters for PayPal return callback (?contract=...&funded=1)
    const params = new URLSearchParams(window.location.search);
    const contractParam = params.get('contract');
    const fundedParam = params.get('funded');

    if (contractParam) {
      setSelectedContractId(contractParam);
      if (fundedParam === '1') {
        setFundedToast(`Contract ${contractParam} successfully funded via PayPal!`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    fetchContracts();
    const interval = setInterval(fetchContracts, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchContracts = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/contracts');
      if (res.ok) {
        const data: Contract[] = await res.json();
        setContracts(data);
        if (data.length > 0 && !selectedContractId) {
          setSelectedContractId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching contracts:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const selectedContract = contracts.find((c) => c.id === selectedContractId) || contracts[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        onOpenCreate={() => setIsCreateModalOpen(true)}
        onRefresh={fetchContracts}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* PayPal Funded Toast Banner */}
        {fundedToast && (
          <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{fundedToast}</span>
            </div>
            <button
              onClick={() => setFundedToast(null)}
              className="text-xs text-emerald-400 hover:text-white underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top KPIs */}
        <MetricsOverview contracts={contracts} />

        {/* AG Grid Contract Matrix */}
        <ContractMatrix
          contracts={contracts}
          selectedContractId={selectedContractId}
          onSelectContract={(c) => setSelectedContractId(c.id)}
        />

        {/* Selected Contract Detail Inspector & Actions */}
        {selectedContract && (
          <ContractDetailView
            contract={selectedContract}
            onRefresh={fetchContracts}
          />
        )}
      </main>

      {/* AI Contract Drafter Modal */}
      <DraftContractModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onContractCreated={(id) => {
          fetchContracts();
          setSelectedContractId(id);
        }}
      />
    </div>
  );
};
