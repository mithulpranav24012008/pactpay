export type ContractStatus = 'draft' | 'awaiting_payment' | 'funded' | 'completed' | 'cancelled';

export type MilestoneStatus =
  | 'pending'
  | 'submitted'
  | 'verifying'
  | 'passed'
  | 'failed'
  | 'released'
  | 'rejected';

export interface MilestoneCheckConfig {
  repo?: string;
  checks?: string[];
  expected_status?: number;
  acceptance?: string;
  [key: string]: any;
}

export interface Milestone {
  id: string;
  contract_id: string;
  position: number;
  title: string;
  amount: string;
  check_type: 'github_ci' | 'http' | 'manual';
  check_config: MilestoneCheckConfig;
  submission: string | null;
  status: MilestoneStatus;
  evidence: any | null;
  ai_summary: string | null;
  capture_id: string | null;
  payout_batch_id: string | null;
  updated_at: string;
}

export interface ContractTotals {
  released: string;
  held: string;
  returned: string;
}

export interface Contract {
  id: string;
  title: string;
  description: string;
  client_name: string;
  worker_name: string;
  worker_paypal_email: string;
  currency: string;
  total: string;
  status: ContractStatus;
  paypal_order_id: string | null;
  authorization_id: string | null;
  created_at: string;
  totals: ContractTotals;
  milestones: Milestone[];
}

export interface EventLog {
  id: number;
  contract_id: string;
  milestone_id: string | null;
  kind: string;
  message: string;
  data: string | null;
  created_at: string;
}

export interface DraftMilestone {
  title: string;
  amount: string;
  check_type: 'github_ci' | 'http' | 'manual';
  check_config: Record<string, any>;
  acceptance: string;
}

export interface DraftContractResponse {
  title: string;
  description: string;
  currency: string;
  milestones: DraftMilestone[];
}
