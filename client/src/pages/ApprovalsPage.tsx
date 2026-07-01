import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, FileCheck2, ExternalLink, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { cn, formatDate } from '../lib/utils';
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS, TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../lib/constants';
import { api } from '../lib/api';
import type { ApprovalTask } from '@rd/shared';

export function ApprovalsPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ task: ApprovalTask; action: 'approved' | 'rejected' } | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.approvals.list();
      setTasks(data);
    } catch { toast.error('Không thể tải danh sách phê duyệt'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDialog = (task: ApprovalTask, action: 'approved' | 'rejected') => {
    setDialog({ task, action });
    setNotes('');
  };

  const handleProcess = async () => {
    if (!dialog) return;
    // Use approvalTargetName (assigned approver), fallback to generic label
    const approvalBy = dialog.task.approvalTargetName || 'Quản lý';
    setSaving(true);
    try {
      await api.tasks.processApproval(dialog.task.id, dialog.action, approvalBy, notes.trim());
      toast.success(dialog.action === 'approved' ? '✅ Đã phê duyệt!' : '❌ Đã từ chối!');
      setDialog(null);
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra'); } finally { setSaving(false); }
  };

  // Group by project
  const grouped = tasks.reduce<Record<string, { projectName: string; tasks: ApprovalTask[] }>>((acc, t) => {
    if (!acc[t.projectId]) acc[t.projectId] = { projectName: t.projectName, tasks: [] };
    acc[t.projectId].tasks.push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-orange-500" />
            Phê duyệt công việc
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Danh sách công việc đang chờ phê duyệt từ các dự án
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>Làm mới</Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border rounded-xl p-4 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Không có công việc nào chờ duyệt</h3>
          <p className="text-muted-foreground text-sm">Tất cả công việc yêu cầu phê duyệt đã được xử lý.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([projectId, { projectName, tasks: projectTasks }]) => (
            <div key={projectId} className="border rounded-xl overflow-hidden">
              {/* Project header */}
              <div className="bg-muted/40 px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <span className="font-semibold text-sm">{projectName}</span>
                  <span className="text-xs text-muted-foreground bg-orange-100 dark:bg-orange-900/30 text-orange-700 px-2 py-0.5 rounded-full">
                    {projectTasks.length} chờ duyệt
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => navigate(`/projects/${projectId}`, { state: { tab: 'timeline' } })}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Mở dự án
                </Button>
              </div>

              {/* Tasks list */}
              <div className="divide-y">
                {projectTasks.map((task) => (
                  <div key={task.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm">{task.title}</span>
                          <Badge className={cn('text-xs', TASK_STATUS_COLORS[task.status])}>
                            {TASK_STATUS_LABELS[task.status]}
                          </Badge>
                          <span className={cn('text-xs px-2 py-0.5 rounded-md border-l-4 bg-muted font-medium', TASK_PRIORITY_COLORS[task.priority])}>
                            {TASK_PRIORITY_LABELS[task.priority]}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                            {task.stageName}
                          </span>
                          {task.owner && <span>👤 {task.owner}</span>}
                          {task.dueDate && (
                            <span className={cn(new Date(task.dueDate) < new Date() && 'text-red-500')}>
                              📅 {formatDate(task.dueDate)}
                            </span>
                          )}
                          {/* Who this was sent to */}
                          {task.approvalTargetName && (
                            <span className="flex items-center gap-1 text-blue-600 font-medium">
                              <User className="h-3 w-3" /> Gửi cho: {task.approvalTargetName}
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{task.description}</p>
                        )}

                        {task.completionReport && (
                          <div className="mt-2 p-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs">
                            <p className="font-medium text-green-700 mb-0.5">Báo cáo kết quả:</p>
                            <p className="text-green-800 dark:text-green-300 line-clamp-2">{task.completionReport}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Gửi lúc {formatDate(task.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs"
                          onClick={() => openDialog(task, 'approved')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Phê duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs"
                          onClick={() => openDialog(task, 'rejected')}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Từ chối
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent onClose={() => setDialog(null)}>
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === 'approved' ? '✅ Phê duyệt công việc' : '❌ Từ chối công việc'}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="font-medium text-sm">{dialog?.task.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{dialog?.task.projectName} › {dialog?.task.stageName}</p>
            </div>

            {/* Show approver (auto-filled, read-only) */}
            {dialog?.task.approvalTargetName && (
              <div className="flex items-center gap-2 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 px-3 py-2.5 text-sm">
                <User className="h-4 w-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Người phê duyệt</p>
                  <p className="font-medium text-blue-700 dark:text-blue-300">{dialog.task.approvalTargetName}</p>
                </div>
              </div>
            )}

            <div>
              <Label>
                Ghi chú
                {dialog?.action === 'rejected' && <span className="text-red-500 ml-1">(nêu rõ lý do từ chối)</span>}
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={dialog?.action === 'approved'
                  ? 'Ghi chú thêm (tuỳ chọn)...'
                  : 'Lý do từ chối, những điểm cần chỉnh sửa...'}
                className="mt-1"
                rows={3}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Hủy</Button>
            <Button
              onClick={handleProcess}
              disabled={saving}
              variant={dialog?.action === 'rejected' ? 'destructive' : 'default'}
              className={dialog?.action === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {saving ? 'Đang xử lý...' : dialog?.action === 'approved' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
