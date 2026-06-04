import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

// Client schemas
export const clientSchema = z.object({
  name: z.string().min(2, 'Client name is required'),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').or(z.literal('')).optional().nullable(),
  aadhaar: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').or(z.literal('')).optional().nullable(),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile must be 10 digits'),
  email: z.string().email('Invalid email').or(z.literal('')).optional().nullable(),
  dob: z.string().optional().nullable(),
  anniversary: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').or(z.literal('')).optional().nullable(),
  occupation: z.string().optional().nullable(),
  risk_profile: z.enum(['conservative', 'moderate', 'aggressive', 'very_aggressive']).optional().nullable(),
  notes: z.string().optional().nullable(),
  assigned_rm_id: z.string().uuid().optional().nullable(),
});

// Family schemas
export const familySchema = z.object({
  name: z.string().min(2, 'Family name is required'),
  head_client_id: z.string().uuid('Select a head of family').optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const familyMemberSchema = z.object({
  family_id: z.string().uuid(),
  client_id: z.string().uuid('Select a client'),
  relationship: z.string().min(1, 'Relationship is required'),
});

// Investment schemas
export const investmentSchema = z.object({
  client_id: z.string().uuid(),
  scheme_name: z.string().min(1, 'Scheme name is required'),
  scheme_code: z.string().optional().nullable(),
  amc: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  folio_number: z.string().optional().nullable(),
  invested_amount: z.coerce.number().min(0, 'Amount must be positive'),
  current_value: z.coerce.number().min(0, 'Value must be positive'),
  units: z.coerce.number().min(0, 'Units must be positive'),
  nav: z.coerce.number().min(0, 'NAV must be positive'),
  purchase_date: z.string().optional().nullable(),
  investment_type: z.enum(['sip', 'lumpsum', 'switch', 'redemption']),
});

// SIP schemas
export const sipSchema = z.object({
  client_id: z.string().uuid(),
  scheme_name: z.string().min(1, 'Scheme name is required'),
  scheme_code: z.string().optional().nullable(),
  amc: z.string().optional().nullable(),
  folio_number: z.string().optional().nullable(),
  amount: z.coerce.number().min(100, 'Minimum SIP amount is ₹100'),
  start_date: z.string(),
  end_date: z.string().optional().nullable(),
  frequency: z.enum(['monthly', 'quarterly', 'yearly']),
  sip_date: z.coerce.number().min(1).max(31, 'SIP date must be between 1 and 31'),
  status: z.enum(['active', 'paused', 'stopped']),
});

// Goal schemas
export const goalSchema = z.object({
  client_id: z.string().uuid(),
  goal_type: z.enum(['retirement', 'education', 'marriage', 'house', 'vehicle', 'other']),
  goal_name: z.string().min(1, 'Goal name is required'),
  target_amount: z.coerce.number().min(1, 'Target amount is required'),
  current_investment: z.coerce.number().min(0).default(0),
  target_date: z.string().optional().nullable(),
  monthly_sip: z.coerce.number().min(0).default(0),
  expected_return: z.coerce.number().min(0).max(100).default(12),
  inflation_rate: z.coerce.number().min(0).max(100).default(6),
  notes: z.string().optional().nullable(),
});

// CRM schemas
export const leadSchema = z.object({
  name: z.string().min(2, 'Lead name is required'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile must be 10 digits'),
  email: z.string().email('Invalid email').or(z.literal('')).optional().nullable(),
  status: z.enum(['new', 'contacted', 'interested', 'converted', 'lost']),
  source: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional().nullable(),
  assigned_to: z.string().uuid('Assignee is required'),
  client_id: z.string().uuid().optional().nullable(),
  due_date: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
});

export const meetingSchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Meeting title is required'),
  date: z.string(),
  time: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  action_items: z.string().optional().nullable(),
});

export const noteSchema = z.object({
  client_id: z.string().uuid(),
  content: z.string().min(1, 'Note content is required'),
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ClientFormData = z.infer<typeof clientSchema>;
export type FamilyFormData = z.infer<typeof familySchema>;
export type FamilyMemberFormData = z.infer<typeof familyMemberSchema>;
export type InvestmentFormData = z.infer<typeof investmentSchema>;
export type SipFormData = z.infer<typeof sipSchema>;
export type GoalFormData = z.infer<typeof goalSchema>;
export type LeadFormData = z.infer<typeof leadSchema>;
export type TaskFormData = z.infer<typeof taskSchema>;
export type MeetingFormData = z.infer<typeof meetingSchema>;
export type NoteFormData = z.infer<typeof noteSchema>;
