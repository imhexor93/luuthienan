import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Truck, Plane, Ship, Navigation } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { api } from '../../lib/api';
import type { ShippingLeg, ShippingLegType, ShippingMode, ShippingLegStatus, Currency } from '@rd/shared';

const LEG_TYPE_LABEL: Record<ShippingLegType, string> = {
  'factory-to-port-china': 'Nhà máy → Cảng TQ',
  'china-to-vietnam-sea': 'TQ → VN (đường biển)',
  'china-to-vietnam-air': 'TQ → VN (hàng không)',
  'vietnam-port-to-warehouse': 'Cảng VN → Kho',
  custom: 'Tùy chỉnh',
};

const MODE_LABEL: Record<ShippingMode, string> = {
  sea: 'Đường biển', air: 'Hàng không', road: 'Đường bộ', rail: 'Đường sắt',
};

const STATUS_LABEL: Record<ShippingLegStatus, string> = {
  'not-booked': 'Chưa đặt', booked: 'Đã đặt', 'in-transit': 'Đang vận chuyển',
  'customs-clearance': 'Đang thông quan', delivered: 'Đã giao', delayed: 'Trễ',
};

const STATUS_COLOR: Record<ShippingLegStatus, string> = {
  'not-booked': 'bg-gray-100 text-gray-600',
  booked: 'bg-blue-100 text-blue-700',
  'in-transit': 'bg-amber-100 text-amber-700',
  'customs-clearance': 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  delayed: 'bg-red-100 text-red-700',
};

const MODE_ICON: Record<ShippingMode, React.ReactNode> = {
  sea: <Ship className="h-4 w-4" />,
  air: <Plane className="h-4 w-4" />,
  road: <Truck className="h-4 w-4" />,
  rail: <Navigation className="h-4 w-4" />,
};

function daysDiff(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / 86400000);
}

function delayDays(leg: ShippingLeg): number | null {
  const planned = daysDiff(leg.plannedStartDate, leg.plannedEndDate);
  const actual = daysDiff(leg.actualStartDate, leg.actualEndDate);
  if (planned == null || actual == null) return null;
  return actual - planned;
}

export function ShippingTab({ engagementId }: { engagementId: string }) {
  const [legs, setLegs] = useState<ShippingLeg[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    legType: 'china-to-vietnam-sea' as ShippingLegType,
    mode: 'sea' as ShippingMode,
    origin: '',
    destination: '',
    plannedStartDate: '',
    plannedEndDate: '',
    actualStartDate: '',
    actualEndDate: '',
    carrier: '',
    trackingNumber: '',
    cost: '',
    costCurrency: 'USD' as Currency,
    status: 'not-booked' as ShippingLegStatus,
    notes: '',
  });

  useEffect(() => {
    api.engagements.shipping.list(engagementId).then(setLegs).catch(() => {});
  }, [engagementId]);

  const resetForm = () => {
    setForm({
      legType: 'china-to-vietnam-sea', mode: 'sea', origin: '', destination: '',
      plannedStartDate: '', plannedEndDate: '', actualStartDate: '', actualEndDate: '',
      carrier: '', trackingNumber: '', cost: '', costCurrency: 'USD' as Currency, status: 'not-booked' as ShippingLegStatus, notes: '',
    });
    setEditingId(null);
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (leg: ShippingLeg) => {
    setForm({
      legType: leg.legType,
      mode: leg.mode,
      origin: leg.origin,
      destination: leg.destination,
      plannedStartDate: leg.plannedStartDate || '',
      plannedEndDate: leg.plannedEndDate || '',
      actualStartDate: leg.actualStartDate || '',
      actualEndDate: leg.actualEndDate || '',
      carrier: leg.carrier,
      trackingNumber: leg.trackingNumber,
      cost: leg.cost > 0 ? String(leg.cost) : '',
      costCurrency: leg.costCurrency,
      status: leg.status,
      notes: leg.notes,
    });
    setEditingId(leg.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        legType: form.legType,
        mode: form.mode,
        origin: form.origin,
        destination: form.destination,
        plannedStartDate: form.plannedStartDate || null,
        plannedEndDate: form.plannedEndDate || null,
        actualStartDate: form.actualStartDate || null,
        actualEndDate: form.actualEndDate || null,
        carrier: form.carrier,
        trackingNumber: form.trackingNumber,
        cost: parseFloat(form.cost) || 0,
        costCurrency: form.costCurrency,
        status: form.status,
        notes: form.notes,
        order: legs.length + 1,
      };

      if (editingId) {
        const updated = await api.engagements.shipping.update(editingId, payload);
        setLegs((prev) => prev.map((l) => l.id === editingId ? updated : l));
        toast.success('Đã cập nhật lộ trình!');
      } else {
        const created = await api.engagements.shipping.create(engagementId, payload);
        setLegs((prev) => [...prev, created]);
        toast.success('Đã thêm lộ trình vận chuyển!');
      }
      setShowForm(false);
      resetForm();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa lộ trình này?')) return;
    await api.engagements.shipping.delete(id);
    setLegs((prev) => prev.filter((l) => l.id !== id));
    toast.success('Đã xóa');
  };

  const updateStatus = async (id: string, status: ShippingLegStatus) => {
    try {
      const updated = await api.engagements.shipping.update(id, { status });
      setLegs((prev) => prev.map((l) => l.id === id ? updated : l));
    } catch { toast.error('Không thể cập nhật'); }
  };

  // Total planned/actual days summary
  const totalPlanned = legs.reduce((s, l) => s + (daysDiff(l.plannedStartDate, l.plannedEndDate) ?? 0), 0);
  const totalActual = legs.reduce((s, l) => s + (daysDiff(l.actualStartDate, l.actualEndDate) ?? 0), 0);
  const totalCost = legs.reduce((s, l) => s + (l.cost || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {legs.length > 0 && (
            <span>
              {legs.length} lộ trình ·
              {totalPlanned > 0 && <span> Kế hoạch: <strong>{totalPlanned} ngày</strong></span>}
              {totalActual > 0 && <span> · Thực tế: <strong className={totalActual > totalPlanned ? 'text-red-600' : 'text-green-600'}>{totalActual} ngày</strong></span>}
              {totalCost > 0 && <span> · Chi phí: <strong>{totalCost.toLocaleString()}</strong></span>}
            </span>
          )}
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />Thêm lộ trình
        </Button>
      </div>

      {legs.length === 0 && (
        <p className="text-center py-10 text-muted-foreground">Chưa có lộ trình vận chuyển nào</p>
      )}

      {/* Timeline view */}
      {legs.length > 0 && (
        <div className="space-y-3">
          {legs.map((leg, idx) => {
            const delay = delayDays(leg);
            const plannedDays = daysDiff(leg.plannedStartDate, leg.plannedEndDate);
            const actualDays = daysDiff(leg.actualStartDate, leg.actualEndDate);

            return (
              <div key={leg.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                  <span className="text-muted-foreground text-sm font-mono w-5">{idx + 1}</span>
                  <span className="text-muted-foreground">{MODE_ICON[leg.mode]}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{LEG_TYPE_LABEL[leg.legType]}</span>
                      {leg.origin && leg.destination && (
                        <span className="text-xs text-muted-foreground">{leg.origin} → {leg.destination}</span>
                      )}
                    </div>
                    {leg.carrier && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {leg.carrier}{leg.trackingNumber && ` · ${leg.trackingNumber}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[leg.status]}`}>
                      {STATUS_LABEL[leg.status]}
                    </span>
                    {delay != null && delay > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        Trễ {delay} ngày
                      </span>
                    )}
                    <button onClick={() => openEdit(leg)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent">Sửa</button>
                    <button onClick={() => handleDelete(leg.id)} className="text-xs text-destructive hover:opacity-70 px-1">✕</button>
                  </div>
                </div>

                <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ngày khởi hành</p>
                    <p className={`font-medium ${leg.actualStartDate && leg.plannedStartDate && leg.actualStartDate > leg.plannedStartDate ? 'text-amber-600' : ''}`}>
                      KH: {leg.plannedStartDate || '—'}
                    </p>
                    {leg.actualStartDate && (
                      <p className="text-xs text-muted-foreground">TT: {leg.actualStartDate}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ngày dự kiến đến</p>
                    <p className={`font-medium ${leg.actualEndDate && leg.plannedEndDate && leg.actualEndDate > leg.plannedEndDate ? 'text-red-600' : ''}`}>
                      KH: {leg.plannedEndDate || '—'}
                    </p>
                    {leg.actualEndDate && (
                      <p className="text-xs text-muted-foreground">TT: {leg.actualEndDate}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Thời gian vận chuyển</p>
                    <p className="font-medium">
                      {plannedDays != null ? `KH: ${plannedDays} ngày` : '—'}
                    </p>
                    {actualDays != null && (
                      <p className={`text-xs ${actualDays > (plannedDays ?? 0) ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        TT: {actualDays} ngày
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Chi phí</p>
                    <p className="font-medium">
                      {leg.cost > 0 ? `${leg.cost.toLocaleString()} ${leg.costCurrency}` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">{MODE_LABEL[leg.mode]}</p>
                  </div>
                </div>

                {leg.notes && (
                  <div className="px-4 pb-3 text-xs text-muted-foreground italic border-t pt-2">{leg.notes}</div>
                )}

                {/* Status buttons */}
                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                  {(['not-booked', 'booked', 'in-transit', 'customs-clearance', 'delivered', 'delayed'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(leg.id, s)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${leg.status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent border-border'}`}
                    >{STATUS_LABEL[s]}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent onClose={() => { setShowForm(false); resetForm(); }} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Cập nhật lộ trình' : 'Thêm lộ trình vận chuyển'}</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-2 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Loại lộ trình</Label>
                  <Select value={form.legType} onChange={(e) => setForm((f) => ({ ...f, legType: e.target.value as ShippingLegType }))} className="mt-1">
                    {Object.entries(LEG_TYPE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Phương thức</Label>
                  <Select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as ShippingMode }))} className="mt-1">
                    {Object.entries(MODE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Điểm xuất phát</Label>
                  <Input value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} className="mt-1" placeholder="VD: Guangzhou" />
                </div>
                <div>
                  <Label>Điểm đến</Label>
                  <Input value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} className="mt-1" placeholder="VD: Cảng Hải Phòng" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ngày khởi hành (kế hoạch)</Label>
                  <Input type="date" value={form.plannedStartDate} onChange={(e) => setForm((f) => ({ ...f, plannedStartDate: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Ngày đến (kế hoạch)</Label>
                  <Input type="date" value={form.plannedEndDate} onChange={(e) => setForm((f) => ({ ...f, plannedEndDate: e.target.value }))} className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ngày khởi hành (thực tế)</Label>
                  <Input type="date" value={form.actualStartDate} onChange={(e) => setForm((f) => ({ ...f, actualStartDate: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Ngày đến (thực tế)</Label>
                  <Input type="date" value={form.actualEndDate} onChange={(e) => setForm((f) => ({ ...f, actualEndDate: e.target.value }))} className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hãng vận chuyển</Label>
                  <Input value={form.carrier} onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))} className="mt-1" placeholder="VD: COSCO, DHL, FedEx" />
                </div>
                <div>
                  <Label>Mã tracking</Label>
                  <Input value={form.trackingNumber} onChange={(e) => setForm((f) => ({ ...f, trackingNumber: e.target.value }))} className="mt-1" placeholder="VD: COSU1234567890" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Chi phí vận chuyển</Label>
                  <Input type="number" min={0} step="0.01" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} className="mt-1" placeholder="0" />
                </div>
                <div>
                  <Label>Tiền tệ</Label>
                  <Select value={form.costCurrency} onChange={(e) => setForm((f) => ({ ...f, costCurrency: e.target.value as Currency }))} className="mt-1">
                    <option value="USD">USD</option>
                    <option value="CNY">CNY</option>
                    <option value="VND">VND</option>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Trạng thái</Label>
                <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ShippingLegStatus }))} className="mt-1">
                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Ghi chú</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" placeholder="Ghi chú thêm về lộ trình..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setShowForm(false); resetForm(); }}>Hủy</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm lộ trình'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
