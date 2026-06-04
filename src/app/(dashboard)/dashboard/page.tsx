import { getDashboardStats, getActivities } from '@/lib/actions/dashboard';
import { getAssetAllocation } from '@/lib/actions/portfolio';
import { DashboardCards } from '@/components/dashboard/dashboard-cards';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { RecentActivity } from '@/components/dashboard/recent-activity';

export default async function DashboardPage() {
  let stats = null;
  let activities: any[] = [];
  let assetAllocation: any[] = [];

  try {
    [stats, activities, assetAllocation] = await Promise.all([
      getDashboardStats(),
      getActivities(10),
      getAssetAllocation(),
    ]);
  } catch {
    // Will show zeros if Supabase is not configured
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome to Dhara Financial Services</p>
      </div>

      <DashboardCards stats={stats} />
      <DashboardCharts assetAllocation={assetAllocation} />
      <RecentActivity activities={activities} />
    </div>
  );
}
