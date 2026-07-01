import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ProjectChatProps {
  projectId: string;
}

export function ProjectChat({ projectId }: ProjectChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setError(null);

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStreaming(true);

    // Add empty assistant message that we'll fill via streaming
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const response = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Lỗi kết nối' }));
        throw new Error(err.error ?? 'Server error');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + data.text,
                };
                return updated;
              });
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      // Remove the empty assistant message on error
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1].role === 'assistant' && !updated[updated.length - 1].content) {
          return updated.slice(0, -1);
        }
        return updated;
      });
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const SUGGESTED_QUESTIONS = [
    'Tiến độ tổng thể của dự án như thế nào?',
    'Có công việc nào đang bị chặn không?',
    'Những rủi ro nào cần chú ý nhất?',
    'Giai đoạn nào đang chậm tiến độ?',
  ];

  return (
    <div className="flex flex-col h-[600px] border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Trợ lý AI dự án</p>
          <p className="text-xs text-muted-foreground">Hỏi bất cứ điều gì về dự án này</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-medium">Chào! Tôi là trợ lý AI của dự án.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tôi có thể trả lời mọi câu hỏi về tiến độ, công việc, rủi ro và tài liệu của dự án này.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="text-left text-xs px-3 py-2 rounded-lg border hover:bg-muted/50 hover:border-primary/30 transition-colors text-muted-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex items-start gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}
          >
            {/* Avatar */}
            <div className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
              msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
            )}>
              {msg.role === 'user'
                ? <User className="h-4 w-4" />
                : <Bot className="h-4 w-4 text-muted-foreground" />
              }
            </div>

            {/* Bubble */}
            <div className={cn(
              'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-muted rounded-tl-sm',
            )}>
              {msg.content
                ? <MessageContent content={msg.content} />
                : streaming && i === messages.length - 1
                  ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  : null
              }
            </div>
          </div>
        ))}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-3 flex items-end gap-2 bg-background">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hỏi về dự án... (Enter để gửi, Shift+Enter xuống dòng)"
          className="min-h-[40px] max-h-[120px] resize-none text-sm"
          rows={1}
          disabled={streaming}
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={!input.trim() || streaming}
          className="shrink-0 h-10 w-10"
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// Render assistant markdown-lite: bold, newlines, code
function MessageContent({ content }: { content: string }) {
  // Split on code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-1 whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const code = part.slice(3, -3).replace(/^\w+\n/, '');
          return (
            <pre key={i} className="bg-background/50 rounded p-2 text-xs overflow-x-auto font-mono border">
              {code}
            </pre>
          );
        }
        // Render **bold** inline
        const segments = part.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i}>
            {segments.map((seg, j) =>
              seg.startsWith('**') && seg.endsWith('**')
                ? <strong key={j}>{seg.slice(2, -2)}</strong>
                : seg
            )}
          </span>
        );
      })}
    </div>
  );
}
