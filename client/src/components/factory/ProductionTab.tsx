import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { api } from '../../lib/api';
import type { ProductionExecutionWithPhases, ProductionPhase, QuoteWithDetails } from '@rd/shared';

const EXEC_STATUS_LABEL: Record<string, string> = {
  'not-started': 'Chưa bắt đầu', 'in-progress': 'Đang thực hiện',
  delayed: 'Bị trễ', completed: 'Hoàn thành', 'on-hold': 'Tạm dừng',
};
const EXEC_STATUS_COLOR: Record<string, string> = {
  'not-started': 'bg-gray-100 text-gray-600', 'in-progress': 'bg-blue-100 text-blue-700',
  delayed: 'bg-red-100 text-red-700', completed: 'bg-green-100 text-green-700', 'on-hold': 'bg-amber-100 text-amber-700',
};
const PHASE_STATUS_LABEL: Record<string, string> = {
  'not-started': 'Chưa bắt đầu', 'in-progress': 'Đang thực hiện',
  completed: 'Hoàn thành', delayed: 'Bị trễ', blocked: 'Bị chặn',
};
const PHASE_STATUS_COLOR: Record<string, string> = {
  'not-started': 'bg-gray-100 text-gray-500', 'in-progress': 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700', delayed: 'bg-red-100 text-red-700', blocked: 'bg-orange-100 text-orange-700',
};
const PHASE_TYPE_LABEL: Record<string, string> = {
  'bottle-production': 'SX chai/bao bì', 'packaging-production': 'SX bao gói phụ',
  'material-production': 'SX nguyên liệu', filling: 'Chiết rót',
  'shipping-internal': 'Vận chuyển nội địa', other: 'Khác',
};

function daysDiff(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

function PhaseBar({ phase }: { phase: ProductionPhase }) {
  const isDelayed = phase.actualDays != null && phase.plannedDays != null && phase.actualDays > phase.plannedDays;
  return (
    <div className={`border rounded-lg p-3 ${phase.status === 'delayed' ? 'border-red-200 bg-red-50/30' : 'bg-muted/20'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{phase.phaseName || PHASE_TYPE_LABEL[phase.phaseType]}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${PHASE_STATUS_COLOR[phase.status] || 'bg-gray-100'}`}>
            {PHASE_STATUS_LABEL[phase.status] || phase.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {phase.plannedStartDate && <span>Dự kiến: {phase.plannedStartDate} → {phase.plannedEndDate ?? '?'} ({phase.plannedDays ?? '?'}d)</span>}
          {phase.actualStartDate && (
            <span className={isDelayed ? 'text-red-600 font-medium' : ''}>
              Thực tế: {phase.actualStartDate} → {phase.actualEndDate ?? 'đang chạy'} ({phase.actualDays ?? '?'}d{isDelayed ? ' ⚠' : ''})
            </span>
          )}
        </div>
      </div>
      {phase.delayReason && <p className="text-xs text-red-600 mt-1 italic">Lý do trễ: {phase.delayReason}</p>}
      {phase.notes && <p className="text-xs text-muted-foreground mt-1">{phase.notes}</p>}
    </div>
  );
}

export function ProductionTab({ engagementId }: { engagementId: string }) {
  const [executions, setExecutions] = useState<ProductionExecutionWithPhases[]>([]);
  const [quotes, setQuotes] = useState<QuoteWithDetails[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreateExec, setShowCreateExec] = useState(false);
  const [showAddPhase, setShowAddPhase] = useState<string | null>(null);
  const [execForm, setExecForm] = useState({ quoteId: '', productionOrderNumber: '', orderConfirmedAt: '', overallNotes: '' });
  const [phaseForm, setPhaseForm] = useState({
    phaseType: 'other', phaseName: '', plannedStartDate: '', plannedEndDate: '', status: 'not-started', notes: '', order: '1',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.engagements.production.list(engagementId)
      .then(async (list) => {
        const detailed = await Promise.all(list.map((e) => api.engagements.production.get(e.id)));
        setExecutions(detailed);
        if (detailed.length === 1) setExpanded(detailed[0].id);
      })
      .catch(() => {});
    api.engagements.quotes(engagementId).then(setQuotes).catch(() => {});
  }, [engagementId]);

  const handleCreateExec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!execForm.quoteId) { toast.error('Chọn báo giá đã chốt'); return; }
    setLoading(true);
    try {
      const exec = await api.engagements.production.create(engagementId, {
        quoteId: execForm.quoteId,
        productionOrderNumber: execForm.productionOrderNumber,
        orderConfirmedAt: execForm.orderConfirmedAt || undefined,
        overallNotes: execForm.overallNotes,
      });
      const detailed = await api.engagements.production.get(exec.id);
      setExecutions((prev) => [detailed, ...prev]);
      setExpanded(detailed.id);
      setShowCreateExec(false);
      setExecForm({ quoteId: '', productionOrderNumber: '', orderConfirmedAt: '', overallNotes: '' });
      toast.success('Đã tạo lệnh sản xuất!');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setLoading(false); }
  };

  const handleAddPhase = async (e: React.FormEvent, executionId: string) => {
    e.preventDefault();
    setLoading(true);
    try {
      const phase = await api.engagements.production.phases.create(executionId, {
        phaseType: phaseForm.phaseType, phaseName: phaseForm.phaseName || PHASE_TYPE_LABEL[phaseForm.phaseType],
        plannedStartDate: phaseForm.plannedStartDate || undefined, plannedEndDate: phaseForm.plannedEndDate || undefined,
        status: phaseForm.status, notes: phaseForm.notes, order: parseInt(phaseForm.order) || 1,
      });
      setExecutions((prev) => prev.map((ex) => ex.id === executionId ? { ...ex, phases: [...ex.phases, phase] } : ex));
      setShowAddPhase(null);
      setPhaseForm({ phaseType: 'other', phaseName: '', plannedStartDate: '', plannedEndDate: '', status: 'not-started', notes: '', order: '1' });
      toast.success('Đã thêm công đoạn!');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setLoading(false); }
  };

  const updatePhaseStatus = async (executionId: string, phaseId: string, status: string) => {
    try {
      const updated = await api.engagements.production.phases.update(phaseId, { status: status as ProductionPhase['status'] });
      setExecutions((prev) => prev.map((ex) => ex.id === executionId ? { ...ex, phases: ex.phases.map((p) => p.id === phaseId ? updated : p) } : ex));
    } catch { toast.error('Không thể cập nhật'); }
  };

  const updateExecStatus = async (exec: ProductionExecutionWithPhases, status: string) => {
    try {
      const updated = await api.engagements.production.update(exec.id, { status: status as ProductionExecutionWithPhases['status'] });
      setExecutions((prev) => prev.map((ex) => ex.id === exec.id ? { ...ex, ...updated } : ex));
    } catch { toast.error('Không thể cập nhật'); }
  };

  const acceptedQuotes = quotes.filter((q) => q.status === 'accepted');
  const otherQuotes = quotes.filter((q) => q.status !== 'accepted');

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreateExec(true)} className="gap-1.5"><Plus className="h-4 w-4" />Tạo lệnh SX</Button>
      </div>

      {executions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Chưa có lệnh sản xuất nào</p>
          <p className="text-xs mt-1">Tạo lệnh SX khi đã chốt báo giá với nhà máy</p>
        </div>
      )}

      {executions.map((exec) => (
        <div key={exec.id} className="border rounded-lg overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <button className="flex items-center gap-2 text-left" onClick={() => setExpanded(expanded === exec.id ? null : exec.id)}>
              {expanded === exec.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <div>
                <span className="font-semibold text-sm">{exec.productionOrderNumber || 'Lệnh SX'}</span>
                <span className="ml-2 text-xs text-muted-foreground">· Chốt: {exec.orderConfirmedAt}</span>
              </div>
            </button>
            <div className="flex items-center gap-2">
              <Select value={exec.status} onChange={(e) => updateExecStatus(exec, e.target.value)} className="h-7 text-xs w-40">
                {Object.entries(EXEC_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <span className={`text-xs px-2 py-0.5 rounded-full ${EXEC_STATUS_COLOR[exec.status] || ''}`}>{EXEC_STATUS_LABEL[exec.status]}</span>
            </div>
          </div>

          {expanded === exec.id && (
            <div className="border-t px-4 pb-4 pt-3 space-y-3">
              {/* Phase timeline */}
              <div className="space-y-2">
                {exec.phases.length === 0 && <p className="text-xs text-muted-foreground italic">Chưa có công đoạn nào</p>}
                {exec.phases.map((phase) => (
                  <div key={phase.id}>
                    <PhaseBar phase={phase} />
                    <div className="flex gap-1 mt-1 ml-1">
                      {(['not-started', 'in-progress', 'completed', 'delayed', 'blocked'] as const).map((s) => (
                        <button key={s}
                          onClick={() => updatePhaseStatus(exec.id, phase.id, s)}
                          className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${phase.status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent border-border'}`}
                        >{PHASE_STATUS_LABEL[s]}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowAddPhase(exec.id)}>
                <Plus className="h-3 w-3" />Thêm công đoạn
              </Button>
              {exec.overallNotes && <p className="text-xs text-muted-foreground italic border-t pt-2">{exec.overallNotes}</p>}
            </div>
          )}
        </div>
      ))}

      {/* Create execution dialog */}
      <Dialog open={showCreateExec} onOpenChange={setShowCreateExec}>
        <DialogContent onClose={() => setShowCreateExec(false)} className="max-w-md">
          <form onSubmit={handleCreateExec}>
            <DialogHeader><DialogTitle>Tạo lệnh sản xuất</DialogTitle></DialogHeader>
            <div className="px-6 pb-2 space-y-3">
              <div>
                <Label>Báo giá đã chốt <span className="text-destructive">*</span></Label>
                <Select value={execForm.quoteId} onChange={(e) => setExecForm((f) => ({ ...f, quoteId: e.target.value }))} className="mt-1">
                  <option value="">-- Chọn báo giá --</option>
                  {acceptedQuotes.length > 0 && (
                    <optgroup label="✅ Đã chốt (accepted)">
                      {acceptedQuotes.map((q) => (
                        <option key={q.id} value={q.id}>
                          v{q.version} · {q.productName || q.quantityScenario || `Báo giá ${q.id.slice(0, 6)}`}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherQuotes.length > 0 && (
                    <optgroup label="Báo giá khác">
                      {otherQuotes.map((q) => (
                        <option key={q.id} value={q.id}>
                          v{q.version} · {q.productName || q.quantityScenario || `Báo giá ${q.id.slice(0, 6)}`} ({q.status})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {quotes.length === 0 && <option disabled>Chưa có báo giá nào</option>}
                </Select>
                {acceptedQuotes.length === 0 && quotes.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Chưa có báo giá nào được chốt (accepted). Bạn vẫn có thể tạo lệnh SX.</p>
                )}
              </div>
              <div>
                <Label>Mã lệnh sản xuất</Label>
                <Input value={execForm.productionOrderNumber} onChange={(e) => setExecForm((f) => ({ ...f, productionOrderNumber: e.target.value }))} placeholder="PO-2025-001" className="mt-1" />
              </div>
              <div>
                <Label>Ngày chốt đơn</Label>
                <Input type="date" value={execForm.orderConfirmedAt} onChange={(e) => setExecForm((f) => ({ ...f, orderConfirmedAt: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Ghi chú</Label>
                <Textarea value={execForm.overallNotes} onChange={(e) => setExecForm((f) => ({ ...f, overallNotes: e.target.value }))} rows={2} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreateExec(false)}>Hủy</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Đang tạo...' : 'Tạo'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add phase dialog */}
      <Dialog open={!!showAddPhase} onOpenChange={(open) => { if (!open) setShowAddPhase(null); }}>
        <DialogContent onClose={() => setShowAddPhase(null)} className="max-w-md">
          <form onSubmit={(e) => handleAddPhase(e, showAddPhase!)}>
            <DialogHeader><DialogTitle>Thêm công đoạn sản xuất</DialogTitle></DialogHeader>
            <div className="px-6 pb-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Loại công đoạn</Label>
                  <Select value={phaseForm.phaseType} onChange={(e) => setPhaseForm((f) => ({ ...f, phaseType: e.target.value, phaseName: PHASE_TYPE_LABEL[e.target.value] || '' }))} className="mt-1">
                    {Object.entries(PHASE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Thứ tự</Label>
                  <Input type="number" min={1} value={phaseForm.order} onChange={(e) => setPhaseForm((f) => ({ ...f, order: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Tên hiển thị</Label>
                <Input value={phaseForm.phaseName} onChange={(e) => setPhaseForm((f) => ({ ...f, phaseName: e.target.value }))} className="mt-1" placeholder="Tên công đoạn..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bắt đầu dự kiến</Label>
                  <Input type="date" value={phaseForm.plannedStartDate} onChange={(e) => setPhaseForm((f) => ({ ...f, plannedStartDate: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Kết thúc dự kiến</Label>
                  <Input type="date" value={phaseForm.plannedEndDate} onChange={(e) => setPhaseForm((f) => ({ ...f, plannedEndDate: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Ghi chú</Label>
                <Textarea value={phaseForm.notes} onChange={(e) => setPhaseForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAddPhase(null)}>Hủy</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Đang lưu...' : 'Thêm'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
