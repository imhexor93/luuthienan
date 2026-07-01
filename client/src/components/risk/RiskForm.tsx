import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { api } from '../../lib/api';
import type { Risk, StageWithProgress, CreateRiskInput } from '@rd/shared';

interface RiskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  stages: StageWithProgress[];
  risk?: Risk;
  onSuccess: (risk: Risk) => void;
}

export function RiskForm({ open, onOpenChange, projectId, stages, risk, onSuccess }: RiskFormProps) {
  const isEdit = !!risk;
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    stageId: risk?.stageId ?? '',
    title: risk?.title ?? '',
    description: risk?.description ?? '',
    severity: risk?.severity ?? 'medium',
    likelihood: risk?.likelihood ?? 'possible',
    mitigation: risk?.mitigation ?? '',
    status: risk?.status ?? 'open',
  });

  useEffect(() => {
    setForm({
      stageId: risk?.stageId ?? '',
      title: risk?.title ?? '',
      description: risk?.description ?? '',
      severity: risk?.severity ?? 'medium',
      likelihood: risk?.likelihood ?? 'possible',
      mitigation: risk?.mitigation ?? '',
      status: risk?.status ?? 'open',
    });
  }, [risk]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Tiêu đề không được để trống'); return; }

    const data: CreateRiskInput = {
      stageId: form.stageId || undefined,
      title: form.title.trim(),
      description: form.description.trim(),
      severity: form.severity as CreateRiskInput['severity'],
      likelihood: form.likelihood as CreateRiskInput['likelihood'],
      mitigation: form.mitigation.trim(),
      status: form.status as CreateRiskInput['status'],
    };

    setLoading(true);
    try {
      const result = isEdit
        ? await api.risks.update(risk.id, data)
        : await api.risks.create(projectId, data);

      toast.success(isEdit ? 'Đã cập nhật rủi ro!' : 'Đã thêm rủi ro!');
      onSuccess(result);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Chỉnh sửa rủi ro' : 'Thêm rủi ro'}</DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-2 space-y-4">
            <div>
              <Label>Tiêu đề *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Mô tả ngắn về rủi ro..."
                className="mt-1"
                autoFocus
              />
            </div>

            <div>
              <Label>Mô tả chi tiết</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Chi tiết về rủi ro và tác động..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mức độ nghiêm trọng *</Label>
                <Select
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as typeof f.severity }))}
                  className="mt-1"
                >
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                  <option value="critical">Nghiêm trọng</option>
                </Select>
              </div>
              <div>
                <Label>Khả năng xảy ra *</Label>
                <Select
                  value={form.likelihood}
                  onChange={(e) => setForm((f) => ({ ...f, likelihood: e.target.value as typeof f.likelihood }))}
                  className="mt-1"
                >
                  <option value="rare">Hiếm</option>
                  <option value="possible">Có thể</option>
                  <option value="likely">Có khả năng</option>
                  <option value="certain">Chắc chắn</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Trạng thái</Label>
                <Select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof f.status }))}
                  className="mt-1"
                >
                  <option value="open">Đang mở</option>
                  <option value="monitoring">Đang theo dõi</option>
                  <option value="mitigated">Đã giảm thiểu</option>
                  <option value="occurred">Đã xảy ra</option>
                </Select>
              </div>
              <div>
                <Label>Giai đoạn liên quan</Label>
                <Select
                  value={form.stageId}
                  onChange={(e) => setForm((f) => ({ ...f, stageId: e.target.value }))}
                  className="mt-1"
                >
                  <option value="">Tất cả giai đoạn</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label>Phương án giảm thiểu</Label>
              <Textarea
                value={form.mitigation}
                onChange={(e) => setForm((f) => ({ ...f, mitigation: e.target.value }))}
                placeholder="Mô tả cách xử lý và giảm thiểu rủi ro này..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm rủi ro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
