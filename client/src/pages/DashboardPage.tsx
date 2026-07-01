import React, { useState, useEffect } from 'react';
import { Plus, Filter, SortAsc } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { StatsCards } from '../components/dashboard/StatsCards';
import { ProjectCard, ProjectCardSkeleton } from '../components/project/ProjectCard';
import { ProjectForm } from '../components/project/ProjectForm';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardStats, ProjectWithProgress } from '@rd/shared';

export function DashboardPage() {
  const { canManage } = useAuth();
  const [stats, setStats] = useState<DashboardStats | undefined>();
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [sortBy, setSortBy] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, projectsData] = await Promise.all([
        api.dashboard.stats(),
        api.projects.list({
          status: filterStatus || undefined,
          category: filterCategory || undefined,
          brand: filterBrand || undefined,
          sortBy: sortBy || undefined,
        }),
      ]);
      setStats(statsData);
      setProjects(projectsData);
    } catch (err) {
      toast.error('Không thể tải dữ liệu. Kiểm tra server đang chạy chưa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterStatus, filterCategory, filterBrand, sortBy]);

  // Get unique categories and brands from projects
  const categories = Array.from(new Set(projects.map((p) => p.productCategory).filter(Boolean)));
  const brands = Array.from(new Set(projects.map((p) => p.brand).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tổng quan tất cả dự án R&D
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Tạo dự án mới
          </Button>
        )}
      </div>

      {/* Stats */}
      <StatsCards stats={stats} loading={loading} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Lọc:</span>
        </div>

        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-40 h-8 text-xs"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="on-hold">Tạm dừng</option>
          <option value="completed">Hoàn thành</option>
          <option value="cancelled">Đã hủy</option>
        </Select>

        {categories.length > 0 && (
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-44 h-8 text-xs"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
        )}

        {brands.length > 0 && (
          <Select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="w-44 h-8 text-xs"
          >
            <option value="">Tất cả thương hiệu</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
        )}

        <div className="flex items-center gap-1.5 ml-auto text-sm text-muted-foreground">
          <SortAsc className="h-4 w-4" />
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-40 h-8 text-xs"
          >
            <option value="">Mới nhất</option>
            <option value="deadline">Deadline gần nhất</option>
            <option value="name">Tên A-Z</option>
          </Select>
        </div>
      </div>

      {/* Project grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Chưa có dự án nào</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Bấm nút "+ Tạo dự án mới" để bắt đầu dự án R&D đầu tiên của bạn.
          </p>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Tạo dự án đầu tiên
          </Button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            Hiển thị {projects.length} dự án
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      {/* Create Project Form */}
      <ProjectForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
