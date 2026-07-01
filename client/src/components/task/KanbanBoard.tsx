import React, { useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { Plus, AlertCircle, Clock, Calendar, GripVertical, CheckCircle2, XCircle, FileCheck2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn, formatDate, isOverdue } from '../../lib/utils';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  STAGE_COLORS,
} from '../../lib/constants';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Task, TaskStatus, StageWithProgress } from '@rd/shared';

interface KanbanBoardProps {
  tasks: Task[];
  stages: StageWithProgress[];
  onTaskClick: (task: Task) => void;
  onAddTask: (stageId?: string) => void;
  onTasksChange: (tasks: Task[]) => void;
}

const COLUMNS: { id: TaskStatus; label: string; colorClass: string; headerColor: string }[] = [
  { id: 'todo',    label: 'Chưa làm',    colorClass: 'border-t-slate-400',  headerColor: 'text-slate-600' },
  { id: 'doing',   label: 'Đang làm',    colorClass: 'border-t-blue-500',   headerColor: 'text-blue-600' },
  { id: 'done',    label: 'Hoàn thành',  colorClass: 'border-t-green-500',  headerColor: 'text-green-600' },
  { id: 'blocked', label: 'Bị chặn',     colorClass: 'border-t-red-500',    headerColor: 'text-red-600' },
];

export function KanbanBoard({ tasks, stages, onTaskClick, onAddTask, onTasksChange }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    // over.id is a COLUMN id (from useDroppable on each column)
    const newStatus = COLUMNS.find((c) => c.id === over.id)?.id;
    if (!newStatus) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    const updated = tasks.map((t) => t.id === task.id ? { ...t, status: newStatus } : t);
    onTasksChange(updated);

    try {
      await api.tasks.updateStatus(task.id, newStatus);
    } catch {
      toast.error('Không thể cập nhật trạng thái');
      onTasksChange(tasks); // revert
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[500px]">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={colTasks}
              stages={stages}
              isDragging={!!activeTask}
              onTaskClick={onTaskClick}
              onAddTask={onAddTask}
            />
          );
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask && (
          <TaskCard
            task={activeTask}
            stages={stages}
            onClick={() => {}}
            isOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Column (droppable) ──────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: (typeof COLUMNS)[0];
  tasks: Task[];
  stages: StageWithProgress[];
  isDragging: boolean;
  onTaskClick: (task: Task) => void;
  onAddTask: (stageId?: string) => void;
}

function KanbanColumn({ column, tasks, stages, isDragging, onTaskClick, onAddTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className={cn(
      'flex flex-col rounded-xl border border-t-4 bg-muted/30 min-h-[400px] transition-all duration-150',
      column.colorClass,
      isOver && 'ring-2 ring-primary/50 bg-primary/5',
    )}>
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold text-sm', column.headerColor)}>{column.label}</span>
          <Badge variant="secondary" className="text-xs h-5 px-1.5">{tasks.length}</Badge>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onAddTask()} title="Thêm công việc">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Drop zone */}
      <div ref={setNodeRef} className="flex-1 px-2 pb-2 space-y-2 min-h-[200px]">
        {tasks.length === 0 ? (
          <div className={cn(
            'flex items-center justify-center h-20 text-xs text-muted-foreground border-2 border-dashed rounded-lg mt-2 transition-colors',
            isDragging && 'border-primary/40 text-primary/60 bg-primary/5',
          )}>
            {isDragging ? 'Thả vào đây' : 'Chưa có task'}
          </div>
        ) : (
          <>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                stages={stages}
                onClick={() => onTaskClick(task)}
              />
            ))}
            {isDragging && (
              <div className="h-14 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center text-xs text-primary/50">
                Thả vào đây
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Task Card (draggable) ───────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  stages: StageWithProgress[];
  onClick: () => void;
  isOverlay?: boolean;
}

function TaskCard({ task, stages, onClick, isOverlay }: TaskCardProps) {
  const { user: currentUser } = useAuth();
  const isMyTask = task.assigneeId === currentUser?.id || task.owner === currentUser?.name;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  const stage = stages.find((s) => s.id === task.stageId);
  const stageIndex = stages.findIndex((s) => s.id === task.stageId);
  const stageColor = STAGE_COLORS[stageIndex] ?? '#888';
  const overdue = isOverdue(task.dueDate);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-background rounded-lg border shadow-sm p-3 select-none',
        'border-l-4',
        TASK_PRIORITY_COLORS[task.priority],
        isDragging && 'opacity-40',
        isOverlay && 'shadow-2xl rotate-1 cursor-grabbing',
        !isOverlay && 'cursor-grab hover:shadow-md transition-shadow',
      )}
    >
      {/* Drag handle + title row */}
      <div className="flex items-start gap-1.5 mb-2">
        {/* Drag handle - only this area triggers drag */}
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <button
          className="text-sm font-medium leading-snug line-clamp-2 flex-1 text-left hover:text-primary transition-colors"
          onClick={onClick}
        >
          {task.title}
        </button>
        {isMyTask && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5">Tôi</span>
        )}
      </div>

      {/* Stage badge */}
      {stage && (
        <div className="mb-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: stageColor + 'cc' }}>
            {stage.name}
          </span>
        </div>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {(task.assigneeName || task.owner) && (
          <span className="flex items-center gap-1">
            <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
              {(task.assigneeName || task.owner).split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()}
            </div>
            <span className={isMyTask ? 'text-primary font-medium' : ''}>
              {task.assigneeName || task.owner}
            </span>
          </span>
        )}
        {task.dueDate && (
          <span className={cn('flex items-center gap-1', overdue && 'text-red-500 font-medium')}>
            <Calendar className="h-3 w-3" />
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.estimatedHours && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {task.estimatedHours}h
          </span>
        )}
      </div>

      {/* Blocker reason */}
      {task.status === 'blocked' && task.blockerReason && (
        <div className="mt-2 flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{task.blockerReason}</span>
        </div>
      )}

      {/* Footer: priority + approval status */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">{TASK_PRIORITY_LABELS[task.priority]}</span>
        {task.approvalRequired && (
          <ApprovalBadge status={task.approvalStatus} />
        )}
      </div>
    </div>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
      <Clock className="h-2.5 w-2.5" /> Chờ duyệt
    </span>
  );
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
      <CheckCircle2 className="h-2.5 w-2.5" /> Đã duyệt
    </span>
  );
  if (status === 'rejected') return (
    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
      <XCircle className="h-2.5 w-2.5" /> Từ chối
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
      <FileCheck2 className="h-2.5 w-2.5" /> Cần duyệt
    </span>
  );
}
