'use client';

import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/helpers';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = ['#2563EB', '#0F172A', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

interface DashboardChartsProps {
  assetAllocation: Array<{ name: string; value: number }>;
}

export function DashboardCharts({ assetAllocation }: DashboardChartsProps) {
  const hasData = assetAllocation.length > 0;

  // Calculate total for percentage
  const total = assetAllocation.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Asset Allocation Pie Chart */}
      <Card className="p-6 bg-white border-gray-200">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Asset Allocation</h3>
        {hasData ? (
          <div className="flex items-center gap-4">
            <div className="w-48 h-48 min-w-[192px] min-h-[192px]">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 192, height: 192 }}>
                <PieChart>
                  <Pie
                    data={assetAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {assetAllocation.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value || 0)}
                    contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {assetAllocation.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-600 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="font-medium text-[#0F172A]">
                    {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">
            No investment data available
          </div>
        )}
      </Card>

      {/* AUM Growth Bar Chart */}
      <Card className="p-6 bg-white border-gray-200">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-4">AUM Overview</h3>
        {hasData ? (
          <div className="h-[200px] w-full min-w-[200px] min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 200, height: 200 }}>
              <BarChart data={assetAllocation.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 10 ? value.slice(0, 10) + '...' : value}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value || 0)}
                  contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                />
                <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">
            No data available
          </div>
        )}
      </Card>
    </div>
  );
}
