import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Moon, Sun, Search, FlaskConical, Factory, LogOut, Users,
  ChevronDown, Settings, Activity, FileCheck2, Bell, CheckCircle2, XCircle, Briefcase,
} from 'lucide-react';
import { Button } from '../ui/button';
import { useAppStore } from '../../stores/useAppStore';
import { QuickSearch } from '../dashboard/QuickSearch';
import { cn, formatDate } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import type { AppNotification } from '@rd/shared';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Quản trị viên',
  manager: 'Trưởng nhóm',
  employee: 'Nhân viên',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  employee: 'bg-green-100 text-green-700',
};

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { darkMode, toggleDarkMode, searchOpen, setSearchOpen } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, canManage } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load pending approvals count for admin/manager
  useEffect(() => {
    if (!canManage) return;
    api.approvals.list()
      .then((list) => setPendingApprovals(list.length))
      .catch(() => {});
    const interval = setInterval(() => {
      api.approvals.list().then((list) => setPendingApprovals(list.length)).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [canManage]);

  // Load unread notification count for current user
  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      api.notifications.unreadCount(user.id).then((r) => setUnreadCount(r.count)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Open notification panel — load full list and mark read
  const handleOpenNotif = async () => {
    if (!user) return;
    setNotifOpen((prev) => !prev);
    if (!notifOpen) {
      try {
        const list = await api.notifications.list(user.id);
        setNotifications(list);
        setUnreadCount(0);
        api.notifications.markAllRead(user.id).catch(() => {});
      } catch { /* ignore */ }
    }
  };

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setSearchOpen]);

  // Close user menu on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top navigation */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <FlaskConical className="h-5 w-5 text-primary" />
            <span className="hidden sm:block">R&D Manager</span>
          </Link>

          <div className="flex-1" />

          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              'hidden md:flex items-center gap-2 text-sm text-muted-foreground',
              'border rounded-md px-3 py-1.5 hover:bg-accent transition-colors min-w-[200px]'
            )}
          >
            <Search className="h-4 w-4" />
            <span>Tìm kiếm...</span>
            <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            <Link to="/">
              <Button
                variant={location.pathname === '/' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:block">Dashboard</span>
              </Button>
            </Link>
            <Link to="/workspace">
              <Button
                variant={location.pathname === '/workspace' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
              >
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:block">Công việc</span>
              </Button>
            </Link>
            <Link to="/factories">
              <Button
                variant={location.pathname.startsWith('/factories') ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
              >
                <Factory className="h-4 w-4" />
                <span className="hidden sm:block">Nhà máy</span>
              </Button>
            </Link>
            {isAdmin && (
              <Link to="/rd-overview">
                <Button
                  variant={location.pathname === '/rd-overview' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1.5"
                >
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:block">Tổng quát</span>
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link to="/users">
                <Button
                  variant={location.pathname === '/users' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1.5"
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:block">Người dùng</span>
                </Button>
              </Link>
            )}
            {canManage && (
              <Link to="/approvals">
                <Button
                  variant={location.pathname === '/approvals' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1.5 relative"
                >
                  <FileCheck2 className="h-4 w-4" />
                  <span className="hidden sm:block">Phê duyệt</span>
                  {pendingApprovals > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {pendingApprovals > 9 ? '9+' : pendingApprovals}
                    </span>
                  )}
                </Button>
              </Link>
            )}
          </nav>

          {/* Notification bell — visible to all users */}
          {user && (
            <div className="relative" ref={notifRef}>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={handleOpenNotif}
                title="Thông báo"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-popover border rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <p className="text-sm font-semibold">Thông báo</p>
                    {notifications.some((n) => !n.isRead) && (
                      <button
                        onClick={() => {
                          if (user) api.notifications.markAllRead(user.id).catch(() => {});
                          setNotifications((ns) => ns.map((n) => ({ ...n, isRead: true })));
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Đánh dấu đọc tất cả
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Chưa có thông báo nào
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={cn(
                            'px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-accent transition-colors',
                            !n.isRead && 'bg-blue-50/50 dark:bg-blue-900/10'
                          )}
                          onClick={() => {
                            if (n.projectId) {
                              navigate(`/projects/${n.projectId}`);
                              setNotifOpen(false);
                            }
                          }}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={cn(
                              'h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                              n.type === 'task_approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                            )}>
                              {n.type === 'task_approved'
                                ? <CheckCircle2 className="h-3.5 w-3.5" />
                                : <XCircle className="h-3.5 w-3.5" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold leading-tight">{n.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{formatDate(n.createdAt)}</p>
                            </div>
                            {!n.isRead && (
                              <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dark mode toggle */}
          <Button variant="ghost" size="icon" onClick={toggleDarkMode} title="Chuyển chế độ sáng/tối">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* User menu */}
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent transition-colors"
              >
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: user.avatarColor }}
                >
                  {initials}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLOR[user.role] ?? ''}`}>
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-popover border rounded-md shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  {isAdmin && (
                    <Link
                      to="/users"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Quản lý người dùng
                    </Link>
                  )}
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Quick Search Modal */}
      {searchOpen && <QuickSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
