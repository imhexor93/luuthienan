import { useNavigate } from 'react-router-dom';
import { Calendar, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Skeleton } from '../ui/skeleton';
import { cn, formatDate, daysUntil } from '../../lib/utils';
import { STAGE_COLORS, STAGE_NAMES } from '../../lib/constants';
import type { ProjectWithProgress } from '@rd/shared';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '../../lib/constants';

interface ProjectCardProps {
  project: ProjectWithProgress;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  const days = daysUntil(project.targetLaunchDate);
  const isOverdue = days < 0;
  const isUrgent = days >= 0 && days <= 30;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {project.name}
          </h3>
          <Badge className={cn('shrink-0 text-xs', PROJECT_STATUS_COLORS[project.status])}>
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </div>

        {/* Brand / Market / Category */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3 min-h-[18px]">
          {project.brand && (
            <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{project.brand}</span>
          )}
          {project.market && (
            <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">{project.market}</span>
          )}
          {project.productCategory && !project.brand && !project.market && (
            <span className="text-xs text-muted-foreground">{project.productCategory}</span>
          )}
          {project.productCategory && (project.brand || project.market) && (
            <span className="text-[11px] text-muted-foreground/70">{project.productCategory}</span>
          )}
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Tiến độ tổng
            </span>
            <span className="font-semibold">{project.progressPercent}%</span>
          </div>
          <Progress
            value={project.progressPercent}
            className="h-1.5"
            indicatorClassName={
              project.progressPercent === 100 ? 'bg-green-500' : 'bg-primary'
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            {project.doneTasks}/{project.totalTasks} công việc
          </p>
        </div>

        {/* Stage timeline mini — stage 1 | [dev×4 grouped] | stage 6 | stage 7 */}
        <div className="flex items-center gap-0.5 mb-3">
          {(() => {
            const stage1 = project.stages.find((s) => s.order === 1);
            const devStages = project.stages.filter((s) => s.stageGroup === 'development').sort((a, b) => a.order - b.order);
            const stage6 = project.stages.find((s) => s.order === 6);
            const stage7 = project.stages.find((s) => s.order === 7);
            const devPassedCount = devStages.filter((s) => s.gateStatus === 'passed').length;
            const devAllPassed = devStages.length > 0 && devPassedCount === devStages.length;

            const linearSegments = [stage1, stage6, stage7].filter(Boolean);
            // Each linear = 1 unit, dev group = 2 units
            const totalUnits = linearSegments.length + (devStages.length > 0 ? 2 : 0);

            return (
              <>
                {stage1 && (
                  <div className="flex-1" style={{ flex: 1 / totalUnits }}>
                    <div
                      className={cn('h-1.5 rounded-full transition-all', stage1.gateStatus === 'passed' ? 'opacity-100' : stage1.gateStatus === 'in-progress' ? 'opacity-70' : 'opacity-20')}
                      style={{ backgroundColor: STAGE_COLORS[0] }}
                      title={STAGE_NAMES[0]}
                    />
                  </div>
                )}
                {devStages.length > 0 && (
                  <div className="flex gap-0.5" style={{ flex: 2 / totalUnits }}>
                    {devStages.map((stage, i) => (
                      <div key={stage.id} className="flex-1">
                        <div
                          className={cn('h-1.5 rounded-full transition-all', stage.gateStatus === 'passed' ? 'opacity-100' : stage.gateStatus === 'in-progress' ? 'opacity-70' : 'opacity-20')}
                          style={{ backgroundColor: STAGE_COLORS[i + 1] }}
                          title={STAGE_NAMES[i + 1]}
                        />
                      </div>
                    ))}
                    {devAllPassed && (
                      <div className="absolute" />
                    )}
                  </div>
                )}
                {stage6 && (
                  <div className="flex-1" style={{ flex: 1 / totalUnits }}>
                    <div
                      className={cn('h-1.5 rounded-full transition-all', stage6.gateStatus === 'passed' ? 'opacity-100' : stage6.gateStatus === 'in-progress' ? 'opacity-70' : 'opacity-20')}
                      style={{ backgroundColor: STAGE_COLORS[5] }}
                      title={STAGE_NAMES[5]}
                    />
                  </div>
                )}
                {stage7 && (
                  <div className="flex-1" style={{ flex: 1 / totalUnits }}>
                    <div
                      className={cn('h-1.5 rounded-full transition-all', stage7.gateStatus === 'passed' ? 'opacity-100' : stage7.gateStatus === 'in-progress' ? 'opacity-70' : 'opacity-20')}
                      style={{ backgroundColor: STAGE_COLORS[6] }}
                      title={STAGE_NAMES[6]}
                    />
                  </div>
                )}
                {/* Fallback for stages not in structured layout */}
                {project.stages.filter((s) => s.order !== 1 && s.stageGroup !== 'development' && s.order !== 6 && s.order !== 7).map((stage, i) => (
                  <div key={stage.id} className="flex-1">
                    <div
                      className={cn('h-1.5 rounded-full transition-all', stage.gateStatus === 'passed' ? 'opacity-100' : stage.gateStatus === 'in-progress' ? 'opacity-70' : 'opacity-20')}
                      style={{ backgroundColor: STAGE_COLORS[Math.min(stage.order - 1, STAGE_COLORS.length - 1)] }}
                      title={stage.name}
                    />
                  </div>
                ))}
              </>
            );
          })()}
        </div>

        {/* Current stage */}
        {project.currentStage && (
          <div className="flex items-center gap-1.5 mb-3">
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: STAGE_COLORS[Math.min((project.currentStage.order ?? 1) - 1, STAGE_COLORS.length - 1)] }}
            />
            <span className="text-xs text-muted-foreground truncate">
              {project.currentStage.name}
            </span>
            <span className="text-xs font-medium ml-auto">
              {project.currentStage.progressPercent}%
            </span>
          </div>
        )}

        {/* Deadline */}
        <div className={cn('flex items-center gap-1.5 text-xs', isOverdue ? 'text-red-500' : isUrgent ? 'text-orange-500' : 'text-muted-foreground')}>
          <Calendar className="h-3 w-3" />
          <span>Ra mắt: {formatDate(project.targetLaunchDate)}</span>
          {isOverdue && <span className="ml-auto font-medium">Quá hạn {Math.abs(days)} ngày</span>}
          {isUrgent && !isOverdue && <span className="ml-auto font-medium">Còn {days} ngày</span>}
        </div>

        {/* Progress summary */}
        {project.progressSummary && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[11px] text-muted-foreground italic line-clamp-2 leading-relaxed">
              {project.progressSummary}
            </p>
          </div>
        )}

        {/* Completed badge */}
        {project.status === 'completed' && (
          <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Đã hoàn thành
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex justify-between mb-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-2 w-full mb-1" />
        <Skeleton className="h-1.5 w-full mb-3" />
        <div className="flex gap-1 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}
