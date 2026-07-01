import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, Plus, LayoutGrid, List,
  Calendar, DollarSign, TrendingUp, ExternalLink, User,
  AlertTriangle, FileText, Activity, Sparkles, Factory,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select } from '../components/ui/select';
import { StageTimeline } from '../components/project/StageTimeline';
import { ProjectForm } from '../components/project/ProjectForm';
import { KanbanBoard } from '../components/task/KanbanBoard';
import { TaskListView } from '../components/task/TaskListView';
import { TaskForm } from '../components/task/TaskForm';
import { RiskMatrix } from '../components/risk/RiskMatrix';
import { RiskForm } from '../components/risk/RiskForm';
import { DocumentForm } from '../components/document/DocumentForm';
import { GanttChart } from '../components/gantt/GanttChart';
import { ActivityLogTab } from '../components/project/ActivityLogTab';
import { ProjectChat } from '../components/project/ProjectChat';
import { EngagementTab } from '../components/factory/EngagementTab';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { cn, formatDate, formatCurrency } from '../lib/utils';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, STAGE_COLORS, DOCUMENT_TYPE_LABELS, RISK_SEVERITY_COLORS, RISK_SEVERITY_LABELS, RISK_STATUS_LABELS } from '../lib/constants';
import type { ProjectWithProgress, Task, Risk, Document, StageWithProgress } from '@rd/shared';

export function ProjectDetailPage() {
  const { canManage } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = useState<ProjectWithProgress | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const initialTab = (location.state as { tab?: string } | null)?.tab ?? 'timeline';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [taskView, setTaskView] = useState<'kanban' | 'list'>('kanban');

  // Filter state for tasks
  const [taskFilterStage, setTaskFilterStage] = useState('');
  const [taskFilterPriority, setTaskFilterPriority] = useState('');

  // Dialog states
  const [showEditProject, setShowEditProject] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | undefined>();
  const [showRiskForm, setShowRiskForm] = useState(false);
  const [editRisk, setEditRisk] = useState<Risk | undefined>();
  const [showDocForm, setShowDocForm] = useState(false);
  const [deleteRiskId, setDeleteRiskId] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProject = useCallback(async () => {
    if (!id) return;
    try {
      const [proj, taskList, riskList, docList] = await Promise.all([
        api.projects.get(id),
        api.tasks.list(id),
        api.risks.list(id),
        api.documents.list(id),
      ]);
      setProject(proj);
      setTasks(taskList);
      setRisks(riskList);
      setDocuments(docList);
    } catch {
      toast.error('Không tìm thấy dự án');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setShowTaskForm(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await api.projects.delete(project.id);
      toast.success('Đã xóa dự án');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteRisk = async () => {
    if (!deleteRiskId) return;
    setDeleting(true);
    try {
      await api.risks.delete(deleteRiskId);
      setRisks((prev) => prev.filter((r) => r.id !== deleteRiskId));
      toast.success('Đã xóa rủi ro');
      setDeleteRiskId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteDoc = async () => {
    if (!deleteDocId) return;
    setDeleting(true);
    try {
      await api.documents.delete(deleteDocId);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteDocId));
      toast.success('Đã xóa tài liệu');
      setDeleteDocId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setDeleting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (taskFilterStage && t.stageId !== taskFilterStage) return false;
    if (taskFilterPriority && t.priority !== taskFilterPriority) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (!project) return null;

  const stages = project.stages;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold text-lg">{project.name}</h1>
          <Badge className={cn('ml-1', PROJECT_STATUS_COLORS[project.status])}>
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowEditProject(true)}>
            <Edit className="h-4 w-4" />
            Chỉnh sửa
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setShowDeleteProject(true)}>
            <Trash2 className="h-4 w-4" />
            Xóa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: project info */}
        <aside className="lg:col-span-1 space-y-4">
          {/* Progress circle */}
          <div className="border rounded-xl p-5 text-center">
            <div className="relative inline-flex items-center justify-center mb-3">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={project.progressPercent === 100 ? '#22c55e' : 'hsl(var(--primary))'}
                  strokeWidth="3"
                  strokeDasharray={`${project.progressPercent}, 100`}
                />
              </svg>
              <span className="absolute text-xl font-bold">{project.progressPercent}%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {project.doneTasks}/{project.totalTasks} công việc hoàn thành
            </p>
          </div>

          {/* Project details */}
          <div className="border rounded-xl p-5 space-y-3">
            {project.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}

            <div className="space-y-2 text-sm">
              {project.productCategory && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0 text-xs">Danh mục</span>
                  <span className="font-medium">{project.productCategory}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Bắt đầu</p>
                  <p className="font-medium text-xs">{formatDate(project.startDate)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Ra mắt mục tiêu</p>
                  <p className="font-medium text-xs">{formatDate(project.targetLaunchDate)}</p>
                </div>
              </div>

              {project.budget > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ngân sách</p>
                    <p className="font-medium text-xs">{formatCurrency(project.budget)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stage progress mini list */}
          <div className="border rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-semibold mb-3">Tiến độ các giai đoạn</h3>
            {stages.map((stage, i) => (
              <div key={stage.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[i] }} />
                    <span className="truncate">{stage.name}</span>
                  </span>
                  <span className="text-muted-foreground">{stage.progressPercent}%</span>
                </div>
                <Progress
                  value={stage.progressPercent}
                  className="h-1"
                  indicatorClassName={stage.progressPercent === 100 ? 'bg-green-500' : ''}
                  style={{ '--indicator-color': STAGE_COLORS[i] } as React.CSSProperties}
                />
              </div>
            ))}
          </div>
        </aside>

        {/* Main content: tabs */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto gap-1 mb-2">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="tasks">Công việc ({tasks.length})</TabsTrigger>
              <TabsTrigger value="risks">Rủi ro ({risks.length})</TabsTrigger>
              <TabsTrigger value="documents">Tài liệu ({documents.length})</TabsTrigger>
              <TabsTrigger value="gantt">Gantt</TabsTrigger>
              <TabsTrigger value="activity">Nhật ký</TabsTrigger>
              <TabsTrigger value="factory" className="gap-1.5">
                <Factory className="h-3.5 w-3.5" />Nhà máy
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                AI Chat
              </TabsTrigger>
            </TabsList>

            {/* Timeline tab */}
            <TabsContent value="timeline">
              <StageTimeline
                stages={stages}
                tasks={tasks}
                onStageUpdated={loadProject}
                onTaskUpdated={loadProject}
              />
            </TabsContent>

            {/* Tasks tab */}
            <TabsContent value="tasks">
              <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { setEditTask(undefined); setShowTaskForm(true); }}
                  >
                    <Plus className="h-4 w-4" />
                    Thêm công việc
                    <kbd className="ml-1 text-xs opacity-60 border border-primary-foreground/30 rounded px-1">N</kbd>
                  </Button>

                  <Select
                    value={taskFilterStage}
                    onChange={(e) => setTaskFilterStage(e.target.value)}
                    className="w-44 h-8 text-xs"
                  >
                    <option value="">Tất cả giai đoạn</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>

                  <Select
                    value={taskFilterPriority}
                    onChange={(e) => setTaskFilterPriority(e.target.value)}
                    className="w-36 h-8 text-xs"
                  >
                    <option value="">Tất cả ưu tiên</option>
                    <option value="critical">Khẩn cấp</option>
                    <option value="high">Cao</option>
                    <option value="medium">Trung bình</option>
                    <option value="low">Thấp</option>
                  </Select>

                  <div className="ml-auto flex items-center border rounded-md overflow-hidden">
                    <button
                      className={cn('px-2.5 py-1.5 text-xs transition-colors', taskView === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                      onClick={() => setTaskView('kanban')}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className={cn('px-2.5 py-1.5 text-xs transition-colors', taskView === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                      onClick={() => setTaskView('list')}
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {taskView === 'kanban' ? (
                  <KanbanBoard
                    tasks={filteredTasks}
                    stages={stages}
                    onTaskClick={(task) => { setEditTask(task); setShowTaskForm(true); }}
                    onAddTask={() => { setEditTask(undefined); setShowTaskForm(true); }}
                    onTasksChange={setTasks}
                  />
                ) : (
                  <TaskListView
                    tasks={filteredTasks}
                    stages={stages}
                    onTaskClick={(task) => { setEditTask(task); setShowTaskForm(true); }}
                    onTaskDeleted={(taskId) => setTasks((prev) => prev.filter((t) => t.id !== taskId))}
                  />
                )}
              </div>
            </TabsContent>

            {/* Risks tab */}
            <TabsContent value="risks">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Quản lý rủi ro</h3>
                  <Button size="sm" className="gap-1.5" onClick={() => { setEditRisk(undefined); setShowRiskForm(true); }}>
                    <Plus className="h-4 w-4" />
                    Thêm rủi ro
                  </Button>
                </div>

                {risks.length > 0 && (
                  <RiskMatrix risks={risks} onRiskClick={(r) => { setEditRisk(r); setShowRiskForm(true); }} />
                )}

                {risks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Chưa có rủi ro nào được ghi nhận.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowRiskForm(true)}>
                      Thêm rủi ro đầu tiên
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rủi ro</th>
                          <th className="text-left px-3 py-3 font-medium text-muted-foreground">Mức độ</th>
                          <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden sm:table-cell">Khả năng</th>
                          <th className="text-left px-3 py-3 font-medium text-muted-foreground">Trạng thái</th>
                          <th className="w-20" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {risks.map((risk) => (
                          <tr key={risk.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <p className="font-medium">{risk.title}</p>
                              {risk.mitigation && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{risk.mitigation}</p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <Badge className={cn('text-xs', RISK_SEVERITY_COLORS[risk.severity])}>
                                {RISK_SEVERITY_LABELS[risk.severity]}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                              {risk.likelihood === 'rare' ? 'Hiếm' : risk.likelihood === 'possible' ? 'Có thể' : risk.likelihood === 'likely' ? 'Khả năng' : 'Chắc chắn'}
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground">
                              {RISK_STATUS_LABELS[risk.status]}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditRisk(risk); setShowRiskForm(true); }}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteRiskId(risk.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Documents tab */}
            <TabsContent value="documents">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Tài liệu dự án</h3>
                  <Button size="sm" className="gap-1.5" onClick={() => setShowDocForm(true)}>
                    <Plus className="h-4 w-4" />
                    Thêm tài liệu
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Chưa có tài liệu nào.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowDocForm(true)}>
                      Thêm tài liệu đầu tiên
                    </Button>
                  </div>
                ) : (
                  // Group by stage
                  <div className="space-y-6">
                    {stages.map((stage, stageIdx) => {
                      const stageDocs = documents.filter((d) => d.stageId === stage.id);
                      if (stageDocs.length === 0) return null;
                      return (
                        <div key={stage.id}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STAGE_COLORS[stageIdx] }} />
                            <h4 className="text-sm font-semibold">{stage.name}</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {stageDocs.map((doc) => (
                              <DocumentCard key={doc.id} doc={doc} onDelete={() => setDeleteDocId(doc.id)} />
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Docs without stage */}
                    {documents.filter((d) => !d.stageId).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Không thuộc giai đoạn cụ thể</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {documents.filter((d) => !d.stageId).map((doc) => (
                            <DocumentCard key={doc.id} doc={doc} onDelete={() => setDeleteDocId(doc.id)} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Gantt tab */}
            <TabsContent value="gantt">
              <GanttChart tasks={tasks} stages={stages} />
            </TabsContent>

            {/* Activity log tab */}
            <TabsContent value="activity">
              <ActivityLogTab projectId={project.id} />
            </TabsContent>

            {/* Factory tab */}
            <TabsContent value="factory">
              <EngagementTab projectId={project.id} />
            </TabsContent>

            {/* AI Chat tab */}
            <TabsContent value="chat">
              <ProjectChat projectId={project.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      <ProjectForm
        open={showEditProject}
        onOpenChange={setShowEditProject}
        project={project}
        onSuccess={(updated) => { setProject(updated); }}
      />

      <TaskForm
        open={showTaskForm}
        onOpenChange={(open) => { setShowTaskForm(open); if (!open) setEditTask(undefined); }}
        projectId={project.id}
        stages={stages}
        task={editTask}
        onSuccess={(task) => {
          setTasks((prev) => {
            const exists = prev.find((t) => t.id === task.id);
            return exists ? prev.map((t) => t.id === task.id ? task : t) : [...prev, task];
          });
          loadProject(); // refresh stage progress
        }}
      />

      <RiskForm
        open={showRiskForm}
        onOpenChange={(open) => { setShowRiskForm(open); if (!open) setEditRisk(undefined); }}
        projectId={project.id}
        stages={stages}
        risk={editRisk}
        onSuccess={(risk) => {
          setRisks((prev) => {
            const exists = prev.find((r) => r.id === risk.id);
            return exists ? prev.map((r) => r.id === risk.id ? risk : r) : [...prev, risk];
          });
        }}
      />

      <DocumentForm
        open={showDocForm}
        onOpenChange={setShowDocForm}
        projectId={project.id}
        stages={stages}
        onSuccess={(doc) => setDocuments((prev) => [doc, ...prev])}
      />

      {/* Delete project */}
      <Dialog open={showDeleteProject} onOpenChange={setShowDeleteProject}>
        <DialogContent onClose={() => setShowDeleteProject(false)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa dự án?</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-2 text-sm text-muted-foreground">
            Tất cả công việc, rủi ro, tài liệu và nhật ký hoạt động sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteProject(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteProject} disabled={deleting}>
              {deleting ? 'Đang xóa...' : 'Xóa dự án'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete risk */}
      <Dialog open={!!deleteRiskId} onOpenChange={(open) => !open && setDeleteRiskId(null)}>
        <DialogContent onClose={() => setDeleteRiskId(null)} className="max-w-sm">
          <DialogHeader><DialogTitle>Xóa rủi ro?</DialogTitle></DialogHeader>
          <div className="px-6 py-2 text-sm text-muted-foreground">Hành động này không thể hoàn tác.</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteRiskId(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteRisk} disabled={deleting}>
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete document */}
      <Dialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <DialogContent onClose={() => setDeleteDocId(null)} className="max-w-sm">
          <DialogHeader><DialogTitle>Xóa tài liệu?</DialogTitle></DialogHeader>
          <div className="px-6 py-2 text-sm text-muted-foreground">Hành động này không thể hoàn tác.</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDocId(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteDoc} disabled={deleting}>
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Document card component
function DocumentCard({ doc, onDelete }: { doc: Document; onDelete: () => void }) {
  return (
    <div className="border rounded-lg p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors group">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{doc.title}</p>
        <p className="text-xs text-muted-foreground">{DOCUMENT_TYPE_LABELS[doc.type]}</p>
        {doc.uploadedBy && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <User className="h-3 w-3" />
            {doc.uploadedBy}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a href={doc.url} target="_blank" rel="noopener noreferrer">
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </a>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
