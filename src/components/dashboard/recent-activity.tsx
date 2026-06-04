'use client';

import { Card } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/helpers';
import type { Activity } from '@/lib/types';
import { Activity as ActivityIcon } from 'lucide-react';

interface RecentActivityProps {
  activities: any[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card className="p-6 bg-white border-gray-200">
      <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Recent Activity</h3>
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <ActivityIcon className="h-8 w-8 mb-2" />
          <p className="text-sm">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 rounded-lg p-3 hover:bg-gray-50"
            >
              <div className="mt-0.5 h-2 w-2 rounded-full bg-[#2563EB] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{activity.user?.full_name || 'System'}</span>{' '}
                  {activity.action}{' '}
                  <span className="text-gray-500">{activity.entity_type}</span>
                </p>
                {activity.details && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.details}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {formatDateTime(activity.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
