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
  Scale,
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AI Dispute Arbitrator State
  const [disputeMilestone, setDisputeMilestone] = useState<Milestone | null>(null);
  const [disputeStatement, setDisputeStatement] = useState('');
  const [isMediating, setIsMediating] = useState(false);
  const [disputeVerdict, setDisputeVerdict] = useState<{
    recommendation: 'release' | 'reject' | 'partial_settlement' | 'cure_window';
    recommended_split_pct: number;
    verdict_summary: string;
    detailed_analysis: string;
    action_plan: string[];
  } | null>(null);

  // Live PayPal Payout Verification State
  const [payoutStatusMap, setPayoutStatusMap] = useState<Record<string, any>>({});
  const [loadingPayoutStatusId, setLoadingPayoutStatusId] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
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

  const extractErrorMessage = async (res: Response, defaultMsg: string) => {
    try {
      const data = await res.json();
      return data.error || defaultMsg;
    } catch {
      try {
        const text = await res.text();
        return text || defaultMsg;
      } catch {
        return defaultMsg;
      }
    }
  };

  const handleFundWithPayPal = async () => {
    setIsFunding(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/fund`, { method: 'POST' });
      if (!res.ok) {
        const errMsg = await extractErrorMessage(res, 'Failed to start PayPal funding');
        setErrorMessage(errMsg);
        return;
      }
      const data = await res.json();
      if (data.approveUrl) {
        window.location.href = data.approveUrl;
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error funding with PayPal');
    } finally {
      setIsFunding(false);
    }
  };

  const handleSubmitMilestone = async (milestoneId: string) => {
    const submission = (submissionUrls[milestoneId] || '').trim();
    if (!submission) {
      setErrorMessage('Please enter a submission URL (e.g. GitHub Pull Request or HTTP endpoint)');
      return;
    }
    setSubmittingMilestoneId(milestoneId);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission }),
      });
      if (!res.ok) {
        const errMsg = await extractErrorMessage(res, 'Milestone verification submission failed');
        setErrorMessage(errMsg);
      }
      onRefresh();
      fetchEvents();
    } catch (e: any) {
      setErrorMessage(e.message || 'Error submitting milestone');
    } finally {
      setSubmittingMilestoneId(null);
    }
  };

  const handleReVerify = async (milestoneId: string) => {
    setSubmittingMilestoneId(milestoneId);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/verify`, { method: 'POST' });
      if (!res.ok) {
        const errMsg = await extractErrorMessage(res, 'Verification check failed');
        setErrorMessage(errMsg);
      }
      onRefresh();
      fetchEvents();
    } catch (e: any) {
      setErrorMessage(e.message || 'Error re-verifying');
    } finally {
      setSubmittingMilestoneId(null);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideModalMilestone) return;
    setIsSubmittingOverride(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/milestones/${overrideModalMilestone.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: overrideAction, reason: overrideReason }),
      });
      if (!res.ok) {
        const errMsg = await extractErrorMessage(res, 'Override action failed');
        setErrorMessage(errMsg);
      }
      setOverrideModalMilestone(null);
      setOverrideReason('');
      onRefresh();
      fetchEvents();
    } catch (e: any) {
      setErrorMessage(e.message || 'Error submitting override');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const handleMediateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeMilestone) return;
    setIsMediating(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/milestones/${disputeMilestone.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement: disputeStatement }),
      });
      if (!res.ok) {
        const errMsg = await extractErrorMessage(res, 'Failed to mediate dispute');
        setErrorMessage(errMsg);
        return;
      }
      const data = await res.json();
      setDisputeVerdict(data);
      fetchEvents();
    } catch (e: any) {
      setErrorMessage(e.message || 'Error mediating dispute');
    } finally {
      setIsMediating(false);
    }
  };

  const handleFetchPayoutStatus = async (milestoneId: string) => {
    setLoadingPayoutStatusId(milestoneId);
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/payout-status`);
      if (res.ok) {
        const data = await res.json();
        setPayoutStatusMap((prev) => ({ ...prev, [milestoneId]: data }));
      }
    } catch (e) {
      console.error('Error fetching payout status:', e);
    } finally {
      setLoadingPayoutStatusId(null);
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

      {/* API / State Error Banner */}
      {errorMessage && (
        <div className="mx-6 bg-rose-950/80 border border-rose-500/40 text-rose-300 px-4 py-3 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-400 hover:text-white underline ml-4 flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

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
                    <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono mt-0.5 flex-wrap gap-y-1">
                      <span className="text-purple-400 bg-purple-950/40 border border-purple-800/40 px-1.5 py-0.5 rounded text-[10px]">
                        {milestone.check_type}
                      </span>
                      {milestone.check_config?.repo && (
                        <>
                          <span>•</span>
                          <span className="text-cyan-400">Repo: {milestone.check_config.repo}</span>
                        </>
                      )}
                      {milestone.check_config?.url && (
                        <>
                          <span>•</span>
                          <span className="text-cyan-400 truncate max-w-xs">URL: {milestone.check_config.url}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>Acceptance: {milestone.check_config?.acceptance || 'Automated Check Pass'}</span>
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

                    {/* Autonomous AI Dispute Arbitrator Trigger */}
                    {milestone.status === 'failed' && (
                      <button
                        onClick={() => {
                          setDisputeMilestone(milestone);
                          setDisputeVerdict(null);
                          setDisputeStatement('');
                        }}
                        className="px-3 py-2 text-xs font-semibold bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 border border-purple-700/60 rounded-lg flex items-center space-x-1 transition shadow-sm"
                        title="Invoke Gemini AI Arbitrator to analyze failure logs and propose a fair resolution"
                      >
                        <Scale className="w-3.5 h-3.5 text-purple-400" />
                        <span>AI Arbitrator</span>
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

              {/* Settled Details & Live PayPal Verification */}
              {milestone.status === 'released' && (
                <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Payout Dispatched via PayPal Payouts</span>
                    {milestone.payout_batch_id && (
                      <span className="text-slate-500">({milestone.payout_batch_id.slice(0, 16)}...)</span>
                    )}
                  </div>

                  {milestone.payout_batch_id && (
                    <div className="flex items-center space-x-2">
                      {payoutStatusMap[milestone.id] ? (
                        <div className="flex items-center space-x-1.5 bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>PayPal Status: {payoutStatusMap[milestone.id].transaction_status}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleFetchPayoutStatus(milestone.id)}
                          disabled={loadingPayoutStatusId === milestone.id}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 rounded flex items-center space-x-1 transition"
                        >
                          <Activity className="w-3 h-3 text-cyan-400" />
                          <span>{loadingPayoutStatusId === milestone.id ? 'Verifying...' : 'Verify PayPal Receipt'}</span>
                        </button>
                      )}
                    </div>
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

            {overrideModalMilestone.capture_id && (
              <div className="p-2.5 bg-blue-950/60 border border-blue-500/30 rounded-lg text-blue-300 text-xs">
                Funds for this milestone have already been captured from PayPal. Only <strong>Approve & Pay</strong> is available to re-send the worker payout.
              </div>
            )}

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
                    disabled={!!overrideModalMilestone.capture_id}
                    onClick={() => setOverrideAction('reject')}
                    className={`py-2 text-xs font-bold rounded-lg border flex items-center justify-center space-x-1 ${
                      overrideAction === 'reject'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : overrideModalMilestone.capture_id
                        ? 'bg-slate-950/50 text-slate-600 border-slate-900 cursor-not-allowed'
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

      {/* Autonomous AI Dispute Arbitrator Modal */}
      {disputeMilestone && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Scale className="w-5 h-5 text-purple-400" />
                <span>Autonomous AI Dispute Arbitrator</span>
              </h3>
              <button
                onClick={() => setDisputeMilestone(null)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-200">
                Milestone: <span className="text-cyan-400">{disputeMilestone.title}</span> (${disputeMilestone.amount} USD)
              </div>
              <p className="text-xs text-slate-400">
                The Gemini AI Arbitrator objectively evaluates the contract brief, automated check failure logs, and counterparty arguments to recommend an equitable resolution.
              </p>
            </div>

            {!disputeVerdict ? (
              <form onSubmit={handleMediateDispute} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Dispute Statement / Context (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={disputeStatement}
                    onChange={(e) => setDisputeStatement(e.target.value)}
                    placeholder="e.g. CI failed on a formatting check, but all primary feature requirements and tests passed..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDisputeMilestone(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isMediating}
                    className="px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center space-x-1.5 shadow-md transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isMediating ? 'Arbitrating with Gemini AI...' : 'Analyze Dispute with AI'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Recommendation Banner */}
                <div className="p-3.5 bg-purple-950/50 border border-purple-500/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-purple-300 tracking-wider">
                      Arbitrator Verdict
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      {disputeVerdict.recommendation.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white leading-relaxed">
                    {disputeVerdict.verdict_summary}
                  </p>
                  <div className="text-[11px] font-mono text-cyan-300">
                    Recommended Settlement: {disputeVerdict.recommended_split_pct}% to worker (${((parseFloat(disputeMilestone.amount) * disputeVerdict.recommended_split_pct) / 100).toFixed(2)} USD)
                  </div>
                </div>

                {/* Impartial Analysis */}
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-300 uppercase">Analysis</div>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                    {disputeVerdict.detailed_analysis}
                  </p>
                </div>

                {/* Action Plan */}
                {disputeVerdict.action_plan?.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-300 uppercase">Recommended Next Steps</div>
                    <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                      {disputeVerdict.action_plan.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setDisputeVerdict(null);
                      setDisputeMilestone(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                  >
                    Dismiss
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const targetMilestone = disputeMilestone;
                      const rec = disputeVerdict.recommendation;
                      setDisputeMilestone(null);
                      setDisputeVerdict(null);
                      setOverrideModalMilestone(targetMilestone);
                      setOverrideAction(rec === 'reject' ? 'reject' : 'release');
                      setOverrideReason(`AI Arbitrator Verdict: ${disputeVerdict.verdict_summary}`);
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center space-x-1.5 shadow-md transition"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Apply via Human Override</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
