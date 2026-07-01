import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, UserX, UserCheck, Shield, Users, User as UserIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '@rd/shared';
import { Navigate } from 'react-router-dom';

const ROLE_LABEL: Record<string, string> = { admin: 'Quản trị viên', manager: 'Trưởng nhóm', employee: 'Nhân viên' };
const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  employee: 'bg-green-100 text-green-700',
};
const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#0ea5e9', '#f59e0b', '#ef4444'];

function UserAvatar({ user }: { user: User }) {
  const initials = user.name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase();
  return (
    <div
      className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
      style={{ backgroundColor: user.avatarColor }}
    >
      {initials}
    </div>
  );
}

type FormData = { name: string; email: string; password: string; role: string; avatarColor: string };
const EMPTY_FORM: FormData = { name: '', email: '', password: '', role: 'employee', avatarColor: '#6366f1' };

export function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  if (!isAdmin) return <Navigate to="/" replace />;

  useEffect(() => {
    api.users.list().then(setUsers).catch(() => toast.error('Không tải được danh sách người dùng'));
  }, []);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (u: User) => {
    setEditTarget(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, avatarColor: u.avatarColor });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editTarget) {
        const payload: Parameters<typeof api.users.update>[1] = {
          name: form.name, email: form.email, role: form.role, avatarColor: form.avatarColor,
        };
        if (form.password) payload.password = form.password;
        const updated = await api.users.update(editTarget.id, payload);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        toast.success('Đã cập nhật tài khoản!');
      } else {
        const created = await api.users.create({ ...form });
        setUsers((prev) => [...prev, created]);
        toast.success('Đã tạo tài khoản!');
      }
      setShowForm(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
    finally { setLoading(false); }
  };

  const handleToggleActive = async (u: User) => {
    if (u.id === currentUser?.id) { toast.error('Không thể vô hiệu hóa chính mình'); return; }
    try {
      const updated = await api.users.update(u.id, { isActive: !u.isActive });
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(updated.isActive ? 'Đã kích hoạt tài khoản' : 'Đã vô hiệu hóa tài khoản');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Có lỗi'); }
  };

  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" />Quản lý người dùng</h1>
          <p className="text-muted-foreground text-sm mt-1">{activeCount} tài khoản đang hoạt động / {users.length} tổng cộng</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" />Thêm người dùng</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['admin', 'manager', 'employee'] as const).map((role) => {
          const count = users.filter((u) => u.role === role && u.isActive).length;
          const Icon = role === 'admin' ? Shield : role === 'manager' ? UserCheck : UserIcon;
          return (
            <div key={role} className="border rounded-lg p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${ROLE_COLOR[role]} bg-opacity-20`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground">{ROLE_LABEL[role]}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* User table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Người dùng</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Email</th>
              <th className="text-left px-4 py-3">Vai trò</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Trạng thái</th>
              <th className="text-right px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className={`${!u.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={u} />
                    <div>
                      <p className="font-medium">{u.name}</p>
                      {u.id === currentUser?.id && <span className="text-xs text-muted-foreground">(bạn)</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[u.role]}`}>
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <Badge variant={u.isActive ? 'default' : 'secondary'} className="text-xs">
                    {u.isActive ? 'Hoạt động' : 'Vô hiệu'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => handleToggleActive(u)}
                      disabled={u.id === currentUser?.id}
                      title={u.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                    >
                      {u.isActive ? <UserX className="h-3.5 w-3.5 text-red-500" /> : <UserCheck className="h-3.5 w-3.5 text-green-500" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Chưa có người dùng nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent onClose={() => setShowForm(false)} className="max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editTarget ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản mới'}</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-2 space-y-3">
              <div>
                <Label>Họ tên <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nguyễn Văn A" className="mt-1" required />
              </div>
              <div>
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="nva@company.com" className="mt-1" required />
              </div>
              <div>
                <Label>{editTarget ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'} {!editTarget && <span className="text-red-500">*</span>}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" className="mt-1" required={!editTarget} minLength={6} />
              </div>
              <div>
                <Label>Vai trò</Label>
                <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="mt-1">
                  <option value="employee">Nhân viên</option>
                  <option value="manager">Trưởng nhóm</option>
                  <option value="admin">Quản trị viên</option>
                </Select>
              </div>
              <div>
                <Label>Màu avatar</Label>
                <div className="flex gap-2 mt-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color} type="button"
                      className={`h-7 w-7 rounded-full transition-transform ${form.avatarColor === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setForm((f) => ({ ...f, avatarColor: color }))}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Hủy</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Đang lưu...' : editTarget ? 'Cập nhật' : 'Tạo tài khoản'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
