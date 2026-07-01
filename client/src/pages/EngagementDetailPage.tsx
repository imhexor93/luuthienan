import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Plus, FileText, Package, MessageSquare, BarChart3, Trash2, ChevronDown, ChevronRight, Factory, FileCheck, Truck, UserCheck, Clock, Target, CheckCircle2, XCircle, PauseCircle, AlertCircle, Paperclip, ImageIcon, Download, X as XIcon, Upload, Link as LinkIcon, ExternalLink, FlaskConical, Pencil } from 'lucide-react';
import { ProductionTab } from '../components/factory/ProductionTab';
import { DocumentationTab } from '../components/factory/DocumentationTab';
import { ShippingTab } from '../components/factory/ShippingTab';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type {
  FactoryEngagementWithFactory,
  QuoteRequest,
  Quote,
  QuoteProductLine,
  NegotiationLog,
  NegotiationAttachment,
  NegotiationType,
  Sample,
  SampleFormula,
  FormulaIngredient,
  SampleAttachment,
  SampleLink,
  FactoryCommunication,
  CommunicationChannel,
  CommunicationDirection,
  User,
} from '@rd/shared';

const SCOPE_LABEL: Record<string, string> = {
  formula: 'Công thức', packaging: 'Bao bì', filling: 'Đóng gói', labeling: 'Nhãn mác',
  'full-production': 'Toàn bộ sản xuất', testing: 'Kiểm nghiệm', other: 'Khác',
};
const ENG_STATUS_LABEL: Record<string, string> = {
  sampling: 'Lấy mẫu', quoting: 'Báo giá', negotiating: 'Đàm phán',
  sourcing: 'Test mẫu', approved: 'Đã chốt', 'in-production': 'Đang sản xuất',
  completed: 'Hoàn thành', cancelled: 'Đã hủy',
};
const ENG_STATUS_COLOR: Record<string, string> = {
  sampling: 'bg-gray-100 text-gray-600', quoting: 'bg-blue-100 text-blue-700',
  negotiating: 'bg-amber-100 text-amber-700', sourcing: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700', 'in-production': 'bg-teal-100 text-teal-700',
  completed: 'bg-green-200 text-green-800', cancelled: 'bg-red-100 text-red-700',
};
const RFQ_STATUS_LABEL: Record<string, string> = {
  sent: 'Đã gửi', received: 'Đã nhận', clarifying: 'Đang làm rõ', expired: 'Hết hạn', cancelled: 'Đã hủy',
};
const QUOTE_STATUS_LABEL: Record<string, string> = {
  'pending-review': 'Chờ xem xét', accepted: 'Chấp nhận', rejected: 'Từ chối', countering: 'Đang mặc cả',
};
const EVAL_STATUS_LABEL: Record<string, string> = {
  'pending-evaluation': 'Chờ đánh giá', evaluating: 'Đang đánh giá',
  approved: 'Đạt', 'approved-with-changes': 'Đạt (có chỉnh sửa)',
  rejected: 'Không đạt', reworking: 'Đang làm lại',
};
const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email', 'phone-call': 'Điện thoại', zalo: 'Zalo',
  wechat: 'WeChat', 'wechat-video': 'WeChat Video', 'in-person-visit': 'Gặp trực tiếp', other: 'Khác',
};

// ---- Packaging component item type (stored as JSON in packagingComponents) ----
type PackagingItem = { name: string; unitCost: string; qty: string; };

function parsePackagingItems(raw: string): PackagingItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* not JSON — legacy text */ }
  return [];
}

function packagingTotal(items: PackagingItem[]): number {
  return items.reduce((s, i) => s + (parseFloat(i.unitCost) || 0) * (parseFloat(i.qty) || 1), 0);
}

// ---- Quote product line table (read-only display) ----
function QuoteProductTable({ lines, currency }: { lines: QuoteProductLine[]; currency: string }) {
  const [expandedRows, setExpandedRows] = React.useState<Set<number>>(new Set());
  if (!lines || lines.length === 0) return <p className="text-xs text-muted-foreground italic">Chưa có dòng sản phẩm</p>;

  const toggle = (stt: number) => setExpandedRows(prev => {
    const next = new Set(prev);
    next.has(stt) ? next.delete(stt) : next.add(stt);
    return next;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[860px]">
        <thead>
          <tr className="bg-muted text-muted-foreground">
            <th className="border px-2 py-1.5 text-center w-8">STT</th>
            <th className="border px-2 py-1.5 text-left">Tên sản phẩm</th>
            <th className="border px-2 py-1.5 text-center w-20">Quy cách</th>
            <th className="border px-2 py-1.5 text-right w-20">SL SX</th>
            <th className="border px-2 py-1.5 text-right w-24">Giá NL /kg</th>
            <th className="border px-2 py-1.5 text-right w-24">Giá NL /pcs</th>
            <th className="border px-2 py-1.5 text-right w-20">Phí GC</th>
            <th className="border px-2 py-1.5 text-right w-24">Bao bì ODM</th>
            <th className="border px-2 py-1.5 text-right w-28 font-semibold">GT (RMB)</th>
            <th className="border px-2 py-1.5 text-right w-24">GT (USD)</th>
            <th className="border px-2 py-1.5 text-right w-20">MOQ</th>
            <th className="border px-2 py-1.5 text-left min-w-[120px]">Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const items = parsePackagingItems(line.packagingComponents);
            const hasItems = items.length > 0;
            const isExpanded = expandedRows.has(line.stt);
            return (
              <React.Fragment key={line.stt}>
                <tr className="hover:bg-accent/30">
                  <td className="border px-2 py-1.5 text-center">{line.stt}</td>
                  <td className="border px-2 py-1.5 font-medium">{line.productName}</td>
                  <td className="border px-2 py-1.5 text-center">{line.specs}</td>
                  <td className="border px-2 py-1.5 text-right">{line.productionQty?.toLocaleString()}</td>
                  <td className="border px-2 py-1.5 text-right">{line.contentPriceKg != null ? line.contentPriceKg.toLocaleString() : '—'}</td>
                  <td className="border px-2 py-1.5 text-right">{line.contentPricePcs?.toLocaleString()}</td>
                  <td className="border px-2 py-1.5 text-right">{line.processingFee?.toLocaleString()}</td>
                  <td className="border px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>{line.packagingODM?.toLocaleString()}</span>
                      {hasItems && (
                        <button onClick={() => toggle(line.stt)} className="text-blue-500 hover:text-blue-700 ml-1">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="border px-2 py-1.5 text-right font-semibold text-red-700">{line.totalRMB?.toLocaleString()}</td>
                  <td className="border px-2 py-1.5 text-right">{line.totalUSD != null ? `$${line.totalUSD.toFixed(3)}` : '—'}</td>
                  <td className="border px-2 py-1.5 text-right">{line.moq?.toLocaleString()}</td>
                  <td className="border px-2 py-1.5 text-xs text-muted-foreground italic">{line.notes || ''}</td>
                </tr>
                {hasItems && isExpanded && (
                  <tr>
                    <td colSpan={12} className="border bg-blue-50/50 px-4 py-2">
                      <p className="text-[11px] font-medium text-blue-700 mb-1.5">Chi tiết bao bì ODM:</p>
                      <table className="text-[11px] w-auto">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left pr-6 pb-1 font-medium">Thành phần</th>
                            <th className="text-right pr-4 pb-1 font-medium">Đơn giá</th>
                            <th className="text-right pr-4 pb-1 font-medium">SL</th>
                            <th className="text-right pb-1 font-medium">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => {
                            const subtotal = (parseFloat(item.unitCost) || 0) * (parseFloat(item.qty) || 1);
                            return (
                              <tr key={i} className="border-t border-blue-100">
                                <td className="pr-6 py-0.5">{item.name}</td>
                                <td className="text-right pr-4 py-0.5">{parseFloat(item.unitCost).toLocaleString()}</td>
                                <td className="text-right pr-4 py-0.5">{item.qty}</td>
                                <td className="text-right py-0.5 font-medium">{subtotal.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                              </tr>
                            );
                          })}
                          <tr className="border-t-2 border-blue-300">
                            <td colSpan={3} className="text-right pr-4 pt-1 font-semibold text-blue-700">Tổng bao bì:</td>
                            <td className="text-right pt-1 font-semibold text-blue-700">
                              {packagingTotal(items).toLocaleString(undefined, { maximumFractionDigits: 3 })} {currency}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Quote form: product line row editor ----
type ProductLineForm = {
  stt: number;
  productName: string;
  specs: string;
  productionQty: string;
  contentPriceKg: string;
  contentPricePcs: string;
  processingFee: string;
  packagingODM: string;      // manual entry when no items
  // packaging builder
  packagingItems: PackagingItem[];
  packagingExpanded: boolean;
  moq: string;
  notes: string;
};

function emptyLine(stt: number): ProductLineForm {
  return {
    stt, productName: '', specs: '', productionQty: '',
    contentPriceKg: '', contentPricePcs: '', processingFee: '',
    packagingODM: '',
    packagingItems: [], packagingExpanded: false,
    moq: '', notes: '',
  };
}

// Tính GT (RMB) tự động từ các thành phần
function resolvePackagingODM(line: ProductLineForm): number {
  // If detail items exist, calculate from them; otherwise use the manually entered value
  if (line.packagingItems.length > 0) return packagingTotal(line.packagingItems);
  return parseFloat(line.packagingODM) || 0;
}

function calcTotalRMB(line: ProductLineForm): number {
  const nl = parseFloat(line.contentPricePcs) || 0;
  const gc = parseFloat(line.processingFee) || 0;
  const bb = resolvePackagingODM(line);
  return nl + gc + bb;
}

function parseLines(lines: ProductLineForm[], exchangeRate: string): QuoteProductLine[] {
  const rate = parseFloat(exchangeRate) || 0;
  return lines.map((l) => {
    const pkgODM = resolvePackagingODM(l);
    const totalRMB = calcTotalRMB(l);
    return {
      stt: l.stt,
      productName: l.productName,
      specs: l.specs,
      productionQty: parseFloat(l.productionQty) || 0,
      contentPriceKg: l.contentPriceKg !== '' ? parseFloat(l.contentPriceKg) : null,
      contentPricePcs: parseFloat(l.contentPricePcs) || 0,
      processingFee: parseFloat(l.processingFee) || 0,
      packagingODM: pkgODM,
      totalRMB,
      totalUSD: rate > 0 ? Math.round((totalRMB / rate) * 10000) / 10000 : null,
      packagingComponents: l.packagingItems.length > 0 ? JSON.stringify(l.packagingItems) : '',
      moq: parseFloat(l.moq) || 0,
      notes: l.notes || '',
    };
  });
}

// ---- RFQ Tab ----
function RFQTab({ engagementId }: { engagementId: string }) {
  const [rfqs, setRfqs] = useState<QuoteRequest[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [quotesMap, setQuotesMap] = useState<Record<string, Quote[]>>({});
  const [showRFQForm, setShowRFQForm] = useState(false);
  const [rfqForm, setRfqForm] = useState({ requestedBy: '', specifications: '', quantityRange: '', deadlineForResponse: '', notes: '' });
  const [rfqLoading, setRfqLoading] = useState(false);

  // Quote dialog state
  const [quoteDialogRfqId, setQuoteDialogRfqId] = useState<string | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    pricingTerms: 'EXW', currency: 'CNY', leadTimeDays: '', paymentTerms: '', validUntil: '', internalNotes: '',
    exchangeRate: '', // tỷ giá CNY→USD, để trống = không tự tính USD
  });
  const [productLines, setProductLines] = useState<ProductLineForm[]>([emptyLine(1)]);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    api.engagements.rfqs.list(engagementId).then(setRfqs).catch(() => {});
  }, [engagementId]);

  const loadQuotes = useCallback(async (rfqId: string) => {
    const quotes = await api.engagements.rfqs.quotes.list(rfqId);
    setQuotesMap((prev) => ({ ...prev, [rfqId]: quotes }));
  }, []);

  const handleExpand = (rfqId: string) => {
    const next = expanded === rfqId ? null : rfqId;
    setExpanded(next);
    if (next) loadQuotes(next);
  };

  const handleCreateRFQ = async (e: React.FormEvent) => {
    e.preventDefault();
    setRfqLoading(true);
    try {
      const rfq = await api.engagements.rfqs.create(engagementId, rfqForm);
      setRfqs((prev) => [rfq, ...prev]);
      setShowRFQForm(false);
      setRfqForm({ requestedBy: '', specifications: '', quantityRange: '', deadlineForResponse: '', notes: '' });
      toast.success('Đã tạo RFQ!');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setRfqLoading(false); }
  };

  const openQuoteDialog = (rfqId: string) => {
    setQuoteDialogRfqId(rfqId);
    setEditingQuoteId(null);
    setQuoteForm({ pricingTerms: 'EXW', currency: 'CNY', leadTimeDays: '', paymentTerms: '', validUntil: '', internalNotes: '', exchangeRate: '' });
    setProductLines([emptyLine(1)]);
  };

  const openEditQuoteDialog = (rfqId: string, q: Quote) => {
    setQuoteDialogRfqId(rfqId);
    setEditingQuoteId(q.id);
    setQuoteForm({
      pricingTerms: q.pricingTerms || 'EXW',
      currency: q.currency || 'CNY',
      leadTimeDays: q.leadTimeDays ? String(q.leadTimeDays) : '',
      paymentTerms: q.paymentTerms || '',
      validUntil: q.validUntil || '',
      internalNotes: q.internalNotes || '',
      exchangeRate: '',
    });
    setProductLines(
      (q.productLines || []).map((l, i) => {
        const restoredItems = parsePackagingItems(l.packagingComponents || '');
        return {
          stt: l.stt ?? i + 1,
          productName: l.productName || '',
          specs: l.specs || '',
          productionQty: String(l.productionQty ?? ''),
          contentPriceKg: l.contentPriceKg != null ? String(l.contentPriceKg) : '',
          contentPricePcs: String(l.contentPricePcs ?? ''),
          processingFee: String(l.processingFee ?? ''),
          packagingODM: String(l.packagingODM ?? ''),
          moq: String(l.moq ?? ''),
          notes: l.notes || '',
          packagingItems: restoredItems,
          packagingExpanded: false,
        };
      })
    );
  };

  const addLine = () => setProductLines((prev) => [...prev, emptyLine(prev.length + 1)]);
  const removeLine = (idx: number) => setProductLines((prev) => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, stt: i + 1 })));
  const updateLine = (idx: number, field: keyof ProductLineForm, value: string) =>
    setProductLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  // Packaging items helpers
  const togglePackaging = (idx: number) =>
    setProductLines((prev) => prev.map((l, i) => i === idx ? { ...l, packagingExpanded: !l.packagingExpanded } : l));
  const addPackagingItem = (lineIdx: number) =>
    setProductLines((prev) => prev.map((l, i) => i === lineIdx
      ? { ...l, packagingItems: [...l.packagingItems, { name: '', unitCost: '', qty: '1' }], packagingExpanded: true }
      : l));
  const updatePackagingItem = (lineIdx: number, itemIdx: number, field: keyof PackagingItem, value: string) =>
    setProductLines((prev) => prev.map((l, i) => i === lineIdx
      ? { ...l, packagingItems: l.packagingItems.map((it, j) => j === itemIdx ? { ...it, [field]: value } : it) }
      : l));
  const removePackagingItem = (lineIdx: number, itemIdx: number) =>
    setProductLines((prev) => prev.map((l, i) => i === lineIdx
      ? { ...l, packagingItems: l.packagingItems.filter((_, j) => j !== itemIdx) }
      : l));

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteDialogRfqId) return;
    setQuoteLoading(true);
    try {
      const payload = {
        pricingTerms: quoteForm.pricingTerms,
        currency: quoteForm.currency as 'VND' | 'USD' | 'CNY',
        leadTimeDays: quoteForm.leadTimeDays ? parseInt(quoteForm.leadTimeDays) : undefined,
        paymentTerms: quoteForm.paymentTerms,
        validUntil: quoteForm.validUntil || undefined,
        internalNotes: quoteForm.internalNotes,
        productLines: parseLines(productLines, quoteForm.exchangeRate),
      };
      if (editingQuoteId) {
        const updated = await api.engagements.rfqs.quotes.update(editingQuoteId, payload);
        if (updated) {
          setQuotesMap((prev) => ({
            ...prev,
            [quoteDialogRfqId]: (prev[quoteDialogRfqId] || []).map((q) => q.id === editingQuoteId ? updated : q),
          }));
        }
        toast.success('Đã cập nhật báo giá!');
      } else {
        const existingQuotes = quotesMap[quoteDialogRfqId] || [];
        const version = existingQuotes.length > 0 ? Math.max(...existingQuotes.map((q) => q.version)) + 1 : 1;
        const quote = await api.engagements.rfqs.quotes.create(quoteDialogRfqId, {
          ...payload,
          version,
          status: 'pending-review',
        });
        setQuotesMap((prev) => ({ ...prev, [quoteDialogRfqId]: [quote, ...(prev[quoteDialogRfqId] || [])] }));
        toast.success('Đã thêm báo giá!');
      }
      setQuoteDialogRfqId(null);
      setEditingQuoteId(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setQuoteLoading(false); }
  };

  const updateQuoteStatus = (rfqId: string, quoteId: string, status: Quote['status']) => {
    api.engagements.rfqs.quotes.update(quoteId, { status }).then((updated) => {
      if (updated) setQuotesMap((prev) => ({ ...prev, [rfqId]: (prev[rfqId] || []).map((x) => x.id === quoteId ? updated : x) }));
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowRFQForm(true)} className="gap-1.5"><Plus className="h-4 w-4" />Tạo RFQ</Button>
      </div>

      {rfqs.length === 0 && <p className="text-center py-10 text-muted-foreground">Chưa có yêu cầu báo giá nào</p>}
      {rfqs.map((rfq) => (
        <div key={rfq.id} className="border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50"
            onClick={() => handleExpand(rfq.id)}
          >
            <div className="flex items-center gap-3">
              {expanded === rfq.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className="font-mono font-semibold text-sm">{rfq.requestNumber}</span>
              <span className="text-sm text-muted-foreground">{rfq.requestedAt?.slice(0, 10)}</span>
              {rfq.requestedBy && <span className="text-sm text-muted-foreground">· {rfq.requestedBy}</span>}
              {rfq.quantityRange && <span className="text-xs text-muted-foreground">· SL: {rfq.quantityRange}</span>}
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rfq.status === 'received' ? 'bg-green-100 text-green-700' : rfq.status === 'expired' ? 'bg-red-100 text-red-600' : rfq.status === 'cancelled' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'}`}>
              {RFQ_STATUS_LABEL[rfq.status] || rfq.status}
            </span>
          </button>

          {expanded === rfq.id && (
            <div className="border-t bg-muted/20">
              {/* RFQ details */}
              {(rfq.specifications || rfq.notes || rfq.deadlineForResponse) && (
                <div className="px-4 pt-3 pb-2 space-y-1 border-b">
                  {rfq.specifications && <p className="text-sm"><span className="text-muted-foreground text-xs">Thông số: </span>{rfq.specifications}</p>}
                  {rfq.deadlineForResponse && <p className="text-sm"><span className="text-muted-foreground text-xs">Hạn phản hồi: </span>{rfq.deadlineForResponse}</p>}
                  {rfq.notes && <p className="text-xs text-muted-foreground italic">{rfq.notes}</p>}
                </div>
              )}

              {/* Quotes */}
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Báo giá ({quotesMap[rfq.id]?.length ?? '…'})
                  </p>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openQuoteDialog(rfq.id)}>
                    <Plus className="h-3 w-3" />Nhập báo giá
                  </Button>
                </div>

                {(quotesMap[rfq.id] || []).length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Chưa có báo giá nào</p>
                )}

                {(quotesMap[rfq.id] || []).map((q) => (
                  <div key={q.id} className="border rounded-lg bg-background overflow-hidden">
                    {/* Quote header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">Báo giá v{q.version}</span>
                        <span className="text-xs text-muted-foreground">{q.receivedAt?.slice(0, 10)}</span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{q.pricingTerms || 'EXW'}</span>
                        <span className="text-xs text-muted-foreground">{q.currency}</span>
                        {q.leadTimeDays && <span className="text-xs text-muted-foreground">· {q.leadTimeDays} ngày</span>}
                        {q.validUntil && <span className="text-xs text-muted-foreground">· HSD: {q.validUntil}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${q.status === 'accepted' ? 'bg-green-100 text-green-700' : q.status === 'rejected' ? 'bg-red-100 text-red-700' : q.status === 'countering' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                          {QUOTE_STATUS_LABEL[q.status] || q.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditQuoteDialog(rfq.id, q)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Chỉnh sửa báo giá"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Product lines table */}
                    <div className="p-3">
                      <QuoteProductTable lines={q.productLines} currency={q.currency} />
                    </div>

                    {/* Standard notes */}
                    <div className="px-4 pb-3 text-[11px] text-muted-foreground space-y-0.5 border-t pt-2">
                      <p>• Giá {q.pricingTerms || 'EXW'} – chưa bao gồm chi phí vận chuyển và xuất nhập khẩu.</p>
                      <p>• Tỷ giá RMB/USD tính theo tỷ giá ngân hàng tại ngày thanh toán thực tế.</p>
                      <p>• Dung sai số lượng giao hàng: ±5%.</p>
                      <p>• Giá trên dựa theo quy trình sản xuất tiêu chuẩn, có hiệu lực trong 60 ngày.</p>
                      {q.paymentTerms && <p>• Thanh toán: {q.paymentTerms}</p>}
                      {q.internalNotes && <p className="text-amber-700 italic mt-1">Ghi chú nội bộ: {q.internalNotes}</p>}
                    </div>

                    {/* Status buttons */}
                    <div className="flex gap-1.5 px-4 pb-3">
                      {(['pending-review', 'countering', 'accepted', 'rejected'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateQuoteStatus(rfq.id, q.id, s)}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${q.status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent border-border'}`}
                        >{QUOTE_STATUS_LABEL[s]}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Create RFQ dialog */}
      <Dialog open={showRFQForm} onOpenChange={setShowRFQForm}>
        <DialogContent onClose={() => setShowRFQForm(false)} className="max-w-md">
          <form onSubmit={handleCreateRFQ}>
            <DialogHeader><DialogTitle>Tạo yêu cầu báo giá (RFQ)</DialogTitle></DialogHeader>
            <div className="px-6 pb-2 space-y-3">
              <div>
                <Label>Người yêu cầu</Label>
                <Input value={rfqForm.requestedBy} onChange={(e) => setRfqForm((f) => ({ ...f, requestedBy: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Thông số kỹ thuật / Mô tả yêu cầu</Label>
                <Textarea value={rfqForm.specifications} onChange={(e) => setRfqForm((f) => ({ ...f, specifications: e.target.value }))} rows={3} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Số lượng mong muốn</Label>
                  <Input value={rfqForm.quantityRange} onChange={(e) => setRfqForm((f) => ({ ...f, quantityRange: e.target.value }))} placeholder="VD: 5000–10000" className="mt-1" />
                </div>
                <div>
                  <Label>Hạn phản hồi</Label>
                  <Input type="date" value={rfqForm.deadlineForResponse} onChange={(e) => setRfqForm((f) => ({ ...f, deadlineForResponse: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Ghi chú</Label>
                <Textarea value={rfqForm.notes} onChange={(e) => setRfqForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowRFQForm(false)}>Hủy</Button>
              <Button type="submit" disabled={rfqLoading}>{rfqLoading ? 'Đang tạo...' : 'Tạo RFQ'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create quote dialog */}
      <Dialog open={!!quoteDialogRfqId} onOpenChange={(open) => { if (!open) { setQuoteDialogRfqId(null); setEditingQuoteId(null); } }}>
        <DialogContent onClose={() => { setQuoteDialogRfqId(null); setEditingQuoteId(null); }} className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateQuote}>
            <DialogHeader><DialogTitle>{editingQuoteId ? 'Chỉnh sửa báo giá' : 'Nhập báo giá từ nhà máy'}</DialogTitle></DialogHeader>
            <div className="px-6 pb-2 space-y-5">
              {/* Quote header fields */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Điều kiện giá</Label>
                  <Select value={quoteForm.pricingTerms} onChange={(e) => setQuoteForm((f) => ({ ...f, pricingTerms: e.target.value }))} className="mt-1">
                    <option value="EXW">EXW</option>
                    <option value="FOB">FOB</option>
                    <option value="CIF">CIF</option>
                    <option value="CFR">CFR</option>
                  </Select>
                </div>
                <div>
                  <Label>Đơn vị tiền tệ</Label>
                  <Select value={quoteForm.currency} onChange={(e) => setQuoteForm((f) => ({ ...f, currency: e.target.value }))} className="mt-1">
                    <option value="CNY">CNY (RMB)</option>
                    <option value="USD">USD</option>
                    <option value="VND">VND</option>
                  </Select>
                </div>
                <div>
                  <Label>
                    Tỷ giá {quoteForm.currency !== 'USD' ? `${quoteForm.currency}/USD` : ''}
                    <span className="ml-1 text-[11px] text-muted-foreground font-normal">(để trống = không tính USD)</span>
                  </Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={quoteForm.exchangeRate}
                    onChange={(e) => setQuoteForm((f) => ({ ...f, exchangeRate: e.target.value }))}
                    className="mt-1"
                    placeholder={quoteForm.currency === 'CNY' ? 'VD: 7.25' : quoteForm.currency === 'VND' ? 'VD: 25400' : '1'}
                  />
                </div>
                <div>
                  <Label>Lead time (ngày)</Label>
                  <Input type="number" min={0} value={quoteForm.leadTimeDays} onChange={(e) => setQuoteForm((f) => ({ ...f, leadTimeDays: e.target.value }))} className="mt-1" placeholder="VD: 45" />
                </div>
                <div>
                  <Label>Điều khoản thanh toán</Label>
                  <Input value={quoteForm.paymentTerms} onChange={(e) => setQuoteForm((f) => ({ ...f, paymentTerms: e.target.value }))} className="mt-1" placeholder="VD: 30% TT trước, 70% trước giao" />
                </div>
                <div>
                  <Label>Hiệu lực đến</Label>
                  <Input type="date" value={quoteForm.validUntil} onChange={(e) => setQuoteForm((f) => ({ ...f, validUntil: e.target.value }))} className="mt-1" />
                </div>
                <div className="col-span-3">
                  <Label>Ghi chú nội bộ</Label>
                  <Input value={quoteForm.internalNotes} onChange={(e) => setQuoteForm((f) => ({ ...f, internalNotes: e.target.value }))} className="mt-1" placeholder="Chỉ hiển thị nội bộ" />
                </div>
              </div>

              {/* Product lines table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Danh sách sản phẩm báo giá</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addLine} className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" />Thêm dòng SP
                  </Button>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-muted">
                      <tr>
                        <th className="border-b border-r px-2 py-2 text-center w-8">STT</th>
                        <th className="border-b border-r px-2 py-2 text-left min-w-[130px]">Tên sản phẩm</th>
                        <th className="border-b border-r px-2 py-2 text-center w-20">Quy cách</th>
                        <th className="border-b border-r px-2 py-2 text-right w-22">SL SX</th>
                        <th className="border-b border-r px-2 py-2 text-right w-24">Giá NL /kg</th>
                        <th className="border-b border-r px-2 py-2 text-right w-24">Giá NL /pcs</th>
                        <th className="border-b border-r px-2 py-2 text-right w-22">Phí GC</th>
                        <th className="border-b border-r px-2 py-2 text-right w-28">Bao bì ODM</th>
                        <th className="border-b border-r px-2 py-2 text-right w-28 font-semibold bg-amber-50">GT ({quoteForm.currency}) ↓auto</th>
                        <th className="border-b border-r px-2 py-2 text-right w-24 bg-amber-50">GT (USD) ↓auto</th>
                        <th className="border-b border-r px-2 py-2 text-right w-22">MOQ</th>
                        <th className="border-b border-r px-2 py-2 text-left min-w-[140px]">Ghi chú</th>
                        <th className="border-b px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productLines.map((line, idx) => {
                        const pkgTotal = resolvePackagingODM(line);
                        return (
                          <React.Fragment key={idx}>
                            {/* Main product row */}
                            <tr className="border-b">
                              <td className="border-r px-2 py-1 text-center text-muted-foreground">{line.stt}</td>
                              <td className="border-r px-1 py-0.5">
                                <input className="w-full px-1 py-0.5 text-xs bg-transparent outline-none focus:bg-accent/50 rounded" value={line.productName} onChange={(e) => updateLine(idx, 'productName', e.target.value)} placeholder="Tên sản phẩm" />
                              </td>
                              <td className="border-r px-1 py-0.5">
                                <input className="w-full px-1 py-0.5 text-xs bg-transparent outline-none focus:bg-accent/50 rounded" value={line.specs} onChange={(e) => updateLine(idx, 'specs', e.target.value)} placeholder="50g" />
                              </td>
                              <td className="border-r px-1 py-0.5">
                                <input type="number" min={0} className="w-full px-1 py-0.5 text-xs bg-transparent outline-none focus:bg-accent/50 rounded text-right" value={line.productionQty} onChange={(e) => updateLine(idx, 'productionQty', e.target.value)} placeholder="0" />
                              </td>
                              <td className="border-r px-1 py-0.5">
                                <input type="number" min={0} step="0.001" className="w-full px-1 py-0.5 text-xs bg-transparent outline-none focus:bg-accent/50 rounded text-right" value={line.contentPriceKg} onChange={(e) => updateLine(idx, 'contentPriceKg', e.target.value)} placeholder="—" />
                              </td>
                              <td className="border-r px-1 py-0.5">
                                <input type="number" min={0} step="0.001" className="w-full px-1 py-0.5 text-xs bg-transparent outline-none focus:bg-accent/50 rounded text-right" value={line.contentPricePcs} onChange={(e) => updateLine(idx, 'contentPricePcs', e.target.value)} placeholder="0" />
                              </td>
                              <td className="border-r px-1 py-0.5">
                                <input type="number" min={0} step="0.001" className="w-full px-1 py-0.5 text-xs bg-transparent outline-none focus:bg-accent/50 rounded text-right" value={line.processingFee} onChange={(e) => updateLine(idx, 'processingFee', e.target.value)} placeholder="0" />
                              </td>
                              {/* BB ODM: nếu có items → tổng tự tính (read-only); nếu không → input trực tiếp */}
                              <td className="border-r px-1 py-0.5">
                                <div className="flex items-center gap-1">
                                  {line.packagingItems.length > 0 ? (
                                    <span className="flex-1 text-right text-xs font-medium text-blue-700">
                                      {pkgTotal.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                    </span>
                                  ) : (
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.001"
                                      value={line.packagingODM}
                                      onChange={(e) => updateLine(idx, 'packagingODM', e.target.value)}
                                      placeholder="0"
                                      className="flex-1 px-1 py-0.5 text-xs bg-transparent outline-none focus:bg-accent/50 rounded text-right"
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => togglePackaging(idx)}
                                    title={line.packagingExpanded ? 'Thu gọn' : 'Nhập chi tiết bao bì'}
                                    className={`flex-shrink-0 rounded px-1 py-0.5 text-[10px] border transition-colors ${line.packagingExpanded ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-border text-muted-foreground hover:bg-accent'}`}
                                  >
                                    {line.packagingItems.length > 0 ? `${line.packagingItems.length} item` : '+ Chi tiết'}
                                  </button>
                                </div>
                              </td>
                              {/* GT tự tính — read only */}
                              {(() => {
                                const totalRMB = calcTotalRMB(line);
                                const rate = parseFloat(quoteForm.exchangeRate) || 0;
                                const totalUSD = rate > 0 ? totalRMB / rate : null;
                                const hasValue = totalRMB > 0;
                                return (
                                  <>
                                    <td className="border-r px-2 py-1 bg-amber-50/60">
                                      <div className="text-right">
                                        {hasValue ? (
                                          <>
                                            <span className="font-bold text-amber-800 text-xs">
                                              {totalRMB.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                            </span>
                                            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                              {parseFloat(line.contentPricePcs) > 0 && <span>NL {(parseFloat(line.contentPricePcs)||0).toLocaleString(undefined,{maximumFractionDigits:3})}</span>}
                                              {parseFloat(line.processingFee) > 0 && <span> + GC {(parseFloat(line.processingFee)||0).toLocaleString(undefined,{maximumFractionDigits:3})}</span>}
                                              {pkgTotal > 0 && <span> + BB {pkgTotal.toLocaleString(undefined,{maximumFractionDigits:3})}</span>}
                                            </div>
                                          </>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="border-r px-2 py-1 bg-amber-50/60">
                                      <div className="text-right text-xs">
                                        {totalUSD != null ? (
                                          <span className="font-medium text-amber-700">${totalUSD.toFixed(4)}</span>
                                        ) : (
                                          <span className="text-muted-foreground text-[10px]">Nhập tỷ giá</span>
                                        )}
                                      </div>
                                    </td>
                                  </>
                                );
                              })()}
                              <td className="border-r px-1 py-0.5">
                                <input type="number" min={0} className="w-full px-1 py-0.5 text-xs bg-transparent outline-none focus:bg-accent/50 rounded text-right" value={line.moq} onChange={(e) => updateLine(idx, 'moq', e.target.value)} placeholder="0" />
                              </td>
                              <td className="border-r px-1 py-0.5">
                                <input className="w-full px-1 py-0.5 text-xs bg-transparent outline-none focus:bg-accent/50 rounded" value={line.notes} onChange={(e) => updateLine(idx, 'notes', e.target.value)} placeholder="Ghi chú..." />
                              </td>
                              <td className="px-1 py-0.5 text-center">
                                {productLines.length > 1 && (
                                  <button type="button" onClick={() => removeLine(idx)} className="text-destructive hover:opacity-70">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>

                            {/* Packaging detail builder — expandable row */}
                            {line.packagingExpanded && (
                              <tr className="border-b bg-blue-50/40">
                                <td colSpan={13} className="px-4 py-3">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[11px] font-semibold text-blue-700">
                                        Chi tiết bao bì ODM — {line.productName || `SP ${line.stt}`}
                                        {pkgTotal > 0 && <span className="ml-2 font-normal text-blue-600">Tổng: {pkgTotal.toLocaleString(undefined, { maximumFractionDigits: 3 })} {quoteForm.currency}</span>}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => addPackagingItem(idx)}
                                        className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-100"
                                      >
                                        <Plus className="h-3 w-3" />Thêm thành phần
                                      </button>
                                    </div>

                                    {line.packagingItems.length === 0 && (
                                      <p className="text-[11px] text-muted-foreground italic">Chưa có thành phần nào. Nhấn "Thêm thành phần" để bắt đầu.</p>
                                    )}

                                    {line.packagingItems.length > 0 && (
                                      <table className="w-full text-[11px]">
                                        <thead>
                                          <tr className="text-muted-foreground border-b border-blue-200">
                                            <th className="text-left pb-1 font-medium w-1/2">Thành phần bao bì</th>
                                            <th className="text-right pb-1 font-medium w-28">Đơn giá ({quoteForm.currency})</th>
                                            <th className="text-right pb-1 font-medium w-16">Số lượng</th>
                                            <th className="text-right pb-1 font-medium w-24">Thành tiền</th>
                                            <th className="w-6"></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {line.packagingItems.map((item, itemIdx) => {
                                            const subtotal = (parseFloat(item.unitCost) || 0) * (parseFloat(item.qty) || 1);
                                            return (
                                              <tr key={itemIdx} className="border-b border-blue-100 last:border-b-0">
                                                <td className="py-1 pr-3">
                                                  <input
                                                    className="w-full px-1 py-0.5 bg-white border border-blue-200 rounded outline-none focus:border-blue-400 text-xs"
                                                    value={item.name}
                                                    onChange={(e) => updatePackagingItem(idx, itemIdx, 'name', e.target.value)}
                                                    placeholder="VD: Chai HDPE 150ml, Nắp CRC, In thêm 1 màu..."
                                                  />
                                                </td>
                                                <td className="py-1 pr-2">
                                                  <input
                                                    type="number" min={0} step="0.001"
                                                    className="w-full px-1 py-0.5 bg-white border border-blue-200 rounded outline-none focus:border-blue-400 text-xs text-right"
                                                    value={item.unitCost}
                                                    onChange={(e) => updatePackagingItem(idx, itemIdx, 'unitCost', e.target.value)}
                                                    placeholder="0"
                                                  />
                                                </td>
                                                <td className="py-1 pr-2">
                                                  <input
                                                    type="number" min={1} step="1"
                                                    className="w-full px-1 py-0.5 bg-white border border-blue-200 rounded outline-none focus:border-blue-400 text-xs text-right"
                                                    value={item.qty}
                                                    onChange={(e) => updatePackagingItem(idx, itemIdx, 'qty', e.target.value)}
                                                    placeholder="1"
                                                  />
                                                </td>
                                                <td className="py-1 pr-2 text-right font-semibold text-blue-700">
                                                  {subtotal > 0 ? subtotal.toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'}
                                                </td>
                                                <td className="py-1 text-center">
                                                  <button type="button" onClick={() => removePackagingItem(idx, itemIdx)} className="text-destructive hover:opacity-70">
                                                    <Trash2 className="h-3 w-3" />
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                          {/* Tổng cộng */}
                                          <tr className="border-t-2 border-blue-300 bg-blue-50">
                                            <td colSpan={3} className="py-1.5 pr-2 text-right font-semibold text-blue-700 text-[11px]">Tổng bao bì ODM:</td>
                                            <td className="py-1.5 pr-2 text-right font-bold text-blue-700">
                                              {pkgTotal.toLocaleString(undefined, { maximumFractionDigits: 3 })} {quoteForm.currency}
                                            </td>
                                            <td></td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Standard notes preview */}
              <div className="text-[11px] text-muted-foreground bg-muted/50 rounded p-3 space-y-0.5">
                <p className="font-medium text-foreground/70 mb-1">Điều khoản tiêu chuẩn sẽ hiển thị:</p>
                <p>• Giá {quoteForm.pricingTerms} – chưa bao gồm chi phí vận chuyển và xuất nhập khẩu.</p>
                <p>• Tỷ giá RMB/USD tính theo tỷ giá ngân hàng tại ngày thanh toán thực tế.</p>
                <p>• Dung sai số lượng giao hàng: ±5%.</p>
                <p>• Giá trên dựa theo quy trình sản xuất tiêu chuẩn, có hiệu lực trong 60 ngày.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setQuoteDialogRfqId(null)}>Hủy</Button>
              <Button type="submit" disabled={quoteLoading}>{quoteLoading ? 'Đang lưu...' : editingQuoteId ? 'Cập nhật báo giá' : 'Lưu báo giá'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Sample Tab ----
const EVAL_COLORS: Record<string, string> = {
  'pending-evaluation': 'bg-gray-100 text-gray-600',
  evaluating: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  'approved-with-changes': 'bg-teal-100 text-teal-700',
  rejected: 'bg-red-100 text-red-700',
  reworking: 'bg-amber-100 text-amber-700',
};

const SAMPLE_TYPE_LABEL: Record<string, string> = {
  'finished-product': 'Sản phẩm', formula: 'Công thức', packaging: 'Bao bì',
  label: 'Nhãn', 'raw-material': 'Nguyên liệu', other: 'Khác',
};

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-xl transition-colors ${star <= value ? 'text-amber-400' : 'text-gray-300 hover:text-amber-200'}`}
        >★</button>
      ))}
      {value > 0 && <span className="text-sm text-muted-foreground ml-1 self-center">{value}/5</span>}
    </div>
  );
}

function SampleMediaThumb({ att, onDelete }: { att: SampleAttachment; onDelete?: () => void }) {
  const isImage = att.mimetype.startsWith('image/');
  const isVideo = att.mimetype.startsWith('video/');
  const fileUrl = `/api/files/${att.filename}`;
  return (
    <div className="relative group border rounded-lg overflow-hidden bg-muted/30 aspect-square">
      {isImage ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block h-full">
          <img src={fileUrl} alt={att.originalName} className="w-full h-full object-cover" loading="lazy" />
        </a>
      ) : isVideo ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-full gap-1 text-muted-foreground hover:text-primary transition-colors p-2">
          <span className="text-3xl">▶</span>
          <span className="text-[10px] text-center line-clamp-2">{att.originalName}</span>
        </a>
      ) : (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-full gap-1 text-muted-foreground hover:text-primary transition-colors p-2">
          <Download className="h-6 w-6" />
          <span className="text-[10px] text-center line-clamp-2">{att.originalName}</span>
        </a>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
        {att.originalName}
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}


const EMPTY_FORMULA: SampleFormula = {
  dosageForm: '', totalWeight: '', servingSize: '', formulaNotes: '', ingredients: [],
};

function newIngredient(): FormulaIngredient {
  return {
    id: Math.random().toString(36).slice(2, 10),
    tradeName: '', inciName: '', function: '', aiFunction: '',
    activeRatio: '', rawPercentage: '', supplier: '', notes: '',
    warningLevel: null, warningDetail: '',
  };
}

const WARNING_STYLE: Record<string, { row: string; badge: string; label: string }> = {
  banned:     { row: 'bg-red-50 dark:bg-red-950/20',    badge: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300',    label: 'BỊ CẤM' },
  restricted: { row: 'bg-amber-50 dark:bg-amber-950/20', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300', label: 'HẠN CHẾ' },
  caution:    { row: 'bg-yellow-50 dark:bg-yellow-950/20', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/60 dark:text-yellow-300', label: 'CHÚ Ý' },
};

// ---- FormulaImportDialog — Excel upload + AI enrichment ----
function FormulaImportDialog({
  open, onClose, onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (f: SampleFormula) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);

  if (!open) return null;

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const result = await api.engagements.samples.parseFormulaExcel(file);
      const withIds: SampleFormula = {
        ...result,
        ingredients: (result.ingredients || []).map((ing: Partial<FormulaIngredient>) => ({
          ...newIngredient(), ...ing,
          id: Math.random().toString(36).slice(2, 10),
          warningLevel: (ing as FormulaIngredient).warningLevel ?? null,
          warningDetail: (ing as FormulaIngredient).warningDetail || '',
        })),
      };
      onImport(withIds);
      onClose();
      const warnCount = withIds.ingredients.filter((i) => i.warningLevel).length;
      if (warnCount > 0) {
        toast.error(`Đã import ${withIds.ingredients.length} thành phần — phát hiện ${warnCount} thành phần cần chú ý!`, { duration: 5000 });
      } else {
        toast.success(`Đã import ${withIds.ingredients.length} thành phần thành công!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể phân tích file');
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-md border">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Import bảng thành phần từ Excel
          </h2>
          <button onClick={onClose} disabled={parsing} className="text-muted-foreground hover:text-foreground transition-colors">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200 space-y-1">
            <p className="font-medium">AI sẽ tự động:</p>
            <p>• Nhận diện cấu trúc bảng và extract thành phần</p>
            <p>• Thêm mô tả công dụng cho từng thành phần</p>
            <p>• Cảnh báo nếu phát hiện thành phần bị cấm/hạn chế theo quy định VN & quốc tế</p>
          </div>

          {/* File picker */}
          {!file ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/20 transition-colors gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Chọn file Excel</span>
              <span className="text-xs text-muted-foreground">.xlsx, .xls — tối đa 10MB</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 border rounded-lg px-3 py-2.5 bg-muted/20">
              <div className="h-9 w-9 rounded-md bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                <FlaskConical className="h-4 w-4 text-green-700 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{file.name}</p>
                <p className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={() => setFile(null)} disabled={parsing} className="text-muted-foreground hover:text-destructive transition-colors">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {parsing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5">
              <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full shrink-0" />
              AI đang đọc file và phân tích thành phần... (có thể mất 1-2 phút, vui lòng không đóng cửa sổ)
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={parsing} className="h-8 text-xs">Hủy</Button>
            <Button
              size="sm"
              onClick={handleParse}
              disabled={!file || parsing}
              className="h-8 text-xs gap-1.5"
            >
              {parsing ? 'Đang phân tích...' : <><FlaskConical className="h-3.5 w-3.5" />Phân tích & Import</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormulaSection({ sample, onUpdated }: { sample: Sample; onUpdated: (s: Sample) => void }) {
  const formula: SampleFormula = (sample.formula && typeof sample.formula === 'object' && 'ingredients' in sample.formula)
    ? sample.formula as SampleFormula
    : EMPTY_FORMULA;

  const hasContent = formula.ingredients.length > 0 || !!formula.dosageForm;
  const [expanded, setExpanded] = useState(hasContent);
  const [local, setLocal] = useState<SampleFormula>(formula);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  React.useEffect(() => {
    const f = (sample.formula && typeof sample.formula === 'object' && 'ingredients' in sample.formula)
      ? sample.formula as SampleFormula : EMPTY_FORMULA;
    setLocal(f);
  }, [sample]);

  const addIngredient = () => setLocal((f) => ({ ...f, ingredients: [...f.ingredients, newIngredient()] }));
  const updateIngredient = (id: string, patch: Partial<FormulaIngredient>) =>
    setLocal((f) => ({ ...f, ingredients: f.ingredients.map((i) => i.id === id ? { ...i, ...patch } : i) }));
  const removeIngredient = (id: string) =>
    setLocal((f) => ({ ...f, ingredients: f.ingredients.filter((i) => i.id !== id) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.engagements.samples.update(sample.id, { formula: local });
      onUpdated(updated);
      toast.success('Đã lưu bảng thành phần!');
    } catch { toast.error('Không thể lưu bảng thành phần'); }
    finally { setSaving(false); }
  };

  const handleImport = (imported: SampleFormula) => {
    setLocal((prev) => ({
      ...imported,
      // Keep header fields if already filled
      dosageForm: imported.dosageForm || prev.dosageForm,
      totalWeight: imported.totalWeight || prev.totalWeight,
      servingSize: imported.servingSize || prev.servingSize,
    }));
    if (!expanded) setExpanded(true);
  };

  return (
    <>
      <FormulaImportDialog open={showImport} onClose={() => setShowImport(false)} onImport={handleImport} />
      <div className="border-t bg-muted/5">
      {/* Toggle header */}
      <div className="w-full px-4 py-2.5 flex items-center justify-between">
        <button
          type="button"
          className="flex-1 flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-primary/70" />
            Bảng thành phần
            {local.ingredients.length > 0 && (
              <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary normal-case tracking-normal">
                {local.ingredients.length} thành phần
              </span>
            )}
          </span>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />}
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 text-[11px] gap-1 px-2 shrink-0"
          onClick={() => { setShowImport(true); setExpanded(true); }}
        >
          <Upload className="h-3 w-3" />Nhập nhanh
        </Button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Header info */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Dạng bào chế</label>
              <input
                value={local.dosageForm}
                onChange={(e) => setLocal((f) => ({ ...f, dosageForm: e.target.value }))}
                placeholder="VD: Viên nang cứng"
                className="mt-1 w-full h-8 text-xs border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Khối lượng / đơn vị</label>
              <input
                value={local.totalWeight}
                onChange={(e) => setLocal((f) => ({ ...f, totalWeight: e.target.value }))}
                placeholder="VD: 500mg/viên"
                className="mt-1 w-full h-8 text-xs border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Liều dùng</label>
              <input
                value={local.servingSize}
                onChange={(e) => setLocal((f) => ({ ...f, servingSize: e.target.value }))}
                placeholder="VD: 2 viên/ngày"
                className="mt-1 w-full h-8 text-xs border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Warning summary bar */}
          {local.ingredients.some((i) => i.warningLevel) && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 space-y-1">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                <span className="inline-block h-3.5 w-3.5 rounded-full bg-red-500 shrink-0" />
                Phát hiện thành phần cần kiểm tra
              </p>
              {local.ingredients.filter((i) => i.warningLevel).map((i) => (
                <div key={i.id} className="flex items-start gap-2 text-[11px]">
                  <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${WARNING_STYLE[i.warningLevel!]?.badge}`}>
                    {WARNING_STYLE[i.warningLevel!]?.label}
                  </span>
                  <span className="text-red-800 dark:text-red-300">
                    <span className="font-medium">{i.tradeName || i.inciName || '—'}</span>
                    {i.inciName && i.tradeName && i.tradeName !== i.inciName && (
                      <span className="text-red-700/70"> ({i.inciName})</span>
                    )}
                    {i.warningDetail ? ` — ${i.warningDetail}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Ingredient table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Danh sách thành phần</span>
              <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2" onClick={addIngredient}>
                <Plus className="h-3 w-3" /> Thêm thành phần
              </Button>
            </div>

            {local.ingredients.length === 0 ? (
              <div
                className="text-center py-5 border-2 border-dashed rounded-lg text-xs text-muted-foreground cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={addIngredient}
              >
                <FlaskConical className="h-6 w-6 mx-auto mb-1 opacity-30" />
                Nhấn để thêm thành phần đầu tiên hoặc dùng "Nhập nhanh" để upload Excel
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                {(() => {
                  const totalPct = local.ingredients.reduce((sum, ing) => {
                    const v = parseFloat((ing.rawPercentage || '').replace('%', '').trim());
                    return sum + (isNaN(v) ? 0 : v);
                  }, 0);
                  const totalOk = Math.abs(totalPct - 100) < 0.5;
                  const totalWarn = totalPct > 100.5;
                  return (
                  <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 28 }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '21%' }} />
                      <col style={{ width: 68 }} />
                      <col style={{ width: 68 }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: 28 }} />
                    </colgroup>
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-1 py-2 text-left font-medium text-muted-foreground">#</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Trade Name</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">INCI Name</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Chức năng</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-primary/60 shrink-0" />
                            AI kiểm chứng
                          </span>
                        </th>
                        <th className="px-1 py-2 text-center font-medium text-muted-foreground leading-tight">
                          <span className="block">HĐ%</span>
                          <span className="text-[9px] font-normal opacity-70 block">NL thô</span>
                        </th>
                        <th className="px-1 py-2 text-center font-medium text-muted-foreground leading-tight">
                          <span className="block">% CT</span>
                          <span className="text-[9px] font-normal opacity-70 block">cuối</span>
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Cảnh báo &amp; Lý do</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {local.ingredients.map((ing, idx) => {
                        const ws = ing.warningLevel ? WARNING_STYLE[ing.warningLevel] : null;
                        return (
                          <tr key={ing.id} className={`border-t group ${ws ? ws.row : 'hover:bg-muted/20'}`}>
                            <td className="px-1 py-1.5 text-muted-foreground text-center align-top pt-2">{idx + 1}</td>

                            <td className="px-1 py-1.5 align-top overflow-hidden">
                              <input
                                value={ing.tradeName || ''}
                                onChange={(e) => updateIngredient(ing.id, { tradeName: e.target.value })}
                                placeholder="Trade name..."
                                title={ing.tradeName}
                                className="w-full bg-transparent rounded px-1.5 py-0.5 focus:outline-none focus:bg-muted/50 focus:ring-1 focus:ring-ring truncate"
                              />
                              {ing.notes && <p className="text-[10px] text-muted-foreground px-1.5 mt-0.5 truncate italic">{ing.notes}</p>}
                            </td>

                            <td className="px-1 py-1.5 align-top overflow-hidden">
                              <input
                                value={ing.inciName || ''}
                                onChange={(e) => updateIngredient(ing.id, { inciName: e.target.value })}
                                placeholder="INCI name..."
                                title={ing.inciName}
                                className="w-full bg-transparent rounded px-1.5 py-0.5 focus:outline-none focus:bg-muted/50 focus:ring-1 focus:ring-ring truncate"
                              />
                            </td>

                            <td className="px-1 py-1.5 align-top overflow-hidden">
                              <input
                                value={ing.function || ''}
                                onChange={(e) => updateIngredient(ing.id, { function: e.target.value })}
                                placeholder="Từ file..."
                                title={ing.function}
                                className="w-full bg-transparent rounded px-1.5 py-0.5 focus:outline-none focus:bg-muted/50 focus:ring-1 focus:ring-ring truncate"
                              />
                            </td>

                            <td className="px-1 py-1.5 align-top overflow-hidden">
                              {ing.aiFunction ? (
                                <p className="text-[10px] text-primary/80 px-1.5 leading-snug italic line-clamp-3" title={ing.aiFunction}>{ing.aiFunction}</p>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/40 px-1.5 italic">—</span>
                              )}
                            </td>

                            <td className="px-1 py-1.5 align-top overflow-hidden">
                              <input
                                value={ing.activeRatio || ''}
                                onChange={(e) => updateIngredient(ing.id, { activeRatio: e.target.value })}
                                placeholder="100%"
                                className="w-full bg-transparent rounded px-1 py-0.5 text-center focus:outline-none focus:bg-muted/50 focus:ring-1 focus:ring-ring"
                              />
                            </td>

                            <td className="px-1 py-1.5 align-top overflow-hidden">
                              <input
                                value={ing.rawPercentage || ''}
                                onChange={(e) => updateIngredient(ing.id, { rawPercentage: e.target.value })}
                                placeholder="0.5%"
                                className="w-full bg-transparent rounded px-1 py-0.5 text-center focus:outline-none focus:bg-muted/50 focus:ring-1 focus:ring-ring"
                              />
                            </td>

                            <td className="px-1 py-1.5 align-top overflow-hidden">
                              {ws ? (
                                <div className="space-y-1">
                                  <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-bold leading-none ${ws.badge}`}>
                                    {ws.label}
                                  </span>
                                  {ing.warningDetail && (
                                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2" title={ing.warningDetail}>{ing.warningDetail}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/50 px-1">—</span>
                              )}
                            </td>

                            <td className="px-1 py-1.5 align-top">
                              <button
                                type="button"
                                onClick={() => removeIngredient(ing.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mt-0.5"
                              >
                                <XIcon className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {local.ingredients.some((i) => i.rawPercentage) && (
                      <tfoot>
                        <tr className="border-t-2 border-muted-foreground/20 bg-muted/40">
                          <td colSpan={6} className="px-3 py-1.5 text-right text-[11px] font-medium text-muted-foreground">
                            Tổng % CT cuối:
                          </td>
                          <td className={`px-1 py-1.5 text-center text-[11px] font-bold ${
                            totalOk ? 'text-green-700 dark:text-green-400' :
                            totalWarn ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            {totalPct % 1 === 0 ? totalPct : totalPct.toFixed(2)}%
                          </td>
                          <td colSpan={2} className="px-2 py-1.5 text-[10px] text-muted-foreground">
                            {totalOk ? '✓ hợp lệ' : totalWarn ? '⚠ vượt 100%' : `còn ${(100 - totalPct).toFixed(2)}%`}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Formula notes */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Ghi chú công thức</label>
            <textarea
              value={local.formulaNotes}
              onChange={(e) => setLocal((f) => ({ ...f, formulaNotes: e.target.value }))}
              rows={2}
              placeholder="Nguồn gốc nguyên liệu, tiêu chuẩn chất lượng, lưu ý khi pha chế..."
              className="mt-1 w-full text-xs border rounded-md px-2.5 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              {saving ? 'Đang lưu...' : 'Lưu bảng thành phần'}
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function SampleCard({ sample, onUpdated }: { sample: Sample; onUpdated: (s: Sample) => void }) {
  const { user } = useAuth();
  const [showFeedback, setShowFeedback] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkForm, setLinkForm] = useState({ title: '', url: '' });
  const [linkSaving, setLinkSaving] = useState(false);
  const [feedback, setFeedback] = useState({
    evaluatedBy: sample.evaluatedBy || user?.name || '',
    overallRating: sample.overallRating ?? 0,
    feedbackToFactory: sample.feedbackToFactory || '',
    revisionRequested: sample.revisionRequested || false,
    revisionDetails: sample.revisionDetails || '',
    evaluationStatus: sample.evaluationStatus,
  });

  // Sync khi sample thay đổi từ ngoài
  React.useEffect(() => {
    setFeedback({
      evaluatedBy: sample.evaluatedBy || user?.name || '',
      overallRating: sample.overallRating ?? 0,
      feedbackToFactory: sample.feedbackToFactory || '',
      revisionRequested: sample.revisionRequested || false,
      revisionDetails: sample.revisionDetails || '',
      evaluationStatus: sample.evaluationStatus,
    });
  }, [sample, user]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let result: Sample = sample;
    for (const file of Array.from(files)) {
      try {
        result = await api.engagements.samples.uploadAttachment(sample.id, file, user?.name || 'Ẩn danh');
      } catch { toast.error(`Không thể upload: ${file.name}`); }
    }
    onUpdated(result);
    setUploading(false);
    toast.success('Đã tải lên!');
  };

  const handleDeleteMedia = async (attId: string) => {
    try {
      const updated = await api.engagements.samples.deleteAttachment(sample.id, attId);
      onUpdated(updated);
    } catch { toast.error('Không thể xóa file'); }
  };

  const handleStatusChange = async (status: Sample['evaluationStatus']) => {
    try {
      const updated = await api.engagements.samples.update(sample.id, { evaluationStatus: status });
      onUpdated(updated);
    } catch { toast.error('Không thể cập nhật'); }
  };

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await api.engagements.samples.update(sample.id, {
        evaluatedBy: feedback.evaluatedBy,
        evaluatedAt: new Date().toISOString(),
        overallRating: feedback.overallRating || null,
        feedbackToFactory: feedback.feedbackToFactory,
        revisionRequested: feedback.revisionRequested,
        revisionDetails: feedback.revisionDetails,
        evaluationStatus: feedback.evaluationStatus,
      });
      onUpdated(updated);
      setShowFeedback(false);
      toast.success('Đã lưu đánh giá!');
    } catch { toast.error('Không thể lưu đánh giá'); }
  };

  const hasFeedback = sample.overallRating != null || sample.feedbackToFactory;

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkForm.url.startsWith('http')) { toast.error('URL phải bắt đầu bằng http:// hoặc https://'); return; }
    setLinkSaving(true);
    try {
      const updated = await api.engagements.samples.addLink(sample.id, {
        title: linkForm.title.trim() || linkForm.url,
        url: linkForm.url.trim(),
        addedBy: user?.name || 'Ẩn danh',
      });
      onUpdated(updated);
      setLinkForm({ title: '', url: '' });
      setShowAddLink(false);
      toast.success('Đã thêm link!');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setLinkSaving(false); }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const updated = await api.engagements.samples.deleteLink(sample.id, linkId);
      onUpdated(updated);
    } catch { toast.error('Không thể xóa link'); }
  };

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-base">{sample.sampleNumber}</span>
              <Badge variant="secondary" className="text-xs">v{sample.version}</Badge>
              <Badge variant="outline" className="text-xs">{SAMPLE_TYPE_LABEL[sample.type] || sample.type}</Badge>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EVAL_COLORS[sample.evaluationStatus] || 'bg-gray-100 text-gray-600'}`}>
                {EVAL_STATUS_LABEL[sample.evaluationStatus] || sample.evaluationStatus}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3 inline mr-1" />
              Nhận: {formatDateTime(sample.receivedAt)} · {sample.receivedBy}
            </p>
            {sample.description && <p className="text-sm text-muted-foreground mt-1">{sample.description}</p>}
          </div>
        </div>

        {/* Status buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Trạng thái đánh giá:</span>
          {(['pending-evaluation', 'evaluating', 'approved', 'approved-with-changes', 'rejected', 'reworking'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${sample.evaluationStatus === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent border-border'}`}
            >{EVAL_STATUS_LABEL[s]}</button>
          ))}
        </div>
      </div>

      {/* Formula / Bảng thành phần sản phẩm */}
      <FormulaSection sample={sample} onUpdated={onUpdated} />

      {/* Media gallery — bằng chứng nhận mẫu */}
      <div className="border-t bg-muted/10 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" />
            Ảnh / Video bằng chứng ({sample.attachments?.length ?? 0})
          </p>
          <label className={`cursor-pointer text-xs flex items-center gap-1 px-2 py-1 rounded border hover:bg-accent transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="h-3 w-3" />
            {uploading ? 'Đang upload...' : 'Thêm ảnh/video'}
            <input
              type="file"
              multiple
              accept="image/*,video/mp4,video/quicktime,video/webm,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
        </div>

        {(!sample.attachments || sample.attachments.length === 0) ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/30 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Chụp ảnh / quay video mẫu và upload lên đây</span>
            <span className="text-xs text-muted-foreground mt-1">Hỗ trợ ảnh JPG/PNG, video MP4/MOV, tối đa 100MB</span>
            <input
              type="file"
              multiple
              accept="image/*,video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {sample.attachments.map((att) => (
              <SampleMediaThumb
                key={att.id}
                att={att}
                onDelete={() => handleDeleteMedia(att.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Links tham khảo / chi tiết đánh giá */}
      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <LinkIcon className="h-3.5 w-3.5" />
            Link tham khảo ({sample.links?.length ?? 0})
          </p>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowAddLink((v) => !v)}>
            <Plus className="h-3 w-3" />Thêm link
          </Button>
        </div>

        {/* Add link inline form */}
        {showAddLink && (
          <form onSubmit={handleAddLink} className="mb-3 p-3 bg-muted/30 rounded-lg space-y-2">
            <div>
              <Input
                placeholder="URL (bắt buộc, vd: https://docs.google.com/...)"
                value={linkForm.url}
                onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))}
                className="text-sm"
                required
              />
            </div>
            <div>
              <Input
                placeholder="Tên hiển thị (tuỳ chọn)"
                value={linkForm.title}
                onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAddLink(false); setLinkForm({ title: '', url: '' }); }}>Hủy</Button>
              <Button type="submit" size="sm" className="h-7 text-xs" disabled={linkSaving}>
                {linkSaving ? 'Đang lưu...' : 'Lưu link'}
              </Button>
            </div>
          </form>
        )}

        {(!sample.links || sample.links.length === 0) && !showAddLink && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Chưa có link — thêm Google Sheet, Google Doc, báo cáo kiểm nghiệm...
          </p>
        )}

        <div className="space-y-1.5">
          {sample.links?.map((link) => (
            <div key={link.id} className="group flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-primary hover:underline flex items-center gap-1 truncate"
              >
                <span className="truncate">{link.title || link.url}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
              </a>
              <span className="text-xs text-muted-foreground shrink-0 hidden group-hover:inline">
                {link.addedBy} · {link.addedAt?.slice(0, 10)}
              </span>
              <button
                onClick={() => handleDeleteLink(link.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback / đánh giá */}
      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Đánh giá chất lượng mẫu
          </p>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowFeedback(true)}>
            {hasFeedback ? 'Chỉnh sửa đánh giá' : 'Thêm đánh giá'}
          </Button>
        </div>

        {hasFeedback ? (
          <div className="space-y-2">
            {sample.overallRating != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Điểm tổng:</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map((s) => (
                    <span key={s} className={`text-lg ${s <= sample.overallRating! ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                  ))}
                </div>
                <span className="text-sm font-semibold">{sample.overallRating}/5</span>
              </div>
            )}
            {sample.feedbackToFactory && (
              <div className="text-sm border-l-2 border-amber-400 pl-3 text-muted-foreground">
                <span className="font-medium text-foreground">Phản hồi về nhà máy: </span>
                {sample.feedbackToFactory}
              </div>
            )}
            {sample.revisionRequested && (
              <div className="text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Yêu cầu làm lại
                {sample.revisionDetails && <span className="font-normal text-muted-foreground ml-1">— {sample.revisionDetails}</span>}
              </div>
            )}
            {sample.evaluatedBy && (
              <p className="text-xs text-muted-foreground">Đánh giá bởi: {sample.evaluatedBy}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">Chưa có đánh giá — nhấn nút để thêm</p>
        )}
      </div>

      {/* Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent onClose={() => setShowFeedback(false)} className="max-w-md">
          <form onSubmit={handleSaveFeedback}>
            <DialogHeader>
              <DialogTitle>Đánh giá mẫu {sample.sampleNumber}</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-2 space-y-4">
              <div>
                <Label>Người đánh giá</Label>
                <Input value={feedback.evaluatedBy} onChange={(e) => setFeedback((f) => ({ ...f, evaluatedBy: e.target.value }))} className="mt-1" placeholder="Tên người đánh giá" />
              </div>
              <div>
                <Label>Trạng thái</Label>
                <Select value={feedback.evaluationStatus} onChange={(e) => setFeedback((f) => ({ ...f, evaluationStatus: e.target.value as Sample['evaluationStatus'] }))} className="mt-1">
                  <option value="pending-evaluation">Chờ đánh giá</option>
                  <option value="evaluating">Đang đánh giá</option>
                  <option value="approved">Đạt — OK</option>
                  <option value="approved-with-changes">Đạt nhưng cần chỉnh sửa nhỏ</option>
                  <option value="rejected">Không đạt</option>
                  <option value="reworking">Yêu cầu làm lại</option>
                </Select>
              </div>
              <div>
                <Label>Điểm tổng thể</Label>
                <div className="mt-2">
                  <StarRating value={feedback.overallRating} onChange={(v) => setFeedback((f) => ({ ...f, overallRating: v }))} />
                </div>
              </div>
              <div>
                <Label>Nhận xét / phản hồi gửi nhà máy</Label>
                <Textarea
                  value={feedback.feedbackToFactory}
                  onChange={(e) => setFeedback((f) => ({ ...f, feedbackToFactory: e.target.value }))}
                  rows={3}
                  className="mt-1"
                  placeholder="Mùi, màu sắc, kết cấu, bao bì... những điểm cần cải thiện"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="revisionReq"
                  checked={feedback.revisionRequested}
                  onChange={(e) => setFeedback((f) => ({ ...f, revisionRequested: e.target.checked }))}
                  className="h-4 w-4"
                />
                <label htmlFor="revisionReq" className="text-sm font-medium cursor-pointer">Yêu cầu nhà máy làm lại</label>
              </div>
              {feedback.revisionRequested && (
                <div>
                  <Label>Chi tiết yêu cầu làm lại</Label>
                  <Textarea
                    value={feedback.revisionDetails}
                    onChange={(e) => setFeedback((f) => ({ ...f, revisionDetails: e.target.value }))}
                    rows={2}
                    className="mt-1"
                    placeholder="Cụ thể cần thay đổi gì..."
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowFeedback(false)}>Hủy</Button>
              <Button type="submit">Lưu đánh giá</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SampleTab({ engagementId }: { engagementId: string }) {
  const { user } = useAuth();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ type: 'finished-product', receivedBy: '', description: '', version: '1' });

  useEffect(() => {
    api.engagements.samples.list(engagementId).then(setSamples).catch(() => {});
  }, [engagementId]);

  // Auto-fill người nhận mẫu
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, receivedBy: f.receivedBy || user.name }));
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const sample = await api.engagements.samples.create(engagementId, {
        type: form.type as Sample['type'],
        receivedBy: form.receivedBy,
        description: form.description,
        version: parseInt(form.version) || 1,
        evaluationStatus: 'pending-evaluation',
      });
      setSamples((prev) => [sample, ...prev]);
      setShowForm(false);
      toast.success('Đã thêm mẫu!');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{samples.length} mẫu</p>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />Đăng ký mẫu mới
        </Button>
      </div>

      {samples.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Chưa có mẫu nào</p>
          <p className="text-xs mt-1">Đăng ký khi nhận mẫu từ nhà máy</p>
        </div>
      )}

      {samples.map((sample) => (
        <SampleCard
          key={sample.id}
          sample={sample}
          onUpdated={(updated) => setSamples((prev) => prev.map((s) => s.id === updated.id ? updated : s))}
        />
      ))}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent onClose={() => setShowForm(false)} className="max-w-sm">
          <form onSubmit={handleCreate}>
            <DialogHeader><DialogTitle>Đăng ký mẫu mới</DialogTitle></DialogHeader>
            <div className="px-6 pb-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Loại mẫu</Label>
                  <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="mt-1">
                    <option value="finished-product">Sản phẩm hoàn chỉnh</option>
                    <option value="formula">Công thức</option>
                    <option value="packaging">Bao bì</option>
                    <option value="label">Nhãn</option>
                    <option value="raw-material">Nguyên liệu</option>
                    <option value="other">Khác</option>
                  </Select>
                </div>
                <div>
                  <Label>Phiên bản</Label>
                  <Input type="number" min={1} value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Người nhận mẫu</Label>
                <Input value={form.receivedBy} onChange={(e) => setForm((f) => ({ ...f, receivedBy: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Mô tả mẫu</Label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="mt-1" placeholder="Mẫu thứ mấy, từ đợt nào, đặc điểm gì..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Hủy</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Đang lưu...' : 'Thêm mẫu'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Negotiation Tab ----
const NEG_TYPE_LABEL: Record<string, string> = {
  'price-negotiation': 'Giá cả', 'terms-negotiation': 'Điều khoản',
  'spec-clarification': 'Làm rõ thông số', 'timeline-negotiation': 'Tiến độ', other: 'Khác',
};

const NEG_STATUS_LABEL: Record<string, string> = {
  'open': 'Mở', 'in-progress': 'Đang xử lý',
  'closed-win': 'Thành công', 'closed-loss': 'Thất bại', 'on-hold': 'Tạm dừng',
};

const NEG_STATUS_COLOR: Record<string, string> = {
  'open': 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-amber-100 text-amber-700',
  'closed-win': 'bg-green-100 text-green-700',
  'closed-loss': 'bg-red-100 text-red-700',
  'on-hold': 'bg-gray-100 text-gray-600',
};

const NEG_STATUS_ICON: Record<string, React.ReactNode> = {
  'open': <AlertCircle className="h-3.5 w-3.5" />,
  'in-progress': <Clock className="h-3.5 w-3.5" />,
  'closed-win': <CheckCircle2 className="h-3.5 w-3.5" />,
  'closed-loss': <XCircle className="h-3.5 w-3.5" />,
  'on-hold': <PauseCircle className="h-3.5 w-3.5" />,
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

function AttachmentThumb({ att, onDelete }: { att: NegotiationAttachment; onDelete?: () => void }) {
  const isImage = att.mimetype.startsWith('image/');
  const fileUrl = `/api/files/${att.filename}`;
  return (
    <div className="relative group border rounded-md overflow-hidden bg-muted/30">
      {isImage ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={fileUrl}
            alt={att.originalName}
            className="w-full h-24 object-cover"
            loading="lazy"
          />
        </a>
      ) : (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center h-24 gap-1 text-muted-foreground hover:text-primary transition-colors p-2"
        >
          <Download className="h-6 w-6" />
          <span className="text-[10px] text-center line-clamp-2 leading-tight">{att.originalName}</span>
        </a>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-0.5 text-[9px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
        {att.originalName}
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-1 right-1 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        >
          <XIcon className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function NegotiationCard({
  log, onStatusChange, onDelete, onAddUpdate, onLogUpdated,
}: {
  log: NegotiationLog;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onAddUpdate: (log: NegotiationLog) => void;
  onLogUpdated: (log: NegotiationLog) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOverdue = log.deadline && log.status !== 'closed-win' && log.status !== 'closed-loss'
    && new Date(log.deadline) < new Date();

  const handleDeleteAttachment = async (updateId: string, attId: string) => {
    try {
      const updated = await api.engagements.negotiations.deleteAttachment(log.id, updateId, attId);
      if (updated) onLogUpdated(updated);
    } catch { toast.error('Không thể xóa file'); }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{log.subject || '(Không có tiêu đề)'}</span>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${NEG_STATUS_COLOR[log.status] || 'bg-gray-100 text-gray-600'}`}>
                {NEG_STATUS_ICON[log.status]}
                {NEG_STATUS_LABEL[log.status] || log.status}
              </span>
              <Badge variant="secondary" className="text-xs">{NEG_TYPE_LABEL[log.type] || log.type}</Badge>
            </div>
            {/* Timestamps row */}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="font-medium text-foreground/70">Yêu cầu:</span>
                {formatDateTime(log.loggedAt)}
                {log.loggedBy && <span>· {log.loggedBy}</span>}
              </span>
              {log.assignedTo && (
                <span className="flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  {log.assignedTo}
                </span>
              )}
              {log.deadline && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                  <Target className="h-3 w-3" />Hạn: {log.deadline}
                  {isOverdue && ' (Quá hạn)'}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onDelete(log.id)} title="Xóa">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpanded((e) => !e)}>
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Objective */}
        {log.targetObjective && (
          <div className="flex items-start gap-2 text-sm bg-muted/40 rounded px-3 py-2">
            <Target className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div><span className="text-xs font-medium text-muted-foreground">Mục tiêu: </span>{log.targetObjective}</div>
          </div>
        )}

        {/* Initial position */}
        {(log.ourPosition || log.theirPosition) && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {log.ourPosition && <div className="bg-blue-50 rounded px-3 py-2">
              <p className="text-xs font-medium text-blue-600 mb-0.5">Lập trường ban đầu (chúng ta)</p>
              <p className="text-muted-foreground">{log.ourPosition}</p>
            </div>}
            {log.theirPosition && <div className="bg-orange-50 rounded px-3 py-2">
              <p className="text-xs font-medium text-orange-600 mb-0.5">Lập trường ban đầu (đối phương)</p>
              <p className="text-muted-foreground">{log.theirPosition}</p>
            </div>}
          </div>
        )}

        {/* Status buttons */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-xs text-muted-foreground">Trạng thái:</span>
          {(['open', 'in-progress', 'on-hold', 'closed-win', 'closed-loss'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(log.id, s)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                log.status === s
                  ? `${NEG_STATUS_COLOR[s]} border-transparent font-medium`
                  : 'border-border hover:bg-muted'
              }`}
            >
              {NEG_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Updates section */}
      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Lịch sử cập nhật ({log.updates?.length ?? 0})
            </h4>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onAddUpdate(log)}>
              <Plus className="h-3.5 w-3.5" />Thêm cập nhật
            </Button>
          </div>

          {(!log.updates || log.updates.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-2">Chưa có cập nhật nào</p>
          )}

          {log.updates?.map((u, idx) => (
            <div key={u.id} className="bg-white border rounded-md p-3 space-y-2">
              {/* Update header with timestamps */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold">Lần {idx + 1}: {u.updatedBy}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3 text-blue-500" />
                  <span className="text-blue-600 font-medium">Ghi nhận:</span>
                  {formatDateTime(u.date)}
                </span>
                {u.factoryResponseAt && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3 text-orange-500" />
                    <span className="text-orange-600 font-medium">Nhà máy phản hồi:</span>
                    {formatDateTime(u.factoryResponseAt)}
                  </span>
                )}
              </div>

              {(u.ourPosition || u.theirPosition) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {u.ourPosition && <div className="bg-blue-50 rounded px-2 py-1.5"><span className="text-blue-600 font-medium">Chúng ta: </span>{u.ourPosition}</div>}
                  {u.theirPosition && <div className="bg-orange-50 rounded px-2 py-1.5"><span className="text-orange-600 font-medium">Nhà máy: </span>{u.theirPosition}</div>}
                </div>
              )}
              {u.outcome && <div className="text-xs border-l-2 border-green-400 pl-2"><span className="text-green-600 font-medium">Kết quả: </span>{u.outcome}</div>}
              {u.nextSteps && <div className="text-xs border-l-2 border-blue-400 pl-2"><span className="text-blue-600 font-medium">Bước tiếp: </span>{u.nextSteps}</div>}

              {/* Attachments grid */}
              {u.attachments && u.attachments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />Đính kèm ({u.attachments.length})
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {u.attachments.map((att) => (
                      <AttachmentThumb
                        key={att.id}
                        att={att}
                        onDelete={() => handleDeleteAttachment(u.id, att.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NegotiationTab({ engagementId }: { engagementId: string }) {
  const { user, canManage } = useAuth();
  const [logs, setLogs] = useState<NegotiationLog[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<NegotiationLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);

  const [createForm, setCreateForm] = useState({
    type: 'price-negotiation' as NegotiationType, loggedBy: '', subject: '',
    assignedTo: '', targetObjective: '', deadline: '',
    ourPosition: '', theirPosition: '',
  });

  const [updateForm, setUpdateForm] = useState({
    updatedBy: '', factoryResponseAt: '', ourPosition: '', theirPosition: '', outcome: '', nextSteps: '',
  });
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.engagements.negotiations.list(engagementId).then(setLogs).catch(() => {});
    api.users.listActive().then(setTeamUsers).catch(() => {});
  }, [engagementId]);

  // Auto-fill current user in forms
  useEffect(() => {
    if (user) {
      setCreateForm((f) => ({ ...f, loggedBy: f.loggedBy || user.name }));
      setUpdateForm((f) => ({ ...f, updatedBy: f.updatedBy || user.name }));
    }
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const log = await api.engagements.negotiations.create(engagementId, {
        ...createForm,
        deadline: createForm.deadline || null,
        status: 'open',
      });
      setLogs((prev) => [log, ...prev]);
      setShowCreateForm(false);
      setCreateForm({ type: 'price-negotiation', loggedBy: '', subject: '', assignedTo: '', targetObjective: '', deadline: '', ourPosition: '', theirPosition: '' });
      toast.success('Đã tạo yêu cầu đàm phán!');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setLoading(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const updated = await api.engagements.negotiations.update(id, { status: status as NegotiationLog['status'] });
      if (updated) setLogs((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa yêu cầu đàm phán này?')) return;
    try {
      await api.engagements.negotiations.delete(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast.success('Đã xóa!');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
  };

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateTarget) return;
    setLoading(true);
    try {
      let result = await api.engagements.negotiations.addUpdate(updateTarget.id, {
        updatedBy: updateForm.updatedBy,
        factoryResponseAt: updateForm.factoryResponseAt || null,
        ourPosition: updateForm.ourPosition,
        theirPosition: updateForm.theirPosition,
        outcome: updateForm.outcome,
        nextSteps: updateForm.nextSteps,
      });
      if (result && uploadFiles.length > 0) {
        // Get the last update (the one we just added)
        const newUpdateId = result.updates[result.updates.length - 1]?.id;
        if (newUpdateId) {
          setUploading(true);
          for (const file of uploadFiles) {
            try {
              result = await api.engagements.negotiations.uploadAttachment(
                updateTarget.id, newUpdateId, file, updateForm.updatedBy
              );
            } catch { toast.error(`Không thể upload: ${file.name}`); }
          }
          setUploading(false);
        }
      }
      if (result) setLogs((prev) => prev.map((l) => (l.id === updateTarget.id ? result! : l)));
      setUpdateTarget(null);
      setUpdateForm({ updatedBy: '', factoryResponseAt: '', ourPosition: '', theirPosition: '', outcome: '', nextSteps: '' });
      setUploadFiles([]);
      toast.success('Đã thêm cập nhật đàm phán!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const openCounts = logs.filter((l) => l.status === 'open' || l.status === 'in-progress').length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{logs.length} yêu cầu</span>
          {openCounts > 0 && <span className="text-amber-600 font-medium">{openCounts} đang mở</span>}
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowCreateForm(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />Tạo yêu cầu đàm phán
          </Button>
        )}
      </div>

      {logs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Chưa có yêu cầu đàm phán nào</p>
          <p className="text-xs mt-1">Tạo yêu cầu để giao cho nhân viên theo dõi</p>
        </div>
      )}

      {logs.map((log) => (
        <NegotiationCard
          key={log.id}
          log={log}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onAddUpdate={(l) => {
            setUpdateTarget(l);
            setUpdateForm({ updatedBy: user?.name ?? '', factoryResponseAt: '', ourPosition: '', theirPosition: '', outcome: '', nextSteps: '' });
            setUploadFiles([]);
          }}
          onLogUpdated={(updated) => setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))}
        />
      ))}

      {/* Create negotiation dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent onClose={() => setShowCreateForm(false)} className="max-w-lg">
          <form onSubmit={handleCreate}>
            <DialogHeader><DialogTitle>Tạo yêu cầu đàm phán</DialogTitle></DialogHeader>
            <div className="px-6 pb-2 space-y-3">
              <div>
                <Label>Chủ đề <span className="text-red-500">*</span></Label>
                <Input value={createForm.subject} onChange={(e) => setCreateForm((f) => ({ ...f, subject: e.target.value }))} placeholder="VD: Đàm phán giá nguyên liệu lô Q3" className="mt-1" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Loại đàm phán</Label>
                  <Select value={createForm.type} onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value as NegotiationType }))} className="mt-1">
                    <option value="price-negotiation">Giá cả</option>
                    <option value="terms-negotiation">Điều khoản</option>
                    <option value="spec-clarification">Làm rõ thông số</option>
                    <option value="timeline-negotiation">Tiến độ</option>
                    <option value="other">Khác</option>
                  </Select>
                </div>
                <div>
                  <Label>Người tạo</Label>
                  <Input value={createForm.loggedBy} onChange={(e) => setCreateForm((f) => ({ ...f, loggedBy: e.target.value }))} placeholder="Tên quản lý" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Giao cho</Label>
                  <Select value={createForm.assignedTo} onChange={(e) => setCreateForm((f) => ({ ...f, assignedTo: e.target.value }))} className="mt-1">
                    <option value="">-- Chọn nhân viên --</option>
                    {teamUsers.map((u) => <option key={u.id} value={u.name}>{u.name} ({u.role === 'manager' ? 'Trưởng nhóm' : 'Nhân viên'})</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Hạn chót</Label>
                  <Input type="date" value={createForm.deadline} onChange={(e) => setCreateForm((f) => ({ ...f, deadline: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Mục tiêu đàm phán</Label>
                <Textarea value={createForm.targetObjective} onChange={(e) => setCreateForm((f) => ({ ...f, targetObjective: e.target.value }))} placeholder="Kết quả kỳ vọng đạt được..." rows={2} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Lập trường ban đầu (chúng ta)</Label>
                  <Textarea value={createForm.ourPosition} onChange={(e) => setCreateForm((f) => ({ ...f, ourPosition: e.target.value }))} rows={2} className="mt-1" />
                </div>
                <div>
                  <Label>Lập trường ban đầu (đối phương)</Label>
                  <Textarea value={createForm.theirPosition} onChange={(e) => setCreateForm((f) => ({ ...f, theirPosition: e.target.value }))} rows={2} className="mt-1" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)}>Hủy</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Đang lưu...' : 'Tạo yêu cầu'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add update dialog */}
      <Dialog open={!!updateTarget} onOpenChange={(open) => { if (!open) { setUpdateTarget(null); setUploadFiles([]); } }}>
        <DialogContent onClose={() => { setUpdateTarget(null); setUploadFiles([]); }} className="max-w-xl">
          <form onSubmit={handleAddUpdate}>
            <DialogHeader>
              <DialogTitle>Thêm cập nhật đàm phán</DialogTitle>
              {updateTarget && <p className="text-sm text-muted-foreground mt-1">{updateTarget.subject}</p>}
            </DialogHeader>
            <div className="px-6 pb-2 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Người cập nhật <span className="text-red-500">*</span></Label>
                  <Input value={updateForm.updatedBy} onChange={(e) => setUpdateForm((f) => ({ ...f, updatedBy: e.target.value }))} placeholder="Tên nhân viên" className="mt-1" required />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-orange-500" />
                    Thời điểm nhà máy phản hồi
                  </Label>
                  <Input
                    type="datetime-local"
                    value={updateForm.factoryResponseAt}
                    onChange={(e) => setUpdateForm((f) => ({ ...f, factoryResponseAt: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Lập trường chúng ta</Label>
                  <Textarea value={updateForm.ourPosition} onChange={(e) => setUpdateForm((f) => ({ ...f, ourPosition: e.target.value }))} rows={2} className="mt-1" placeholder="Vị thế hiện tại..." />
                </div>
                <div>
                  <Label>Phản hồi từ nhà máy</Label>
                  <Textarea value={updateForm.theirPosition} onChange={(e) => setUpdateForm((f) => ({ ...f, theirPosition: e.target.value }))} rows={2} className="mt-1" placeholder="Nhà máy trả lời gì..." />
                </div>
              </div>
              <div>
                <Label>Kết quả vòng này</Label>
                <Textarea value={updateForm.outcome} onChange={(e) => setUpdateForm((f) => ({ ...f, outcome: e.target.value }))} rows={2} className="mt-1" placeholder="Đã đạt được gì..." />
              </div>
              <div>
                <Label>Bước tiếp theo</Label>
                <Textarea value={updateForm.nextSteps} onChange={(e) => setUpdateForm((f) => ({ ...f, nextSteps: e.target.value }))} rows={2} className="mt-1" placeholder="Kế hoạch tiếp theo..." />
              </div>

              {/* File upload area */}
              <div>
                <Label className="flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Đính kèm ảnh / tài liệu (chat WeChat, email...)
                </Label>
                <div className="mt-1">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Chọn file hoặc kéo thả vào đây</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, PDF, DOCX... tối đa 30MB/file</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        setUploadFiles((prev) => [...prev, ...files]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {uploadFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {uploadFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1">
                          <span className="truncate flex-1">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setUploadFiles((prev) => prev.filter((_, j) => j !== i))}
                            className="ml-2 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setUpdateTarget(null); setUploadFiles([]); }}>Hủy</Button>
              <Button type="submit" disabled={loading || uploading}>
                {uploading ? 'Đang upload...' : loading ? 'Đang lưu...' : 'Lưu cập nhật'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Communication Tab ----
function CommunicationTab({ engagementId }: { engagementId: string }) {
  const [comms, setComms] = useState<FactoryCommunication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    channel: 'email' as CommunicationChannel, direction: 'outgoing' as CommunicationDirection, loggedBy: '', subject: '', summary: '',
  });

  useEffect(() => {
    api.engagements.communications.list(engagementId).then(setComms).catch(() => {});
  }, [engagementId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const comm = await api.engagements.communications.create(engagementId, { ...form, actionItems: [] });
      setComms((prev) => [comm, ...prev]);
      setShowForm(false);
      toast.success('Đã ghi nhận giao tiếp!');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa bản ghi này?')) return;
    await api.engagements.communications.delete(id);
    setComms((prev) => prev.filter((c) => c.id !== id));
  };

  const DIRECTION_ICON: Record<string, string> = { outgoing: '↗', incoming: '↙' };
  const DIRECTION_COLOR: Record<string, string> = { outgoing: 'text-blue-600', incoming: 'text-green-600' };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5"><Plus className="h-4 w-4" />Ghi nhận giao tiếp</Button>
      </div>

      {comms.length === 0 && <p className="text-center py-10 text-muted-foreground">Chưa có giao tiếp nào được ghi nhận</p>}
      {comms.map((comm) => (
        <div key={comm.id} className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-bold ${DIRECTION_COLOR[comm.direction]}`}>{DIRECTION_ICON[comm.direction]}</span>
              <span className="text-sm font-medium">{CHANNEL_LABEL[comm.channel] || comm.channel}</span>
              <span className="text-sm text-muted-foreground">· {comm.subject}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{comm.loggedAt?.slice(0, 10)}</span>
              <button onClick={() => handleDelete(comm.id)} className="text-destructive hover:opacity-70 text-xs">✕</button>
            </div>
          </div>
          {comm.loggedBy && <p className="text-xs text-muted-foreground">Ghi bởi: {comm.loggedBy}</p>}
          {comm.summary && <p className="text-sm">{comm.summary}</p>}
          {comm.actionItems && comm.actionItems.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Action items:</p>
              {comm.actionItems.map((ai, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={ai.done ? 'text-green-500' : 'text-amber-500'}>{ai.done ? '✓' : '○'}</span>
                  <span className={ai.done ? 'line-through text-muted-foreground' : ''}>{ai.what}</span>
                  {ai.who && <span className="text-muted-foreground text-xs">({ai.who})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent onClose={() => setShowForm(false)} className="max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader><DialogTitle>Ghi nhận giao tiếp với nhà máy</DialogTitle></DialogHeader>
            <div className="px-6 pb-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kênh</Label>
                  <Select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as CommunicationChannel }))} className="mt-1">
                    <option value="email">Email</option>
                    <option value="phone-call">Điện thoại</option>
                    <option value="zalo">Zalo</option>
                    <option value="wechat">WeChat</option>
                    <option value="wechat-video">WeChat Video</option>
                    <option value="in-person-visit">Gặp trực tiếp</option>
                    <option value="other">Khác</option>
                  </Select>
                </div>
                <div>
                  <Label>Hướng</Label>
                  <Select value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as CommunicationDirection }))} className="mt-1">
                    <option value="outgoing">Gửi đi (↗)</option>
                    <option value="incoming">Nhận vào (↙)</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Người ghi nhận</Label>
                <Input value={form.loggedBy} onChange={(e) => setForm((f) => ({ ...f, loggedBy: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Chủ đề</Label>
                <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Tóm tắt nội dung</Label>
                <Textarea value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} rows={3} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Hủy</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Đang lưu...' : 'Lưu'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Main Page ----
export function EngagementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const fromProject = (location.state as { from?: string; projectId?: string } | null)?.from === 'project';
  const sourceProjectId = (location.state as { from?: string; projectId?: string } | null)?.projectId;
  const [engagement, setEngagement] = useState<FactoryEngagementWithFactory | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rfq');

  useEffect(() => {
    if (!id) return;
    api.engagements.get(id)
      .then(setEngagement)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: FactoryEngagementWithFactory['status']) => {
    if (!engagement) return;
    try {
      const updated = await api.engagements.update(engagement.id, { status });
      setEngagement(updated);
      toast.success('Đã cập nhật trạng thái');
    } catch (err) { toast.error('Không thể cập nhật'); }
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Đang tải...</div>;
  if (!engagement) return <div className="text-center py-20 text-muted-foreground">Không tìm thấy engagement</div>;

  return (
    <div className="space-y-6">
      {/* Back */}
      <div>
        {fromProject && sourceProjectId ? (
          <Link to={`/projects/${sourceProjectId}`} state={{ tab: 'factory' }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4" /> Quay lại dự án
          </Link>
        ) : (
          <Link to={`/factories/${engagement.factoryId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4" /> {engagement.factoryName}
          </Link>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{SCOPE_LABEL[engagement.scope] || engagement.scope}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{engagement.scopeDescription}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {engagement.factoryShortName || engagement.factoryName} · {engagement.factoryCountry} · {engagement.internalOwner}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select
              value={engagement.status}
              onChange={(e) => updateStatus(e.target.value as FactoryEngagementWithFactory['status'])}
              className="h-8 text-sm"
            >
              {Object.entries(ENG_STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground">Bắt đầu</div>
          <div className="font-medium text-sm">{engagement.startDate}</div>
        </div>
        <div className="border rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground">Mục tiêu hoàn thành</div>
          <div className="font-medium text-sm">{engagement.targetCompletionDate || '—'}</div>
        </div>
        <div className="border rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground">Giá chốt</div>
          <div className="font-medium text-sm">
            {engagement.finalUnitPrice ? `${engagement.finalUnitPrice.toLocaleString()} ${engagement.currency}` : '—'}
          </div>
        </div>
        <div className="border rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground">MOQ chốt</div>
          <div className="font-medium text-sm">{engagement.finalMOQ ? engagement.finalMOQ.toLocaleString() : '—'}</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="rfq" className="gap-1.5"><FileText className="h-4 w-4" />Báo giá (RFQ)</TabsTrigger>
          <TabsTrigger value="negotiation" className="gap-1.5"><BarChart3 className="h-4 w-4" />Đàm phán</TabsTrigger>
          <TabsTrigger value="samples" className="gap-1.5"><Package className="h-4 w-4" />Mẫu</TabsTrigger>
          <TabsTrigger value="communication" className="gap-1.5"><MessageSquare className="h-4 w-4" />Giao tiếp</TabsTrigger>
          <TabsTrigger value="production" className="gap-1.5"><Factory className="h-4 w-4" />Tiến độ SX</TabsTrigger>
          <TabsTrigger value="documentation" className="gap-1.5"><FileCheck className="h-4 w-4" />Giấy tờ</TabsTrigger>
          <TabsTrigger value="shipping" className="gap-1.5"><Truck className="h-4 w-4" />Vận chuyển</TabsTrigger>
        </TabsList>
        <TabsContent value="rfq" className="mt-4"><RFQTab engagementId={engagement.id} /></TabsContent>
        <TabsContent value="negotiation" className="mt-4"><NegotiationTab engagementId={engagement.id} /></TabsContent>
        <TabsContent value="samples" className="mt-4"><SampleTab engagementId={engagement.id} /></TabsContent>
        <TabsContent value="communication" className="mt-4"><CommunicationTab engagementId={engagement.id} /></TabsContent>
        <TabsContent value="production" className="mt-4"><ProductionTab engagementId={engagement.id} /></TabsContent>
        <TabsContent value="documentation" className="mt-4"><DocumentationTab engagementId={engagement.id} /></TabsContent>
        <TabsContent value="shipping" className="mt-4"><ShippingTab engagementId={engagement.id} /></TabsContent>
      </Tabs>
    </div>
  );
}
