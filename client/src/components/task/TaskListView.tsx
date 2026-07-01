import React, { useState } from 'react';
import { AlertCircle, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { cn, formatDate, isOverdue } from '../../lib/utils';
import {
  TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_LABELS, STAGE_COLORS,
} from '../../lib/constants';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Task, StageWithProgress } from '@rd/shared';

interface TaskListViewProps {
  tasks: Task[];
  stages: StageWithProgress[];
  onTaskClick: (task: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

// Mini avatar từ tên
function AssigneeChip({ name, color }: { name: string; color?: string }) {
  const initials = name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase();
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
        style={{ backgroundColor: color ?? '#6366f1' }}
      >
        {initials}
      </div>
      <span className="text-sm text-muted-foreground truncate max-w-[100px]">{name}</span>
    </div>
  );
}

export function TaskListView({ tasks, stages, onTaskClick, onTaskDeleted }: TaskListViewProps) {
  const { canManage, user: currentUser } = useAuth();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.tasks.delete(deleteId);
      toast.success('Đã xóa công việc');
      onTaskDeleted(deleteId);
      setDeleteId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setDeleting(false);
    }
  };

  // Nhân viên chỉ xóa được task của chính mình
  const canDelete = (task: Task) => {
    if (canManage) return true;
    return task.assigneeId === currentUser?.id || task.owner === currentUser?.name;
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Chưa có công việc nào</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Công việc</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden sm:table-cell">Giai đoạn</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden md:table-cell">Người thực hiện</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden lg:table-cell">Deadline</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Trạng thái</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Ưu tiên</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((task) => {
              const stage = stages.find((s) => s.id === task.stageId);
              const stageIndex = stages.findIndex((s) => s.id === task.stageId);
              const overdue = isOverdue(task.dueDate);
              // Highlight task được giao cho mình
              const isMyTask = task.assigneeId === currentUser?.id || task.owner === currentUser?.name;

              return (
                <tr
                  key={task.id}
                  className={cn(
                    'hover:bg-muted/30 transition-colors',
                    isMyTask && 'bg-primary/5'
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2 cursor-pointer" onClick={() => onTaskClick(task)}>
                      <div className={cn('w-1 self-stretch rounded-full shrink-0 mt-1', {
                        'bg-slate-300': task.priority === 'low',
                        'bg-blue-400': task.priority === 'medium',
                        'bg-orange-400': task.priority === 'high',
                        'bg-red-500': task.priority === 'critical',
                      })} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium hover:text-primary transition-colors">{task.title}</span>
                          {isMyTask && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Của tôi</span>
                          )}
                        </div>
                        {task.status === 'blocked' && task.blockerReason && (
                          <div className="flex items-center gap-1 text-xs text-red-500 mt-0.5">
                            <AlertCircle className="h-3 w-3" />
                            <span className="line-clamp-1">{task.blockerReason}</span>
                          </div>
                        )}
                        {/* Người tạo (owner) nếu khác assignee */}
                        {task.owner && task.owner !== task.assigneeName && (
                          <p className="text-xs text-muted-foreground mt-0.5">Tạo bởi: {task.owner}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    {stage && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: STAGE_COLORS[stageIndex] + 'cc' }}
                      >
                        {stage.name}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    {task.assigneeName ? (
                      <AssigneeChip name={task.assigneeName} />
                    ) : task.owner ? (
                      <span className="text-muted-foreground text-sm">{task.owner}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                  <td className={cn('px-3 py-3 hidden lg:table-cell text-sm', overdue && 'text-red-500 font-medium')}>
                    {formatDate(task.dueDate)}
                  </td>
                  <td className="px-3 py-3">
                    <Badge className={cn('text-xs', TASK_STATUS_COLORS[task.status])}>
                      {TASK_STATUS_LABELS[task.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onTaskClick(task)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      {canDelete(task) && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(task.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent onClose={() => setDeleteId(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa công việc?</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-2 text-sm text-muted-foreground">
            Hành động này không thể hoàn tác. Công việc sẽ bị xóa vĩnh viễn.
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
