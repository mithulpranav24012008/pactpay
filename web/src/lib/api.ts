// Calls to the PactPay API (proxied to :4000 by Vite in development, same origin in production).
import type { Contract, DraftContractResponse, EventLog } from '../types';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON, e.g. a proxy error page */ }
  if (!res.ok) throw new Error(data?.error ?? (text.slice(0, 160) || `Request failed (${res.status})`));
  return data as T;
}

export interface Health { ok: boolean; paypal: boolean; ai: boolean }
export interface VerifyResult { result: { passed: boolean; summary: string }; explanation?: string; contract: Contract }
export interface DisputeVerdict {
  recommendation: 'release' | 'reject' | 'partial_settlement' | 'cure_window';
  recommended_split_pct: number;
  verdict_summary: string;
  detailed_analysis: string;
  action_plan: string[];
}

export const api = {
  health: () => call<Health>('GET', '/api/health'),
  contracts: () => call<Contract[]>('GET', '/api/contracts'),
  events: (contractId: string) => call<EventLog[]>('GET', `/api/contracts/${contractId}/events`),
  draft: (brief: string, budget: string) => call<DraftContractResponse>('POST', '/api/agent/draft', { brief, budget }),
  create: (body: unknown) => call<Contract>('POST', '/api/contracts', body),
  fund: (contractId: string) => call<{ orderId: string; approveUrl: string }>('POST', `/api/contracts/${contractId}/fund`),
  submit: (milestoneId: string, submission: string) => call<VerifyResult>('POST', `/api/milestones/${milestoneId}/submit`, { submission }),
  verify: (milestoneId: string) => call<VerifyResult>('POST', `/api/milestones/${milestoneId}/verify`),
  override: (milestoneId: string, action: 'release' | 'reject', reason: string) =>
    call<Contract>('POST', `/api/milestones/${milestoneId}/override`, { action, reason }),
  dispute: (milestoneId: string, statement: string) => call<DisputeVerdict>('POST', `/api/milestones/${milestoneId}/dispute`, { statement }),
  payoutStatus: (milestoneId: string) => call<{ payout_status: string }>('POST', `/api/milestones/${milestoneId}/payout-status`),
};
