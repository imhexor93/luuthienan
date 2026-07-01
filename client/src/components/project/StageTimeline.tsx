import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, Clock, Circle, ChevronDown, ChevronRight,
  Calendar, User, Timer, AlertCircle, ClipboardCheck, MessageSquareWarning,
  Lock, ArrowDown, Pencil, Send, FileCheck2, RefreshCw, Plus, Trash2, BarChart2,
} from 'lucide-react';
import { MarkdownViewer } from '../ui/markdown-editor';
import { TaskAttachments } from '../task/TaskAttachments';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { cn, formatDate } from '../../lib/utils';
import {
  STAGE_COLORS,
  TASK_STATUS_LABELS, TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS,
} from '../../lib/constants';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { StageWithProgress, Task, ApprovalHistoryEntry, User as AppUser, StageWeeklyUpdate } from '@rd/shared';

interface StageTimelineProps {
  stages: StageWithProgress[];
  tasks: Task[];
  onStageUpdated: () => void;
  onTaskUpdated?: () => void;
}

export function StageTimeline({ stages, tasks, onStageUpdated, onTaskUpdated }: StageTimelineProps) {
  const { canManage, user } = useAuth();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [gateDialog, setGateDialog] = useState<StageWithProgress | null>(null);
  const [gateForm, setGateForm] = useState({ approvedBy: '', notes: '', decision: 'passed' });
  const [saving, setSaving] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  // Approval request dialog
  const [approvalReqDialog, setApprovalReqDialog] = useState<{ task: Task } | null>(null);
  const [approvalReqForm, setApprovalReqForm] = useState({ targetId: '', targetName: '' });
  const [savingApprovalReq, setSavingApprovalReq] = useState(false);
  const [managers, setManagers] = useState<AppUser[]>([]);
  // Approval history for selected task
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const toggleExpand = (stageId: string) => setExpandedStage((cur) => (cur === stageId ? null : stageId));

  // Load managers/admins for approver selection
  useEffect(() => {
    api.users.listActive().then((users) => {
      setManagers(users.filter((u) => u.role === 'admin' || u.role === 'manager'));
    }).catch(() => {});
  }, []);

  // Load approval history when task is selected
  useEffect(() => {
    if (!selectedTask?.approvalRequired) { setApprovalHistory([]); return; }
    setLoadingHistory(true);
    api.tasks.getApprovalHistory(selectedTask.id)
      .then(setApprovalHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [selectedTask?.id]);

  const handleGateApproval = async () => {
    if (!gateDialog) return;
    const approvedBy = gateForm.approvedBy.trim() || user?.name || 'Quản lý';
    setSaving(true);
    try {
      await api.stages.update(gateDialog.id, {
        gateStatus: gateForm.decision as 'passed' | 'failed',
        gateApprovedBy: approvedBy,
        gateNotes: gateForm.notes.trim(),
      });
      toast.success(gateForm.decision === 'passed' ? '✅ Cổng đã được thông qua!' : '❌ Cổng không đạt!');
      setGateDialog(null);
      onStageUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  const handleOpenApprovalReq = (task: Task) => {
    setApprovalReqDialog({ task });
    setApprovalReqForm({ targetId: '', targetName: '' });
  };

  const handleSubmitApprovalReq = async () => {
    if (!approvalReqDialog) return;
    if (!approvalReqForm.targetId) { toast.error('Vui lòng chọn người phê duyệt'); return; }
    setSavingApprovalReq(true);
    try {
      const updated = await api.tasks.requestApproval(
        approvalReqDialog.task.id,
        approvalReqForm.targetId,
        approvalReqForm.targetName,
      );
      toast.success('Đã gửi yêu cầu phê duyệt');
      setApprovalReqDialog(null);
      if (selectedTask?.id === updated.id) {
        setSelectedTask(updated);
        // Reload history
        api.tasks.getApprovalHistory(updated.id).then(setApprovalHistory).catch(() => {});
      }
      onTaskUpdated?.();
      onStageUpdated();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra'); }
    finally { setSavingApprovalReq(false); }
  };

  // Layout helpers
  const stage1 = stages.find((s) => s.order === 1);
  const devStages = stages.filter((s) => s.stageGroup === 'development').sort((a, b) => a.order - b.order);
  const stage6 = stages.find((s) => s.order === 6);
  const stage7 = stages.find((s) => s.order === 7);
  const devAllPassed = devStages.length > 0 && devStages.every((s) => s.gateStatus === 'passed');
  const devPassedCount = devStages.filter((s) => s.gateStatus === 'passed').length;

  // Shared card context
  const cardContext = {
    tasks,
    expandedStage,
    canManage,
    onToggle: toggleExpand,
    onOpenGate: (s: StageWithProgress) => { setGateDialog(s); setGateForm({ approvedBy: user?.name ?? '', notes: '', decision: 'passed' }); },
    onSelectTask: setSelectedTask,
    onOpenApprovalReq: handleOpenApprovalReq,
  };

  return (
    <div className="space-y-2">
      {stage1 && (
        <>
          <LinearStageCard stage={stage1} colorIndex={0} ctx={cardContext} />
          <div className="flex justify-center py-1"><ArrowDown className="h-4 w-4 text-muted-foreground/40" /></div>
        </>
      )}

      {devStages.length > 0 && (
        <>
          <div className="border rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {devStages.map((_, i) => (
                      <div key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[i + 1] }} />
                    ))}
                  </div>
                  <h3 className="font-semibold text-sm">Phát triển sản phẩm</h3>
                  <span className="text-xs text-muted-foreground">(4 giai đoạn song song)</span>
                </div>
                {devAllPassed ? (
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Hoàn thành
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{devPassedCount}/{devStages.length} giai đoạn đã qua cổng</span>
                )}
              </div>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {devStages.map((stage, i) => (
                <ParallelStageCard key={stage.id} stage={stage} colorIndex={i + 1} ctx={cardContext} />
              ))}
            </div>
          </div>
          <div className="flex justify-center py-1"><ArrowDown className="h-4 w-4 text-muted-foreground/40" /></div>
        </>
      )}

      {stage6 && (
        <>
          <LinearStageCard stage={stage6} colorIndex={5} ctx={cardContext} />
          <div className="flex justify-center py-1"><ArrowDown className="h-4 w-4 text-muted-foreground/40" /></div>
        </>
      )}

      {stage7 && <LinearStageCard stage={stage7} colorIndex={6} ctx={cardContext} />}

      {stages.filter((s) => s.order !== 1 && s.stageGroup !== 'development' && s.order !== 6 && s.order !== 7).map((stage) => (
        <LinearStageCard key={stage.id} stage={stage} colorIndex={stage.order - 1} ctx={cardContext} />
      ))}

      {/* ── Task Detail Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent onClose={() => setSelectedTask(null)} className="max-w-lg">
          {selectedTask && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3 pr-6">
                  <TaskStatusIcon status={selectedTask.status} />
                  <DialogTitle className="leading-snug">{selectedTask.title}</DialogTitle>
                </div>
              </DialogHeader>
              <div className="px-6 pb-2 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className={cn('text-xs', TASK_STATUS_COLORS[selectedTask.status])}>
                    {TASK_STATUS_LABELS[selectedTask.status]}
                  </Badge>
                  <span className={cn('inline-flex items-center text-xs px-2.5 py-0.5 rounded-md border-l-4 bg-muted font-medium', TASK_PRIORITY_COLORS[selectedTask.priority])}>
                    Ưu tiên: {TASK_PRIORITY_LABELS[selectedTask.priority]}
                  </span>
                  <ApprovalStatusBadge task={selectedTask} />
                </div>
                {selectedTask.description ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Mô tả</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedTask.description}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Chưa có mô tả</p>
                )}
                {selectedTask.status === 'blocked' && selectedTask.blockerReason && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-0.5">Lý do bị chặn</p>
                      <p className="text-sm text-red-600 dark:text-red-300">{selectedTask.blockerReason}</p>
                    </div>
                  </div>
                )}
                {selectedTask.status === 'done' && selectedTask.completionReport && (
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardCheck className="h-4 w-4 text-green-600 shrink-0" />
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">Báo cáo kết quả</p>
                    </div>
                    <MarkdownViewer content={selectedTask.completionReport} className="text-green-900 dark:text-green-200" />
                  </div>
                )}
                {(selectedTask.status === 'todo' || selectedTask.status === 'doing') && selectedTask.issueNotes && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquareWarning className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Vấn đề / Chậm tiến độ</p>
                    </div>
                    <MarkdownViewer content={selectedTask.issueNotes} className="text-amber-900 dark:text-amber-200" />
                  </div>
                )}
                {selectedTask.approvalStatus === 'approved' && (
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-green-700">
                      <FileCheck2 className="h-3.5 w-3.5" /> Đã phê duyệt bởi {selectedTask.approvalBy}
                    </div>
                    {selectedTask.approvalNotes && <p className="text-muted-foreground mt-1">{selectedTask.approvalNotes}</p>}
                  </div>
                )}
                {selectedTask.approvalStatus === 'rejected' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-red-700">
                      <XCircle className="h-3.5 w-3.5" /> Từ chối bởi {selectedTask.approvalBy}
                    </div>
                    {selectedTask.approvalNotes && <p className="text-muted-foreground mt-1">{selectedTask.approvalNotes}</p>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedTask.owner && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div><p className="text-xs text-muted-foreground">Người phụ trách</p><p className="font-medium">{selectedTask.owner}</p></div>
                    </div>
                  )}
                  {selectedTask.dueDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div><p className="text-xs text-muted-foreground">Deadline</p><p className="font-medium">{formatDate(selectedTask.dueDate)}</p></div>
                    </div>
                  )}
                  {selectedTask.estimatedHours != null && (
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div><p className="text-xs text-muted-foreground">Giờ dự kiến</p><p className="font-medium">{selectedTask.estimatedHours}h</p></div>
                    </div>
                  )}
                  {selectedTask.actualHours != null && (
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div><p className="text-xs text-muted-foreground">Giờ thực tế</p><p className="font-medium">{selectedTask.actualHours}h</p></div>
                    </div>
                  )}
                </div>
              </div>
              {/* Approval history */}
              {selectedTask.approvalRequired && (
                <div className="px-6 pb-2">
                  {loadingHistory ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Đang tải lịch sử...
                    </div>
                  ) : approvalHistory.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Lịch sử phê duyệt</p>
                      <div className="space-y-2 border-l-2 border-muted pl-3">
                        {approvalHistory.map((entry) => (
                          <div key={entry.id} className="relative text-xs">
                            <div className={cn(
                              'absolute -left-[17px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background',
                              entry.action === 'approved' ? 'bg-green-500' :
                              entry.action === 'rejected' ? 'bg-red-500' : 'bg-orange-400'
                            )} />
                            <div className="font-medium leading-tight">
                              {entry.action === 'requested'
                                ? <><span className="text-orange-700">{entry.byName}</span> gửi yêu cầu duyệt{entry.targetName && <> → <span className="text-blue-600">{entry.targetName}</span></>}</>
                                : entry.action === 'approved'
                                ? <><span className="text-green-700">{entry.byName}</span> đã phê duyệt</>
                                : <><span className="text-red-700">{entry.byName}</span> từ chối</>
                              }
                            </div>
                            <div className="text-muted-foreground mt-0.5">{formatDate(entry.createdAt)}</div>
                            {entry.notes && <p className="text-muted-foreground italic mt-0.5">"{entry.notes}"</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="px-6 pb-4">
                <div className="border-t pt-4 flex items-center gap-2">
                  <div className="flex-1">
                    <TaskAttachments taskId={selectedTask.id} readonly />
                  </div>
                  {selectedTask.approvalRequired && (selectedTask.approvalStatus === 'not-required' || selectedTask.approvalStatus === 'rejected') && (
                    <Button size="sm" variant="outline" className={cn('gap-1.5 text-xs shrink-0', selectedTask.approvalStatus === 'rejected' && 'border-red-200 text-red-700 hover:bg-red-50')}
                      onClick={() => handleOpenApprovalReq(selectedTask)}>
                      <Send className="h-3.5 w-3.5" />
                      {selectedTask.approvalStatus === 'rejected' ? 'Gửi duyệt lại' : 'Gửi duyệt'}
                    </Button>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setSelectedTask(null)}>Đóng</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Gate Approval Dialog ───────────────────────────────────────── */}
      <Dialog open={!!gateDialog} onOpenChange={(open) => !open && setGateDialog(null)}>
        <DialogContent onClose={() => setGateDialog(null)}>
          <DialogHeader><DialogTitle>Đánh giá cổng: {gateDialog?.name}</DialogTitle></DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <div>
              <Label>Quyết định</Label>
              <Select value={gateForm.decision} onChange={(e) => setGateForm((f) => ({ ...f, decision: e.target.value }))} className="mt-1">
                <option value="passed">✅ Thông qua — Chuyển sang giai đoạn tiếp theo</option>
                <option value="failed">❌ Không đạt — Cần xem xét lại</option>
              </Select>
            </div>
            <div>
              <Label>Người phê duyệt</Label>
              <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{gateForm.approvedBy || user?.name || '—'}</span>
                <span className="text-xs text-muted-foreground ml-auto">Tài khoản hiện tại</span>
              </div>
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Textarea value={gateForm.notes} onChange={(e) => setGateForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Ghi chú về quyết định đánh giá cổng..." className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGateDialog(null)}>Hủy</Button>
            <Button onClick={handleGateApproval} disabled={saving} variant={gateForm.decision === 'failed' ? 'destructive' : 'default'}>
              {saving ? 'Đang lưu...' : gateForm.decision === 'passed' ? 'Thông qua cổng' : 'Không thông qua'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Gửi yêu cầu phê duyệt Dialog ─────────────────────────────── */}
      <Dialog open={!!approvalReqDialog} onOpenChange={(open) => !open && setApprovalReqDialog(null)}>
        <DialogContent onClose={() => setApprovalReqDialog(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-orange-500" />
              {approvalReqDialog?.task.approvalStatus === 'rejected' ? 'Gửi duyệt lại' : 'Gửi yêu cầu phê duyệt'}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="font-medium text-sm">{approvalReqDialog?.task.title}</p>
              {approvalReqDialog?.task.approvalStatus === 'rejected' && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-2">
                  <span className="font-medium">Lý do từ chối trước đó:</span>{' '}
                  {approvalReqDialog.task.approvalNotes || 'Không có ghi chú'}
                </div>
              )}
            </div>
            <div>
              <Label>Gửi đến (người phê duyệt) *</Label>
              <Select
                value={approvalReqForm.targetId}
                onChange={(e) => {
                  const selected = managers.find((m) => m.id === e.target.value);
                  setApprovalReqForm({ targetId: e.target.value, targetName: selected?.name ?? '' });
                }}
                className="mt-1"
              >
                <option value="">-- Chọn trưởng nhóm / admin --</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.role === 'admin' ? 'Quản trị viên' : 'Trưởng nhóm'}
                  </option>
                ))}
              </Select>
              {managers.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Không có trưởng nhóm/admin nào trong hệ thống</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApprovalReqDialog(null)}>Hủy</Button>
            <Button onClick={handleSubmitApprovalReq} disabled={savingApprovalReq || !approvalReqForm.targetId}
              className="bg-orange-500 hover:bg-orange-600 text-white">
              {savingApprovalReq ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Card context (prop drilling replacement) ────────────────────────────────

interface CardCtx {
  tasks: Task[];
  expandedStage: string | null;
  canManage: boolean;
  onToggle: (id: string) => void;
  onOpenGate: (s: StageWithProgress) => void;
  onSelectTask: (t: Task) => void;
  onOpenApprovalReq: (t: Task) => void;
}

// ─── Linear Stage Card ───────────────────────────────────────────────────────

function LinearStageCard({ stage, colorIndex, ctx }: { stage: StageWithProgress; colorIndex: number; ctx: CardCtx }) {
  const color = STAGE_COLORS[colorIndex] ?? STAGE_COLORS[0];
  const stageTasks = ctx.tasks.filter((t) => t.stageId === stage.id);
  const isExpanded = ctx.expandedStage === stage.id;
  const canApproveGate = !stage.isLocked && (stage.progressPercent === 100 || stageTasks.length === 0);
  const pendingApprovals = stageTasks.filter((t) => t.approvalStatus === 'pending').length;

  return (
    <div className={cn('border rounded-xl overflow-hidden', stage.isLocked && 'opacity-60')}>
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => ctx.onToggle(stage.id)}>
        <div
          className={cn('h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0', stage.isLocked ? 'bg-muted text-muted-foreground' : 'text-white')}
          style={stage.isLocked ? undefined : { backgroundColor: color }}
        >
          {stage.isLocked ? <Lock className="h-4 w-4" /> : stage.order}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3 className="font-semibold text-sm">{stage.name}</h3>
            <GateStatusBadge status={stage.gateStatus} isLocked={stage.isLocked} />
            {pendingApprovals > 0 && (
              <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-full font-medium">
                {pendingApprovals} chờ duyệt
              </span>
            )}
          </div>
          {stage.isLocked ? (
            <p className="text-xs text-muted-foreground">{stage.lockReason}</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Progress value={stage.progressPercent} className="h-1.5 flex-1" indicatorClassName={stage.progressPercent === 100 ? 'bg-green-500' : ''} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{stage.doneTasks}/{stage.totalTasks} việc ({stage.progressPercent}%)</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canApproveGate && stage.gateStatus === 'not-started' && (
            <Button size="sm" variant="outline" className="text-xs h-7"
              onClick={(e) => { e.stopPropagation(); ctx.onOpenGate(stage); }}>
              Đánh giá cổng
            </Button>
          )}
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>
      {isExpanded && (
        <StageTaskList stage={stage} stageTasks={stageTasks} ctx={ctx} />
      )}
    </div>
  );
}

// ─── Parallel Stage Card ─────────────────────────────────────────────────────

function ParallelStageCard({ stage, colorIndex, ctx }: { stage: StageWithProgress; colorIndex: number; ctx: CardCtx }) {
  const color = STAGE_COLORS[colorIndex] ?? STAGE_COLORS[1];
  const stageTasks = ctx.tasks.filter((t) => t.stageId === stage.id);
  const isExpanded = ctx.expandedStage === stage.id;
  const canApproveGate = !stage.isLocked && (stage.progressPercent === 100 || stageTasks.length === 0);
  const pendingApprovals = stageTasks.filter((t) => t.approvalStatus === 'pending').length;

  return (
    <div className={cn('border rounded-lg overflow-hidden', stage.isLocked && 'opacity-60')}>
      <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => ctx.onToggle(stage.id)}>
        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-xs font-semibold leading-tight">{stage.name}</span>
            <GateStatusBadge status={stage.gateStatus} isLocked={stage.isLocked} compact />
            {pendingApprovals > 0 && (
              <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 px-1 py-0.5 rounded-full font-medium">{pendingApprovals} chờ duyệt</span>
            )}
          </div>
          {stage.isLocked ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3 shrink-0" /><span>Chờ cổng giai đoạn trước</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Progress value={stage.progressPercent} className="h-1 flex-1" indicatorClassName={stage.progressPercent === 100 ? 'bg-green-500' : ''} />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{stage.doneTasks}/{stage.totalTasks}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {canApproveGate && stage.gateStatus === 'not-started' && (
        <div className="px-3 pb-2">
          <Button size="sm" variant="outline" className="w-full h-7 text-xs"
            onClick={(e) => { e.stopPropagation(); ctx.onOpenGate(stage); }}>
            Đánh giá cổng
          </Button>
        </div>
      )}

      {isExpanded && <StageTaskList stage={stage} stageTasks={stageTasks} ctx={ctx} compact />}
    </div>
  );
}

// ─── Stage Task List ─────────────────────────────────────────────────────────

function StageTaskList({ stage, stageTasks, ctx, compact }: {
  stage: StageWithProgress; stageTasks: Task[]; ctx: CardCtx; compact?: boolean;
}) {
  return (
    <div className="border-t bg-muted/20 p-3 space-y-1.5">
      {stageTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Chưa có công việc nào trong giai đoạn này</p>
      ) : (
        stageTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2 bg-background rounded-lg px-2.5 py-1.5 border cursor-pointer hover:bg-accent hover:border-primary/30 transition-colors group"
            onClick={() => ctx.onSelectTask(task)}
          >
            <TaskStatusIcon status={task.status} />
            <span className={cn('text-xs flex-1 group-hover:text-primary transition-colors', compact && 'line-clamp-1')}>{task.title}</span>
            {task.approvalRequired && (task.approvalStatus === 'not-required' || task.approvalStatus === 'rejected') && (
              <button
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 transition-colors',
                  task.approvalStatus === 'rejected'
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30'
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30'
                )}
                onClick={(e) => { e.stopPropagation(); ctx.onOpenApprovalReq(task); }}
              >
                {task.approvalStatus === 'rejected' ? '↩ Gửi lại' : 'Gửi duyệt'}
              </button>
            )}
            {task.approvalRequired && task.approvalStatus !== 'not-required' && task.approvalStatus !== 'rejected' && (
              <ApprovalStatusBadge task={task} mini />
            )}
            {task.owner && !compact && <span className="text-[10px] text-muted-foreground hidden sm:block">{task.owner}</span>}
            {task.dueDate && !compact && <span className="text-[10px] text-muted-foreground hidden md:block">{formatDate(task.dueDate)}</span>}
            <TaskPriorityDot priority={task.priority} />
          </div>
        ))
      )}

      {(stage.gateStatus === 'passed' || stage.gateStatus === 'failed') && (
        <div className={cn('mt-2 p-2.5 rounded-lg border text-xs', stage.gateStatus === 'passed' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800')}>
          <div className="flex items-center gap-2 font-medium mb-0.5">
            {stage.gateStatus === 'passed' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-red-600" />}
            {stage.gateStatus === 'passed' ? 'Đã thông qua' : 'Không đạt'} — {stage.gateApprovedBy}
          </div>
          {stage.gateNotes && <p className="text-muted-foreground">{stage.gateNotes}</p>}
        </div>
      )}

      <WeeklyUpdatesSection stage={stage} />
    </div>
  );
}

// ─── Weekly Updates Section ───────────────────────────────────────────────────

function getCurrentWeekLabel(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const year = sun.getFullYear();
  // ISO week number
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `Tuần ${weekNum}: ${fmt(mon)} - ${fmt(sun)}/${year}`;
}

function WeeklyUpdatesSection({ stage }: { stage: StageWithProgress }) {
  const { user, canManage } = useAuth();
  const [updates, setUpdates] = useState<StageWeeklyUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ weekLabel: '', content: '' });
  const [saving, setSaving] = useState(false);

  const isActive = stage.gateStatus !== 'passed' && stage.gateStatus !== 'failed';

  useEffect(() => {
    setLoading(true);
    api.stages.weeklyUpdates.list(stage.id)
      .then(setUpdates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stage.id]);

  function openNewForm() {
    setEditingId(null);
    setForm({ weekLabel: getCurrentWeekLabel(), content: '' });
    setShowForm(true);
  }

  function openEditForm(u: StageWeeklyUpdate) {
    setEditingId(u.id);
    setForm({ weekLabel: u.weekLabel, content: u.content });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.weekLabel.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await api.stages.weeklyUpdates.update(editingId, { weekLabel: form.weekLabel, content: form.content });
        setUpdates((prev) => prev.map((u) => u.id === editingId ? updated : u));
      } else {
        const created = await api.stages.weeklyUpdates.create(stage.id, {
          weekLabel: form.weekLabel,
          content: form.content,
          createdBy: user?.name ?? '',
        });
        setUpdates((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditingId(null);
    } catch {
      toast.error('Không thể lưu cập nhật');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.stages.weeklyUpdates.delete(id);
      setUpdates((prev) => prev.filter((u) => u.id !== id));
    } catch {
      toast.error('Không thể xóa');
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-dashed">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <BarChart2 className="h-3 w-3" /> Cập nhật tiến độ hàng tuần
        </span>
        {isActive && !showForm && (
          <button
            onClick={openNewForm}
            className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 flex items-center gap-0.5 transition-colors"
          >
            <Plus className="h-2.5 w-2.5" /> Thêm
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-2 p-2.5 rounded-lg border bg-background space-y-2">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Nhãn tuần</label>
            <input
              className="w-full text-xs border rounded px-2 py-1 bg-background"
              value={form.weekLabel}
              onChange={(e) => setForm((f) => ({ ...f, weekLabel: e.target.value }))}
              placeholder="VD: Tuần 24: 09/06 - 15/06/2025"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Nội dung cập nhật</label>
            <textarea
              className="w-full text-xs border rounded px-2 py-1.5 bg-background resize-none"
              rows={3}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Mô tả tiến độ tuần này..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={cancelForm} className="text-[10px] px-2.5 py-1 rounded border hover:bg-muted transition-colors">Hủy</button>
            <button
              onClick={handleSave}
              disabled={saving || !form.weekLabel.trim() || !form.content.trim()}
              className="text-[10px] px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Lưu'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[10px] text-muted-foreground py-1">Đang tải...</p>
      ) : updates.length === 0 ? (
        <p className="text-[10px] text-muted-foreground py-1 text-center">Chưa có cập nhật tuần nào</p>
      ) : (
        <div className="relative pl-3 space-y-2">
          <div className="absolute left-1 top-1 bottom-1 w-px bg-border" />
          {updates.map((u) => (
            <div key={u.id} className="relative group">
              <div className="absolute -left-2 top-1.5 h-2 w-2 rounded-full bg-blue-400 border-2 border-background" />
              <div className="bg-background border rounded-lg px-2.5 py-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-blue-700 dark:text-blue-400 text-[11px]">{u.weekLabel}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{u.createdBy}</span>
                    {canManage && isActive && (
                      <>
                        <button
                          onClick={() => openEditForm(u)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap">{u.content}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(u.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────────────────────

function ApprovalStatusBadge({ task, mini }: { task: Task; mini?: boolean }) {
  if (task.approvalStatus === 'pending') {
    return <span className={cn('inline-flex items-center gap-0.5 font-medium rounded-full', mini ? 'text-[10px] px-1 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30' : 'text-xs px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30')}><Clock className="h-2.5 w-2.5" />{!mini && ' Chờ duyệt'}</span>;
  }
  if (task.approvalStatus === 'approved') {
    return <span className={cn('inline-flex items-center gap-0.5 font-medium rounded-full', mini ? 'text-[10px] px-1 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30' : 'text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30')}><CheckCircle2 className="h-2.5 w-2.5" />{!mini && ' Đã duyệt'}</span>;
  }
  if (task.approvalStatus === 'rejected') {
    return <span className={cn('inline-flex items-center gap-0.5 font-medium rounded-full', mini ? 'text-[10px] px-1 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30' : 'text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30')}><XCircle className="h-2.5 w-2.5" />{!mini && ' Từ chối'}</span>;
  }
  if (task.approvalRequired && task.approvalStatus === 'not-required') {
    return <span className={cn('inline-flex items-center gap-0.5 text-muted-foreground rounded-full', mini ? 'text-[10px] px-1 py-0.5 bg-slate-100' : 'text-xs px-2 py-0.5 bg-slate-100')}><FileCheck2 className="h-2.5 w-2.5" />{!mini && ' Cần duyệt'}</span>;
  }
  return null;
}

function GateStatusBadge({ status, isLocked, compact }: { status: string; isLocked?: boolean; compact?: boolean }) {
  if (isLocked) {
    return <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 inline-flex items-center gap-0.5', compact && 'hidden sm:inline-flex')}><Lock className="h-2.5 w-2.5" /> Khóa</span>;
  }
  const config: Record<string, { label: string; className: string }> = {
    'not-started': { label: 'Chờ đánh giá', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800' },
    'in-progress': { label: 'Đang thực hiện', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' },
    'passed': { label: 'Đã thông qua', className: 'bg-green-100 text-green-700 dark:bg-green-900/30' },
    'failed': { label: 'Không đạt', className: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
  };
  const c = config[status] ?? config['not-started'];
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex', c.className, compact && 'hidden sm:inline-flex')}>{c.label}</span>;
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  if (status === 'blocked') return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
  if (status === 'doing') return <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function TaskPriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = { low: 'bg-slate-300', medium: 'bg-blue-400', high: 'bg-orange-400', critical: 'bg-red-500' };
  return <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', colors[priority] ?? colors.medium)} />;
}
