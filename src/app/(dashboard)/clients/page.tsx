import { getClients } from '@/lib/actions/clients';
import { ClientList } from '@/components/clients/client-list';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; risk?: string }>;
}) {
  const params = await searchParams;
  let clients: any[] = [];

  try {
    clients = await getClients(params.search, params.risk);
  } catch {
    // Supabase not configured
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Clients</h1>
          <p className="text-sm text-gray-500">{clients.length} total clients</p>
        </div>
      </div>
      <ClientList initialClients={clients} />
    </div>
  );
}
