import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, MapPin, Star, Phone, Mail, Plus, Trash2, Edit2, MessageCircle, Users, CheckCircle, XCircle, QrCode, Upload, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { api } from '../lib/api';
import type { Factory, FactoryContact, FactoryEngagementWithFactory, WechatGroup } from '@rd/shared';

const STATUS_LABEL: Record<string, string> = {
  active: 'Đang hợp tác', inactive: 'Không hoạt động', blacklisted: 'Từ chối',
};
const ENGAGEMENT_STATUS_LABEL: Record<string, string> = {
  sourcing: 'Tìm kiếm', quoting: 'Đang báo giá', negotiating: 'Đàm phán',
  sampling: 'Lấy mẫu', approved: 'Đã phê duyệt', 'in-production': 'Đang sản xuất',
  completed: 'Hoàn thành', cancelled: 'Đã hủy',
};
const ENGAGEMENT_STATUS_COLOR: Record<string, string> = {
  sourcing: 'bg-gray-100 text-gray-600', quoting: 'bg-blue-100 text-blue-700',
  negotiating: 'bg-amber-100 text-amber-700', sampling: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700', 'in-production': 'bg-teal-100 text-teal-700',
  completed: 'bg-green-200 text-green-800', cancelled: 'bg-red-100 text-red-700',
};

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-4 w-4 ${s <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  );
}

function ContactFormDialog({
  open, onOpenChange, factoryId, contact, onSuccess,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  factoryId: string; contact?: FactoryContact;
  onSuccess: (c: FactoryContact) => void;
}) {
  const isEdit = !!contact;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: contact?.name ?? '',
    role: contact?.role ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    zalo: contact?.zalo ?? '',
    wechat: contact?.wechat ?? '',
    isPrimary: contact?.isPrimary ?? false,
    notes: contact?.notes ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Tên liên hệ không được để trống'); return; }
    setLoading(true);
    try {
      const result = isEdit
        ? await api.factories.contacts.update(contact!.id, form)
        : await api.factories.contacts.create(factoryId, form);
      toast.success(isEdit ? 'Đã cập nhật!' : 'Đã thêm liên hệ!');
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
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Chỉnh sửa liên hệ' : 'Thêm người liên hệ'}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-3">
            <div>
              <Label>Họ tên *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Chức vụ</Label>
                <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="VD: Sales Manager" className="mt-1" />
              </div>
              <div>
                <Label>Điện thoại</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Zalo</Label>
                <Input value={form.zalo} onChange={(e) => setForm((f) => ({ ...f, zalo: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>WeChat</Label>
              <Input value={form.wechat} onChange={(e) => setForm((f) => ({ ...f, wechat: e.target.value }))} className="mt-1" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))} className="rounded" />
              Đặt làm liên hệ chính
            </label>
            <div>
              <Label>Ghi chú</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm liên hệ'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WechatGroupFormDialog({
  open, onOpenChange, factoryId, group, onSuccess,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  factoryId: string; group?: WechatGroup;
  onSuccess: (g: WechatGroup) => void;
}) {
  const isEdit = !!group;
  const [loading, setLoading] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [removingQr, setRemovingQr] = useState(false);
  const [form, setForm] = useState({
    groupName: group?.groupName ?? '',
    purpose: group?.purpose ?? '',
    ourMembers: group?.ourMembers ?? '',
    theirMembers: group?.theirMembers ?? '',
    active: group?.active ?? true,
    notes: group?.notes ?? '',
  });

  useEffect(() => {
    setForm({
      groupName: group?.groupName ?? '',
      purpose: group?.purpose ?? '',
      ourMembers: group?.ourMembers ?? '',
      theirMembers: group?.theirMembers ?? '',
      active: group?.active ?? true,
      notes: group?.notes ?? '',
    });
    setQrFile(null);
    setQrPreview(null);
    setRemovingQr(false);
  }, [group, open]);

  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrFile(file);
    setRemovingQr(false);
    const reader = new FileReader();
    reader.onload = (ev) => setQrPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.groupName.trim()) { toast.error('Tên nhóm không được để trống'); return; }
    setLoading(true);
    try {
      // 1. Create / update group info
      let result = isEdit
        ? await api.factories.wechatGroups.update(group!.id, form)
        : await api.factories.wechatGroups.create(factoryId, form);

      // 2. Handle QR changes
      if (removingQr && isEdit && group!.qrCodePath) {
        result = await api.factories.wechatGroups.removeQr(result.id);
      } else if (qrFile) {
        result = await api.factories.wechatGroups.uploadQr(result.id, qrFile);
      }

      toast.success(isEdit ? 'Đã cập nhật nhóm!' : 'Đã thêm nhóm WeChat!');
      onSuccess(result);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  // Current QR to display in edit mode
  const currentQrUrl = isEdit && group?.qrCodePath ? `/api/files/${group.qrCodePath}` : null;
  const showQr = qrPreview ?? (removingQr ? null : currentQrUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Chỉnh sửa nhóm WeChat' : 'Thêm nhóm WeChat'}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-3 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>Tên nhóm *</Label>
              <Input value={form.groupName} onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))} placeholder="VD: HANOPHARMA × R&D — SX VitaPro" className="mt-1" autoFocus />
            </div>
            <div>
              <Label>Mục đích nhóm</Label>
              <Input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} placeholder="VD: Theo dõi đơn hàng sản xuất, QC, giao hàng" className="mt-1" />
            </div>
            <div>
              <Label>Thành viên phía mình</Label>
              <Input value={form.ourMembers} onChange={(e) => setForm((f) => ({ ...f, ourMembers: e.target.value }))} placeholder="VD: Nguyễn Văn An, Trần Thị Bình" className="mt-1" />
            </div>
            <div>
              <Label>Thành viên phía nhà máy</Label>
              <Input value={form.theirMembers} onChange={(e) => setForm((f) => ({ ...f, theirMembers: e.target.value }))} placeholder="VD: Lisa Chen, Wang Wei" className="mt-1" />
            </div>

            {/* QR Code upload */}
            <div>
              <Label className="flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5" /> QR Code tham gia nhóm
              </Label>
              <div className="mt-1.5">
                {showQr ? (
                  <div className="relative inline-block">
                    <img
                      src={showQr}
                      alt="QR Code"
                      className="w-32 h-32 object-contain border rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => { setQrFile(null); setQrPreview(null); setRemovingQr(true); }}
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <label className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      <Upload className="h-3 w-3" /> Thay ảnh khác
                      <input type="file" accept="image/*" className="hidden" onChange={handleQrFileChange} />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                    <QrCode className="h-8 w-8 text-muted-foreground/40 mb-1" />
                    <span className="text-[10px] text-muted-foreground text-center leading-tight px-2">Upload ảnh QR code</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleQrFileChange} />
                  </label>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded" />
              Nhóm đang hoạt động
            </label>
            <div>
              <Label>Ghi chú</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="VD: Nhóm tạo ngày 15/5/2024, dùng để báo cáo tiến độ hàng tuần" rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm nhóm'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FactoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [factory, setFactory] = useState<(Factory & { contacts: FactoryContact[]; wechatGroups: WechatGroup[]; stats: Record<string, unknown>; engagements: FactoryEngagementWithFactory[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<FactoryContact | undefined>();
  const [showWechatForm, setShowWechatForm] = useState(false);
  const [editingWechat, setEditingWechat] = useState<WechatGroup | undefined>();
  const [activeTab, setActiveTab] = useState('contacts');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteFactory = async () => {
    if (!factory) return;
    setDeleting(true);
    try {
      await api.factories.delete(factory.id);
      toast.success(`Đã xóa nhà máy "${factory.name}"`);
      navigate('/factories');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể xóa');
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    api.factories.get(id)
      .then(setFactory)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDeleteWechat = async (groupId: string) => {
    if (!confirm('Xóa nhóm WeChat này?')) return;
    try {
      await api.factories.wechatGroups.delete(groupId);
      setFactory((prev) => prev ? { ...prev, wechatGroups: prev.wechatGroups.filter((g) => g.id !== groupId) } : prev);
      toast.success('Đã xóa nhóm WeChat');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Xóa liên hệ này?')) return;
    try {
      await api.factories.contacts.delete(contactId);
      setFactory((prev) => prev ? { ...prev, contacts: prev.contacts.filter((c) => c.id !== contactId) } : prev);
      toast.success('Đã xóa liên hệ');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Đang tải...</div>;
  if (!factory) return <div className="text-center py-20 text-muted-foreground">Không tìm thấy nhà máy</div>;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link to="/factories" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{factory.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {factory.shortName && <span className="text-muted-foreground text-sm">({factory.shortName})</span>}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${factory.status === 'active' ? 'bg-green-100 text-green-700' : factory.status === 'blacklisted' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABEL[factory.status]}
              </span>
              <StarRating value={factory.rating} />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa nhà máy
          </Button>
        </div>

        {/* Confirm delete dialog */}
        {showDeleteConfirm && (
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
                <span className="font-semibold block truncate max-w-full" title={factory.name}>"{factory.name}"</span>{' '}
                không?
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Hủy</Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteFactory} disabled={deleting}>
                  {deleting ? 'Đang xóa...' : 'Xóa nhà máy'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Địa chỉ</div>
          <div className="text-sm font-medium flex items-start gap-1">
            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
            {factory.address || factory.country}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">MOQ / Lead time</div>
          <div className="text-sm font-medium">
            {factory.moqDefault ? factory.moqDefault.toLocaleString() : '—'}
            {factory.leadTimeDays ? ` / ${factory.leadTimeDays} ngày` : ''}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Thanh toán</div>
          <div className="text-sm font-medium">{factory.paymentTerms || '—'}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Engagement</div>
          <div className="text-2xl font-bold">{factory.engagements?.length ?? 0}</div>
        </div>
      </div>

      {/* Specialties & Certifications */}
      {(factory.specialties.length > 0 || factory.certifications.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {factory.specialties.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
          {factory.certifications.map((c) => <Badge key={c} className="bg-blue-50 text-blue-700 border-blue-200">{c}</Badge>)}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="contacts">Liên hệ ({factory.contacts.length})</TabsTrigger>
          <TabsTrigger value="wechat">
            <MessageCircle className="h-3.5 w-3.5 mr-1" />
            Nhóm WeChat ({factory.wechatGroups.length})
          </TabsTrigger>
          <TabsTrigger value="history">Lịch sử ({factory.engagements?.length ?? 0})</TabsTrigger>
          {factory.notes && <TabsTrigger value="notes">Ghi chú</TabsTrigger>}
        </TabsList>

        {/* Contacts */}
        <TabsContent value="contacts" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => { setEditingContact(undefined); setShowContactForm(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" /> Thêm liên hệ
            </Button>
          </div>
          {factory.contacts.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">Chưa có liên hệ nào</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {factory.contacts.map((contact) => (
                <div key={contact.id} className={`border rounded-lg p-4 ${contact.isPrimary ? 'border-primary/30 bg-primary/5' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{contact.name}</span>
                        {contact.isPrimary && <Badge className="text-xs bg-primary/10 text-primary border-0">Chính</Badge>}
                      </div>
                      {contact.role && <p className="text-sm text-muted-foreground">{contact.role}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingContact(contact); setShowContactForm(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteContact(contact.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {contact.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{contact.phone}</div>}
                    {contact.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{contact.email}</div>}
                    {contact.zalo && <div className="text-xs">Zalo: {contact.zalo}</div>}
                    {contact.wechat && <div className="text-xs">WeChat: {contact.wechat}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* WeChat Groups */}
        <TabsContent value="wechat" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => { setEditingWechat(undefined); setShowWechatForm(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" /> Thêm nhóm WeChat
            </Button>
          </div>
          {factory.wechatGroups.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Chưa có nhóm WeChat nào</p>
              <p className="text-xs mt-1">Thêm nhóm để theo dõi kênh liên lạc với nhà máy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {factory.wechatGroups.map((group) => (
                <div key={group.id} className={`border rounded-lg p-4 ${group.active ? '' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MessageCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{group.groupName}</span>
                          {group.active
                            ? <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle className="h-2.5 w-2.5" />Đang hoạt động</span>
                            : <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500"><XCircle className="h-2.5 w-2.5" />Không hoạt động</span>
                          }
                        </div>
                        {group.purpose && <p className="text-xs text-muted-foreground mt-0.5">{group.purpose}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingWechat(group); setShowWechatForm(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteWechat(group.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-3">
                    {/* QR Code */}
                    {group.qrCodePath && (
                      <div className="flex-shrink-0 flex flex-col items-center gap-1">
                        <div className="w-24 h-24 border rounded-lg overflow-hidden bg-white p-1">
                          <img
                            src={`/api/files/${group.qrCodePath}`}
                            alt="QR tham gia nhóm"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">Quét để<br/>tham gia</span>
                      </div>
                    )}

                    {/* Members */}
                    {(group.ourMembers || group.theirMembers) && (
                      <div className="flex-1 grid grid-cols-1 gap-2 min-w-0">
                        {group.ourMembers && (
                          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md px-3 py-2">
                            <div className="flex items-center gap-1 mb-1">
                              <Users className="h-3 w-3 text-blue-600" />
                              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Phía mình</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{group.ourMembers}</p>
                          </div>
                        )}
                        {group.theirMembers && (
                          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
                            <div className="flex items-center gap-1 mb-1">
                              <Users className="h-3 w-3 text-amber-600" />
                              <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Phía nhà máy</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{group.theirMembers}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {group.notes && <p className="mt-2 text-xs text-muted-foreground border-t pt-2">{group.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-4">
          {!factory.engagements || factory.engagements.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">Chưa có lịch sử làm việc</p>
          ) : (
            <div className="space-y-2">
              {factory.engagements.map((eng) => (
                <Link key={eng.id} to={`/engagements/${eng.id}`} className="block">
                  <div className="border rounded-lg p-4 hover:border-primary/30 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">{(eng as unknown as Record<string, string>)['project_name'] || eng.projectId}</div>
                        <div className="text-xs text-muted-foreground">{eng.scopeDescription || eng.scope}</div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENGAGEMENT_STATUS_COLOR[eng.status] || 'bg-gray-100 text-gray-600'}`}>
                        {ENGAGEMENT_STATUS_LABEL[eng.status] || eng.status}
                      </span>
                    </div>
                    {eng.finalUnitPrice && (
                      <div className="mt-2 text-sm">
                        Giá chốt: {eng.finalUnitPrice.toLocaleString()} {eng.currency}
                        {eng.finalMOQ && ` · MOQ: ${eng.finalMOQ.toLocaleString()}`}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">{eng.startDate}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {factory.notes && (
          <TabsContent value="notes" className="mt-4">
            <div className="border rounded-lg p-4 text-sm whitespace-pre-wrap">{factory.notes}</div>
          </TabsContent>
        )}
      </Tabs>

      <ContactFormDialog
        open={showContactForm}
        onOpenChange={setShowContactForm}
        factoryId={factory.id}
        contact={editingContact}
        onSuccess={(c) => {
          if (editingContact) {
            setFactory((prev) => prev ? { ...prev, contacts: prev.contacts.map((x) => x.id === c.id ? c : x) } : prev);
          } else {
            setFactory((prev) => prev ? { ...prev, contacts: [...prev.contacts, c] } : prev);
          }
          setShowContactForm(false);
        }}
      />

      <WechatGroupFormDialog
        open={showWechatForm}
        onOpenChange={setShowWechatForm}
        factoryId={factory.id}
        group={editingWechat}
        onSuccess={(g) => {
          if (editingWechat) {
            setFactory((prev) => prev ? { ...prev, wechatGroups: prev.wechatGroups.map((x) => x.id === g.id ? g : x) } : prev);
          } else {
            setFactory((prev) => prev ? { ...prev, wechatGroups: [...prev.wechatGroups, g] } : prev);
          }
          setShowWechatForm(false);
        }}
      />
    </div>
  );
}
