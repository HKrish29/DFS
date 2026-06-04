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

export async function bulkImportAction(payload: {
  importType: 'portfolio' | 'feed' | 'standard';
  extractedClients?: any[];
  standardData?: any[];
}) {
  const { importType, extractedClients = [], standardData = [] } = payload;
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

