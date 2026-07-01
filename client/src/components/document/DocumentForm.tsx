import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { api } from '../../lib/api';
import type { Document, StageWithProgress, CreateDocumentInput } from '@rd/shared';
import { useAppStore } from '../../stores/useAppStore';

interface DocumentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  stages: StageWithProgress[];
  onSuccess: (doc: Document) => void;
}

export function DocumentForm({ open, onOpenChange, projectId, stages, onSuccess }: DocumentFormProps) {
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    stageId: '',
    title: '',
    type: 'other' as CreateDocumentInput['type'],
    url: '',
    uploadedBy: currentUser,
  });

  useEffect(() => {
    if (open) {
      setForm({ stageId: '', title: '', type: 'other', url: '', uploadedBy: currentUser });
    }
  }, [open, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Tiêu đề không được để trống'); return; }
    if (!form.url.trim()) { toast.error('URL không được để trống'); return; }

    const data: CreateDocumentInput = {
      stageId: form.stageId || undefined,
      title: form.title.trim(),
      type: form.type,
      url: form.url.trim(),
      uploadedBy: form.uploadedBy.trim() || currentUser,
    };

    setLoading(true);
    try {
      const result = await api.documents.create(projectId, data);
      toast.success('Đã thêm tài liệu!');
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
            <DialogTitle>Thêm tài liệu</DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-2 space-y-4">
            <div>
              <Label>Tiêu đề *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Tên tài liệu..."
                className="mt-1"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Loại tài liệu</Label>
                <Select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CreateDocumentInput['type'] }))}
                  className="mt-1"
                >
                  <option value="market-research">Nghiên cứu thị trường</option>
                  <option value="technical-spec">Đặc tả kỹ thuật</option>
                  <option value="design">Thiết kế</option>
                  <option value="test-report">Báo cáo kiểm thử</option>
                  <option value="business-case">Business Case</option>
                  <option value="other">Khác</option>
                </Select>
              </div>
              <div>
                <Label>Giai đoạn</Label>
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
              <Label>URL tài liệu *</Label>
              <Input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Link đến Google Drive, Notion, Confluence, v.v.</p>
            </div>

            <div>
              <Label>Người upload</Label>
              <Input
                value={form.uploadedBy}
                onChange={(e) => setForm((f) => ({ ...f, uploadedBy: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Thêm tài liệu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
