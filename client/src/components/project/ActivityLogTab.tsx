import { useEffect, useState } from 'react';
import { FolderKanban, CheckSquare, ShieldAlert, FileText, Layers, Factory, Handshake, ClipboardList, Package, BoxIcon } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn, formatRelativeTime } from '../../lib/utils';
import { api } from '../../lib/api';
import type { ActivityLog, ActivityEntityType } from '@rd/shared';

interface ActivityLogTabProps {
  projectId: string;
}

const ENTITY_ICONS: Record<ActivityEntityType, React.ComponentType<{ className?: string }>> = {
  project: FolderKanban,
  stage: Layers,
  task: CheckSquare,
  risk: ShieldAlert,
  document: FileText,
  factory: Factory,
  engagement: Handshake,
  rfq: ClipboardList,
  sample: BoxIcon,
  packaging: Package,
};

const ENTITY_COLORS: Record<ActivityEntityType, string> = {
  project: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30',
  stage: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30',
  task: 'bg-green-100 text-green-600 dark:bg-green-900/30',
  risk: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30',
  document: 'bg-slate-100 text-slate-600 dark:bg-slate-800',
  factory: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30',
  engagement: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30',
  rfq: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30',
  sample: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30',
  packaging: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30',
};

export function ActivityLogTab({ projectId }: ActivityLogTabProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.activities.list(projectId);
        setActivities(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Chưa có hoạt động nào được ghi lại.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />

      <div className="space-y-4">
        {activities.map((activity, i) => {
          const Icon = ENTITY_ICONS[activity.entityType] ?? FolderKanban;
          const colorClass = ENTITY_COLORS[activity.entityType] ?? ENTITY_COLORS.project;

          return (
            <div key={activity.id} className="flex gap-3 relative">
              {/* Icon dot */}
              <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10', colorClass)}>
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm">
                  <span className="font-medium">{activity.performedBy}</span>{' '}
                  <span className="text-muted-foreground">{activity.action}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatRelativeTime(activity.performedAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
