import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { api } from '../../lib/api';
import type { DocumentationWorkflowWithSteps, DocumentationStep } from '@rd/shared';

const DOC_TYPE_LABEL: Record<string, string> = {
  'loa-china': 'LOA (Ủy quyền TQ)', 'cfs-china': 'CFS (Lưu hành tự do TQ)',
  'product-declaration-vn': 'Công bố sản phẩm VN', 'iso-cert': 'Chứng nhận ISO',
  'halal-cert': 'Chứng nhận Halal', 'quality-cert': 'Chứng nhận chất lượng',
  'import-permit': 'Giấy phép nhập khẩu', 'customs-clearance': 'Thông quan', other: 'Khác',
};

const STEP_STATUS_LABEL: Record<string, string> = {
  'not-started': 'Chưa bắt đầu', preparing: 'Đang chuẩn bị', submitted: 'Đã nộp',
  'under-review': 'Đang xét duyệt', approved: 'Đã cấp', rejected: 'Bị từ chối', expired: 'Hết hạn',
};
const STEP_STATUS_COLOR: Record<string, string> = {
  'not-started': 'bg-gray-100 text-gray-600', preparing: 'bg-blue-100 text-blue-600',
  submitted: 'bg-indigo-100 text-indigo-700', 'under-review': 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', expired: 'bg-gray-200 text-gray-500',
};

// Default cost/time estimates per document type
const DOC_DEFAULTS: Record<string, { minDays: number; maxDays: number; cost: number; currency: string; country: string }> = {
  'loa-china': { minDays: 14, maxDays: 21, cost: 1700, currency: 'CNY', country: 'china' },
  'cfs-china': { minDays: 14, maxDays: 21, cost: 3000, currency: 'CNY', country: 'china' },
  'product-declaration-vn': { minDays: 25, maxDays: 35, cost: 3000000, currency: 'VND', country: 'vietnam' },
  'iso-cert': { minDays: 60, maxDays: 90, cost: 0, currency: 'USD', country: 'china' },
  'halal-cert': { minDays: 30, maxDays: 60, cost: 0, currency: 'USD', country: 'china' },
  'quality-cert': { minDays: 10, maxDays: 20, cost: 500, currency: 'CNY', country: 'china' },
  'import-permit': { minDays: 14, maxDays: 21, cost: 0, currency: 'VND', country: 'vietnam' },
  'customs-clearance': { minDays: 2, maxDays: 5, cost: 0, currency: 'VND', country: 'vietnam' },
  other: { minDays: 0, maxDays: 0, cost: 0, currency: 'CNY', country: 'china' },
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function StepCard({ step, onUpdate }: { step: DocumentationStep; onUpdate: (updated: DocumentationStep) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    actualStartDate: step.actualStartDate ?? '', actualEndDate: step.actualEndDate ?? '',
    documentNumber: step.documentNumber, status: step.status,
    issueDate: step.issueDate ?? '', expiryDate: step.expiryDate ?? '',
    actualCost: step.actualCost?.toString() ?? '', notes: step.notes,
    handlerName: step.handlerName, handlerContact: step.handlerContact,
  });
  const [saving, setSaving] = useState(false);

  const daysLeft = daysUntil(step.plannedEndDate);
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.engagements.documentation.steps.update(step.id, {
        actualStartDate: form.actualStartDate || null,
        actualEndDate: form.actualEndDate || null,
        documentNumber: form.documentNumber,
        status: form.status as DocumentationStep['status'],
        issueDate: form.issueDate || null,
        expiryDate: form.expiryDate || null,
        actualCost: form.actualCost ? parseFloat(form.actualCost) : null,
        notes: form.notes, handlerName: form.handlerName, handlerContact: form.handlerContact,
      });
      onUpdate(updated);
      setEditMode(false);
      toast.success('Đã cập nhật!');
    } catch { toast.error('Lỗi cập nhật'); }
    finally { setSaving(false); }
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${step.status === 'approved' ? 'border-green-200' : isUrgent ? 'border-amber-300' : ''}`}>
      <button className="w-full p-3 flex items-center justify-between text-left hover:bg-accent/30" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-sm font-medium">{DOC_TYPE_LABEL[step.documentType] || step.documentType}</span>
          {step.documentNumber && <span className="text-xs text-muted-foreground">· {step.documentNumber}</span>}
          {isUrgent && step.status !== 'approved' && <span className="text-xs text-amber-600 font-medium">⚠ {daysLeft}d</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{step.estimatedCost > 0 ? `${step.estimatedCost.toLocaleString()} ${step.estimatedCostCurrency}` : ''}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STEP_STATUS_COLOR[step.status] || 'bg-gray-100'}`}>
            {STEP_STATUS_LABEL[step.status] || step.status}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <div>Thời gian dự kiến: {step.estimatedMinDays}–{step.estimatedMaxDays} ngày</div>
            <div>Người phụ trách: {step.handlerName || '—'}</div>
            {step.plannedStartDate && <div>Dự kiến nộp: {step.plannedStartDate}</div>}
            {step.plannedEndDate && <div>Dự kiến nhận: {step.plannedEndDate}{daysLeft !== null && daysLeft >= 0 ? ` (còn ${daysLeft}d)` : daysLeft !== null ? ` (đã trễ ${Math.abs(daysLeft)}d)` : ''}</div>}
            {step.actualStartDate && <div>Đã nộp: {step.actualStartDate}</div>}
            {step.actualEndDate && <div>Đã nhận: {step.actualEndDate}</div>}
            {step.issueDate && <div>Ngày cấp: {step.issueDate}</div>}
            {step.expiryDate && <div>Hết hạn: {step.expiryDate}</div>}
            {step.actualCost != null && <div>Chi phí thực: {step.actualCost.toLocaleString()} {step.estimatedCostCurrency}</div>}
          </div>
          {step.notes && <p className="text-xs text-muted-foreground italic">{step.notes}</p>}

          {editMode ? (
            <div className="space-y-2 border-t pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Ngày nộp thực tế</Label>
                  <Input type="date" value={form.actualStartDate} onChange={(e) => setForm((f) => ({ ...f, actualStartDate: e.target.value }))} className="mt-0.5 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Ngày nhận thực tế</Label>
                  <Input type="date" value={form.actualEndDate} onChange={(e) => setForm((f) => ({ ...f, actualEndDate: e.target.value }))} className="mt-0.5 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Số giấy tờ</Label>
                  <Input value={form.documentNumber} onChange={(e) => setForm((f) => ({ ...f, documentNumber: e.target.value }))} className="mt-0.5 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Trạng thái</Label>
                  <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof f.status }))} className="mt-0.5 h-7 text-xs">
                    {Object.entries(STEP_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Ngày cấp</Label>
                  <Input type="date" value={form.issueDate} onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))} className="mt-0.5 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Hết hạn</Label>
                  <Input type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} className="mt-0.5 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Chi phí thực tế</Label>
                  <Input type="number" value={form.actualCost} onChange={(e) => setForm((f) => ({ ...f, actualCost: e.target.value }))} className="mt-0.5 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Người phụ trách</Label>
                  <Input value={form.handlerName} onChange={(e) => setForm((f) => ({ ...f, handlerName: e.target.value }))} className="mt-0.5 h-7 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Ghi chú</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-0.5 text-xs" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>{saving ? 'Lưu...' : 'Lưu'}</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditMode(false)}>Hủy</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditMode(true)}>Cập nhật</Button>
          )}
        </div>
      )}
    </div>
  );
}

export function DocumentationTab({ engagementId }: { engagementId: string }) {
  const [workflow, setWorkflow] = useState<DocumentationWorkflowWithSteps | null>(null);
  const [showAddStep, setShowAddStep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepForm, setStepForm] = useState({
    documentType: 'loa-china', plannedStartDate: '', plannedEndDate: '',
    handlerName: '', handlerContact: '', notes: '', order: '1',
  });

  useEffect(() => {
    api.engagements.documentation.get(engagementId)
      .then((wf) => setWorkflow(wf))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [engagementId]);

  const ensureWorkflow = async (): Promise<DocumentationWorkflowWithSteps> => {
    if (workflow) return workflow;
    const wf = await api.engagements.documentation.create(engagementId);
    setWorkflow(wf);
    return wf;
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepLoading(true);
    try {
      const wf = await ensureWorkflow();
      const defaults = DOC_DEFAULTS[stepForm.documentType] || DOC_DEFAULTS.other;
      const step = await api.engagements.documentation.steps.create(wf.id, {
        documentType: stepForm.documentType,
        issuingCountry: defaults.country,
        estimatedMinDays: defaults.minDays, estimatedMaxDays: defaults.maxDays,
        estimatedCost: defaults.cost, estimatedCostCurrency: defaults.currency,
        plannedStartDate: stepForm.plannedStartDate || undefined,
        plannedEndDate: stepForm.plannedEndDate || undefined,
        handlerName: stepForm.handlerName, handlerContact: stepForm.handlerContact,
        notes: stepForm.notes, order: parseInt(stepForm.order) || 1,
      });
      setWorkflow((prev) => prev ? { ...prev, steps: [...prev.steps, step] } : prev);
      setShowAddStep(false);
      setStepForm({ documentType: 'loa-china', plannedStartDate: '', plannedEndDate: '', handlerName: '', handlerContact: '', notes: '', order: '1' });
      toast.success('Đã thêm giấy tờ!');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setStepLoading(false); }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Xóa giấy tờ này?')) return;
    await api.engagements.documentation.steps.delete(stepId);
    setWorkflow((prev) => prev ? { ...prev, steps: prev.steps.filter((s) => s.id !== stepId) } : prev);
    toast.success('Đã xóa');
  };

  if (loading) return <div className="text-center py-10 text-muted-foreground text-sm">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAddStep(true)} className="gap-1.5"><Plus className="h-4 w-4" />Thêm giấy tờ</Button>
      </div>

      {(!workflow || workflow.steps.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Chưa có giấy tờ nào</p>
          <p className="text-xs mt-1">Thêm LOA, CFS, công bố sản phẩm... để theo dõi tiến độ thủ tục</p>
        </div>
      )}

      {workflow && workflow.steps.length > 0 && (
        <div className="space-y-2">
          {workflow.steps.map((step) => (
            <div key={step.id} className="relative">
              <StepCard step={step} onUpdate={(updated) => setWorkflow((prev) => prev ? { ...prev, steps: prev.steps.map((s) => s.id === updated.id ? updated : s) } : prev)} />
              <button onClick={() => handleDeleteStep(step.id)} className="absolute top-3 right-2 text-muted-foreground hover:text-destructive text-xs opacity-50 hover:opacity-100">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Standard costs reference */}
      {workflow && workflow.steps.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-0.5">
          <p className="font-medium text-foreground/60 mb-1">Chi phí tham khảo:</p>
          <p>• LOA TQ: ~1.500–2.000 tệ, 14–21 ngày</p>
          <p>• CFS TQ: ~2.500–3.500 tệ, 14–21 ngày</p>
          <p>• Công bố VN: ~2.5–3.5 triệu VND, 25–35 ngày</p>
        </div>
      )}

      <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
        <DialogContent onClose={() => setShowAddStep(false)} className="max-w-md">
          <form onSubmit={handleAddStep}>
            <DialogHeader><DialogTitle>Thêm giấy tờ cần xử lý</DialogTitle></DialogHeader>
            <div className="px-6 pb-2 space-y-3">
              <div>
                <Label>Loại giấy tờ</Label>
                <Select value={stepForm.documentType} onChange={(e) => setStepForm((f) => ({ ...f, documentType: e.target.value }))} className="mt-1">
                  {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
                {DOC_DEFAULTS[stepForm.documentType] && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Mặc định: {DOC_DEFAULTS[stepForm.documentType].minDays}–{DOC_DEFAULTS[stepForm.documentType].maxDays} ngày,
                    {DOC_DEFAULTS[stepForm.documentType].cost > 0 ? ` ~${DOC_DEFAULTS[stepForm.documentType].cost.toLocaleString()} ${DOC_DEFAULTS[stepForm.documentType].currency}` : ' chưa có chi phí tham khảo'}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Dự kiến nộp</Label>
                  <Input type="date" value={stepForm.plannedStartDate} onChange={(e) => setStepForm((f) => ({ ...f, plannedStartDate: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Dự kiến nhận</Label>
                  <Input type="date" value={stepForm.plannedEndDate} onChange={(e) => setStepForm((f) => ({ ...f, plannedEndDate: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Người phụ trách</Label>
                  <Input value={stepForm.handlerName} onChange={(e) => setStepForm((f) => ({ ...f, handlerName: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Thứ tự hiển thị</Label>
                  <Input type="number" min={1} value={stepForm.order} onChange={(e) => setStepForm((f) => ({ ...f, order: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Ghi chú</Label>
                <Textarea value={stepForm.notes} onChange={(e) => setStepForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAddStep(false)}>Hủy</Button>
              <Button type="submit" disabled={stepLoading}>{stepLoading ? 'Đang thêm...' : 'Thêm'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
