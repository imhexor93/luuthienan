import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { api } from '../../lib/api';
import { PRODUCT_CATEGORIES } from '../../lib/constants';
import type { ProjectWithProgress, CreateProjectInput } from '@rd/shared';

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectWithProgress;
  onSuccess: (project: ProjectWithProgress) => void;
}

export function ProjectForm({ open, onOpenChange, project, onSuccess }: ProjectFormProps) {
  const isEdit = !!project;
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: project?.name ?? '',
    description: project?.description ?? '',
    productCategory: project?.productCategory ?? '',
    market: project?.market ?? '',
    brand: project?.brand ?? '',
    progressSummary: project?.progressSummary ?? '',
    startDate: project?.startDate ?? new Date().toISOString().split('T')[0],
    targetLaunchDate: project?.targetLaunchDate ?? '',
    budget: project?.budget?.toString() ?? '0',
    status: project?.status ?? 'active',
  });

  // Reset form when project changes
  React.useEffect(() => {
    setForm({
      name: project?.name ?? '',
      description: project?.description ?? '',
      productCategory: project?.productCategory ?? '',
      market: project?.market ?? '',
      brand: project?.brand ?? '',
      progressSummary: project?.progressSummary ?? '',
      startDate: project?.startDate ?? new Date().toISOString().split('T')[0],
      targetLaunchDate: project?.targetLaunchDate ?? '',
      budget: project?.budget?.toString() ?? '0',
      status: project?.status ?? 'active',
    });
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Tên dự án không được để trống');
      return;
    }
    if (!form.targetLaunchDate) {
      toast.error('Vui lòng chọn ngày ra mắt mục tiêu');
      return;
    }
    if (form.targetLaunchDate < form.startDate) {
      toast.error('Ngày ra mắt phải sau ngày bắt đầu');
      return;
    }

    const data: CreateProjectInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      productCategory: form.productCategory,
      market: form.market.trim(),
      brand: form.brand.trim(),
      progressSummary: form.progressSummary.trim(),
      startDate: form.startDate,
      targetLaunchDate: form.targetLaunchDate,
      budget: parseFloat(form.budget) || 0,
      status: form.status as CreateProjectInput['status'],
    };

    setLoading(true);
    try {
      const result = isEdit
        ? await api.projects.update(project.id, data)
        : await api.projects.create(data);

      toast.success(isEdit ? 'Đã cập nhật dự án!' : 'Đã tạo dự án mới!');
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
            <DialogTitle>{isEdit ? 'Chỉnh sửa dự án' : 'Tạo dự án mới'}</DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-2 space-y-4">
            <div>
              <Label htmlFor="name">Tên dự án *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nhập tên dự án..."
                className="mt-1"
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả ngắn về dự án..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="brand">Thương hiệu</Label>
                <Input
                  id="brand"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="VD: NutriLife, SkinGlow..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="market">Thị trường</Label>
                <Input
                  id="market"
                  value={form.market}
                  onChange={(e) => setForm((f) => ({ ...f, market: e.target.value }))}
                  placeholder="VD: Việt Nam, EU, USA..."
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="category">Danh mục sản phẩm</Label>
                <Select
                  id="category"
                  value={form.productCategory}
                  onChange={(e) => setForm((f) => ({ ...f, productCategory: e.target.value }))}
                  className="mt-1"
                >
                  <option value="">-- Chọn danh mục --</option>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Trạng thái</Label>
                <Select
                  id="status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof f.status }))}
                  className="mt-1"
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="on-hold">Tạm dừng</option>
                  <option value="completed">Hoàn thành</option>
                  <option value="cancelled">Đã hủy</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startDate">Ngày bắt đầu *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="targetLaunchDate">Ngày ra mắt mục tiêu *</Label>
                <Input
                  id="targetLaunchDate"
                  type="date"
                  value={form.targetLaunchDate}
                  min={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, targetLaunchDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="progressSummary">Tóm tắt tiến độ hiện tại</Label>
              <Textarea
                id="progressSummary"
                value={form.progressSummary}
                onChange={(e) => setForm((f) => ({ ...f, progressSummary: e.target.value }))}
                placeholder="VD: Đang chờ NM gửi mẫu bao bì, dự kiến 17/7 nhận được và đánh giá..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="budget">Ngân sách (VND)</Label>
              <Input
                id="budget"
                type="number"
                min={0}
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                placeholder="0"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo dự án'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
