export type UserRole = 'admin' | 'staff' | 'relationship_manager' | 'client';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string | null;
  name: string;
  pan: string | null;
  aadhaar: string | null;
  mobile: string;
  email: string | null;
  dob: string | null;
  anniversary: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  occupation: string | null;
  risk_profile: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive' | null;
  notes: string | null;
  assigned_rm_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Family {
  id: string;
  name: string;
  head_client_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  client_id: string;
  relationship: string;
  created_at: string;
  client?: Client;
}

export interface Portfolio {
  id: string;
  client_id: string;
  total_invested: number;
  current_value: number;
  realized_gains: number;
  updated_at: string;
}

export interface Investment {
  id: string;
  portfolio_id: string;
  client_id: string;
  scheme_name: string;
  scheme_code: string | null;
  amc: string | null;
  category: string | null;
  folio_number: string | null;
  invested_amount: number;
  current_value: number;
  units: number;
  nav: number;
  purchase_date: string | null;
  investment_type: 'sip' | 'lumpsum' | 'switch' | 'redemption';
  created_at: string;
  updated_at: string;
}

export interface SipRecord {
  id: string;
  client_id: string;
  scheme_name: string;
  scheme_code: string | null;
  amc: string | null;
  folio_number: string | null;
  amount: number;
  start_date: string;
  end_date: string | null;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  sip_date: number;
  status: 'active' | 'paused' | 'stopped';
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  client_id: string;
  goal_type: 'retirement' | 'education' | 'marriage' | 'house' | 'vehicle' | 'other';
  goal_name: string;
  target_amount: number;
  current_investment: number;
  target_date: string | null;
  monthly_sip: number;
  expected_return: number;
  inflation_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  client_id: string;
  doc_type: 'pan' | 'aadhaar' | 'kyc' | 'statement' | 'report' | 'other';
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
}

export interface Report {
  id: string;
  client_id: string | null;
  family_id: string | null;
  report_type: 'portfolio_summary' | 'family_summary' | 'investment_summary' | 'client_summary';
  file_url: string | null;
  generated_by: string;
  generated_at: string;
}

export interface CrmLead {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  status: 'new' | 'contacted' | 'interested' | 'converted' | 'lost';
  source: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmTask {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  client_id: string | null;
  due_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  notes: string | null;
  action_items: string | null;
  created_by: string;
  created_at: string;
}

export interface Note {
  id: string;
  client_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'birthday' | 'anniversary' | 'sip' | 'follow_up' | 'task' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
  user?: User;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

// Dashboard types
export interface DashboardStats {
  totalClients: number;
  totalFamilies: number;
  totalAUM: number;
  totalInvestment: number;
  currentValue: number;
  profitLoss: number;
  activeSIPs: number;
  upcomingSIPs: number;
  pendingFollowUps: number;
  upcomingBirthdays: number;
  upcomingAnniversaries: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  date?: string;
}

// Import types
export interface ImportRow {
  [key: string]: string | number | null;
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

// Search types
export interface SearchResult {
  id: string;
  type: 'client' | 'family' | 'lead';
  name: string;
  subtitle: string;
  link: string;
}

// File Import types
export interface FileImport {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  import_type: 'standard' | 'portfolio' | 'bulk_clients' | 'bulk_transactions' | 'nav_feed';
  clients_created: number;
  clients_updated: number;
  investments_created: number;
  total_rows: number;
  rows_processed: number;
  rows_failed: number;
  processing_time_ms: number | null;
  file_hash: string | null;
  data_source: string | null;
  status: 'processing' | 'completed' | 'failed';
  notes: string | null;
  created_at: string;
}
