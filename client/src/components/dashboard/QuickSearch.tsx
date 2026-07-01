import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderKanban, CheckSquare, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { SearchResult } from '@rd/shared';
import { cn } from '../../lib/utils';

interface QuickSearchProps {
  onClose: () => void;
}

export function QuickSearch({ onClose }: QuickSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ projects: [], tasks: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ projects: [], tasks: [] });
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.search(query);
        setResults(res);
        setSelectedIndex(0);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const allItems = [
    ...results.projects.map((p) => ({ type: 'project' as const, item: p })),
    ...results.tasks.map((t) => ({ type: 'task' as const, item: t })),
  ];

  const handleSelect = (index: number) => {
    const selected = allItems[index];
    if (!selected) return;

    if (selected.type === 'project') {
      navigate(`/projects/${selected.item.id}`);
    } else {
      const task = selected.item as (typeof results.tasks)[0];
      navigate(`/projects/${task.projectId}`);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      handleSelect(selectedIndex);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl mx-4 bg-background rounded-xl border shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm kiếm dự án, công việc..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && (
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
          <button onClick={onClose}>
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {allItems.length === 0 && query.trim().length >= 2 && !loading && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả cho "{query}"
            </div>
          )}

          {query.trim().length < 2 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nhập ít nhất 2 ký tự để tìm kiếm
            </div>
          )}

          {results.projects.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Dự án
              </div>
              {results.projects.map((project, i) => (
                <button
                  key={project.id}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent',
                    selectedIndex === i && 'bg-accent'
                  )}
                  onClick={() => { navigate(`/projects/${project.id}`); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{project.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{project.productCategory}</span>
                </button>
              ))}
            </div>
          )}

          {results.tasks.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-t">
                Công việc
              </div>
              {results.tasks.map((task, i) => {
                const idx = results.projects.length + i;
                return (
                  <button
                    key={task.id}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent',
                      selectedIndex === idx && 'bg-accent'
                    )}
                    onClick={() => { navigate(`/projects/${task.projectId}`); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{task.title}</div>
                      <div className="text-xs text-muted-foreground">{task.projectName}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t flex items-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="bg-muted px-1 rounded">↑↓</kbd> di chuyển</span>
          <span><kbd className="bg-muted px-1 rounded">Enter</kbd> chọn</span>
          <span><kbd className="bg-muted px-1 rounded">Esc</kbd> đóng</span>
        </div>
      </div>
    </div>
  );
}
