import React, { useState, useEffect } from 'react';
import {
  Contract,
  Milestone,
  EventLog,
} from '../types';
import {
  CreditCard,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  RotateCw,
  UserCheck,
  Ban,
  Activity,
  ChevronRight,
} from 'lucide-react';

interface ContractDetailViewProps {
  contract: Contract;
  onRefresh: () => void;
}

export const ContractDetailView: React.FC<ContractDetailViewProps> = ({
  contract,
  onRefresh,
}) => {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [isFunding, setIsFunding] = useState(false);
  const [submittingMilestoneId, setSubmittingMilestoneId] = useState<string | null>(null);
  const [submissionUrls, setSubmissionUrls] = useState<Record<string, string>>({});
  const [overrideModalMilestone, setOverrideModalMilestone] = useState<Milestone | null>(null);
  const [overrideAction, setOverrideAction] = useState<'release' | 'reject'>('release');
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [activeTab, setActiveTab] = useState<'milestones' | 'events'>('milestones');

  useEffect(() => {
    fetchEvents();
  }, [contract.id]);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/contracts/${contract.id}/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error('Error fetching events:', e);
    }
  };

  const handleFundWithPayPal = async () => {
    setIsFunding(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/fund`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to start PayPal funding');
        return;
      }
      const data = await res.json();
      if (data.approveUrl) {
        window.location.href = data.approveUrl;
      }
    } catch (e: any) {
      alert(e.message || 'Error funding with PayPal');
    } finally {
      setIsFunding(false);
    }
  };

  const handleSubmitMilestone = async (milestoneId: string) => {
    const submission = submissionUrls[milestoneId];
    if (!submission) return;
    setSubmittingMilestoneId(milestoneId);
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Milestone verification submission failed');
      }
      onRefresh();
      fetchEvents();
    } catch (e: any) {
      alert(e.message || 'Error submitting milestone');
    } finally {
      setSubmittingMilestoneId(null);
    }
  };

  const handleReVerify = async (milestoneId: string) => {
    setSubmittingMilestoneId(milestoneId);
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/verify`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Verification check failed');
      }
      onRefresh();
      fetchEvents();
    } catch (e: any) {
      alert(e.message || 'Error re-verifying');
    } finally {
      setSubmittingMilestoneId(null);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideModalMilestone) return;
    setIsSubmittingOverride(true);
    try {
      const res = await fetch(`/api/milestones/${overrideModalMilestone.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: overrideAction, reason: overrideReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Override action failed');
      }
      setOverrideModalMilestone(null);
      setOverrideReason('');
      onRefresh();
      fetchEvents();
    } catch (e: any) {
      alert(e.message || 'Error submitting override');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-4">
      {/* Header Banner */}
      <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
              {contract.id}
            </span>
            <span className="text-xs uppercase font-bold text-slate-400">
              {contract.status.replace('_', ' ')}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">{contract.title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{contract.description}</p>
        </div>

        {/* Action Button: Fund with PayPal */}
        <div className="flex items-center space-x-3">
          {(contract.status === 'draft' || contract.status === 'awaiting_payment') && (
            <button
              onClick={handleFundWithPayPal}
              disabled={isFunding}
              className="px-5 py-2.5 text-sm font-bold bg-[#0070BA] hover:bg-[#003087] text-white rounded-xl shadow-lg shadow-blue-500/25 flex items-center space-x-2 transition"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isFunding ? 'Connecting to PayPal...' : `Fund Escrow ($${contract.total} ${contract.currency})`}</span>
            </button>
          )}

          {contract.status === 'funded' && (
            <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Escrow Funded via PayPal Authorization</span>
            </div>
          )}

          {contract.status === 'completed' && (
            <div className="flex items-center space-x-2 bg-blue-500/10 border border-blue-500/30 px-3.5 py-2 rounded-xl text-blue-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>All Milestones Settled</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-slate-800 flex space-x-6">
        <button
          onClick={() => setActiveTab('milestones')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
            activeTab === 'milestones'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Milestones ({contract.milestones.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'events'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Audit Feed ({events.length})</span>
        </button>
      </div>

      {/* Tab 1: Milestones List */}
      {activeTab === 'milestones' && (
        <div className="p-6 space-y-4">
          {contract.milestones.map((milestone) => (
            <div
              key={milestone.id}
              className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4 transition hover:border-slate-700/80"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold">
                    {milestone.position}
                  </span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{milestone.title}</h4>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono mt-0.5">
                      <span className="text-purple-400 bg-purple-950/40 border border-purple-800/40 px-1.5 py-0.5 rounded text-[10px]">
                        {milestone.check_type}
                      </span>
                      <span>•</span>
                      <span>Acceptance: {milestone.check_config?.acceptance || 'CI Checks Pass'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="font-mono font-bold text-slate-100 text-sm">
                    ${parseFloat(milestone.amount).toFixed(2)} USD
                  </span>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-full border uppercase tracking-wider ${
                      milestone.status === 'released'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : milestone.status === 'passed'
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                        : milestone.status === 'failed'
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : milestone.status === 'rejected'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {milestone.status}
                  </span>
                </div>
              </div>

              {/* AI Explanation / Feedback */}
              {milestone.ai_summary && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 text-purple-400 font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Arbitrator AI Verdict</span>
                  </div>
                  <p className="text-slate-300 font-sans leading-relaxed">{milestone.ai_summary}</p>
                </div>
              )}

              {/* Evidence Inspector */}
              {milestone.evidence && (
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 font-mono text-[11px] text-slate-400 overflow-x-auto">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Check Evidence:</div>
                  <pre>{JSON.stringify(milestone.evidence, null, 2)}</pre>
                </div>
              )}

              {/* Submission Input (If contract funded and milestone not yet released) */}
              {contract.status === 'funded' && !['released', 'rejected'].includes(milestone.status) && (
                <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={submissionUrls[milestone.id] || ''}
                    onChange={(e) =>
                      setSubmissionUrls({ ...submissionUrls, [milestone.id]: e.target.value })
                    }
                    placeholder={
                      milestone.check_type === 'github_ci'
                        ? 'Paste GitHub Pull Request URL (e.g. https://github.com/org/repo/pull/1)'
                        : 'Paste deployed HTTP service URL (e.g. https://my-app.onrender.com/health)'
                    }
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSubmitMilestone(milestone.id)}
                      disabled={submittingMilestoneId === milestone.id}
                      className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center space-x-1.5 shadow-sm transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submittingMilestoneId === milestone.id ? 'Running Check...' : 'Submit & Verify'}</span>
                    </button>

                    {milestone.submission && (
                      <button
                        onClick={() => handleReVerify(milestone.id)}
                        disabled={submittingMilestoneId === milestone.id}
                        className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center space-x-1"
                        title="Re-run verification check"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Human Override Trigger */}
                    <button
                      onClick={() => setOverrideModalMilestone(milestone)}
                      className="px-3 py-2 text-xs font-semibold bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-lg flex items-center space-x-1"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Override</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Settled Details */}
              {milestone.status === 'released' && (
                <div className="pt-2 border-t border-slate-800/60 flex items-center space-x-4 text-xs font-mono text-emerald-400">
                  <div className="flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Payout Settled via PayPal Payouts API</span>
                  </div>
                  {milestone.payout_batch_id && (
                    <span className="text-slate-500">Batch: {milestone.payout_batch_id}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Activity & Audit Feed */}
      {activeTab === 'events' && (
        <div className="p-6">
          <div className="space-y-3 font-mono text-xs">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg flex items-start space-x-3"
              >
                <span className="text-cyan-400 font-bold uppercase tracking-wider">{evt.kind}</span>
                <span className="text-slate-300 flex-1">{evt.message}</span>
                <span className="text-slate-500 text-[10px]">{evt.created_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Human Override Modal */}
      {overrideModalMilestone && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>Human Arbitrator Override</span>
            </h3>
            <p className="text-xs text-slate-400">
              Override the automated check for milestone "{overrideModalMilestone.title}".
            </p>

            <form onSubmit={handleOverrideSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Arbitration Decision
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideAction('release')}
                    className={`py-2 text-xs font-bold rounded-lg border flex items-center justify-center space-x-1 ${
                      overrideAction === 'release'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Approve & Pay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideAction('reject')}
                    className={`py-2 text-xs font-bold rounded-lg border flex items-center justify-center space-x-1 ${
                      overrideAction === 'reject'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Reject Share</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Reason / Audit Log Note
                </label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why you are overriding the automated runner..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalMilestone(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride}
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-md"
                >
                  {isSubmittingOverride ? 'Executing...' : 'Confirm Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
