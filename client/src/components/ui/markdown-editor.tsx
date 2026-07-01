import React, { useRef, useState } from 'react';
import { marked } from 'marked';
import { Bold, Italic, Heading2, List, ListOrdered, Minus, Eye, Edit3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

marked.setOptions({ breaks: true, gfm: true });

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function MarkdownEditor({ value, onChange, placeholder, rows = 6, className }: MarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insert = (before: string, after = '', defaultText = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || defaultText;
    const newVal = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newVal);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertLine = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const newVal = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(newVal);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + prefix.length, start + prefix.length); });
  };

  const html = marked.parse(value || '') as string;

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        <ToolBtn icon={Bold} title="Đậm (Ctrl+B)" onClick={() => insert('**', '**', 'in đậm')} disabled={mode === 'preview'} />
        <ToolBtn icon={Italic} title="Nghiêng" onClick={() => insert('_', '_', 'nghiêng')} disabled={mode === 'preview'} />
        <ToolBtn icon={Heading2} title="Tiêu đề" onClick={() => insertLine('## ')} disabled={mode === 'preview'} />
        <div className="w-px h-4 bg-border mx-1" />
        <ToolBtn icon={List} title="Danh sách dấu chấm" onClick={() => insertLine('- ')} disabled={mode === 'preview'} />
        <ToolBtn icon={ListOrdered} title="Danh sách số" onClick={() => insertLine('1. ')} disabled={mode === 'preview'} />
        <ToolBtn icon={Minus} title="Đường kẻ ngang" onClick={() => onChange(value + '\n---\n')} disabled={mode === 'preview'} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
          className={cn(
            'flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors',
            'hover:bg-muted border',
            mode === 'preview' ? 'bg-primary text-primary-foreground border-primary' : 'border-transparent'
          )}
        >
          {mode === 'preview' ? <><Edit3 className="h-3 w-3" /> Chỉnh sửa</> : <><Eye className="h-3 w-3" /> Xem trước</>}
        </button>
      </div>

      {/* Editor / Preview */}
      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Nhập nội dung... (hỗ trợ **đậm**, _nghiêng_, ## tiêu đề, - danh sách)'}
          rows={rows}
          className="w-full px-3 py-2.5 text-sm bg-background resize-y outline-none font-mono leading-relaxed"
          style={{ minHeight: `${rows * 1.6}rem` }}
        />
      ) : (
        <div
          className="px-4 py-3 text-sm prose min-h-[8rem]"
          dangerouslySetInnerHTML={{ __html: html || '<p class="text-muted-foreground italic">Chưa có nội dung</p>' }}
        />
      )}

      {/* Footer hint */}
      {mode === 'edit' && (
        <div className="px-3 py-1 border-t bg-muted/20 text-xs text-muted-foreground">
          Markdown: **đậm** · _nghiêng_ · ## tiêu đề · - danh sách · `code`
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon: Icon, title, onClick, disabled }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function MarkdownViewer({ content, className }: { content: string; className?: string }) {
  const html = marked.parse(content || '') as string;
  return (
    <div
      className={cn('prose text-sm', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
