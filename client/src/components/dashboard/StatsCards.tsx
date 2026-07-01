import { FolderKanban, Clock, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import type { DashboardStats } from '@rd/shared';

interface StatsCardsProps {
  stats?: DashboardStats;
  loading?: boolean;
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  const items = [
    {
      label: 'Dự án đang hoạt động',
      value: stats?.activeProjects ?? 0,
      icon: FolderKanban,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Sắp đến deadline (30 ngày)',
      value: stats?.upcomingDeadlines ?? 0,
      icon: Clock,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
    },
    {
      label: 'Công việc quá hạn',
      value: stats?.overdueTasks ?? 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      label: 'Rủi ro cao đang mở',
      value: stats?.highRisks ?? 0,
      icon: ShieldAlert,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground leading-tight">{item.label}</p>
              <div className={`p-2 rounded-lg ${item.bg}`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
