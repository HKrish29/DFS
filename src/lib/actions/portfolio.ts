'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { InvestmentFormData, SipFormData } from '@/lib/validations';

export async function getPortfolio(clientId: string) {
  const supabase = await createClient();

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*')
    .eq('client_id', clientId)
    .single();

  const { data: investments } = await supabase
    .from('investments')
    .select('*')
    .eq('client_id', clientId)
    .order('scheme_name', { ascending: true });

  const { data: sips } = await supabase
    .from('sip_records')
    .select('*')
    .eq('client_id', clientId)
    .order('scheme_name', { ascending: true });

  return {
    portfolio,
    investments: investments || [],
    sips: sips || [],
  };
}

export async function addInvestmentAction(formData: InvestmentFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('investments')
    .insert({ ...formData, portfolio_id: null })
    .select()
    .single();

  if (error) return { error: error.message };

  // Get portfolio and link investment
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('client_id', formData.client_id)
    .single();

  if (portfolio) {
    await supabase
      .from('investments')
      .update({ portfolio_id: portfolio.id })
      .eq('id', data.id);
  }

  // Recalculate portfolio totals
  await recalculatePortfolio(formData.client_id);

  await supabase.from('activities').insert({
    user_id: user.id,
    action: 'created',
    entity_type: 'investment',
    entity_id: data.id,
    details: `Added investment: ${formData.scheme_name}`,
  });

  revalidatePath(`/portfolio/${formData.client_id}`);
  revalidatePath('/dashboard');
  return { data };
}

export async function updateInvestmentAction(id: string, formData: InvestmentFormData) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('investments')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  await recalculatePortfolio(formData.client_id);

  revalidatePath(`/portfolio/${formData.client_id}`);
  return { data };
}

export async function deleteInvestmentAction(id: string, clientId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from('investments').delete().eq('id', id);
  if (error) return { error: error.message };

  await recalculatePortfolio(clientId);

  revalidatePath(`/portfolio/${clientId}`);
  return { success: true };
}

export async function addSipAction(formData: SipFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('sip_records')
    .insert(formData)
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from('activities').insert({
    user_id: user.id,
    action: 'created',
    entity_type: 'sip',
    entity_id: data.id,
    details: `Added SIP: ${formData.scheme_name} - ₹${formData.amount}`,
  });

  revalidatePath(`/portfolio/${formData.client_id}`);
  return { data };
}

export async function updateSipAction(id: string, formData: SipFormData) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sip_records')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/portfolio/${formData.client_id}`);
  return { data };
}

export async function deleteSipAction(id: string, clientId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from('sip_records').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath(`/portfolio/${clientId}`);
  return { success: true };
}

async function recalculatePortfolio(clientId: string) {
  const supabase = await createClient();

  const { data: investments } = await supabase
    .from('investments')
    .select('invested_amount, current_value')
    .eq('client_id', clientId);

  const totalInvested = (investments || []).reduce((sum, inv) => sum + inv.invested_amount, 0);
  const currentValue = (investments || []).reduce((sum, inv) => sum + inv.current_value, 0);

  await supabase
    .from('portfolios')
    .update({
      total_invested: totalInvested,
      current_value: currentValue,
      updated_at: new Date().toISOString(),
    })
    .eq('client_id', clientId);
}

export async function getTotalAUM() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('portfolios')
    .select('current_value');

  return (data || []).reduce((sum, p) => sum + (p.current_value || 0), 0);
}

export async function getPortfolioSummary() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('portfolios')
    .select('total_invested, current_value');

  const totalInvested = (data || []).reduce((sum, p) => sum + (p.total_invested || 0), 0);
  const currentValue = (data || []).reduce((sum, p) => sum + (p.current_value || 0), 0);

  return { totalInvested, currentValue, profitLoss: currentValue - totalInvested };
}

export async function getAssetAllocation(clientId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('investments')
    .select('category, current_value');

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data } = await query;

  const allocation: Record<string, number> = {};
  (data || []).forEach((inv) => {
    const category = inv.category || 'Other';
    allocation[category] = (allocation[category] || 0) + inv.current_value;
  });

  return Object.entries(allocation).map(([name, value]) => ({ name, value }));
}

export async function getAmcAllocation(clientId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('investments')
    .select('amc, current_value');

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data } = await query;

  const allocation: Record<string, number> = {};
  (data || []).forEach((inv) => {
    const amc = inv.amc || 'Other';
    allocation[amc] = (allocation[amc] || 0) + inv.current_value;
  });

  return Object.entries(allocation).map(([name, value]) => ({ name, value }));
}

export async function getFileImports() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('file_imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createFileImportRecord(record: {
  file_name: string;
  file_size: number;
  import_type: 'standard' | 'portfolio';
  clients_created: number;
  investments_created: number;
  status: 'processing' | 'completed' | 'failed';
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('file_imports')
    .insert({ ...record, user_id: user.id })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}
