import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Factory, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { api } from '../../lib/api';
import type { FactoryEngagementWithFactory, Factory as FactoryType } from '@rd/shared';

const STATUS_LABEL: Record<string, string> = {
  sourcing: 'Tìm kiếm', quoting: 'Báo giá', negotiating: 'Đàm phán',
  sampling: 'Lấy mẫu', approved: 'Đã phê duyệt', 'in-production': 'Sản xuất',
  completed: 'Hoàn thành', cancelled: 'Đã hủy',
};
const STATUS_COLOR: Record<string, string> = {
  sourcing: 'bg-gray-100 text-gray-600', quoting: 'bg-blue-100 text-blue-700',
  negotiating: 'bg-amber-100 text-amber-700', sampling: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700', 'in-production': 'bg-teal-100 text-teal-700',
  completed: 'bg-green-200 text-green-800', cancelled: 'bg-red-100 text-red-700',
};
const SCOPE_LABEL: Record<string, string> = {
  formula: 'Công thức', packaging: 'Bao bì', filling: 'Đóng gói', labeling: 'Nhãn mác',
  'full-production': 'Toàn bộ sản xuất', testing: 'Kiểm nghiệm', other: 'Khác',
};

function NewEngagementDialog({
  open, onOpenChange, projectId, onSuccess,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  projectId: string; onSuccess: (e: FactoryEngagementWithFactory) => void;
}) {
  const [factories, setFactories] = useState<FactoryType[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    factoryId: '', scope: 'other', scopeDescription: '', status: 'sourcing',
    internalOwner: '', startDate: new Date().toISOString().slice(0, 10),
    targetCompletionDate: '', currency: 'VND',
  });

  useEffect(() => {
    if (open) api.factories.list({ status: 'active' }).then(setFactories).catch(() => {});
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.factoryId) { toast.error('Vui lòng chọn nhà máy'); return; }
    setLoading(true);
    try {
      const eng = await api.engagements.create(projectId, {
        ...form,
        targetCompletionDate: form.targetCompletionDate || undefined,
      } as Partial<FactoryEngagementWithFactory>);
      toast.success('Đã tạo engagement!');
      onSuccess(eng);
      onOpenChange(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra'); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader><DialogTitle>Bắt đầu làm việc với nhà máy</DialogTitle></DialogHeader>
          <div className="px-6 pb-2 space-y-3">
            <div>
              <Label>Nhà máy *</Label>
              <Select value={form.factoryId} onChange={(e) => setForm((f) => ({ ...f, factoryId: e.target.value }))} className="mt-1">
                <option value="">-- Chọn nhà máy --</option>
                {factories.map((fac) => (
                  <option key={fac.id} value={fac.id}>{fac.name}</option>
                ))}
              </Select>
              {factories.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Chưa có nhà máy. <Link to="/factories" className="text-primary underline">Thêm nhà máy</Link>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phạm vi</Label>
                <Select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))} className="mt-1">
                  {Object.entries(SCOPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </div>
              <div>
                <Label>Trạng thái</Label>
                <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="mt-1">
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <Label>Mô tả chi tiết</Label>
              <Textarea value={form.scopeDescription} onChange={(e) => setForm((f) => ({ ...f, scopeDescription: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Người phụ trách</Label>
                <Input value={form.internalOwner} onChange={(e) => setForm((f) => ({ ...f, internalOwner: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Ngày bắt đầu</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mục tiêu hoàn thành</Label>
                <Input type="date" value={form.targetCompletionDate} onChange={(e) => setForm((f) => ({ ...f, targetCompletionDate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Tiền tệ</Label>
                <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="mt-1">
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Đang tạo...' : 'Tạo engagement'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EngagementTab({ projectId }: { projectId: string }) {
  const [engagements, setEngagements] = useState<FactoryEngagementWithFactory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.engagements.listByProject(projectId)
      .then(setEngagements)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div className="text-center py-10 text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{engagements.length} nhà máy đang làm việc</p>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Thêm nhà máy
        </Button>
      </div>

      {engagements.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Factory className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Chưa có nhà máy nào</p>
          <p className="text-sm mt-1">Nhấn "Thêm nhà máy" để bắt đầu làm việc với nhà máy</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {engagements.map((eng) => (
            <Link key={eng.id} to={`/engagements/${eng.id}`} state={{ from: 'project', projectId }} className="group">
              <div className="border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold group-hover:text-primary transition-colors">
                      {eng.factoryName}
                      {eng.factoryShortName && <span className="font-normal text-muted-foreground text-sm ml-1">({eng.factoryShortName})</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">{eng.factoryCountry}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[eng.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[eng.status] || eng.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>

                <Badge variant="secondary" className="text-xs mb-2">{SCOPE_LABEL[eng.scope] || eng.scope}</Badge>
                {eng.scopeDescription && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{eng.scopeDescription}</p>}

                <div className="mt-3 pt-3 border-t text-sm text-muted-foreground flex items-center justify-between">
                  <span>{eng.internalOwner || '—'}</span>
                  {eng.finalUnitPrice ? (
                    <span className="font-medium text-foreground">{eng.finalUnitPrice.toLocaleString()} {eng.currency}</span>
                  ) : (
                    <span>{eng.startDate}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewEngagementDialog
        open={showForm}
        onOpenChange={setShowForm}
        projectId={projectId}
        onSuccess={(eng) => setEngagements((prev) => [eng, ...prev])}
      />
    </div>
  );
}
