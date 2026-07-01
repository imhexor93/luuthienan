import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  FlaskConical, Factory, FileText, ShieldAlert, Layers,
  ChevronDown, ChevronRight, Activity, Target, XCircle, BarChart2,
  MessageCircle, X, Send, Bot, User, Loader2, Minimize2, Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type {
  RDOverviewData, RDOverviewProject, RDOverviewEngagement, WeeklyFeedEntry,
} from '../lib/api';

// ── Constants ────────────────────────────────────────────────────────────────

const ENGAGEMENT_STATUS_ORDER = [
  'sampling', 'quoting', 'negotiating', 'sourcing', 'approved', 'in-production',
] as const;

const ENGAGEMENT_STATUS_LABEL: Record<string, string> = {
  sampling: 'Lấy mẫu', quoting: 'Báo giá', negotiating: 'Đàm phán',
  sourcing: 'Test mẫu', approved: 'Đã chốt', 'in-production': 'Đang sản xuất',
};

const ENGAGEMENT_STATUS_COLOR: Record<string, string> = {
  sampling: 'bg-gray-100 text-gray-700 border-gray-200',
  quoting: 'bg-blue-50 text-blue-700 border-blue-200',
  negotiating: 'bg-amber-50 text-amber-700 border-amber-200',
  sourcing: 'bg-purple-50 text-purple-700 border-purple-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  'in-production': 'bg-teal-50 text-teal-700 border-teal-200',
};

const SCOPE_LABEL: Record<string, string> = {
  formula: 'Công thức', packaging: 'Bao bì', filling: 'Đóng gói',
  labeling: 'Nhãn mác', 'full-production': 'Toàn bộ', testing: 'Thử nghiệm', other: 'Khác',
};

const EVAL_STATUS_LABEL: Record<string, string> = {
  'pending-evaluation': 'Chờ đánh giá', evaluating: 'Đang đánh giá', reworking: 'Đang sửa',
};
const EVAL_STATUS_COLOR: Record<string, string> = {
  'pending-evaluation': 'bg-gray-100 text-gray-600',
  evaluating: 'bg-blue-100 text-blue-700',
  reworking: 'bg-amber-100 text-amber-700',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 font-semibold',
  high: 'bg-orange-100 text-orange-700',
};
const SEVERITY_LABEL: Record<string, string> = { critical: 'Nghiêm trọng', high: 'Cao' };
const LIKELIHOOD_LABEL: Record<string, string> = {
  certain: 'Chắc chắn', likely: 'Có thể', possible: 'Khả năng', rare: 'Hiếm',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function daysBadge(days: number | null) {
  if (days === null || days === undefined) return <span className="text-muted-foreground text-xs">—</span>;
  if (days < 0) return <span className="text-xs font-semibold text-red-600">Quá hạn {Math.abs(days)}d</span>;
  if (days <= 14) return <span className="text-xs font-semibold text-red-500">{fmtDateSimple(days)} · {days}d</span>;
  if (days <= 30) return <span className="text-xs font-semibold text-amber-600">{days}d</span>;
  return <span className="text-xs text-muted-foreground">{days}d</span>;
}

function fmtDateSimple(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function ProgressBar({ done, total, className = '' }: { done: number; total: number; className?: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{done}/{total}</span>
    </div>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, variant = 'default',
}: {
  icon: React.ReactNode; label: string; value: number; sub?: string;
  variant?: 'default' | 'warn' | 'danger' | 'ok' | 'muted';
}) {
  const valueColor = variant === 'danger' ? 'text-red-600' : variant === 'warn' ? 'text-amber-600' : variant === 'ok' ? 'text-green-600' : 'text-foreground';
  const bg = variant === 'danger' ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10' : variant === 'warn' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10' : variant === 'ok' ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10' : 'bg-card';
  return (
    <div className={`border rounded-xl p-4 flex items-center gap-4 ${bg}`}>
      <div className="shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        <p className={`text-2xl font-bold leading-tight ${valueColor}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Project Row ─────────────────────────────────────────────────────────────

function ProjectRow({ p, idx }: { p: RDOverviewProject; idx: number }) {
  const isOnHold = p.status === 'on-hold';
  const hasAlerts = p.tasksBlocked > 0 || p.tasksOverdue > 0 || p.risksHigh > 0;
  const pct = p.tasksTotal === 0 ? 0 : Math.round((p.tasksDone / p.tasksTotal) * 100);
  const deadlineUrgent = p.daysUntilDeadline !== null && p.daysUntilDeadline >= 0 && p.daysUntilDeadline <= 14;
  const deadlineOverdue = p.daysUntilDeadline !== null && p.daysUntilDeadline < 0;

  return (
    <tr className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${isOnHold ? 'opacity-70' : ''} ${deadlineOverdue ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
      <td className="px-3 py-3 text-xs text-muted-foreground text-center">{idx + 1}</td>
      <td className="px-3 py-3">
        <Link to={`/projects/${p.id}`} className="font-medium text-sm hover:text-primary hover:underline transition-colors">
          {p.name}
        </Link>
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
          {p.brand && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{p.brand}</span>
          )}
          {p.market && (
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">{p.market}</span>
          )}
          {p.productCategory && (
            <span className="text-[10px] text-muted-foreground/60">{p.productCategory}</span>
          )}
        </div>
        {p.progressSummary && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 italic mt-1 line-clamp-2 max-w-xs leading-relaxed">
            {p.progressSummary}
          </p>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`h-2 w-2 rounded-full shrink-0 ${p.currentStageStatus === 'in-progress' ? 'bg-blue-500' : p.currentStageStatus === 'passed' ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-muted-foreground">{p.currentStageName}</span>
          <span className="text-muted-foreground/60">({p.stagesPassed}/{p.stagesTotal})</span>
        </div>
      </td>
      <td className="px-3 py-3 min-w-[130px]">
        <ProgressBar done={p.tasksDone} total={p.tasksTotal} />
        <span className="text-[10px] text-muted-foreground">{pct}% hoàn thành</span>
      </td>
      <td className="px-3 py-3">
        <div>
          <span className={`text-xs ${deadlineOverdue ? 'text-red-600 font-semibold' : deadlineUrgent ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
            {fmtDate(p.targetLaunchDate)}
          </span>
          {p.daysUntilDeadline !== null && (
            <div>{daysBadge(p.daysUntilDeadline)}</div>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        <span className="text-sm font-medium">{p.engagementsActive}</span>
      </td>
      <td className="px-3 py-3">
        {hasAlerts ? (
          <div className="flex flex-wrap gap-1">
            {p.tasksBlocked > 0 && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                {p.tasksBlocked} bị chặn
              </span>
            )}
            {p.tasksOverdue > 0 && (
              <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                {p.tasksOverdue} quá hạn
              </span>
            )}
            {p.risksHigh > 0 && (
              <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full font-medium">
                ⚠ {p.risksHigh} rủi ro cao
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Bình thường
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isOnHold ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
          {isOnHold ? 'Tạm dừng' : 'Đang hoạt động'}
        </span>
      </td>
    </tr>
  );
}

// ── Engagement Pipeline ──────────────────────────────────────────────────────

function EngagementPipeline({ engagements }: { engagements: RDOverviewEngagement[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const byStatus = ENGAGEMENT_STATUS_ORDER.reduce((acc, s) => {
    acc[s] = engagements.filter((e) => e.status === s);
    return acc;
  }, {} as Record<string, RDOverviewEngagement[]>);

  return (
    <div>
      {/* Flow row */}
      <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
        {ENGAGEMENT_STATUS_ORDER.map((status, i) => {
          const items = byStatus[status] || [];
          const isExpanded = expanded === status;
          const colorClass = ENGAGEMENT_STATUS_COLOR[status];
          return (
            <React.Fragment key={status}>
              {i > 0 && (
                <div className="flex items-center shrink-0 px-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
              <button
                onClick={() => setExpanded(isExpanded ? null : status)}
                className={`flex-1 min-w-[110px] border rounded-lg p-3 text-left transition-all hover:shadow-sm ${colorClass} ${isExpanded ? 'shadow-sm ring-2 ring-current ring-opacity-20' : ''}`}
              >
                <p className="text-[11px] font-medium leading-tight">{ENGAGEMENT_STATUS_LABEL[status]}</p>
                <p className="text-2xl font-bold mt-1 leading-none">{items.length}</p>
                <p className="text-[10px] opacity-70 mt-1">engagement{items.length !== 1 ? 's' : ''}</p>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Expanded detail */}
      {expanded && (byStatus[expanded] || []).length > 0 && (
        <div className={`mt-2 border rounded-lg p-4 ${ENGAGEMENT_STATUS_COLOR[expanded]}`}>
          <p className="text-xs font-semibold mb-3">
            {ENGAGEMENT_STATUS_LABEL[expanded]} — {(byStatus[expanded] || []).length} engagement
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(byStatus[expanded] || []).map((e) => (
              <Link
                key={e.id}
                to={`/engagements/${e.id}`}
                className="bg-background/70 border rounded-md px-3 py-2 hover:bg-background hover:shadow-sm transition-all block"
              >
                <p className="text-xs font-semibold truncate">{e.projectName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{e.factoryName}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1 py-0.5 rounded">
                    {SCOPE_LABEL[e.scope] || e.scope}
                  </span>
                  {e.targetCompletionDate && (
                    <span className="text-[10px] text-muted-foreground">→ {fmtDate(e.targetCompletionDate)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Weekly Progress Report ────────────────────────────────────────────────────

function WeeklyProgressReport({ projects, feed }: { projects: RDOverviewProject[]; feed: WeeklyFeedEntry[] }) {
  const [view, setView] = useState<'week' | 'project'>('week');
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  // Unique weeks in order (newest first — feed is already sorted by created_at DESC)
  const weeks = Array.from(new Set(feed.map((e) => e.weekLabel)));
  const activeWeek = selectedWeek ?? weeks[0] ?? null;

  // ── "Theo tuần" data ──
  const weekEntries = feed.filter((e) => e.weekLabel === activeWeek);
  // All entries grouped by project (a project may update multiple stages in the same week)
  const weekByProject = new Map<string, WeeklyFeedEntry[]>();
  for (const e of weekEntries) {
    if (!weekByProject.has(e.projectId)) weekByProject.set(e.projectId, []);
    weekByProject.get(e.projectId)!.push(e);
  }
  const reportedProjects = projects.filter((p) => weekByProject.has(p.id));
  const missingProjects = projects.filter((p) => !weekByProject.has(p.id));
  const reportRate = projects.length > 0 ? Math.round((reportedProjects.length / projects.length) * 100) : 0;

  // ── "Theo dự án" data ──
  // Latest entry per (project, stage) — feed is already sorted newest-first so first hit wins
  const latestByProjectStage = new Map<string, Map<string, WeeklyFeedEntry>>();
  for (const e of feed) {
    if (!latestByProjectStage.has(e.projectId)) latestByProjectStage.set(e.projectId, new Map());
    const stageMap = latestByProjectStage.get(e.projectId)!;
    if (!stageMap.has(e.stageId)) stageMap.set(e.stageId, e);
  }
  const projectRows = projects.map((p) => {
    const stageMap = latestByProjectStage.get(p.id);
    const stageEntries = stageMap ? Array.from(stageMap.values()) : [];
    const minDays = stageEntries.length > 0 ? Math.min(...stageEntries.map((e) => e.daysSinceUpdate)) : null;
    return { p, stageEntries, minDays };
  }).sort((a, b) => (a.minDays ?? 9999) - (b.minDays ?? 9999));

  const freshCount = projectRows.filter((r) => r.minDays !== null && r.minDays <= 7).length;
  const staleCount = projectRows.filter((r) => r.minDays === null || r.minDays > 14).length;

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* ── Tab bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex gap-1">
          <button
            onClick={() => setView('week')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${view === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            Theo tuần
          </button>
          <button
            onClick={() => setView('project')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${view === 'project' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            Theo dự án
          </button>
        </div>
        {view === 'week' && activeWeek && (
          <span className="text-xs text-muted-foreground">
            {reportedProjects.length}/{projects.length} dự án báo cáo ({reportRate}%)
          </span>
        )}
        {view === 'project' && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />{freshCount} ≤7 ngày</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />{staleCount} chưa cập nhật</span>
          </div>
        )}
      </div>

      {/* ── Theo tuần view ── */}
      {view === 'week' && (
        <div>
          {weeks.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Chưa có cập nhật tuần nào. Hãy mở từng giai đoạn trong dự án và thêm cập nhật.
            </div>
          ) : (
            <>
              {/* Week selector */}
              <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto border-b bg-muted/10">
                {weeks.map((w) => (
                  <button
                    key={w}
                    onClick={() => setSelectedWeek(w)}
                    className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors whitespace-nowrap ${
                      w === activeWeek
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {w.split(':')[0]}
                    {w.includes(':') && <span className="ml-1 opacity-70 font-normal">{w.split(':')[1]?.trim()}</span>}
                  </button>
                ))}
              </div>

              {/* Progress bar */}
              <div className="px-4 pt-3 pb-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${reportRate >= 80 ? 'bg-green-500' : reportRate >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                      style={{ width: `${reportRate}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground w-14 text-right">{reportRate}%</span>
                </div>
              </div>

              {/* Reported projects */}
              {reportedProjects.length > 0 && (
                <div className="px-4 py-2 space-y-2">
                  {reportedProjects.map((p) => {
                    const entries = weekByProject.get(p.id)!;
                    return (
                      <div key={p.id} className="border border-green-200 bg-green-50/50 dark:bg-green-950/10 rounded-lg overflow-hidden">
                        {/* Project header */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-green-200/60">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                          <Link to={`/projects/${p.id}`} className="text-sm font-semibold hover:underline hover:text-primary transition-colors flex-1 min-w-0 truncate">
                            {p.name}
                          </Link>
                          <span className="text-[10px] text-green-700 shrink-0">{entries.length} giai đoạn</span>
                        </div>
                        {/* Per-stage entries */}
                        <div className={entries.length > 1 ? 'divide-y divide-green-200/40' : ''}>
                          {entries.map((e) => (
                            <div key={e.id} className="px-3 py-2.5">
                              <span className="inline-block text-[10px] bg-background border rounded px-1.5 py-0.5 font-medium mb-1">{e.stageName}</span>
                              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{e.content}</p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1">Bởi: {e.createdBy || '—'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Missing projects */}
              {missingProjects.length > 0 && (
                <div className="px-4 pb-3">
                  {reportedProjects.length > 0 && (
                    <p className="text-[11px] font-medium text-muted-foreground mb-1.5 mt-1">Chưa báo cáo tuần này</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {missingProjects.map((p) => (
                      <Link
                        key={p.id}
                        to={`/projects/${p.id}`}
                        className="flex items-center gap-2 border border-slate-200 bg-slate-50 dark:bg-slate-900/20 rounded-lg px-3 py-2 hover:bg-muted/40 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">{p.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Theo dự án view ── */}
      {view === 'project' && (
        <div className="divide-y">
          {projectRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Không có dự án nào.</div>
          ) : (
            projectRows.map(({ p, stageEntries, minDays }) => {
              const dotColor = minDays === null ? 'bg-slate-300' : minDays <= 7 ? 'bg-green-500' : minDays <= 14 ? 'bg-amber-500' : 'bg-red-400';
              const dayLabel = minDays === null ? 'Chưa cập nhật' : minDays === 0 ? 'Hôm nay' : `${minDays} ngày trước`;
              return (
                <div key={p.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      {/* Project header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                        <Link to={`/projects/${p.id}`} className="text-sm font-semibold hover:underline hover:text-primary transition-colors">
                          {p.name}
                        </Link>
                        <span className="text-[11px] text-muted-foreground shrink-0">{dayLabel}</span>
                      </div>
                      {stageEntries.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Chưa có cập nhật tuần nào</p>
                      ) : (
                        <div className="space-y-2">
                          {stageEntries.map((e) => (
                            <div key={e.id} className="border-l-2 border-muted pl-2.5">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <span className="text-[10px] bg-muted border rounded px-1.5 py-0.5 font-medium">{e.stageName}</span>
                                <span className="text-[10px] text-muted-foreground">{e.weekLabel}</span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{e.content}</p>
                              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Bởi: {e.createdBy || '—'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function RDOverviewPage() {
  const [data, setData] = useState<RDOverviewData | null>(null);
  const [weeklyFeed, setWeeklyFeed] = useState<WeeklyFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, feed] = await Promise.all([
        api.dashboard.rdOverview(),
        api.dashboard.weeklyFeed(),
      ]);
      setData(result);
      setWeeklyFeed(feed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải báo cáo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Đang tải báo cáo...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, projects, engagements, pendingSamples, pendingQuotes, blockedTasks, highRisks } = data;

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Báo cáo Tổng quát R&D
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tổng quan tiến độ toàn bộ dự án đang phát triển · Cập nhật: {fmtDatetime(data.generatedAt)}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={<FlaskConical className="h-6 w-6" />}
          label="Dự án đang hoạt động"
          value={stats.activeProjects}
          sub={stats.onHoldProjects > 0 ? `+${stats.onHoldProjects} tạm dừng` : undefined}
          variant="ok"
        />
        <KpiCard
          icon={<Factory className="h-6 w-6" />}
          label="Engagements đang chạy"
          value={stats.activeEngagements}
          variant="default"
        />
        <KpiCard
          icon={<FlaskConical className="h-6 w-6" />}
          label="Mẫu chờ đánh giá"
          value={stats.pendingSamples}
          variant={stats.pendingSamples > 0 ? 'warn' : 'muted'}
        />
        <KpiCard
          icon={<FileText className="h-6 w-6" />}
          label="Báo giá chờ xem xét"
          value={stats.pendingQuotes}
          variant={stats.pendingQuotes > 0 ? 'warn' : 'muted'}
        />
        <KpiCard
          icon={<XCircle className="h-6 w-6" />}
          label="Task bị chặn"
          value={stats.blockedTasks}
          variant={stats.blockedTasks > 0 ? 'danger' : 'muted'}
        />
        <KpiCard
          icon={<ShieldAlert className="h-6 w-6" />}
          label="Rủi ro cao / nghiêm trọng"
          value={stats.highRisks}
          variant={stats.highRisks > 0 ? 'danger' : 'muted'}
        />
        <KpiCard
          icon={<Clock className="h-6 w-6" />}
          label="Deadline trong 30 ngày"
          value={stats.upcomingDeadlines}
          variant={stats.upcomingDeadlines > 0 ? 'warn' : 'muted'}
        />
        <KpiCard
          icon={<TrendingUp className="h-6 w-6" />}
          label="Tổng dự án theo dõi"
          value={stats.activeProjects + stats.onHoldProjects}
          sub={`${stats.activeEngagements} nhà máy liên kết`}
          variant="default"
        />
      </div>

      {/* ── Tiến độ dự án ── */}
      <section>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Tiến độ dự án
          <span className="text-sm font-normal text-muted-foreground">({projects.length} dự án)</span>
        </h2>
        {projects.length === 0 ? (
          <div className="border rounded-xl p-8 text-center text-muted-foreground text-sm">
            Không có dự án nào đang hoạt động
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-center w-8">#</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-left">Tên dự án</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-left w-44">Stage hiện tại</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-left w-44">Tiến độ tasks</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-left w-32">Deadline</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-center w-20">Engag.</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-left w-52">Cảnh báo</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-left w-28">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, i) => <ProjectRow key={p.id} p={p} idx={i} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Tiến độ hàng tuần ── */}
      <section>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          Tiến độ hàng tuần theo dự án
          <span className="text-sm font-normal text-muted-foreground">— dựa trên cập nhật của nhân viên / quản lý</span>
        </h2>
        {projects.length === 0 ? (
          <div className="border rounded-xl p-8 text-center text-muted-foreground text-sm">
            Không có dự án nào đang hoạt động
          </div>
        ) : (
          <WeeklyProgressReport projects={projects} feed={weeklyFeed} />
        )}
      </section>

      {/* ── Engagement Pipeline ── */}
      <section>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Pipeline Engagements
          <span className="text-sm font-normal text-muted-foreground">— click vào stage để xem danh sách</span>
        </h2>
        <div className="border rounded-xl p-4 bg-card">
          {engagements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Không có engagement đang hoạt động</p>
          ) : (
            <EngagementPipeline engagements={engagements} />
          )}
        </div>
      </section>

      {/* ── Cần chú ý ngay ── */}
      <section>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Cần chú ý ngay
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Blocked Tasks */}
          <div className="border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-950/20 border-b">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-semibold text-red-700">Task bị chặn</span>
              <span className="ml-auto text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{blockedTasks.length}</span>
            </div>
            <div className="divide-y max-h-72 overflow-y-auto">
              {blockedTasks.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">Không có task nào bị chặn</p>
              ) : blockedTasks.map((t) => (
                <Link key={t.id} to={`/projects/${t.projectId}`} className="block px-4 py-3 hover:bg-muted/30 transition-colors">
                  <p className="text-xs font-medium leading-tight truncate">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {t.projectName}{t.stageName ? ` · ${t.stageName}` : ''}
                  </p>
                  {(t.owner || t.assigneeName) && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      Phụ trách: {t.assigneeName || t.owner}
                    </p>
                  )}
                  {t.dueDate && (
                    <p className="text-[11px] text-red-500 mt-0.5">Hạn: {fmtDate(t.dueDate)}</p>
                  )}
                  {t.blockerReason && (
                    <p className="text-[11px] text-muted-foreground italic mt-1 line-clamp-2">"{t.blockerReason}"</p>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Samples pending */}
          <div className="border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-950/20 border-b">
              <FlaskConical className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">Mẫu chờ đánh giá</span>
              <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">{pendingSamples.length}</span>
            </div>
            <div className="divide-y max-h-72 overflow-y-auto">
              {pendingSamples.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">Không có mẫu nào cần đánh giá</p>
              ) : pendingSamples.map((s) => (
                <Link key={s.id} to={`/engagements/${s.engagementId}`} className="block px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">#{s.sampleNumber}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${EVAL_STATUS_COLOR[s.evaluationStatus] || 'bg-gray-100 text-gray-600'}`}>
                      {EVAL_STATUS_LABEL[s.evaluationStatus] || s.evaluationStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{s.projectName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{s.factoryName}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Nhận: {fmtDate(s.receivedAt)}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Quotes pending */}
          <div className="border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 border-b">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">Báo giá chờ xem xét</span>
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{pendingQuotes.length}</span>
            </div>
            <div className="divide-y max-h-72 overflow-y-auto">
              {pendingQuotes.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">Không có báo giá nào chờ xem xét</p>
              ) : pendingQuotes.map((q) => (
                <Link key={q.id} to={`/engagements/${q.engagementId}`} className="block px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Báo giá v{q.version}</p>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{q.currency}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{q.projectName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{q.factoryName}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Nhận: {fmtDate(q.receivedAt)}</p>
                  {q.validUntil && (
                    <p className="text-[11px] text-amber-600 mt-0.5">HSD: {fmtDate(q.validUntil)}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Rủi ro cao ── */}
      {highRisks.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Rủi ro cần theo dõi
            <span className="text-sm font-normal text-muted-foreground">({highRisks.length} rủi ro cao / nghiêm trọng)</span>
          </h2>
          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-left">Rủi ro</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-left w-44">Dự án</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-center w-32">Mức độ</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-center w-28">Khả năng</th>
                    <th className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-left">Biện pháp xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {highRisks.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3 font-medium text-sm">{r.title}</td>
                      <td className="px-3 py-3">
                        <Link to={`/projects/${r.projectId}`} className="text-xs text-primary hover:underline">
                          {r.projectName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${SEVERITY_COLOR[r.severity] || ''}`}>
                          {SEVERITY_LABEL[r.severity] || r.severity}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-muted-foreground">
                        {LIKELIHOOD_LABEL[r.likelihood] || r.likelihood}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {r.mitigation || <span className="italic opacity-60">Chưa có biện pháp</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <div className="border-t pt-4 text-center text-xs text-muted-foreground">
        Báo cáo được tạo tự động · {fmtDatetime(data.generatedAt)} · Chỉ hiển thị dự án đang hoạt động và tạm dừng
      </div>

      {/* ── AI Chat ── */}
      <OverviewChat />
    </div>
  );
}

// ── Overview AI Chat ──────────────────────────────────────────────────────────

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

const SUGGESTED = [
  'Dự án nào đang chậm tiến độ nhất?',
  'Có rủi ro nào cần xử lý ngay không?',
  'Công việc nào đang bị chặn và lý do?',
  'Tóm tắt tình hình mẫu và báo giá',
  'Pipeline nhà máy đang ở giai đoạn nào?',
  'Dự án nào sắp đến deadline?',
];

function ChatBubble({ msg, isLast, streaming }: { msg: ChatMessage; isLast: boolean; streaming: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'}`}>
        {msg.content
          ? <ChatContent content={msg.content} isUser={isUser} />
          : (streaming && isLast ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null)
        }
      </div>
    </div>
  );
}

function ChatContent({ content, isUser }: { content: string; isUser: boolean }) {
  const segments = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {segments.map((s, i) =>
        s.startsWith('**') && s.endsWith('**')
          ? <strong key={i} className={isUser ? 'font-bold' : 'font-semibold'}>{s.slice(2, -2)}</strong>
          : s
      )}
    </span>
  );
}

function OverviewChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, minimized]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput('');
    setError(null);
    const userMsg: ChatMessage = { role: 'user', content: msg };
    const next = [...messages, userMsg];
    setMessages(next);
    setStreaming(true);
    setMessages((p) => [...p, { role: 'assistant', content: '' }]);
    try {
      const res = await fetch('/api/rd/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Lỗi server');
      if (!res.body) throw new Error('No stream');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.type === 'text') setMessages((p) => { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + d.text }; return u; });
            else if (d.type === 'error') throw new Error(d.message);
          } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra');
      setMessages((p) => { const u = [...p]; if (u[u.length - 1]?.role === 'assistant' && !u[u.length - 1].content) return u.slice(0, -1); return u; });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          title="Hỏi AI về toàn bộ dự án"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className={`fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] bg-card border rounded-2xl shadow-2xl flex flex-col transition-all ${minimized ? 'h-14' : 'h-[560px]'}`}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 h-14 border-b shrink-0 rounded-t-2xl bg-primary text-primary-foreground">
            <div className="h-7 w-7 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Trợ lý AI · Toàn bộ dự án</p>
              {!minimized && <p className="text-[11px] opacity-75 leading-tight">Hỏi bất cứ điều gì về 18 dự án</p>}
            </div>
            <button onClick={() => setMinimized((v) => !v)} className="h-7 w-7 rounded-full hover:bg-primary-foreground/20 flex items-center justify-center transition-colors">
              {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setOpen(false)} className="h-7 w-7 rounded-full hover:bg-primary-foreground/20 flex items-center justify-center transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground text-center pt-2">Tôi có thể trả lời câu hỏi về tất cả dự án, công việc, rủi ro, mẫu và nhà máy.</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SUGGESTED.map((q) => (
                        <button key={q} onClick={() => send(q)}
                          className="text-left text-[11px] px-2.5 py-2 rounded-lg border hover:bg-muted/60 hover:border-primary/30 transition-colors text-muted-foreground leading-tight">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <ChatBubble key={i} msg={m} isLast={i === messages.length - 1} streaming={streaming} />
                ))}
                {error && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t p-3 flex items-end gap-2 bg-background rounded-b-2xl">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Hỏi về dự án... (Enter gửi)"
                  className="flex-1 resize-none text-sm bg-transparent outline-none min-h-[36px] max-h-[100px] py-2"
                  rows={1}
                  disabled={streaming}
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || streaming}
                  className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
                >
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
