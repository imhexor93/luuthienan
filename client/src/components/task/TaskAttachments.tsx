import React, { useEffect, useRef, useState } from 'react';
import {
  Paperclip, Upload, Trash2, Download, FileText, Image, File,
  Loader2, Link2, Plus, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import type { TaskAttachment, TaskLink } from '@rd/shared';

// ─── helpers ────────────────────────────────────────────────
function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
  if (mime === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv'))
    return <FileText className="h-4 w-4 text-green-600" />;
  if (mime.includes('word') || mime.includes('document'))
    return <FileText className="h-4 w-4 text-blue-600" />;
  if (mime.includes('presentation') || mime.includes('powerpoint'))
    return <FileText className="h-4 w-4 text-orange-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const LINK_META: Record<string, { label: string; color: string; emoji: string }> = {
  'google-sheet':  { label: 'Google Sheets',      color: 'text-green-600',  emoji: '📊' },
  'google-doc':    { label: 'Google Docs',         color: 'text-blue-600',   emoji: '📄' },
  'google-slides': { label: 'Google Slides',       color: 'text-yellow-600', emoji: '📑' },
  'google-drive':  { label: 'Google Drive',        color: 'text-yellow-500', emoji: '📁' },
  'notion':        { label: 'Notion',              color: 'text-slate-700',  emoji: '📝' },
  'figma':         { label: 'Figma',               color: 'text-purple-600', emoji: '🎨' },
  'confluence':    { label: 'Confluence',          color: 'text-blue-500',   emoji: '📘' },
  'jira':          { label: 'Jira',                color: 'text-blue-700',   emoji: '🎯' },
  'github':        { label: 'GitHub',              color: 'text-gray-800',   emoji: '🐙' },
  'gitlab':        { label: 'GitLab',              color: 'text-orange-600', emoji: '🦊' },
  'trello':        { label: 'Trello',              color: 'text-blue-500',   emoji: '📋' },
  'miro':          { label: 'Miro',                color: 'text-yellow-500', emoji: '🟡' },
  'other':         { label: 'Liên kết',            color: 'text-muted-foreground', emoji: '🔗' },
};

function linkMeta(type: string) {
  return LINK_META[type] ?? LINK_META['other'];
}

// ─── Props ───────────────────────────────────────────────────
interface TaskAttachmentsProps {
  taskId: string;
  addedBy?: string;
  readonly?: boolean;
}

// ─── Main component ──────────────────────────────────────────
export function TaskAttachments({ taskId, addedBy = 'Ẩn danh', readonly = false }: TaskAttachmentsProps) {
  const [tab, setTab] = useState<'files' | 'links'>('files');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.attachments.list(taskId), api.links.list(taskId)])
      .then(([a, l]) => { setAttachments(a); setLinks(l); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [taskId]);

  const totalCount = attachments.length + links.length;

  return (
    <div className="space-y-3">
      {/* Header + tabs */}
      <div className="flex items-center gap-3">
        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Đính kèm {totalCount > 0 && `(${totalCount})`}
        </span>
        <div className="flex items-center border rounded-md overflow-hidden ml-auto">
          <TabBtn active={tab === 'files'} onClick={() => setTab('files')}>
            📎 File {attachments.length > 0 && `(${attachments.length})`}
          </TabBtn>
          <TabBtn active={tab === 'links'} onClick={() => setTab('links')}>
            🔗 Link {links.length > 0 && `(${links.length})`}
          </TabBtn>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
        </div>
      ) : tab === 'files' ? (
        <FilesTab
          taskId={taskId}
          uploadedBy={addedBy}
          attachments={attachments}
          setAttachments={setAttachments}
          readonly={readonly}
        />
      ) : (
        <LinksTab
          taskId={taskId}
          addedBy={addedBy}
          links={links}
          setLinks={setLinks}
          readonly={readonly}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-xs transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
      )}
    >
      {children}
    </button>
  );
}

// ─── Files tab ───────────────────────────────────────────────
function FilesTab({ taskId, uploadedBy, attachments, setAttachments, readonly }: {
  taskId: string;
  uploadedBy: string;
  attachments: TaskAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<TaskAttachment[]>>;
  readonly: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const att = await api.attachments.upload(taskId, file, uploadedBy);
        setAttachments((prev) => [att, ...prev]);
        toast.success(`Đã upload: ${file.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Upload thất bại: ${file.name}`);
      }
    }
    setUploading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.attachments.delete(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success(`Đã xóa: ${name}`);
    } catch { toast.error('Không thể xóa file'); }
  };

  return (
    <div className="space-y-2">
      {!readonly && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg px-4 py-4 text-center cursor-pointer transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30',
            uploading && 'pointer-events-none opacity-60'
          )}
        >
          <input ref={inputRef} type="file" multiple className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading
            ? <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Đang upload...</div>
            : <>
                <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Kéo thả hoặc <span className="text-primary font-medium">chọn file</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">PDF, Word, Excel, PowerPoint, ảnh · Tối đa 20MB</p>
              </>
          }
        </div>
      )}

      {attachments.length === 0
        ? <p className="text-xs text-muted-foreground italic py-1">Chưa có file đính kèm</p>
        : <div className="space-y-1.5">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-2.5 border rounded-lg px-3 py-2 bg-muted/20 group">
                {fileIcon(att.mimetype)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.originalName}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(att.size)} · {att.uploadedBy}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={api.attachments.downloadUrl(att.id)} download={att.originalName} title="Tải xuống">
                    <Button size="icon" variant="ghost" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                  </a>
                  {!readonly && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(att.id, att.originalName)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ─── Links tab ───────────────────────────────────────────────
function LinksTab({ taskId, addedBy, links, setLinks, readonly }: {
  taskId: string;
  addedBy: string;
  links: TaskLink[];
  setLinks: React.Dispatch<React.SetStateAction<TaskLink[]>>;
  readonly: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', url: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.url.trim()) { toast.error('Vui lòng nhập URL'); return; }
    if (!form.title.trim()) { toast.error('Vui lòng nhập tiêu đề'); return; }
    setSaving(true);
    try {
      const link = await api.links.create(taskId, { title: form.title.trim(), url: form.url.trim(), addedBy });
      setLinks((prev) => [link, ...prev]);
      setForm({ title: '', url: '' });
      setShowForm(false);
      toast.success('Đã thêm liên kết');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể thêm liên kết');
    } finally { setSaving(false); }
  };

  const handleUrlChange = (url: string) => {
    setForm((f) => {
      // Auto-fill title from URL type
      if (!f.title) {
        const lower = url.toLowerCase();
        if (lower.includes('spreadsheet')) return { url, title: 'Google Sheets' };
        if (lower.includes('docs.google.com/document')) return { url, title: 'Google Docs' };
        if (lower.includes('docs.google.com/presentation')) return { url, title: 'Google Slides' };
        if (lower.includes('drive.google.com')) return { url, title: 'Google Drive' };
        if (lower.includes('notion.so') || lower.includes('notion.site')) return { url, title: 'Notion' };
        if (lower.includes('figma.com')) return { url, title: 'Figma' };
        if (lower.includes('github.com')) return { url, title: 'GitHub' };
        if (lower.includes('miro.com')) return { url, title: 'Miro Board' };
      }
      return { ...f, url };
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await api.links.delete(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast.success('Đã xóa liên kết');
    } catch { toast.error('Không thể xóa liên kết'); }
  };

  return (
    <div className="space-y-2">
      {/* Add form */}
      {!readonly && (
        showForm ? (
          <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
            <div>
              <Label className="text-xs">URL *</Label>
              <Input
                value={form.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/..."
                className="mt-1 h-8 text-sm"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Tiêu đề *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Tên tài liệu..."
                className="mt-1 h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setForm({ title: '', url: '' }); }}>Hủy</Button>
              <Button type="button" size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Thêm
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full flex items-center gap-2 border-2 border-dashed border-muted-foreground/20 rounded-lg px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-muted/30 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Gắn liên kết tài liệu (Google Drive, Notion, Figma...)
          </button>
        )
      )}

      {/* Quick link type hints */}
      {!readonly && !showForm && (
        <div className="flex flex-wrap gap-1.5">
          {['📊 Google Sheets', '📄 Google Docs', '📁 Google Drive', '📝 Notion', '🎨 Figma', '🐙 GitHub'].map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => setShowForm(true)}
              className="text-xs px-2 py-0.5 rounded-full border border-muted-foreground/20 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              {hint}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {links.length === 0
        ? <p className="text-xs text-muted-foreground italic py-1">Chưa có liên kết nào</p>
        : <div className="space-y-1.5">
            {links.map((link) => {
              const meta = linkMeta(link.linkType);
              return (
                <div key={link.id} className="flex items-center gap-2.5 border rounded-lg px-3 py-2 bg-muted/20 group">
                  <span className="text-base shrink-0">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{link.title}</p>
                    <p className={cn('text-xs truncate', meta.color)}>{meta.label} · {link.addedBy}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" title="Mở liên kết">
                      <Button size="icon" variant="ghost" className="h-7 w-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                    {!readonly && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(link.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}
