import { getFamilies } from '@/lib/actions/families';
import { FamilyList } from '@/components/families/family-list';

export default async function FamiliesPage() {
  let families: any[] = [];
  try {
    families = await getFamilies();
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Families</h1>
        <p className="text-sm text-gray-500">{families.length} families</p>
      </div>
      <FamilyList initialFamilies={families} />
    </div>
  );
}
