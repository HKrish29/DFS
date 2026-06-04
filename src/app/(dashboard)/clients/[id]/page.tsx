import { getClient } from '@/lib/actions/clients';
import { getPortfolio } from '@/lib/actions/portfolio';
import { getGoals } from '@/lib/actions/goals';
import { getDocuments } from '@/lib/actions/documents';
import { getNotes } from '@/lib/actions/crm';
import { ClientDetail } from '@/components/clients/client-detail';
import { notFound } from 'next/navigation';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let client = null;
  let portfolio = null;
  let goals: any[] = [];
  let documents: any[] = [];
  let notes: any[] = [];

  try {
    client = await getClient(id);
    if (!client) notFound();

    [portfolio, goals, documents, notes] = await Promise.all([
      getPortfolio(id),
      getGoals(id),
      getDocuments(id),
      getNotes(id),
    ]);
  } catch {
    notFound();
  }

  return (
    <ClientDetail
      client={client}
      portfolio={portfolio}
      goals={goals}
      documents={documents}
      notes={notes}
    />
  );
}
