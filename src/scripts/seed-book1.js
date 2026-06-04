/**
 * Seed Script: Import Book1.xls data into Supabase
 * 
 * HOW TO USE:
 * 1. First, sign up through the app (http://localhost:3000/signup)
 * 2. Get your user ID from Supabase Dashboard > Authentication > Users
 * 3. Set SUPABASE_SERVICE_ROLE_KEY in .env.local
 * 4. Run: node src/scripts/seed-book1.js YOUR_USER_ID
 * 
 * This script reads Book1.xls and inserts all clients, portfolios, 
 * and investments into your Supabase database.
 */

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'placeholder-service-role-key') {
  console.error('❌ Error: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('   The service role key must be a real key from Supabase Dashboard > Settings > API');
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error('❌ Usage: node src/scripts/seed-book1.js <YOUR_USER_ID>');
  console.error('   Get your user ID from Supabase Dashboard > Authentication > Users');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seed() {
  console.log('🔄 Reading Book1.xls...');
  
  const wb = XLSX.readFile(path.join(process.cwd(), 'Book1.xls'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Parse the structured portfolio format
  const clients = [];
  let currentClient = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Detect client header: ["", "NIKUNJBHAI K AMLANI - AFKPA4817N", "", "KYC - KYC VALIDATED", ...]
    if (
      row[1] && typeof row[1] === 'string' && row[1].includes(' - ') &&
      row[3] && typeof row[3] === 'string' && row[3].startsWith('KYC')
    ) {
      const parts = row[1].split(' - ');
      const name = parts[0].trim();
      const pan = parts[1].trim().toUpperCase();
      const kycStatus = row[3].trim();

      currentClient = {
        name,
        pan,
        kycStatus,
        mobile: '9988779292', // Default - will need to be updated
        email: `${name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '')}@example.com`,
        city: 'Rajkot',
        state: 'Gujarat',
        investments: []
      };
      clients.push(currentClient);
    }

    // Detect investment headers: ["Folio no.", "Scheme Name", "Invt Amt Rs", "Curr Amt Rs", "Profit / Loss Rs"]
    if (row[0] === 'Folio no.' && row[1] === 'Scheme Name') {
      // Next row has the data
      const dataRow = rows[i + 1];
      if (dataRow && dataRow[0] && currentClient) {
        currentClient.investments.push({
          folio_number: String(dataRow[0]).trim(),
          scheme_name: String(dataRow[1]).trim(),
          invested_amount: Number(dataRow[2]) || 0,
          current_value: Number(dataRow[3]) || 0,
          profit_loss: Number(dataRow[4]) || 0,
        });
      }
    }
  }

  console.log(`📊 Found ${clients.length} clients with ${clients.reduce((s, c) => s + c.investments.length, 0)} investments`);

  // Insert clients and their portfolios
  for (const client of clients) {
    console.log(`\n👤 Creating client: ${client.name} (${client.pan})`);

    // Create client
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .insert({
        user_id: userId,
        name: client.name,
        pan: client.pan,
        mobile: client.mobile,
        email: client.email,
        city: client.city,
        state: client.state,
        occupation: 'Business Owner',
        risk_profile: 'moderate',
        is_active: true,
        notes: `KYC Status: ${client.kycStatus}`,
      })
      .select()
      .single();

    if (clientError) {
      console.error(`   ❌ Error creating client: ${clientError.message}`);
      continue;
    }
    console.log(`   ✅ Client created with ID: ${clientData.id}`);

    // Create portfolio
    const totalInvested = client.investments.reduce((s, inv) => s + inv.invested_amount, 0);
    const currentValue = client.investments.reduce((s, inv) => s + inv.current_value, 0);

    const { data: portfolioData, error: portfolioError } = await supabase
      .from('portfolios')
      .insert({
        client_id: clientData.id,
        total_invested: totalInvested,
        current_value: currentValue,
        realized_gains: 0,
      })
      .select()
      .single();

    if (portfolioError) {
      console.error(`   ❌ Error creating portfolio: ${portfolioError.message}`);
      continue;
    }
    console.log(`   ✅ Portfolio created: ₹${currentValue.toLocaleString()}`);

    // Create investments
    for (const inv of client.investments) {
      const { error: invError } = await supabase
        .from('investments')
        .insert({
          portfolio_id: portfolioData.id,
          client_id: clientData.id,
          scheme_name: inv.scheme_name,
          folio_number: inv.folio_number,
          invested_amount: inv.invested_amount,
          current_value: inv.current_value,
          units: inv.invested_amount > 0 ? inv.invested_amount / 10 : 0, // Approximate
          nav: inv.current_value / (inv.invested_amount > 0 ? inv.invested_amount / 10 : 1),
          category: 'mutual_fund',
          amc: inv.scheme_name.split(' ')[0] || 'Other',
          investment_type: 'lumpsum',
        });

      if (invError) {
        console.error(`   ❌ Error creating investment: ${invError.message}`);
      } else {
        console.log(`   ✅ Investment: ${inv.scheme_name} - ₹${inv.current_value.toLocaleString()}`);
      }
    }
  }

  // Log activity
  await supabase.from('activities').insert({
    user_id: userId,
    action: 'imported',
    entity_type: 'system',
    entity_id: null,
    details: 'Seeded Book1.xls data via seed script',
  });

  // Record file import
  await supabase.from('file_imports').insert({
    user_id: userId,
    file_name: 'Book1.xls',
    file_size: 0,
    import_type: 'portfolio',
    clients_created: clients.length,
    investments_created: clients.reduce((s, c) => s + c.investments.length, 0),
    status: 'completed',
    notes: 'Seeded via seed-book1.js script',
  });

  console.log('\n🎉 Seed complete! All Book1.xls data has been imported.');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
