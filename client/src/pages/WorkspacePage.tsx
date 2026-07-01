import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Clock, Circle, AlertTriangle,
  ChevronDown, ChevronRight, RefreshCw, Briefcase, User, Filter,
} from 'lucide-react';
import { api } from '../lib/api';
import type { WorkspaceTask } from '../lib/api';
import type { User as AppUser } from '@rd/shared';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  todo:    { icon: <Circle    className="h-3.5 w-3.5 text-slate-400 shrink-0" />,  label: 'Chưa làm',    color: 'text-slate-500' },
  doing:   { icon: <Clock     className="h-3.5 w-3.5 text-blue-500 shrink-0" />,   label: 'Đang làm',    color: 'text-blue-600' },
  done:    { icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />, label: 'Hoàn thành', color: 'text-green-600' },
  blocked: { icon: <XCircle   className="h-3.5 w-3.5 text-red-500 shrink-0" />,   label: 'Bị chặn',    color: 'text-red-600' },
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-blue-400',
  low:      'bg-slate-300',
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Khẩn cấp', high: 'Cao', medium: 'Trung bình', low: 'Thấp',
};

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function isOverdue(t: WorkspaceTask) {
  if (!t.dueDate || t.status === 'done') return false;
  return new Date(t.dueDate) < new Date(new Date().toDateString());
}

// ── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, showProject, showAssignee }: {
  task: WorkspaceTask; showProject?: boolean; showAssignee?: boolean;
}) {
  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo;
  const overdue = isOverdue(task);

  return (
    <Link
      to={`/projects/${task.projectId}`}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40 transition-colors group rounded-lg',
        task.status === 'blocked' && 'bg-red-50/50 dark:bg-red-950/10',
      )}
    >
      {cfg.icon}
      <span className={cn('flex-1 text-sm truncate group-hover:text-primary transition-colors', task.status === 'done' && 'line-through text-muted-foreground')}>
        {task.title}
      </span>

      <div className="flex items-center gap-1.5 shrink-0">
        {showProject && (
          <span className="hidden sm:block text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]">
            {task.projectName}
          </span>
        )}
        {task.stageName && (
          <span className="hidden md:block text-[10px] text-muted-foreground/70 truncate max-w-[100px]">{task.stageName}</span>
        )}
        {showAssignee && task.assigneeName && (
          <span className="hidden sm:block text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{task.assigneeName}</span>
        )}
        {task.approvalRequired && task.approvalStatus !== 'not-required' && (
          <span className={cn('text-[9px] px-1 py-0.5 rounded-full font-medium', {
            'bg-orange-100 text-orange-700': task.approvalStatus === 'pending',
            'bg-green-100 text-green-700':  task.approvalStatus === 'approved',
            'bg-red-100 text-red-700':      task.approvalStatus === 'rejected',
          })}>
            {task.approvalStatus === 'pending' ? 'Chờ duyệt' : task.approvalStatus === 'approved' ? 'Đã duyệt' : 'Từ chối'}
          </span>
        )}
        {task.dueDate && (
          <span className={cn('text-[10px] font-medium', overdue ? 'text-red-600' : 'text-muted-foreground')}>
            {overdue ? '⚠ ' : ''}{fmtDate(task.dueDate)}
          </span>
        )}
        <div className={cn('h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium)} title={PRIORITY_LABEL[task.priority]} />
      </div>
    </Link>
  );
}

// ── Collapsible Group ─────────────────────────────────────────────────────────

function TaskGroup({ title, subtitle, tasks, defaultOpen = true, showProject, showAssignee }: {
  title: string; subtitle?: string; tasks: WorkspaceTask[];
  defaultOpen?: boolean; showProject?: boolean; showAssignee?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const doing   = tasks.filter((t) => t.status === 'doing').length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  const overdue = tasks.filter(isOverdue).length;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="font-semibold text-sm flex-1 truncate">{title}</span>
        {subtitle && <span className="text-xs text-muted-foreground hidden sm:block">{subtitle}</span>}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">{tasks.length} việc</span>
          {doing > 0   && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{doing} đang làm</span>}
          {blocked > 0 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{blocked} bị chặn</span>}
          {overdue > 0 && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">{overdue} quá hạn</span>}
        </div>
      </button>
      {open && (
        <div className="divide-y px-1 py-1">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} showProject={showProject} showAssignee={showAssignee} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────────

function SummaryBar({ tasks }: { tasks: WorkspaceTask[] }) {
  const active  = tasks.filter((t) => t.status !== 'done').length;
  const doing   = tasks.filter((t) => t.status === 'doing').length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  const overdue = tasks.filter(isOverdue).length;
  const done    = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 font-medium">
        <Circle className="h-3 w-3 text-slate-400" /> {active} đang xử lý
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 font-medium">
        <Clock className="h-3 w-3" /> {doing} đang làm
      </span>
      {blocked > 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-red-100 text-red-800 font-medium">
          <XCircle className="h-3 w-3" /> {blocked} bị chặn
        </span>
      )}
      {overdue > 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-orange-100 text-orange-800 font-medium">
          <AlertTriangle className="h-3 w-3" /> {overdue} quá hạn
        </span>
      )}
      {done > 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-800 font-medium">
          <CheckCircle2 className="h-3 w-3" /> {done} hoàn thành
        </span>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function WorkspacePage() {
  const { user, canManage, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterAssigneeId, setFilterAssigneeId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = canManage
        ? { assigneeId: filterAssigneeId || undefined, status: filterStatus || undefined, projectId: filterProjectId || undefined }
        : { assigneeId: user?.id, status: filterStatus || undefined, projectId: filterProjectId || undefined };
      const data = await api.workspace.tasks(params);
      setTasks(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [canManage, user?.id, filterAssigneeId, filterStatus, filterProjectId]);

  useEffect(() => { load(); }, [load]);

  // Load users list for admin filter
  useEffect(() => {
    if (canManage) api.users.listActive().then(setUsers).catch(() => {});
  }, [canManage]);

  // Unique projects in the current task list (for project filter)
  const projects = Array.from(
    new Map(tasks.map((t) => [t.projectId, t.projectName])).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  // ── Grouping ──
  const grouped = React.useMemo(() => {
    if (canManage && !filterAssigneeId) {
      // Group by assignee
      const map = new Map<string, { label: string; tasks: WorkspaceTask[] }>();
      for (const t of tasks) {
        const key = t.assigneeId ?? '__none__';
        const label = t.assigneeName || t.owner || 'Chưa giao';
        if (!map.has(key)) map.set(key, { label, tasks: [] });
        map.get(key)!.tasks.push(t);
      }
      // Sort: has tasks doing/blocked first, then by task count
      return Array.from(map.entries())
        .sort(([, a], [, b]) => {
          const scoreA = a.tasks.filter((t) => t.status === 'blocked').length * 100 + a.tasks.filter((t) => t.status === 'doing').length * 10;
          const scoreB = b.tasks.filter((t) => t.status === 'blocked').length * 100 + b.tasks.filter((t) => t.status === 'doing').length * 10;
          return scoreB - scoreA || b.tasks.length - a.tasks.length;
        })
        .map(([key, { label, tasks: groupTasks }]) => ({ key, label, tasks: groupTasks }));
    } else {
      // Group by project
      const map = new Map<string, { label: string; tasks: WorkspaceTask[] }>();
      for (const t of tasks) {
        if (!map.has(t.projectId)) map.set(t.projectId, { label: t.projectName, tasks: [] });
        map.get(t.projectId)!.tasks.push(t);
      }
      return Array.from(map.entries()).map(([key, { label, tasks: groupTasks }]) => ({ key, label, tasks: groupTasks }));
    }
  }, [tasks, canManage, filterAssigneeId]);

  const isAdminGroupByAssignee = canManage && !filterAssigneeId;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            {canManage ? 'Quản lý công việc nhóm' : 'Công việc của tôi'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canManage
              ? 'Toàn bộ công việc đang xử lý trong các dự án đang hoạt động'
              : 'Các công việc được giao cho bạn trong tất cả dự án'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Làm mới
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 p-3 border rounded-xl bg-muted/20">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* Admin: filter by assignee */}
        {isAdmin && (
          <select
            value={filterAssigneeId}
            onChange={(e) => setFilterAssigneeId(e.target.value)}
            className="text-xs border rounded-md px-2 py-1.5 bg-background h-8"
          >
            <option value="">Tất cả nhân viên</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs border rounded-md px-2 py-1.5 bg-background h-8"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="todo">Chưa làm</option>
          <option value="doing">Đang làm</option>
          <option value="blocked">Bị chặn</option>
          <option value="done">Hoàn thành</option>
        </select>

        {/* Project filter */}
        <select
          value={filterProjectId}
          onChange={(e) => setFilterProjectId(e.target.value)}
          className="text-xs border rounded-md px-2 py-1.5 bg-background h-8"
        >
          <option value="">Tất cả dự án</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {(filterAssigneeId || filterStatus || filterProjectId) && (
          <button
            onClick={() => { setFilterAssigneeId(''); setFilterStatus(''); setFilterProjectId(''); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* ── Summary bar ── */}
      {!loading && tasks.length > 0 && <SummaryBar tasks={tasks} />}

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="border rounded-xl p-12 text-center text-muted-foreground">
          <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Không có công việc nào</p>
          <p className="text-xs mt-1">
            {filterAssigneeId || filterStatus || filterProjectId
              ? 'Thử thay đổi bộ lọc để xem thêm'
              : canManage ? 'Chưa có công việc nào trong các dự án đang hoạt động' : 'Chưa có công việc nào được giao cho bạn'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ key, label, tasks: groupTasks }) => (
            <TaskGroup
              key={key}
              title={isAdminGroupByAssignee ? label : label}
              subtitle={isAdminGroupByAssignee ? undefined : undefined}
              tasks={groupTasks}
              showProject={isAdminGroupByAssignee || !!filterAssigneeId}
              showAssignee={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
