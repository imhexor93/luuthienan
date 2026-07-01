import React, { useMemo } from 'react';
import { cn, formatDate } from '../../lib/utils';
import { STAGE_COLORS } from '../../lib/constants';
import type { Task, StageWithProgress } from '@rd/shared';

interface GanttChartProps {
  tasks: Task[];
  stages: StageWithProgress[];
}

const MONTH_NAMES_VI = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
const CELL_WIDTH = 56; // px per week
const LEFT_COL_W = 192; // 48 * 4 = w-48

interface MonthGroup {
  label: string;
  leftPct: number;
  widthPct: number;
}

function getWeeks(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  const cur = new Date(start);
  cur.setDate(cur.getDate() - cur.getDay()); // snap to Sunday
  while (cur <= end) {
    weeks.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function getMonthGroups(weeks: Date[], totalDays: number, minDate: Date): MonthGroup[] {
  const groups: MonthGroup[] = [];
  let i = 0;
  while (i < weeks.length) {
    const month = weeks[i].getMonth();
    const year = weeks[i].getFullYear();
    let j = i;
    while (j < weeks.length && weeks[j].getMonth() === month && weeks[j].getFullYear() === year) j++;
    const startDay = (weeks[i].getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    const endWeek = j < weeks.length ? weeks[j] : new Date(minDate.getTime() + totalDays * 86400000);
    const endDay = (endWeek.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    groups.push({
      label: `${MONTH_NAMES_VI[month]} ${year}`,
      leftPct: Math.max(0, (startDay / totalDays) * 100),
      widthPct: ((endDay - startDay) / totalDays) * 100,
    });
    i = j;
  }
  return groups;
}

export function GanttChart({ tasks, stages }: GanttChartProps) {
  const tasksWithDates = tasks.filter((t) => t.dueDate);

  const { minDate, maxDate, weeks, totalDays, monthGroups } = useMemo(() => {
    if (tasksWithDates.length === 0) {
      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + 3);
      const w = getWeeks(now, end);
      const td = Math.max(1, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { minDate: now, maxDate: end, weeks: w, totalDays: td, monthGroups: getMonthGroups(w, td, now) };
    }

    const dueDates = tasksWithDates.map((t) => new Date(t.dueDate!));
    const createdDates = tasksWithDates.map((t) => new Date(t.createdAt));
    const allDates = [...dueDates, ...createdDates];

    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dueDates.map((d) => d.getTime())));
    // pad 1 week on each side
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 14);

    const w = getWeeks(min, max);
    const td = Math.max(1, (max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24));

    return { minDate: min, maxDate: max, weeks: w, totalDays: td, monthGroups: getMonthGroups(w, td, min) };
  }, [tasksWithDates]);

  const getTaskStyle = (task: Task): React.CSSProperties => {
    const start = new Date(task.createdAt);
    const end = task.dueDate ? new Date(task.dueDate) : new Date();

    const startDays = Math.max(0, (start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.max(3, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const leftPct = (startDays / totalDays) * 100;
    const widthPct = Math.max((duration / totalDays) * 100, 2);

    return { left: `${leftPct}%`, width: `${widthPct}%` };
  };

  const getBarColor = (task: Task): string => {
    switch (task.status) {
      case 'done':    return '#22c55e'; // green
      case 'doing':   return '#3b82f6'; // blue
      case 'blocked': return '#ef4444'; // red
      case 'todo':
      default:        return '#94a3b8'; // slate
    }
  };

  const today = new Date();
  const todayDays = (today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
  const todayLeftPct = Math.max(0, Math.min(100, (todayDays / totalDays) * 100));
  const todayVisible = todayLeftPct > 0 && todayLeftPct < 100;

  const totalWidth = Math.max(700, weeks.length * CELL_WIDTH + LEFT_COL_W);

  if (tasksWithDates.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Chưa có công việc nào có ngày deadline để hiển thị Gantt chart.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${totalWidth}px`, position: 'relative' }}>

          {/* ── Header row 1: Months ── */}
          <div className="flex border-b bg-muted/40" style={{ height: '28px' }}>
            {/* Left column placeholder */}
            <div
              className="shrink-0 border-r bg-muted/40"
              style={{ width: LEFT_COL_W, position: 'sticky', left: 0, zIndex: 20 }}
            />
            {/* Month labels */}
            <div className="flex-1 relative overflow-hidden">
              {monthGroups.map((mg, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center border-r border-border/60 px-2"
                  style={{ left: `${mg.leftPct}%`, width: `${mg.widthPct}%`, overflow: 'hidden' }}
                >
                  <span className="text-xs font-semibold text-muted-foreground truncate">{mg.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Header row 2: Weeks ── */}
          <div className="flex border-b bg-muted/20 sticky top-0 z-10" style={{ height: '24px' }}>
            {/* Left column placeholder */}
            <div
              className="shrink-0 border-r bg-muted/20 flex items-center px-3"
              style={{ width: LEFT_COL_W, position: 'sticky', left: 0, zIndex: 20 }}
            >
              <span className="text-xs font-medium text-muted-foreground">Công việc</span>
            </div>
            {/* Week labels */}
            <div className="flex-1 relative overflow-hidden">
              {weeks.map((week, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center border-r border-dashed border-border/40"
                  style={{
                    left: `${(i / weeks.length) * 100}%`,
                    width: `${(1 / weeks.length) * 100}%`,
                    overflow: 'hidden',
                  }}
                >
                  <span className="text-[10px] text-muted-foreground/70 px-1">
                    {week.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              ))}
              {/* Today in header */}
              {todayVisible && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                  style={{ left: `${todayLeftPct}%` }}
                />
              )}
            </div>
          </div>

          {/* ── Rows by stage ── */}
          {stages.map((stage, stageIdx) => {
            const stageTasks = tasksWithDates.filter((t) => t.stageId === stage.id);
            if (stageTasks.length === 0) return null;

            const color = STAGE_COLORS[stageIdx] ?? '#378ADD';

            return (
              <React.Fragment key={stage.id}>
                {/* Stage header */}
                <div className="flex border-b" style={{ backgroundColor: color + '18', height: '30px' }}>
                  <div
                    className="shrink-0 border-r flex items-center px-3"
                    style={{
                      width: LEFT_COL_W,
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: color + '18',
                    }}
                  >
                    <span className="text-xs font-semibold truncate" style={{ color }}>{stage.name}</span>
                  </div>
                  <div className="flex-1 relative">
                    {/* Week grid */}
                    {weeks.map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-r border-dashed border-border/20"
                        style={{ left: `${(i / weeks.length) * 100}%`, width: `${(1 / weeks.length) * 100}%` }}
                      />
                    ))}
                    {todayVisible && (
                      <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/60 z-10" style={{ left: `${todayLeftPct}%` }} />
                    )}
                  </div>
                </div>

                {/* Task rows */}
                {stageTasks.map((task) => (
                  <div key={task.id} className="flex border-b hover:bg-muted/30 transition-colors" style={{ minHeight: '44px' }}>
                    {/* Task name — sticky */}
                    <div
                      className="shrink-0 border-r bg-background flex flex-col justify-center px-3 py-1.5"
                      style={{ width: LEFT_COL_W, position: 'sticky', left: 0, zIndex: 10 }}
                    >
                      <p className="text-xs leading-tight truncate" title={task.title}>{task.title}</p>
                      {task.owner && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{task.owner}</p>
                      )}
                    </div>

                    {/* Bar area */}
                    <div className="flex-1 relative py-2.5">
                      {/* Week grid lines */}
                      {weeks.map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-r border-dashed border-border/15"
                          style={{ left: `${(i / weeks.length) * 100}%`, width: `${(1 / weeks.length) * 100}%` }}
                        />
                      ))}
                      {/* Today line */}
                      {todayVisible && (
                        <div className="absolute top-0 bottom-0 w-0.5 bg-red-400/40 z-10" style={{ left: `${todayLeftPct}%` }} />
                      )}
                      {/* Task bar */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-5 rounded-full opacity-90 flex items-center px-2 cursor-default"
                        style={{ ...getTaskStyle(task), backgroundColor: getBarColor(task) }}
                        title={`${task.title}\nBắt đầu: ${formatDate(task.createdAt)}\nDeadline: ${formatDate(task.dueDate)}`}
                      >
                        <span className="text-white text-[10px] font-medium truncate leading-none">{task.title}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-full bg-slate-400" />
          Chờ làm
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-full bg-blue-500" />
          Đang làm
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-full bg-green-500" />
          Hoàn thành
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-full bg-red-500" />
          Bị chặn
        </div>
        {todayVisible && (
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-0.5 bg-red-500" />
            Hôm nay
          </div>
        )}
      </div>
    </div>
  );
}
