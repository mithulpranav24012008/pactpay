import React, { useState } from 'react';
import { X, Sparkles, Plus, Trash2, ArrowRight, Bot, DollarSign } from 'lucide-react';
import { DraftContractResponse, DraftMilestone } from '../types';

interface DraftContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContractCreated: (contractId: string) => void;
}

export const DraftContractModal: React.FC<DraftContractModalProps> = ({
  isOpen,
  onClose,
  onContractCreated,
}) => {
  const [step, setStep] = useState<'brief' | 'review'>('brief');
  const [brief, setBrief] = useState(
    'Build and test a high-performance PayPal payment service. Milestone 1: Deliver backend API with passing GitHub CI tests. Milestone 2: Expose a live HTTP health endpoint that returns 200 OK.'
  );
  const [budget, setBudget] = useState('100.00');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('Client Agent (Autonomous)');
  const [workerName, setWorkerName] = useState('Dev Agent (Freelancer)');
  const [workerEmail, setWorkerEmail] = useState('worker-sandbox@example.com');
  const [milestones, setMilestones] = useState<DraftMilestone[]>([]);

  if (!isOpen) return null;

  const handleDraftWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDrafting(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, budget }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to draft contract');
      }
      const data: DraftContractResponse = await res.json();
      setTitle(data.title);
      setDescription(data.description);
      setMilestones(data.milestones || []);
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Error drafting contract');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleUpdateMilestone = (index: number, field: keyof DraftMilestone, value: any) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const handleUpdateCheckConfig = (index: number, key: string, value: any) => {
    const updated = [...milestones];
    const cfg = { ...(updated[index].check_config || {}), [key]: value };
    updated[index] = { ...updated[index], check_config: cfg };
    setMilestones(updated);
  };

  const handleAddMilestone = () => {
    setMilestones([
      ...milestones,
      {
        title: 'New Milestone Deliverable',
        amount: '25.00',
        check_type: 'github_ci',
        check_config: { repo: '' },
        acceptance: 'Automated CI checks pass on submitted PR',
      },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const totalCalculated = milestones
    .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0)
    .toFixed(2);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const bad = milestones.find((m) => {
      const val = parseFloat(m.amount);
      return isNaN(val) || val <= 0;
    });
    if (bad) {
      setError(`Milestone "${bad.title}" must have a positive dollar amount (e.g. 50.00).`);
      setIsSubmitting(false);
      return;
    }

    try {
      const normalizedMilestones = milestones.map((m) => ({
        ...m,
        amount: parseFloat(m.amount).toFixed(2),
        check_config: m.check_config || {},
      }));

      const payload = {
        title,
        description,
        currency: 'USD',
        client_name: clientName,
        worker_name: workerName,
        worker_paypal_email: workerEmail,
        milestones: normalizedMilestones,
      };
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create contract');
      }
      const contract = await res.json();
      onContractCreated(contract.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {step === 'brief' ? 'AI Contract Drafter' : 'Review & Customize Contract'}
              </h3>
              <p className="text-xs text-slate-400">
                {step === 'brief'
                  ? 'Describe the job in plain English; Gemini structures checkable milestones.'
                  : 'Adjust milestone tranches, verification requirements, and counterparty details.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Step 1: Input Brief & Budget */}
        {step === 'brief' && (
          <form onSubmit={handleDraftWithAI} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Job Description / Prompt Brief
              </label>
              <textarea
                rows={5}
                required
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500 font-sans"
                placeholder="Describe the job goals, deliverables, and expectations..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Total Budget (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="100.00"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDrafting}
                className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-lg shadow-md flex items-center space-x-2"
              >
                {isDrafting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Gemini Drafting Milestones...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Contract Draft</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Review & Customization */}
        {step === 'review' && (
          <form onSubmit={handleCreateContract} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Contract Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Client Name</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Worker Name</label>
                <input
                  type="text"
                  required
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Worker PayPal Email</label>
                <input
                  type="email"
                  required
                  value={workerEmail}
                  onChange={(e) => setWorkerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            {/* Milestones List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Checkable Milestones ({milestones.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Tranche</span>
                </button>
              </div>

              {milestones.map((m, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-400 font-mono">
                      Milestone #{idx + 1}
                    </span>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestone(idx)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        required
                        value={m.title}
                        onChange={(e) => handleUpdateMilestone(idx, 'title', e.target.value)}
                        placeholder="Milestone title"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <select
                        value={m.check_type}
                        onChange={(e) => handleUpdateMilestone(idx, 'check_type', e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-purple-300 font-mono"
                      >
                        <option value="github_ci">GitHub CI (PR)</option>
                        <option value="http">HTTP Endpoint (200 OK)</option>
                        <option value="manual">Manual Approval</option>
                      </select>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-slate-500 text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={m.amount}
                        onChange={(e) => handleUpdateMilestone(idx, 'amount', e.target.value)}
                        placeholder="Amount"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-6 pr-2 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  {m.check_type === 'github_ci' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Target GitHub Repo (owner/repo)</label>
                        <input
                          type="text"
                          value={m.check_config?.repo || ''}
                          onChange={(e) => handleUpdateCheckConfig(idx, 'repo', e.target.value)}
                          placeholder="e.g. org/repo-name"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Acceptance Criteria</label>
                        <input
                          type="text"
                          value={m.acceptance}
                          onChange={(e) => handleUpdateMilestone(idx, 'acceptance', e.target.value)}
                          placeholder="e.g. Automated CI checks pass on PR"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {m.check_type === 'http' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Target Service Endpoint</label>
                        <input
                          type="text"
                          value={m.check_config?.url || ''}
                          onChange={(e) => handleUpdateCheckConfig(idx, 'url', e.target.value)}
                          placeholder="e.g. https://my-service.com/health"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Acceptance Criteria</label>
                        <input
                          type="text"
                          value={m.acceptance}
                          onChange={(e) => handleUpdateMilestone(idx, 'acceptance', e.target.value)}
                          placeholder="e.g. Endpoint returns HTTP 200"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {m.check_type === 'manual' && (
                    <div className="pt-1">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Acceptance Criteria</label>
                      <input
                        type="text"
                        value={m.acceptance}
                        onChange={(e) => handleUpdateMilestone(idx, 'acceptance', e.target.value)}
                        placeholder="e.g. Manual client sign-off required"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Due Date & Time Picker */}
                  <div className="pt-1 border-t border-slate-800/60 mt-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                      Deadline / Due Date (Optional auto-refund)
                    </label>
                    <input
                      type="datetime-local"
                      value={m.due_at ? m.due_at.slice(0, 16) : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleUpdateMilestone(idx, 'due_at', val ? new Date(val).toISOString() : undefined);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <div className="text-sm font-mono">
                <span className="text-slate-400">Total Escrow Value: </span>
                <span className="font-bold text-cyan-400">${totalCalculated} USD</span>
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setStep('brief')}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-lg"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md flex items-center space-x-1.5"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>{isSubmitting ? 'Creating Contract...' : 'Create & Lock Contract'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
