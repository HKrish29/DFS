'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { InvestmentFormData, SipFormData } from '@/lib/validations';
import { all, get, run, db } from '@/lib/sqlite/db';
import { getCurrentUser } from '@/lib/actions/auth';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

export async function getPortfolio(clientId: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const portfolio = await get('SELECT * FROM portfolios WHERE client_id = ?', [clientId]);
    const investments = await all('SELECT * FROM investments WHERE client_id = ? ORDER BY scheme_name ASC', [clientId]);
    const sips = await all('SELECT * FROM sip_records WHERE client_id = ? ORDER BY scheme_name ASC', [clientId]);
    
    return {
      portfolio,
      investments: investments || [],
      sips: sips || [],
    };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    const newId = crypto.randomUUID();
    const portfolio = await get('SELECT id FROM portfolios WHERE client_id = ?', [formData.client_id]);

    await run(
      `INSERT INTO investments (id, portfolio_id, client_id, scheme_name, scheme_code, amc, category, folio_number, invested_amount, current_value, units, nav, purchase_date, investment_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId, portfolio?.id || null, formData.client_id, formData.scheme_name, formData.scheme_code || null,
        formData.amc || null, formData.category || null, formData.folio_number || null, formData.invested_amount,
        formData.current_value, formData.units, formData.nav, formData.purchase_date || null, formData.investment_type
      ]
    );

    // Recalculate portfolio totals
    await recalculatePortfolio(formData.client_id);

    // Log activity
    await run(
      'INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), user.id, 'created', 'investment', newId, `Added investment: ${formData.scheme_name}`]
    );

    revalidatePath(`/portfolio/${formData.client_id}`);
    revalidatePath('/dashboard');
    return { data: { id: newId } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run(
      `UPDATE investments SET scheme_name = ?, scheme_code = ?, amc = ?, category = ?, folio_number = ?, invested_amount = ?, current_value = ?, units = ?, nav = ?, purchase_date = ?, investment_type = ?, updated_at = datetime('now') WHERE id = ?`,
      [
        formData.scheme_name, formData.scheme_code || null, formData.amc || null, formData.category || null,
        formData.folio_number || null, formData.invested_amount, formData.current_value, formData.units,
        formData.nav, formData.purchase_date || null, formData.investment_type, id
      ]
    );

    await recalculatePortfolio(formData.client_id);

    revalidatePath(`/portfolio/${formData.client_id}`);
    return { data: { id } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run('DELETE FROM investments WHERE id = ?', [id]);
    await recalculatePortfolio(clientId);
    revalidatePath(`/portfolio/${clientId}`);
    return { success: true };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('investments').delete().eq('id', id);
  if (error) return { error: error.message };

  await recalculatePortfolio(clientId);

  revalidatePath(`/portfolio/${clientId}`);
  return { success: true };
}

export async function addSipAction(formData: SipFormData) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    const newId = crypto.randomUUID();
    await run(
      `INSERT INTO sip_records (id, client_id, scheme_name, scheme_code, amc, folio_number, amount, start_date, end_date, frequency, sip_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId, formData.client_id, formData.scheme_name, formData.scheme_code || null, formData.amc || null,
        formData.folio_number || null, formData.amount, formData.start_date, formData.end_date || null,
        formData.frequency, formData.sip_date, formData.status || 'active'
      ]
    );

    // Log activity
    await run(
      'INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), user.id, 'created', 'sip', newId, `Added SIP: ${formData.scheme_name} - ₹${formData.amount}`]
    );

    revalidatePath(`/portfolio/${formData.client_id}`);
    return { data: { id: newId } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run(
      `UPDATE sip_records SET scheme_name = ?, scheme_code = ?, amc = ?, folio_number = ?, amount = ?, start_date = ?, end_date = ?, frequency = ?, sip_date = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
      [
        formData.scheme_name, formData.scheme_code || null, formData.amc || null, formData.folio_number || null,
        formData.amount, formData.start_date, formData.end_date || null, formData.frequency, formData.sip_date,
        formData.status, id
      ]
    );

    revalidatePath(`/portfolio/${formData.client_id}`);
    return { data: { id } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run('DELETE FROM sip_records WHERE id = ?', [id]);
    revalidatePath(`/portfolio/${clientId}`);
    return { success: true };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('sip_records').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath(`/portfolio/${clientId}`);
  return { success: true };
}

async function recalculatePortfolio(clientId: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const investments = await all('SELECT invested_amount, current_value FROM investments WHERE client_id = ?', [clientId]);
    
    const totalInvested = (investments || []).reduce((sum, inv) => sum + Number(inv.invested_amount), 0);
    const currentValue = (investments || []).reduce((sum, inv) => sum + Number(inv.current_value), 0);

    await run(
      `UPDATE portfolios SET total_invested = ?, current_value = ?, updated_at = datetime('now') WHERE client_id = ?`,
      [totalInvested, currentValue, clientId]
    );
    return;
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const row = await get('SELECT sum(current_value) as sum FROM portfolios');
    return row?.sum ? Number(row.sum) : 0;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('portfolios')
    .select('current_value');

  return (data || []).reduce((sum, p) => sum + (p.current_value || 0), 0);
}

export async function getPortfolioSummary() {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const row = await get('SELECT sum(total_invested) as total_invested, sum(current_value) as current_value FROM portfolios');
    const totalInvested = row?.total_invested ? Number(row.total_invested) : 0;
    const currentValue = row?.current_value ? Number(row.current_value) : 0;

    return {
      totalInvested,
      currentValue,
      profitLoss: currentValue - totalInvested
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('portfolios')
    .select('total_invested, current_value');

  const totalInvested = (data || []).reduce((sum, p) => sum + (p.total_invested || 0), 0);
  const currentValue = (data || []).reduce((sum, p) => sum + (p.current_value || 0), 0);

  return { totalInvested, currentValue, profitLoss: currentValue - totalInvested };
}

export async function getAssetAllocation(clientId?: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    let rows;
    if (clientId) {
      rows = await all('SELECT category, current_value FROM investments WHERE client_id = ?', [clientId]);
    } else {
      rows = await all('SELECT category, current_value FROM investments');
    }

    const allocation: Record<string, number> = {};
    rows.forEach((inv) => {
      const category = inv.category || 'Other';
      allocation[category] = (allocation[category] || 0) + Number(inv.current_value);
    });

    return Object.entries(allocation).map(([name, value]) => ({ name, value }));
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    let rows;
    if (clientId) {
      rows = await all('SELECT amc, current_value FROM investments WHERE client_id = ?', [clientId]);
    } else {
      rows = await all('SELECT amc, current_value FROM investments');
    }

    const allocation: Record<string, number> = {};
    rows.forEach((inv) => {
      const amc = inv.amc || 'Other';
      allocation[amc] = (allocation[amc] || 0) + Number(inv.current_value);
    });

    return Object.entries(allocation).map(([name, value]) => ({ name, value }));
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required');
    }
    return await all('SELECT * FROM file_imports ORDER BY created_at DESC LIMIT 20');
  }

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
  import_type: 'standard' | 'portfolio' | 'bulk_clients' | 'bulk_transactions' | 'nav_feed';
  clients_created: number;
  clients_updated?: number;
  investments_created: number;
  total_rows?: number;
  rows_processed?: number;
  rows_failed?: number;
  processing_time_ms?: number;
  file_hash?: string;
  data_source?: string;
  status: 'processing' | 'completed' | 'failed';
  notes?: string;
}) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    const newId = crypto.randomUUID();
    await run(
      `INSERT INTO file_imports (id, user_id, file_name, file_size, import_type, clients_created, clients_updated, investments_created, total_rows, rows_processed, rows_failed, processing_time_ms, file_hash, data_source, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, user.id, record.file_name, record.file_size, record.import_type,
       record.clients_created || 0, record.clients_updated || 0, record.investments_created || 0,
       record.total_rows || 0, record.rows_processed || 0, record.rows_failed || 0,
       record.processing_time_ms || null, record.file_hash || null, record.data_source || null,
       record.status, record.notes || null]
    );

    return { data: { id: newId } };
  }

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

export async function bulkImportAction(payload: {
  importType: 'portfolio' | 'feed' | 'standard';
  extractedClients?: any[];
  standardData?: any[];
  fileName?: string;
  fileSize?: number;
}) {
  const { importType, extractedClients = [], standardData = [], fileName, fileSize } = payload;
  
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    // Check if file has already been imported
    if (fileName && fileSize) {
      const existingImport = await get(
        'SELECT id FROM file_imports WHERE file_name = ? AND file_size = ?',
        [fileName, fileSize]
      );
      if (existingImport) {
        return { error: 'This file has already been imported.' };
      }
    }

    const logs: { item: string; status: 'success' | 'error'; message: string }[] = [];
    const clientIdsToRecalculate = new Set<string>();

    if (importType === 'portfolio' || importType === 'feed') {
      for (const client of extractedClients) {
        try {
          let resolvedClientId = client.existingId;
          let existingProfile: any = null;

          // 1. Find or create client
          if (!resolvedClientId) {
            if (client.pan) {
              existingProfile = await get('SELECT id, name, mobile, email, pan FROM clients WHERE pan = ? AND is_active = 1', [client.pan]);
              if (existingProfile) resolvedClientId = existingProfile.id;
            }
            if (!resolvedClientId && client.mobile) {
              existingProfile = await get('SELECT id, name, mobile, email, pan FROM clients WHERE mobile = ? AND is_active = 1', [client.mobile]);
              if (existingProfile) resolvedClientId = existingProfile.id;
            }
          } else {
            existingProfile = await get('SELECT id, name, mobile, email, pan FROM clients WHERE id = ?', [resolvedClientId]);
          }

          if (!resolvedClientId) {
            resolvedClientId = crypto.randomUUID();
            await run(
              `INSERT INTO clients (id, user_id, name, mobile, pan, email, city, state, occupation, risk_profile, notes, assigned_rm_id, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Business Owner', 'moderate', ?, ?, 1)`,
              [
                resolvedClientId, user.id, client.name, client.mobile, client.pan || null, client.email || null,
                client.city || null, client.state || null,
                importType === 'feed' ? 'Imported via CAMS Feed' : `Imported via Portfolio Sheet: KYC: ${client.kycStatus}`,
                user.id
              ]
            );

            logs.push({
              item: `Client: ${client.name}`,
              status: 'success',
              message: 'Created client successfully',
            });

            await run('INSERT INTO portfolios (id, client_id, total_invested, current_value, realized_gains) VALUES (?, ?, 0, 0, 0)', [
              crypto.randomUUID(), resolvedClientId
            ]);
          } else {
            // Update client details
            const updateFields: string[] = [];
            const updateArgs: any[] = [];

            if (client.email && client.email !== existingProfile?.email && !client.email.endsWith('@example.com')) {
              updateFields.push('email = ?');
              updateArgs.push(client.email);
            }
            if (client.pan && client.pan !== existingProfile?.pan) {
              updateFields.push('pan = ?');
              updateArgs.push(client.pan);
            }
            if (client.name && client.name !== existingProfile?.name) {
              updateFields.push('name = ?');
              updateArgs.push(String(client.name));
            }
            if (client.city && client.city !== existingProfile?.city) {
              updateFields.push('city = ?');
              updateArgs.push(client.city);
            }
            if (client.state && client.state !== existingProfile?.state) {
              updateFields.push('state = ?');
              updateArgs.push(client.state);
            }

            if (updateFields.length > 0) {
              updateArgs.push(resolvedClientId);
              await run(`UPDATE clients SET ${updateFields.join(', ')}, updated_at = datetime('now') WHERE id = ?`, updateArgs);
              logs.push({
                item: `Client: ${client.name}`,
                status: 'success',
                message: 'Linked and updated existing client profile',
              });
            } else {
              logs.push({
                item: `Client: ${client.name}`,
                status: 'success',
                message: 'Linked to existing client',
              });
            }
          }

          let portfolio = await get('SELECT id FROM portfolios WHERE client_id = ?', [resolvedClientId]);
          if (!portfolio) {
            const newPortfolioId = crypto.randomUUID();
            await run('INSERT INTO portfolios (id, client_id, total_invested, current_value, realized_gains) VALUES (?, ?, 0, 0, 0)', [
              newPortfolioId, resolvedClientId
            ]);
            portfolio = { id: newPortfolioId };
          }

          clientIdsToRecalculate.add(resolvedClientId);

          // Prepare investments
          for (const inv of client.investments) {
            // Check if this investment already exists (same scheme name and folio for client)
            const existingInv = await get(
              'SELECT id FROM investments WHERE client_id = ? AND scheme_name = ? AND (folio_number = ? OR (folio_number IS NULL AND ? IS NULL))',
              [resolvedClientId, inv.schemeName, inv.folioNumber || null, inv.folioNumber || null]
            );

            if (existingInv) {
              // Update existing holdings
              await run(
                `UPDATE investments 
                 SET nav = ?, units = ?, invested_amount = ?, current_value = ?, purchase_date = ?, updated_at = datetime('now')
                 WHERE id = ?`,
                [
                  inv.purchaseNav || 0, inv.units || 0, inv.investedAmount || 0, inv.currentValue || 0,
                  inv.purchaseDate || null, existingInv.id
                ]
              );
            } else {
              // Insert new holdings
              const invId = crypto.randomUUID();
              await run(
                `INSERT INTO investments (id, portfolio_id, client_id, scheme_name, folio_number, nav, units, invested_amount, current_value, category, investment_type, purchase_date, amc)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'mutual_fund', 'lumpsum', ?, ?)`,
                [
                  invId, portfolio.id, resolvedClientId, inv.schemeName, inv.folioNumber || null,
                  inv.purchaseNav || 0, inv.units || 0, inv.investedAmount || 0, inv.currentValue || 0,
                  inv.purchaseDate || null, inv.schemeName.split(' ')[0] || 'Other'
                ]
              );

              await run('INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)', [
                crypto.randomUUID(), user.id, 'created', 'investment', invId, `Imported investment: ${inv.schemeName} (Folio ${inv.folioNumber})`
              ]);
            }
          }
        } catch (err: any) {
          logs.push({
            item: `Client: ${client.name}`,
            status: 'error',
            message: `Unexpected error: ${err.message || err}`,
          });
        }
      }
    } else {
      // Standard Flat Import
      const existingClientsList = await all('SELECT id, name, mobile, email, pan, city, state, occupation FROM clients WHERE is_active = 1');

      for (let i = 0; i < standardData.length; i++) {
        const row = standardData[i];
        const name = row['Client Name'] || row['Name'] || row['name'] || row['client_name'] || '';
        const mobile = String(row['Mobile'] || row['mobile'] || row['Phone'] || row['phone'] || '').replace(/\D/g, '');
        const pan = String(row['PAN'] || row['pan'] || '').toUpperCase().trim();
        const email = String(row['Email'] || row['email'] || '').trim();

        if (name && mobile && mobile.length === 10) {
          const matchedClient = existingClientsList.find(c => 
            (pan && c.pan && c.pan.toUpperCase() === pan) || 
            (c.mobile === mobile)
          );

          if (matchedClient) {
            const updateFields: string[] = [];
            const updateArgs: any[] = [];

            if (email && email !== matchedClient.email) {
              updateFields.push('email = ?');
              updateArgs.push(email);
            }
            if (pan && pan !== matchedClient.pan) {
              updateFields.push('pan = ?');
              updateArgs.push(pan);
            }
            if (name && name !== matchedClient.name) {
              updateFields.push('name = ?');
              updateArgs.push(String(name));
            }

            const city = String(row['City'] || row['city'] || '');
            if (city && city !== matchedClient.city) {
              updateFields.push('city = ?');
              updateArgs.push(city);
            }
            const state = String(row['State'] || row['state'] || '');
            if (state && state !== matchedClient.state) {
              updateFields.push('state = ?');
              updateArgs.push(state);
            }
            const occ = String(row['Occupation'] || row['occupation'] || '');
            if (occ && occ !== matchedClient.occupation) {
              updateFields.push('occupation = ?');
              updateArgs.push(occ);
            }

            if (updateFields.length > 0) {
              updateArgs.push(matchedClient.id);
              await run(`UPDATE clients SET ${updateFields.join(', ')}, updated_at = datetime('now') WHERE id = ?`, updateArgs);
              logs.push({
                item: `Row ${i + 1}: ${name}`,
                status: 'success',
                message: 'Updated existing client profile'
              });
            } else {
              logs.push({
                item: `Row ${i + 1}: ${name}`,
                status: 'success',
                message: 'Client profile already up-to-date'
              });
            }
          } else {
            const newClientId = crypto.randomUUID();
            await run(
              `INSERT INTO clients (id, user_id, name, mobile, pan, email, city, state, occupation, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                newClientId, user.id, String(name), mobile, pan || null, email || null,
                String(row['City'] || row['city'] || '') || null,
                String(row['State'] || row['state'] || '') || null,
                String(row['Occupation'] || row['occupation'] || '') || null
              ]
            );

            await run('INSERT INTO portfolios (id, client_id, total_invested, current_value, realized_gains) VALUES (?, ?, 0, 0, 0)', [
              crypto.randomUUID(), newClientId
            ]);

            await run('INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)', [
              crypto.randomUUID(), user.id, 'created', 'client', newClientId, `Bulk imported client: ${name}`
            ]);

            logs.push({
              item: `Row ${i + 1}: ${name}`,
              status: 'success',
              message: 'Client imported successfully',
            });
          }
        } else {
          logs.push({
            item: `Row ${i + 1}`,
            status: 'error',
            message: 'Missing Name or valid 10-digit Mobile',
          });
        }
      }
    }

    for (const clientId of clientIdsToRecalculate) {
      await recalculatePortfolio(clientId);
    }

    revalidatePath('/clients');
    revalidatePath('/dashboard');
    for (const clientId of clientIdsToRecalculate) {
      revalidatePath(`/portfolio/${clientId}`);
    }

    return { data: logs };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const logs: { item: string; status: 'success' | 'error'; message: string }[] = [];
  const clientIdsToRecalculate = new Set<string>();

  if (importType === 'portfolio' || importType === 'feed') {
    const investmentsToInsert: any[] = [];
    const activitiesToInsert: any[] = [];

    for (const client of extractedClients) {
      try {
        let resolvedClientId = client.existingId;
        let existingProfile: any = null;

        // 1. Find or create client
        if (!resolvedClientId) {
          // Double check if client exists by PAN or Mobile
          if (client.pan) {
            const { data: existingPanClient } = await supabase
              .from('clients')
              .select('id, name, mobile, email, pan, city, state')
              .eq('pan', client.pan)
              .eq('is_active', true)
              .maybeSingle();
            if (existingPanClient) {
              resolvedClientId = existingPanClient.id;
              existingProfile = existingPanClient;
            }
          }
          if (!resolvedClientId && client.mobile) {
            const { data: existingMobClient } = await supabase
              .from('clients')
              .select('id, name, mobile, email, pan, city, state')
              .eq('mobile', client.mobile)
              .eq('is_active', true)
              .maybeSingle();
            if (existingMobClient) {
              resolvedClientId = existingMobClient.id;
              existingProfile = existingMobClient;
            }
          }
        } else {
          // Fetch existing profile details for resolvedClientId
          const { data: profile } = await supabase
            .from('clients')
            .select('id, name, mobile, email, pan, city, state')
            .eq('id', resolvedClientId)
            .maybeSingle();
          existingProfile = profile;
        }

        if (!resolvedClientId) {
          // Create new client
          const { data: newClient, error: clientErr } = await supabase
            .from('clients')
            .insert({
              name: client.name,
              mobile: client.mobile,
              pan: client.pan || null,
              email: client.email || null,
              city: client.city || null,
              state: client.state || null,
              occupation: 'Business Owner',
              risk_profile: 'moderate',
              notes: importType === 'feed' ? 'Imported via CAMS Feed' : `Imported via Portfolio Sheet: KYC: ${client.kycStatus}`,
              user_id: user.id,
            })
            .select()
            .single();

          if (clientErr) {
            logs.push({
              item: `Client: ${client.name}`,
              status: 'error',
              message: `Failed to create client: ${clientErr.message}`,
            });
            continue;
          }
          resolvedClientId = newClient.id;
          logs.push({
            item: `Client: ${client.name}`,
            status: 'success',
            message: 'Created client successfully',
          });

          // Create portfolio record
          await supabase.from('portfolios').insert({
            client_id: resolvedClientId,
            total_invested: 0,
            current_value: 0,
            realized_gains: 0,
          });
        } else {
          // Check if we should update existing client details if feed has newer ones
          const updateData: any = {};
          if (client.email && client.email !== existingProfile?.email && !client.email.endsWith('@example.com')) {
            updateData.email = client.email;
          }
          if (client.pan && client.pan !== existingProfile?.pan) {
            updateData.pan = client.pan;
          }
          if (client.name && client.name !== existingProfile?.name) {
            updateData.name = client.name;
          }
          if (client.city && client.city !== existingProfile?.city && client.city !== 'Rajkot') {
            updateData.city = client.city;
          }
          if (client.state && client.state !== existingProfile?.state && client.state !== 'Gujarat') {
            updateData.state = client.state;
          }

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('clients')
              .update(updateData)
              .eq('id', resolvedClientId);
            logs.push({
              item: `Client: ${client.name}`,
              status: 'success',
              message: 'Linked and updated existing client profile',
            });
          } else {
            logs.push({
              item: `Client: ${client.name}`,
              status: 'success',
              message: 'Linked to existing client',
            });
          }
        }

        // Get portfolio ID
        let { data: portfolio } = await supabase
          .from('portfolios')
          .select('id')
          .eq('client_id', resolvedClientId)
          .maybeSingle();

        if (!portfolio) {
          const { data: newPortfolio } = await supabase
            .from('portfolios')
            .insert({
              client_id: resolvedClientId,
              total_invested: 0,
              current_value: 0,
              realized_gains: 0,
            })
            .select()
            .single();
          portfolio = newPortfolio;
        }

        clientIdsToRecalculate.add(resolvedClientId);

        // Prepare investments
        for (const inv of client.investments) {
          investmentsToInsert.push({
            client_id: resolvedClientId,
            portfolio_id: portfolio?.id || null,
            scheme_name: inv.schemeName,
            folio_number: inv.folioNumber || null,
            nav: inv.purchaseNav || 0,
            units: inv.units || 0,
            invested_amount: inv.investedAmount || 0,
            current_value: inv.currentValue || 0,
            category: 'mutual_fund',
            investment_type: 'lumpsum',
            purchase_date: inv.purchaseDate || null,
            scheme_code: null,
            amc: inv.schemeName.split(' ')[0] || 'Other',
          });

          activitiesToInsert.push({
            user_id: user.id,
            action: 'created',
            entity_type: 'investment',
            details: `Imported investment: ${inv.schemeName} (Folio ${inv.folioNumber})`,
          });
        }
      } catch (err: any) {
        logs.push({
          item: `Client: ${client.name}`,
          status: 'error',
          message: `Unexpected error: ${err.message || err}`,
        });
      }
    }

    // Bulk insert investments
    if (investmentsToInsert.length > 0) {
      const { data: insertedInvs, error: invErr } = await supabase
        .from('investments')
        .insert(investmentsToInsert)
        .select('id, folio_number, current_value');

      if (invErr) {
        logs.push({
          item: `Holdings Upload`,
          status: 'error',
          message: `Failed to insert holdings: ${invErr.message}`,
        });
      } else {
        logs.push({
          item: `Holdings Upload`,
          status: 'success',
          message: `Successfully batch-imported ${investmentsToInsert.length} holdings.`,
        });

        // Insert activities
        if (activitiesToInsert.length > 0) {
          const acts = activitiesToInsert.map((act, i) => ({
            ...act,
            entity_id: insertedInvs?.[i]?.id || null,
          }));
          await supabase.from('activities').insert(acts);
        }
      }
    }
  } else {
    // Standard Flat Import - Fetch all existing active clients once to prevent duplicate checks from hitting database in a loop
    const { data: allClients } = await supabase
      .from('clients')
      .select('id, name, mobile, email, pan, city, state, occupation')
      .eq('is_active', true);
    
    const existingClientsList = allClients || [];
    const clientsToInsert: any[] = [];
    const clientRows: any[] = [];

    for (let i = 0; i < standardData.length; i++) {
      const row = standardData[i];
      const name = row['Client Name'] || row['Name'] || row['name'] || row['client_name'] || '';
      const mobile = String(row['Mobile'] || row['mobile'] || row['Phone'] || row['phone'] || '').replace(/\D/g, '');
      const pan = String(row['PAN'] || row['pan'] || '').toUpperCase().trim();
      const email = String(row['Email'] || row['email'] || '').trim();

      if (name && mobile && mobile.length === 10) {
        // Find if client already exists by PAN or Mobile
        const matchedClient = existingClientsList.find(c => 
          (pan && c.pan && c.pan.toUpperCase() === pan) || 
          (c.mobile === mobile)
        );

        if (matchedClient) {
          // Check if details are different and need updating
          const updateData: any = {};
          if (email && email !== matchedClient.email) updateData.email = email;
          if (pan && pan !== matchedClient.pan) updateData.pan = pan;
          if (name && name !== matchedClient.name) updateData.name = String(name);
          
          if (row['City'] || row['city']) {
            const city = String(row['City'] || row['city']);
            if (city && city !== matchedClient.city) updateData.city = city;
          }
          if (row['State'] || row['state']) {
            const state = String(row['State'] || row['state']);
            if (state && state !== matchedClient.state) updateData.state = state;
          }
          if (row['Occupation'] || row['occupation']) {
            const occ = String(row['Occupation'] || row['occupation']);
            if (occ && occ !== matchedClient.occupation) updateData.occupation = occ;
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateErr } = await supabase
              .from('clients')
              .update(updateData)
              .eq('id', matchedClient.id);

            if (updateErr) {
              logs.push({
                item: `Row ${i + 1}: ${name}`,
                status: 'error',
                message: `Update failed: ${updateErr.message}`
              });
            } else {
              logs.push({
                item: `Row ${i + 1}: ${name}`,
                status: 'success',
                message: 'Updated existing client profile'
              });
            }
          } else {
            logs.push({
              item: `Row ${i + 1}: ${name}`,
              status: 'success',
              message: 'Client profile already up-to-date'
            });
          }
        } else {
          // Insert as a new client
          clientsToInsert.push({
            name: String(name),
            mobile,
            pan: pan || null,
            email: email || null,
            city: String(row['City'] || row['city'] || '') || null,
            state: String(row['State'] || row['state'] || '') || null,
            occupation: String(row['Occupation'] || row['occupation'] || '') || null,
            risk_profile: null,
            user_id: user.id,
          });
          clientRows.push({ name, index: i + 1 });
        }
      } else {
        logs.push({
          item: `Row ${i + 1}`,
          status: 'error',
          message: 'Missing Name or valid 10-digit Mobile',
        });
      }
    }

    if (clientsToInsert.length > 0) {
      // Bulk insert new clients
      const { data: insertedClients, error: insertErr } = await supabase
        .from('clients')
        .insert(clientsToInsert)
        .select('id, name');

      if (insertErr) {
        logs.push({
          item: `Clients Upload`,
          status: 'error',
          message: `Failed to bulk insert clients: ${insertErr.message}`,
        });
      } else {
        // Create portfolios & activities in bulk
        const portfoliosToInsert = (insertedClients || []).map(c => ({
          client_id: c.id,
          total_invested: 0,
          current_value: 0,
          realized_gains: 0,
        }));
        await supabase.from('portfolios').insert(portfoliosToInsert);

        const activitiesToInsert = (insertedClients || []).map(c => ({
          user_id: user.id,
          action: 'created',
          entity_type: 'client',
          entity_id: c.id,
          details: `Bulk imported client: ${c.name}`,
        }));
        await supabase.from('activities').insert(activitiesToInsert);

        (insertedClients || []).forEach(c => {
          const rowInfo = clientRows.find(cr => cr.name === c.name);
          logs.push({
            item: `Row ${rowInfo ? rowInfo.index : '?'}: ${c.name}`,
            status: 'success',
            message: 'Client imported successfully',
          });
        });
      }
    }
  }

  // 4. Recalculate portfolio totals on server
  for (const clientId of clientIdsToRecalculate) {
    try {
      await recalculatePortfolio(clientId);
    } catch {}
  }

  // 5. Revalidate paths
  revalidatePath('/clients');
  revalidatePath('/dashboard');
  for (const clientId of clientIdsToRecalculate) {
    revalidatePath(`/portfolio/${clientId}`);
  }

  return { data: logs };
}

export async function importNavFeedAction() {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };

  try {
    const feedDir = path.join(process.cwd(), 'feed');
    if (!fs.existsSync(feedDir)) {
      return { error: "Feed directory 'feed/' not found." };
    }

    const files = fs.readdirSync(feedDir).filter(f => {
      const ext = f.toLowerCase();
      return ext.endsWith('.csv') || ext.endsWith('.dbf');
    });

    if (files.length === 0) {
      return { error: "No CSV or DBF files found in 'feed/' directory." };
    }

    // Sort files numerically if possible e.g., Feed1, Feed2, etc.
    files.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    const latestNavsMap = new Map<string, any>();
    const logs: string[] = [];
    let filesProcessed = 0;

    for (const file of files) {
      const filePath = path.join(feedDir, file);

      if (file.toLowerCase().endsWith('.dbf')) {
        // Dynamic DBF Binary Parser — reads field descriptors from header
        const fd = fs.openSync(filePath, 'r');
        const headerBuf = Buffer.alloc(32);
        fs.readSync(fd, headerBuf, 0, 32, 0);

        const numRecords = headerBuf.readUInt32LE(4);
        const headerLength = headerBuf.readUInt16LE(8);
        const recordLength = headerBuf.readUInt16LE(10);
        const numFieldDefs = Math.floor((headerLength - 33) / 32);

        // Read field descriptors dynamically
        const fieldMap: Record<string, { offset: number; length: number }> = {};
        let currentFieldOffset = 1; // skip deletion flag byte
        for (let fi = 0; fi < numFieldDefs; fi++) {
          const fieldBuf = Buffer.alloc(32);
          fs.readSync(fd, fieldBuf, 0, 32, 32 + (fi * 32));
          const fieldName = fieldBuf.toString('ascii', 0, 11).replace(/\0/g, '').trim();
          const fieldLen = fieldBuf[16];
          fieldMap[fieldName] = { offset: currentFieldOffset, length: fieldLen };
          currentFieldOffset += fieldLen;
        }

        // Map known field names
        const schemeCodeField = fieldMap['PRODCODE'] || fieldMap['SCHEME_CODE'] || fieldMap['SCHEMECODE'];
        const nameField = fieldMap['NAME'] || fieldMap['SCHEME_NAM'] || fieldMap['SCHEMENAME'];
        const navDateField = fieldMap['NAV_DATE'] || fieldMap['NAVDATE'];
        const navValueField = fieldMap['NAV_VALUE'] || fieldMap['NAV'];
        const isinField = fieldMap['ISIN_NO'] || fieldMap['ISIN'] || fieldMap['SCHEMEISIN'];

        if (!schemeCodeField || !navDateField || !navValueField) {
          logs.push(`Skipped DBF ${file}: Required fields (PRODCODE/NAV_DATE/NAV_VALUE) not found in header. Found: ${Object.keys(fieldMap).join(', ')}`);
          fs.closeSync(fd);
          continue;
        }

        const bufferSize = 20000 * recordLength; // 20k records at a time
        const recordBuf = Buffer.alloc(bufferSize);

        let recordCount = 0;
        let fileOffset = headerLength;

        while (recordCount < numRecords) {
          const recordsToRead = Math.min(20000, numRecords - recordCount);
          const bytesToRead = recordsToRead * recordLength;
          const bytesRead = fs.readSync(fd, recordBuf, 0, bytesToRead, fileOffset);

          if (bytesRead === 0) break;

          for (let i = 0; i < recordsToRead; i++) {
            const chunkOffset = i * recordLength;
            if (recordBuf[chunkOffset] === 0x20) { // Valid active record
              const schemeCode = recordBuf.toString('ascii', chunkOffset + schemeCodeField.offset, chunkOffset + schemeCodeField.offset + schemeCodeField.length).trim();
              const navDateRaw = recordBuf.toString('ascii', chunkOffset + navDateField.offset, chunkOffset + navDateField.offset + navDateField.length).trim();

              if (/^\d{8}$/.test(navDateRaw)) {
                const existing = latestNavsMap.get(schemeCode);
                if (!existing || navDateRaw > (existing.rawDate || '')) {
                  const schemeName = nameField
                    ? recordBuf.toString('ascii', chunkOffset + nameField.offset, chunkOffset + nameField.offset + nameField.length).trim()
                    : schemeCode;
                  const navRaw = recordBuf.toString('ascii', chunkOffset + navValueField.offset, chunkOffset + navValueField.offset + navValueField.length).trim();
                  const isin = isinField
                    ? recordBuf.toString('ascii', chunkOffset + isinField.offset, chunkOffset + isinField.offset + isinField.length).trim()
                    : '';
                  const nav = parseFloat(navRaw) || 0;

                  let fundName = schemeName.split(' ').slice(0, 3).join(' ');

                  latestNavsMap.set(schemeCode, {
                    fund: fundName,
                    schemeCode,
                    schemeName,
                    productCode: schemeCode,
                    navDate: `${navDateRaw.substring(0,4)}-${navDateRaw.substring(4,6)}-${navDateRaw.substring(6,8)}`,
                    rawDate: navDateRaw,
                    nav,
                    salePrice: nav,
                    repurchasePrice: nav,
                    isin
                  });
                }
              }
            }
          }

          recordCount += recordsToRead;
          fileOffset += bytesRead;
        }
        fs.closeSync(fd);
        logs.push(`Processed DBF ${file}: ${recordCount.toLocaleString()} rows (Unique schemes cached: ${latestNavsMap.size}).`);
      } else {
        // Fast CSV Stream Parser (Optimized with column index pre-mapping and fast-path split)
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
        });

        let lineCount = 0;
        let colIndices = {
          schemeCode: -1,
          navDate: -1,
          nav: -1,
          fund: -1,
          schemeName: -1,
          productCode: -1,
          salePrice: -1,
          repurchasePrice: -1,
          reportDate: -1,
          reportTime: -1,
          isin: -1
        };

        for await (const line of rl) {
          lineCount++;
          if (lineCount === 1) {
            const header = parseCSVLineFast(line).map(h => h.trim().toUpperCase());
            colIndices = {
              schemeCode: Math.max(header.indexOf('SCHEME CODE'), header.indexOf('SCHEMECODE'), header.indexOf('PRODUCT CODE'), header.indexOf('PRODUCTCODE')),
              navDate: Math.max(header.indexOf('NAV DATE'), header.indexOf('NAVDATE')),
              nav: header.indexOf('NAV'),
              fund: header.indexOf('FUND'),
              schemeName: Math.max(header.indexOf('FUND DESCRIPTION'), header.indexOf('FUNDDESCRIPTION'), header.indexOf('SCHEME NAME'), header.indexOf('SCHEMENAME')),
              productCode: Math.max(header.indexOf('PRODUCT CODE'), header.indexOf('PRODUCTCODE')),
              salePrice: Math.max(header.indexOf('SALE PRICE'), header.indexOf('SALEPRICE')),
              repurchasePrice: Math.max(header.indexOf('REPURCHASE PRICE'), header.indexOf('REPURCHASEPRICE')),
              reportDate: Math.max(header.indexOf('REPORT DATE'), header.indexOf('REPORTDATE')),
              reportTime: Math.max(header.indexOf('REPORT TIME'), header.indexOf('REPORTTIME')),
              isin: Math.max(header.indexOf('SCHEMEISIN'), header.indexOf('ISIN'))
            };
            continue;
          }

          const values = parseCSVLineFast(line);
          if (values.length < 5) continue;

          const schemeCode = colIndices.schemeCode !== -1 ? values[colIndices.schemeCode] : '';
          if (!schemeCode) continue;

          const navDateRaw = colIndices.navDate !== -1 ? values[colIndices.navDate] : '';
          const navRaw = colIndices.nav !== -1 ? values[colIndices.nav] : '';
          if (!navDateRaw || !navRaw) continue;

          const navDate = parseNavFeedDate(navDateRaw);
          const nav = parseFloat(navRaw) || 0;

          const existing = latestNavsMap.get(schemeCode);
          if (!existing || navDate > existing.navDate) {
            latestNavsMap.set(schemeCode, {
              fund: colIndices.fund !== -1 ? values[colIndices.fund] : 'Other',
              schemeCode,
              schemeName: colIndices.schemeName !== -1 ? values[colIndices.schemeName] : schemeCode,
              productCode: colIndices.productCode !== -1 ? values[colIndices.productCode] : schemeCode,
              navDate,
              nav,
              salePrice: colIndices.salePrice !== -1 ? parseFloat(values[colIndices.salePrice]) || null : null,
              repurchasePrice: colIndices.repurchasePrice !== -1 ? parseFloat(values[colIndices.repurchasePrice]) || null : null,
              reportDate: colIndices.reportDate !== -1 ? values[colIndices.reportDate] : null,
              reportTime: colIndices.reportTime !== -1 ? values[colIndices.reportTime] : null,
              isin: colIndices.isin !== -1 ? values[colIndices.isin] : null
            });
          }
        }
        logs.push(`Processed CSV ${file}: ${lineCount.toLocaleString()} rows (Unique schemes cached: ${latestNavsMap.size}).`);
      }

      filesProcessed++;
    }

    // Insert the latest unique NAV records into the database
    const uniqueRecords = Array.from(latestNavsMap.values());
    await insertBatch(uniqueRecords);

    // Now update existing active investments using highly optimized batch transactions
    const updateResult = await updateInvestmentsWithLatestNAVs();

    return {
      success: true,
      message: `Successfully processed ${filesProcessed} feed files (Ingested ${uniqueRecords.length} unique schemes).`,
      details: logs,
      investmentsUpdated: updateResult.updatedCount,
    };
  } catch (err: any) {
    console.error('NAV feed import error:', err);
    return { error: err.message || 'Failed to import NAV feed' };
  }
}

export async function importNavFeedFileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };

  try {
    const file = formData.get('file') as File;
    if (!file) {
      return { error: 'No file uploaded.' };
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return { error: 'Invalid file format. Please upload a CSV file.' };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { Readable } = require('stream');
    const fileStream = Readable.from(buffer);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const latestNavsMap = new Map<string, any>();
    let lineCount = 0;
    let header: string[] = [];

    for await (const line of rl) {
      lineCount++;
      if (lineCount === 1) {
        header = parseCSVLine(line).map(h => h.trim().toUpperCase());
        continue;
      }

      const values = parseCSVLine(line);
      if (values.length < 5) continue;

      const getVal = (colName: string) => {
        const idx = header.indexOf(colName);
        return idx !== -1 ? values[idx] : '';
      };

      const schemeCode = getVal('SCHEME CODE') || getVal('SCHEMECODE') || getVal('PRODUCT CODE') || getVal('PRODUCTCODE');
      if (!schemeCode) continue;

      const navDateRaw = getVal('NAV DATE') || getVal('NAVDATE');
      const navRaw = getVal('NAV');
      if (!navDateRaw || !navRaw) continue;

      const navDate = parseNavFeedDate(navDateRaw);
      const nav = parseFloat(navRaw) || 0;

      const existing = latestNavsMap.get(schemeCode);
      if (!existing || navDate > existing.navDate) {
        latestNavsMap.set(schemeCode, {
          fund: getVal('FUND'),
          schemeCode,
          schemeName: getVal('FUND DESCRIPTION') || getVal('FUNDDESCRIPTION'),
          productCode: getVal('PRODUCT CODE') || getVal('PRODUCTCODE'),
          navDate,
          nav,
          salePrice: parseFloat(getVal('SALE PRICE')) || null,
          repurchasePrice: parseFloat(getVal('REPURCHASE PRICE')) || null,
          reportDate: getVal('REPORT DATE'),
          reportTime: getVal('REPORT TIME'),
          isin: getVal('SCHEMEISIN') || getVal('ISIN')
        });
      }
    }

    const uniqueRecords = Array.from(latestNavsMap.values());
    if (uniqueRecords.length === 0) {
      return { error: 'No valid scheme NAV records found in the uploaded file.' };
    }
    
    await insertBatch(uniqueRecords);

    // Now update existing active investments
    const updateResult = await updateInvestmentsWithLatestNAVs();

    return {
      success: true,
      message: `Successfully processed manual upload: ${file.name} (${lineCount.toLocaleString()} rows, ${uniqueRecords.length} unique schemes).`,
      investmentsUpdated: updateResult.updatedCount,
    };
  } catch (err: any) {
    console.error('NAV feed file upload error:', err);
    return { error: err.message || 'Failed to process NAV feed file' };
  }
}

async function insertBatch(batch: any[]) {
  const statements = batch.map(row => ({
    sql: `INSERT OR REPLACE INTO scheme_navs (
            fund, scheme_code, scheme_name, product_code, nav_date, 
            nav, sale_price, repurchase_price, report_date, report_time, isin
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.fund || null, row.schemeCode, row.schemeName, row.productCode || null, row.navDate,
      row.nav, row.salePrice, row.repurchasePrice, row.reportDate || null, row.reportTime || null, row.isin || null
    ]
  }));

  const chunkSize = 1000;
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    await db.batch(chunk);
  }
}
export async function updateInvestmentsWithLatestNAVs() {
  // Step 1: Bulk update investments that have a scheme_code match in scheme_navs
  const result1 = await run(`
    UPDATE investments 
    SET 
      nav = (SELECT sn.nav FROM scheme_navs sn WHERE sn.scheme_code = investments.scheme_code ORDER BY sn.nav_date DESC LIMIT 1),
      current_value = investments.units * (SELECT sn.nav FROM scheme_navs sn WHERE sn.scheme_code = investments.scheme_code ORDER BY sn.nav_date DESC LIMIT 1),
      updated_at = datetime('now')
    WHERE investments.scheme_code IS NOT NULL 
      AND investments.scheme_code != ''
      AND EXISTS (SELECT 1 FROM scheme_navs sn WHERE sn.scheme_code = investments.scheme_code)
  `);

  // Step 2: For investments without scheme_code, try matching by scheme_name
  const result2 = await run(`
    UPDATE investments 
    SET 
      nav = (SELECT sn.nav FROM scheme_navs sn WHERE sn.scheme_name = investments.scheme_name ORDER BY sn.nav_date DESC LIMIT 1),
      current_value = investments.units * (SELECT sn.nav FROM scheme_navs sn WHERE sn.scheme_name = investments.scheme_name ORDER BY sn.nav_date DESC LIMIT 1),
      scheme_code = (SELECT sn.scheme_code FROM scheme_navs sn WHERE sn.scheme_name = investments.scheme_name ORDER BY sn.nav_date DESC LIMIT 1),
      updated_at = datetime('now')
    WHERE (investments.scheme_code IS NULL OR investments.scheme_code = '')
      AND EXISTS (SELECT 1 FROM scheme_navs sn WHERE sn.scheme_name = investments.scheme_name)
  `);

  const updatedCount = (result1.rowsAffected || 0) + (result2.rowsAffected || 0);

  // Step 3: Bulk recalculate all portfolio totals in one go
  await run(`
    UPDATE portfolios 
    SET 
      total_invested = COALESCE((SELECT SUM(invested_amount) FROM investments WHERE investments.client_id = portfolios.client_id), 0),
      current_value = COALESCE((SELECT SUM(current_value) FROM investments WHERE investments.client_id = portfolios.client_id), 0),
      updated_at = datetime('now')
    WHERE EXISTS (SELECT 1 FROM investments WHERE investments.client_id = portfolios.client_id)
  `);

  return { updatedCount };
}

function parseCSVLineFast(line: string): string[] {
  if (line.indexOf('"') === -1) {
    return line.split(',');
  }
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSVLine(line: string): string[] {
  return parseCSVLineFast(line);
}

function parseNavFeedDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}
