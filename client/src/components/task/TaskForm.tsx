import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { MarkdownEditor } from '../ui/markdown-editor';
import { TaskAttachments } from './TaskAttachments';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Task, StageWithProgress, CreateTaskInput, User } from '@rd/shared';

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  stages: StageWithProgress[];
  task?: Task;
  defaultStageId?: string;
  onSuccess: (task: Task) => void;
}

export function TaskForm({ open, onOpenChange, projectId, stages, task, defaultStageId, onSuccess }: TaskFormProps) {
  const { user: currentUser, canManage } = useAuth();
  const isEdit = !!task;
  const [loading, setLoading] = useState(false);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);

  const [form, setForm] = useState({
    stageId: task?.stageId ?? defaultStageId ?? stages[0]?.id ?? '',
    title: task?.title ?? '',
    description: task?.description ?? '',
    owner: task?.owner ?? '',
    assigneeId: task?.assigneeId ?? '',
    assigneeName: task?.assigneeName ?? '',
    dueDate: task?.dueDate ?? '',
    status: task?.status ?? 'todo',
    priority: task?.priority ?? 'medium',
    estimatedHours: task?.estimatedHours?.toString() ?? '',
    actualHours: task?.actualHours?.toString() ?? '',
    blockerReason: task?.blockerReason ?? '',
    completionReport: task?.completionReport ?? '',
    issueNotes: task?.issueNotes ?? '',
    approvalRequired: task?.approvalRequired ?? false,
  });

  // Load danh sách nhân viên cho dropdown
  useEffect(() => {
    api.users.listActive().then(setTeamUsers).catch(() => {});
  }, []);

  // Reset form khi mở/đóng dialog
  useEffect(() => {
    if (!open) return;
    const defaultOwner = !isEdit && currentUser ? currentUser.name : (task?.owner ?? '');

    setForm({
      stageId: task?.stageId ?? defaultStageId ?? stages[0]?.id ?? '',
      title: task?.title ?? '',
      description: task?.description ?? '',
      owner: defaultOwner,
      assigneeId: task?.assigneeId ?? '',
      assigneeName: task?.assigneeName ?? '',
      dueDate: task?.dueDate ?? '',
      status: task?.status ?? 'todo',
      priority: task?.priority ?? 'medium',
      estimatedHours: task?.estimatedHours?.toString() ?? '',
      actualHours: task?.actualHours?.toString() ?? '',
      blockerReason: task?.blockerReason ?? '',
      completionReport: task?.completionReport ?? '',
      issueNotes: task?.issueNotes ?? '',
      approvalRequired: task?.approvalRequired ?? false,
    });
  }, [open, task, defaultStageId, stages, currentUser, isEdit]);

  // Khi chọn người thực hiện từ dropdown → tự fill assigneeId + assigneeName
  const handleAssigneeChange = (userId: string) => {
    if (!userId) {
      setForm((f) => ({ ...f, assigneeId: '', assigneeName: '' }));
      return;
    }
    const selected = teamUsers.find((u) => u.id === userId);
    if (selected) {
      setForm((f) => ({ ...f, assigneeId: selected.id, assigneeName: selected.name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Tiêu đề không được để trống'); return; }
    if (!form.stageId) { toast.error('Vui lòng chọn giai đoạn'); return; }

    const data: CreateTaskInput = {
      stageId: form.stageId,
      title: form.title.trim(),
      description: form.description.trim(),
      owner: form.owner.trim() || currentUser?.name || '',
      assigneeId: form.assigneeId || null,
      assigneeName: form.assigneeName || '',
      dueDate: form.dueDate || undefined,
      status: form.status as CreateTaskInput['status'],
      priority: form.priority as CreateTaskInput['priority'],
      estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : undefined,
      actualHours: form.actualHours ? parseFloat(form.actualHours) : undefined,
      blockerReason: form.status === 'blocked' ? form.blockerReason : undefined,
      completionReport: form.status === 'done' ? form.completionReport : undefined,
      issueNotes: (form.status === 'todo' || form.status === 'doing') ? form.issueNotes : undefined,
      approvalRequired: form.approvalRequired,
    };

    setLoading(true);
    try {
      const result = isEdit
        ? await api.tasks.update(task.id, data)
        : await api.tasks.create(projectId, data);

      toast.success(isEdit ? 'Đã cập nhật công việc!' : 'Đã thêm công việc!');
      onSuccess(result);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const ROLE_LABEL: Record<string, string> = { admin: 'Quản trị viên', manager: 'Trưởng nhóm', employee: 'Nhân viên' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Chỉnh sửa công việc' : 'Thêm công việc'}</DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-2 space-y-4">
            <div>
              <Label>Giai đoạn *</Label>
              <Select
                value={form.stageId}
                onChange={(e) => setForm((f) => ({ ...f, stageId: e.target.value }))}
                className="mt-1"
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Tiêu đề *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Nhập tên công việc..."
                className="mt-1"
                autoFocus
              />
            </div>

            <div>
              <Label>Mô tả</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả chi tiết..."
                className="mt-1"
                rows={2}
              />
            </div>

            {/* Assignee (admin/manager only) + Deadline */}
            <div className={canManage ? 'grid grid-cols-2 gap-3' : ''}>
              {canManage && (
                <div>
                  <Label>Giao cho <span className="text-muted-foreground font-normal">(tuỳ chọn)</span></Label>
                  <Select
                    value={form.assigneeId}
                    onChange={(e) => handleAssigneeChange(e.target.value)}
                    className="mt-1"
                  >
                    <option value="">-- Không chỉ định --</option>
                    {teamUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {ROLE_LABEL[u.role] ?? u.role}
                      </option>
                    ))}
                  </Select>
                  {form.assigneeName && !teamUsers.find((u) => u.id === form.assigneeId) && (
                    <p className="text-xs text-muted-foreground mt-1">{form.assigneeName}</p>
                  )}
                </div>
              )}
              <div>
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Người tạo */}
            <div>
              <Label>Người tạo / phụ trách</Label>
              <Input
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                placeholder="Tên người phụ trách"
                className="mt-1"
                readOnly={!canManage}
              />
              {!canManage && (
                <p className="text-xs text-muted-foreground mt-1">Tự động điền từ tài khoản của bạn</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Trạng thái</Label>
                <Select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof f.status }))}
                  className="mt-1"
                >
                  <option value="todo">Chưa làm</option>
                  <option value="doing">Đang làm</option>
                  <option value="done">Hoàn thành</option>
                  <option value="blocked">Bị chặn</option>
                </Select>
              </div>
              <div>
                <Label>Độ ưu tiên</Label>
                <Select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as typeof f.priority }))}
                  className="mt-1"
                >
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                  <option value="critical">Khẩn cấp</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Giờ dự kiến</Label>
                <Input
                  type="number" min={0} step={0.5}
                  value={form.estimatedHours}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))}
                  placeholder="0" className="mt-1"
                />
              </div>
              <div>
                <Label>Giờ thực tế</Label>
                <Input
                  type="number" min={0} step={0.5}
                  value={form.actualHours}
                  onChange={(e) => setForm((f) => ({ ...f, actualHours: e.target.value }))}
                  placeholder="0" className="mt-1"
                />
              </div>
            </div>

            {form.status === 'blocked' && (
              <div>
                <Label>Lý do bị chặn</Label>
                <Textarea
                  value={form.blockerReason}
                  onChange={(e) => setForm((f) => ({ ...f, blockerReason: e.target.value }))}
                  placeholder="Mô tả lý do bị chặn và cần hỗ trợ gì..."
                  className="mt-1" rows={2}
                />
              </div>
            )}

            {form.status === 'done' && (
              <div>
                <Label>Báo cáo kết quả</Label>
                <MarkdownEditor
                  value={form.completionReport}
                  onChange={(val) => setForm((f) => ({ ...f, completionReport: val }))}
                  placeholder="Mô tả kết quả đạt được, cách xử lý, những điều đáng chú ý..."
                  rows={6} className="mt-1"
                />
              </div>
            )}

            {(form.status === 'todo' || form.status === 'doing') && (
              <div>
                <Label>Ghi chú vấn đề / chậm tiến độ</Label>
                <MarkdownEditor
                  value={form.issueNotes}
                  onChange={(val) => setForm((f) => ({ ...f, issueNotes: val }))}
                  placeholder="Đang gặp khó khăn gì? Nguyên nhân chậm tiến độ? Cần hỗ trợ gì?..."
                  rows={4} className="mt-1"
                />
              </div>
            )}

            {/* Approval required checkbox */}
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <input
                id="approvalRequired"
                type="checkbox"
                checked={form.approvalRequired}
                onChange={(e) => setForm((f) => ({ ...f, approvalRequired: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer"
              />
              <div>
                <label htmlFor="approvalRequired" className="text-sm font-medium cursor-pointer">Yêu cầu phê duyệt trước khi hoàn thành</label>
                <p className="text-xs text-muted-foreground mt-0.5">Khi bật, nhân viên cần gửi yêu cầu phê duyệt và quản lý phải duyệt trước khi công việc được xác nhận hoàn thành</p>
              </div>
            </div>

            {isEdit && task && (
              <TaskAttachments taskId={task.id} addedBy={form.owner || currentUser?.name || 'Nhân viên'} />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm công việc'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
