import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Factory, MapPin, Star, Package, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import type { Factory as FactoryType } from '@rd/shared';

const STATUS_LABEL: Record<string, string> = {
  active: 'Đang hợp tác',
  inactive: 'Không hoạt động',
  blacklisted: 'Từ chối',
};

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  blacklisted: 'bg-red-100 text-red-700',
};

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  );
}

function FactoryFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: (f: FactoryType) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', shortName: '', address: '', country: 'Việt Nam',
    specialties: '', certifications: '', paymentTerms: '',
    notes: '', status: 'active', rating: '3',
    moqDefault: '', leadTimeDays: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Tên nhà máy không được để trống'); return; }
    setLoading(true);
    try {
      const result = await api.factories.create({
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        address: form.address.trim(),
        country: form.country.trim(),
        specialties: form.specialties.split(',').map((s) => s.trim()).filter(Boolean),
        certifications: form.certifications.split(',').map((s) => s.trim()).filter(Boolean),
        paymentTerms: form.paymentTerms.trim(),
        notes: form.notes.trim(),
        status: form.status as FactoryType['status'],
        rating: parseFloat(form.rating) || 3,
        moqDefault: form.moqDefault ? parseFloat(form.moqDefault) : undefined,
        leadTimeDays: form.leadTimeDays ? parseInt(form.leadTimeDays) : undefined,
      });
      toast.success('Đã thêm nhà máy!');
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
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Thêm nhà máy mới</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tên nhà máy *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tên đầy đủ" className="mt-1" autoFocus />
              </div>
              <div>
                <Label>Tên viết tắt</Label>
                <Input value={form.shortName} onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))} placeholder="VD: NM-ABC" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Địa chỉ</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Địa chỉ nhà máy" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quốc gia</Label>
                <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Trạng thái</Label>
                <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="mt-1">
                  <option value="active">Đang hợp tác</option>
                  <option value="inactive">Không hoạt động</option>
                  <option value="blacklisted">Từ chối</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Chuyên môn (phân cách bằng dấu phẩy)</Label>
              <Input value={form.specialties} onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))} placeholder="VD: Dược phẩm, Thực phẩm chức năng" className="mt-1" />
            </div>
            <div>
              <Label>Chứng nhận (phân cách bằng dấu phẩy)</Label>
              <Input value={form.certifications} onChange={(e) => setForm((f) => ({ ...f, certifications: e.target.value }))} placeholder="VD: GMP, ISO 22000" className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>MOQ mặc định</Label>
                <Input type="number" value={form.moqDefault} onChange={(e) => setForm((f) => ({ ...f, moqDefault: e.target.value }))} placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label>Lead time (ngày)</Label>
                <Input type="number" value={form.leadTimeDays} onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))} placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label>Đánh giá (1-5)</Label>
                <Input type="number" min={1} max={5} step={0.5} value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Điều kiện thanh toán</Label>
              <Input value={form.paymentTerms} onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))} placeholder="VD: 30% trước, 70% khi nhận hàng" className="mt-1" />
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Đang lưu...' : 'Thêm nhà máy'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FactoriesPage() {
  const [factories, setFactories] = useState<FactoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<FactoryType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.factories.delete(confirmDelete.id);
      setFactories((prev) => prev.filter((f) => f.id !== confirmDelete.id));
      toast.success(`Đã xóa nhà máy "${confirmDelete.name}"`);
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể xóa');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    api.factories.list(filterStatus ? { status: filterStatus } : undefined)
      .then(setFactories)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [filterStatus]);

  const filtered = factories.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.country.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="h-6 w-6 text-primary" />
            Quản lý Nhà máy
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Danh sách nhà máy đang hợp tác và lịch sử làm việc</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Thêm nhà máy
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên, quốc gia..."
          className="max-w-xs"
        />
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-44">
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hợp tác</option>
          <option value="inactive">Không hoạt động</option>
          <option value="blacklisted">Từ chối</option>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-20 text-muted-foreground">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Factory className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Chưa có nhà máy nào. Thêm nhà máy đầu tiên!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((factory) => (
            <div key={factory.id} className="group relative">
              <Link to={`/factories/${factory.id}`}>
              <div className="border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all bg-card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{factory.name}</h3>
                    {factory.shortName && <span className="text-xs text-muted-foreground">{factory.shortName}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[factory.status]}`}>
                      {STATUS_LABEL[factory.status]}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>

                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{factory.address || factory.country}</span>
                  </div>
                  {factory.moqDefault != null && (
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>MOQ: {factory.moqDefault.toLocaleString()}</span>
                      {factory.leadTimeDays != null && <span>· Lead time: {factory.leadTimeDays} ngày</span>}
                    </div>
                  )}
                </div>

                {factory.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {factory.specialties.slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                    {factory.specialties.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{factory.specialties.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <StarRating value={factory.rating} />
                  {factory.certifications.length > 0 && (
                    <span className="text-xs text-muted-foreground">{factory.certifications.slice(0, 2).join(', ')}</span>
                  )}
                </div>
              </div>
              </Link>
              {/* Delete button — absolute top-right, visible on hover */}
              <button
                onClick={(e) => { e.preventDefault(); setConfirmDelete(factory); }}
                className="absolute top-3 right-3 h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border text-muted-foreground hover:text-destructive hover:border-destructive z-10"
                title="Xóa nhà máy"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <FactoryFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={(f) => setFactories((prev) => [f, ...prev])}
      />

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-sm border p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Xóa nhà máy?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Hành động này không thể hoàn tác.</p>
              </div>
            </div>
            <p className="text-sm">
              Bạn có chắc muốn xóa nhà máy{' '}
              <span className="font-semibold block truncate max-w-full" title={confirmDelete.name}>"{confirmDelete.name}"</span>{' '}
              không?
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} disabled={deleting}>Hủy</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Đang xóa...' : 'Xóa nhà máy'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
