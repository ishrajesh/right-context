export type FilterField =
  | 'HEADCOUNT'
  | 'INDUSTRY'
  | 'REGION'
  | 'TECH_USED'
  | 'COMPANY_TYPE'
  | 'REVENUE';

export type FilterOp = 'in' | 'not_in' | 'gte' | 'lte';

export type Filter = {
  id: string;
  field: FilterField;
  op: FilterOp;
  value: string[];
  rationale: string;
  confidence: 1 | 2 | 3 | 4 | 5;
};

export type Company = {
  id: string;
  name: string;
  domain: string;
  headcount: string;
  industry: string[];
  region: string;
  hq_city: string;
  tech_used: string[];
  company_type: 'Private' | 'Public' | 'Nonprofit';
  revenue: string;
  description: string;
};

export type ICP = {
  name: string;
  product_description: string;
  value_prop: string;
  perfect_fits: string[];
  bad_fits: string[];
  notes: string;
};

export type PreflightRow = {
  name: string;
  matched: boolean;
  reason: string;
};

export type Preflight = {
  rows: PreflightRow[];
  hitRate: number;
  filterSnapshot: Filter[];
};

export type Score = {
  companyId: string;
  fit: 0 | 1;
  reason: string;
};

export type Diagnosis = {
  p_at_10: number;
  top_category: string;
  counts: Record<string, number>;
  proposal: string;
  accepted?: boolean | null;
  filterSnapshot: Filter[];
};

export type Message =
  | { id: string; kind: 'user'; text: string; ts: number }
  | { id: string; kind: 'assistant'; text: string; ts: number; pending?: boolean }
  | {
      id: string;
      kind: 'tool';
      name: string;
      input: unknown;
      result: unknown;
      ts: number;
    }
  | { id: string; kind: 'card'; variant: 'preflight' | 'results' | 'diagnosis'; refId: string; ts: number }
  | { id: string; kind: 'system'; text: string; ts: number };

export type IterationSnapshot = {
  iter: number;
  filters: Filter[];
  p_at_10: number | null;
  ts: number;
};

export type Integration = {
  id: string;
  name: string;
  label: string;
  key: string;
  endpoint?: string;
  note?: string;
};

export type Session = {
  id: string;
  createdAt: number;
  updatedAt: number;
  icp: ICP;
  filters: Filter[];
  preflight: Preflight | null;
  results: Company[];
  scores: Record<string, Score>;
  diagnosis: Diagnosis | null;
  messages: Message[];
  iteration: number;
  history: IterationSnapshot[];
};

export type Store = {
  apiKey: string | null;
  model: string;
  integrations: Integration[];
  sessions: Session[];
  activeId: string;
};

export const HEADCOUNT_BUCKETS = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001+',
] as const;

export const REVENUE_BUCKETS = [
  '<$1M',
  '$1-10M',
  '$10-50M',
  '$50-100M',
  '$100M-1B',
  '>$1B',
] as const;
