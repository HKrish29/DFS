import { getClients } from '@/lib/actions/clients';
import { PortfolioView } from '@/components/portfolio/portfolio-view';

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const params = await searchParams;
  let clients: any[] = [];
  try {
    clients = await getClients();
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Portfolio</h1>
        <p className="text-sm text-gray-500">Client portfolio management</p>
      </div>
      <PortfolioView clients={clients} selectedClientId={params.client} />
    </div>
  );
}
