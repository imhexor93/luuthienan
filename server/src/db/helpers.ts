// ============================================================
// DB Helper Functions — chuyển đổi snake_case ↔ camelCase
// ============================================================
import { db } from './schema';
import { v4 as uuidv4 } from 'uuid';
import {
  Project,
  Stage,
  Task,
  Risk,
  Document,
  TaskAttachment,
  TaskLink,
  ActivityLog,
  StageWithProgress,
  ProjectWithProgress,
  ActivityEntityType,
  STAGE_NAMES,
  Factory,
  FactoryContact,
  WechatGroup,
  FactoryEngagement,
  FactoryEngagementWithFactory,
  QuoteRequest,
  Quote,
  QuoteWithDetails,
  QuoteMaterialCost,
  QuotePackagingCost,
  QuotePackagingItem,
  QuotePackagingTemplate,
  QuoteTimelineEstimate,
  NegotiationLog,
  Sample,
  PackagingDesign,
  PackagingRevision,
  FactoryCommunication,
  ProductionExecution,
  ProductionExecutionWithPhases,
  ProductionPhase,
  DocumentationWorkflow,
  DocumentationWorkflowWithSteps,
  DocumentationStep,
  ShippingLeg,
} from '@rd/shared';

// -------------------------
// Type mapping từ DB row
// -------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function rowToProject(row: Row): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    productCategory: row.product_category,
    market: row.market ?? '',
    brand: row.brand ?? '',
    progressSummary: row.progress_summary ?? '',
    startDate: row.start_date,
    targetLaunchDate: row.target_launch_date,
    budget: row.budget,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToStage(row: Row): Stage {
  return {
    id: row.id,
    projectId: row.project_id,
    order: row.order,
    name: row.name,
    stageGroup: row.stage_group ?? null,
    stageSummary: row.stage_summary ?? '',
    gateStatus: row.gate_status,
    gateApprovedBy: row.gate_approved_by,
    gateApprovedAt: row.gate_approved_at,
    gateNotes: row.gate_notes,
  };
}

function rowToTask(row: Row): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    stageId: row.stage_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    assigneeId: (row.assignee_id as string | null) ?? null,
    assigneeName: (row.assignee_name as string) ?? '',
    dueDate: row.due_date,
    status: row.status,
    priority: row.priority,
    estimatedHours: row.estimated_hours,
    actualHours: row.actual_hours,
    blockerReason: row.blocker_reason,
    completionReport: row.completion_report,
    issueNotes: row.issue_notes,
    approvalRequired: row.approval_required === 1,
    approvalStatus: (row.approval_status as Task['approvalStatus']) ?? 'not-required',
    approvalBy: row.approval_by ?? null,
    approvalNotes: row.approval_notes ?? null,
    approvalAt: row.approval_at ?? null,
    approvalTargetId: row.approval_target_id ?? null,
    approvalTargetName: row.approval_target_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRisk(row: Row): Risk {
  return {
    id: row.id,
    projectId: row.project_id,
    stageId: row.stage_id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    likelihood: row.likelihood,
    mitigation: row.mitigation,
    status: row.status,
  };
}

function rowToDocument(row: Row): Document {
  return {
    id: row.id,
    projectId: row.project_id,
    stageId: row.stage_id,
    title: row.title,
    type: row.type,
    url: row.url,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

function rowToActivityLog(row: Row): ActivityLog {
  return {
    id: row.id,
    projectId: row.project_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    performedBy: row.performed_by,
    performedAt: row.performed_at,
    details: JSON.parse(row.details || '{}'),
  };
}

// -------------------------
// Activity log helper
// -------------------------
export function logActivity(
  projectId: string,
  action: string,
  entityType: ActivityEntityType,
  entityId: string,
  performedBy = 'System',
  details: Record<string, unknown> = {}
): void {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO activity_logs (id, project_id, action, entity_type, entity_id, performed_by, performed_at, details)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `).run(id, projectId, action, entityType, entityId, performedBy, JSON.stringify(details));
}

// -------------------------
// Project helpers
// -------------------------
export function getAllProjects(filters: {
  status?: string;
  category?: string;
  brand?: string;
  sortBy?: string;
} = {}): ProjectWithProgress[] {
  let query = `SELECT * FROM projects WHERE 1=1`;
  const params: unknown[] = [];

  if (filters.status) {
    query += ` AND status = ?`;
    params.push(filters.status);
  }
  if (filters.category) {
    query += ` AND product_category LIKE ?`;
    params.push(`%${filters.category}%`);
  }
  if (filters.brand) {
    query += ` AND brand = ?`;
    params.push(filters.brand);
  }

  const sortMap: Record<string, string> = {
    deadline: 'target_launch_date ASC',
    created: 'created_at DESC',
    name: 'name ASC',
  };
  query += ` ORDER BY ${sortMap[filters.sortBy ?? ''] ?? 'created_at DESC'}`;

  const rows = db.prepare(query).all(...params) as Row[];
  return rows.map((row) => enrichProject(rowToProject(row)));
}

export function getProjectById(id: string): ProjectWithProgress | undefined {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row | undefined;
  if (!row) return undefined;
  return enrichProject(rowToProject(row));
}

function enrichProject(project: Project): ProjectWithProgress {
  const stages = getStagesWithProgress(project.id);
  const totalTasks = stages.reduce((s, st) => s + st.totalTasks, 0);
  const doneTasks = stages.reduce((s, st) => s + st.doneTasks, 0);
  const progressPercent = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  // Giai đoạn hiện tại = stage in-progress hoặc not-started đầu tiên
  const currentStage =
    stages.find((s) => s.gateStatus === 'in-progress') ??
    stages.find((s) => s.gateStatus === 'not-started') ??
    stages[stages.length - 1] ??
    null;

  return { ...project, stages, totalTasks, doneTasks, progressPercent, currentStage };
}

export function createProject(data: {
  id: string;
  name: string;
  description: string;
  productCategory: string;
  market?: string;
  brand?: string;
  progressSummary?: string;
  startDate: string;
  targetLaunchDate: string;
  budget: number;
  status: string;
}): Project {
  db.prepare(`
    INSERT INTO projects (id, name, description, product_category, market, brand, progress_summary, start_date, target_launch_date, budget, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    data.id, data.name, data.description, data.productCategory,
    data.market ?? '', data.brand ?? '', data.progressSummary ?? '',
    data.startDate, data.targetLaunchDate, data.budget, data.status
  );

  // Tự động tạo 7 stages (orders 2-5 là giai đoạn phát triển song song)
  const DEVELOPMENT_ORDERS = new Set([2, 3, 4, 5]);
  for (let i = 0; i < 7; i++) {
    const order = i + 1;
    const stageGroup = DEVELOPMENT_ORDERS.has(order) ? 'development' : null;
    const stageId = uuidv4();
    db.prepare(`
      INSERT INTO stages (id, project_id, "order", name, stage_group, gate_status)
      VALUES (?, ?, ?, ?, ?, 'not-started')
    `).run(stageId, data.id, order, STAGE_NAMES[i], stageGroup);
  }

  return rowToProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(data.id) as Row);
}

export function updateProject(id: string, data: Partial<{
  name: string;
  description: string;
  productCategory: string;
  market: string;
  brand: string;
  progressSummary: string;
  startDate: string;
  targetLaunchDate: string;
  budget: number;
  status: string;
}>): Project | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  if (data.productCategory !== undefined) { sets.push('product_category = ?'); params.push(data.productCategory); }
  if (data.market !== undefined) { sets.push('market = ?'); params.push(data.market); }
  if (data.brand !== undefined) { sets.push('brand = ?'); params.push(data.brand); }
  if (data.progressSummary !== undefined) { sets.push('progress_summary = ?'); params.push(data.progressSummary); }
  if (data.startDate !== undefined) { sets.push('start_date = ?'); params.push(data.startDate); }
  if (data.targetLaunchDate !== undefined) { sets.push('target_launch_date = ?'); params.push(data.targetLaunchDate); }
  if (data.budget !== undefined) { sets.push('budget = ?'); params.push(data.budget); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }

  if (sets.length === 0) return getProjectById(id);

  sets.push(`updated_at = datetime('now')`);
  params.push(id);

  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToProject(row) : undefined;
}

export function deleteProject(id: string): boolean {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------
// Stage helpers
// -------------------------
export function getStagesWithProgress(projectId: string): StageWithProgress[] {
  const stages = (db.prepare('SELECT * FROM stages WHERE project_id = ? ORDER BY "order" ASC').all(projectId) as Row[])
    .map(rowToStage);

  // Compute task progress for each stage
  const withProgress = stages.map((stage) => {
    const taskCounts = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
      FROM tasks WHERE stage_id = ?
    `).get(stage.id) as { total: number; done: number };

    const totalTasks = taskCounts.total ?? 0;
    const doneTasks = taskCounts.done ?? 0;
    const progressPercent = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

    return { ...stage, totalTasks, doneTasks, progressPercent, isLocked: false, lockReason: null as string | null };
  });

  // Compute gate lock state based on prerequisites
  const stage1 = withProgress.find((s) => s.order === 1);
  const devStages = withProgress.filter((s) => s.stageGroup === 'development');
  const stage6 = withProgress.find((s) => s.order === 6);

  return withProgress.map((stage) => {
    let isLocked = false;
    let lockReason: string | null = null;

    if (stage.stageGroup === 'development') {
      // Development stages unlock only after stage 1 is passed
      if (!stage1 || stage1.gateStatus !== 'passed') {
        isLocked = true;
        lockReason = `Cần hoàn thành cổng giai đoạn "${stage1?.name ?? 'Ý tưởng & Nghiên cứu'}" trước`;
      }
    } else if (stage.order === 6) {
      // Stage 6 unlocks after at least 3/4 development stages are passed
      const notPassed = devStages.filter((s) => s.gateStatus !== 'passed');
      if (notPassed.length > 1) {
        isLocked = true;
        lockReason = `Cần hoàn thành ít nhất 3/${devStages.length} giai đoạn phát triển (còn ${notPassed.length} chưa xong: ${notPassed.map((s) => s.name).join(', ')})`;
      }
    } else if (stage.order === 7) {
      // Stage 7 unlocks only after stage 6 is passed
      if (!stage6 || stage6.gateStatus !== 'passed') {
        isLocked = true;
        lockReason = `Cần hoàn thành cổng giai đoạn "${stage6?.name ?? 'Sản xuất'}" trước`;
      }
    }

    return { ...stage, isLocked, lockReason };
  });
}

export function updateStage(id: string, data: Partial<{
  gateStatus: string;
  gateApprovedBy: string;
  gateNotes: string;
  stageSummary: string;
}>): Stage | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.gateStatus !== undefined) { sets.push('gate_status = ?'); params.push(data.gateStatus); }
  if (data.gateApprovedBy !== undefined) { sets.push('gate_approved_by = ?'); params.push(data.gateApprovedBy); }
  if (data.gateNotes !== undefined) { sets.push('gate_notes = ?'); params.push(data.gateNotes); }
  if (data.stageSummary !== undefined) { sets.push('stage_summary = ?'); params.push(data.stageSummary); }

  if (data.gateStatus === 'passed' || data.gateStatus === 'failed') {
    sets.push(`gate_approved_at = datetime('now')`);
  }

  if (sets.length === 0) return undefined;

  params.push(id);
  db.prepare(`UPDATE stages SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM stages WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToStage(row) : undefined;
}

// -------------------------
// Task helpers
// -------------------------
export function getTasksByProject(projectId: string, filters: {
  stageId?: string;
  status?: string;
  priority?: string;
  owner?: string;
} = {}): Task[] {
  let query = `SELECT * FROM tasks WHERE project_id = ?`;
  const params: unknown[] = [projectId];

  if (filters.stageId) { query += ` AND stage_id = ?`; params.push(filters.stageId); }
  if (filters.status) { query += ` AND status = ?`; params.push(filters.status); }
  if (filters.priority) { query += ` AND priority = ?`; params.push(filters.priority); }
  if (filters.owner) { query += ` AND owner LIKE ?`; params.push(`%${filters.owner}%`); }

  query += ` ORDER BY created_at DESC`;
  return (db.prepare(query).all(...params) as Row[]).map(rowToTask);
}

export function createTask(data: {
  id: string;
  projectId: string;
  stageId: string;
  title: string;
  description: string;
  owner: string;
  assigneeId?: string | null;
  assigneeName?: string;
  dueDate: string | null;
  status: string;
  priority: string;
  estimatedHours: number | null;
  actualHours: number | null;
  blockerReason: string | null;
  completionReport: string | null;
  issueNotes: string | null;
  approvalRequired?: boolean;
}): Task {
  db.prepare(`
    INSERT INTO tasks (id, project_id, stage_id, title, description, owner, assignee_id, assignee_name, due_date, status, priority, estimated_hours, actual_hours, blocker_reason, completion_report, issue_notes, approval_required, approval_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    data.id, data.projectId, data.stageId, data.title, data.description,
    data.owner, data.assigneeId ?? null, data.assigneeName ?? '',
    data.dueDate, data.status, data.priority,
    data.estimatedHours, data.actualHours, data.blockerReason,
    data.completionReport, data.issueNotes,
    data.approvalRequired ? 1 : 0,
    data.approvalRequired ? 'not-required' : 'not-required'
  );
  return rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id) as Row);
}

export function updateTask(id: string, data: Partial<{
  stageId: string;
  title: string;
  description: string;
  owner: string;
  assigneeId: string | null;
  assigneeName: string;
  dueDate: string | null;
  status: string;
  priority: string;
  estimatedHours: number | null;
  actualHours: number | null;
  blockerReason: string | null;
  completionReport: string | null;
  issueNotes: string | null;
  approvalRequired: boolean;
  approvalStatus: string;
  approvalBy: string | null;
  approvalNotes: string | null;
}>): Task | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.stageId !== undefined) { sets.push('stage_id = ?'); params.push(data.stageId); }
  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  if (data.owner !== undefined) { sets.push('owner = ?'); params.push(data.owner); }
  if (data.assigneeId !== undefined) { sets.push('assignee_id = ?'); params.push(data.assigneeId); }
  if (data.assigneeName !== undefined) { sets.push('assignee_name = ?'); params.push(data.assigneeName); }
  if (data.dueDate !== undefined) { sets.push('due_date = ?'); params.push(data.dueDate); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.priority !== undefined) { sets.push('priority = ?'); params.push(data.priority); }
  if (data.estimatedHours !== undefined) { sets.push('estimated_hours = ?'); params.push(data.estimatedHours); }
  if (data.actualHours !== undefined) { sets.push('actual_hours = ?'); params.push(data.actualHours); }
  if (data.blockerReason !== undefined) { sets.push('blocker_reason = ?'); params.push(data.blockerReason); }
  if (data.completionReport !== undefined) { sets.push('completion_report = ?'); params.push(data.completionReport); }
  if (data.issueNotes !== undefined) { sets.push('issue_notes = ?'); params.push(data.issueNotes); }
  if (data.approvalRequired !== undefined) { sets.push('approval_required = ?'); params.push(data.approvalRequired ? 1 : 0); }
  if (data.approvalStatus !== undefined) { sets.push('approval_status = ?'); params.push(data.approvalStatus); }
  if (data.approvalBy !== undefined) { sets.push('approval_by = ?'); params.push(data.approvalBy); }
  if (data.approvalNotes !== undefined) { sets.push('approval_notes = ?'); params.push(data.approvalNotes); }

  if (sets.length === 0) return undefined;

  sets.push(`updated_at = datetime('now')`);
  params.push(id);

  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToTask(row) : undefined;
}

export function deleteTask(id: string): boolean {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

// Lấy danh sách tất cả công việc đang chờ phê duyệt (toàn bộ dự án)
export function getPendingApprovals(): Array<Task & { projectName: string; stageName: string }> {
  const rows = (db.prepare(`
    SELECT t.*,
           p.name as project_name,
           s.name as stage_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    JOIN stages s ON t.stage_id = s.id
    WHERE t.approval_status = 'pending'
    ORDER BY t.updated_at DESC
  `).all() as Row[]);

  return rows.map((row) => ({
    ...rowToTask(row),
    projectName: row.project_name as string,
    stageName: row.stage_name as string,
  }));
}

// Gửi yêu cầu phê duyệt
export function requestTaskApproval(
  id: string,
  targetId?: string | null,
  targetName?: string | null
): Task | undefined {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined;
  if (!row) return undefined;
  db.prepare(`
    UPDATE tasks SET
      approval_status = 'pending',
      approval_target_id = ?,
      approval_target_name = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(targetId ?? null, targetName ?? null, id);
  // Log history
  const histId = require('crypto').randomUUID();
  db.prepare(`
    INSERT INTO task_approval_history (id, task_id, action, by_name, by_id, target_name, target_id, notes)
    VALUES (?, ?, 'requested', ?, ?, ?, ?, NULL)
  `).run(histId, id, (row.owner as string) ?? '', null, targetName ?? null, targetId ?? null);
  return rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row);
}

// Phê duyệt hoặc từ chối
export function processApproval(id: string, action: 'approved' | 'rejected', approvalBy: string, approvalNotes: string): Task | undefined {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined;
  if (!row) return undefined;
  const newStatus = action === 'approved' ? 'done' : row.status as string;
  db.prepare(`
    UPDATE tasks SET
      approval_status = ?,
      approval_by = ?,
      approval_notes = ?,
      approval_at = datetime('now'),
      status = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(action, approvalBy, approvalNotes, newStatus, id);
  // Log history
  const histId = require('crypto').randomUUID();
  db.prepare(`
    INSERT INTO task_approval_history (id, task_id, action, by_name, by_id, target_name, target_id, notes)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
  `).run(histId, id, action, approvalBy, row.owner ?? null, null, approvalNotes || null);

  // Create notification for the task's assignee
  const assigneeId = row.assignee_id as string | null;
  if (assigneeId) {
    const taskTitle = row.title as string;
    const notifType = action === 'approved' ? 'task_approved' : 'task_rejected';
    const notifTitle = action === 'approved'
      ? `✅ Công việc đã được duyệt`
      : `❌ Công việc bị từ chối`;
    const notifBody = action === 'approved'
      ? `"${taskTitle}" đã được phê duyệt bởi ${approvalBy}.`
      : `"${taskTitle}" bị từ chối bởi ${approvalBy}${approvalNotes ? `. Lý do: ${approvalNotes}` : '.'}`;
    createNotification({
      userId: assigneeId,
      type: notifType,
      title: notifTitle,
      body: notifBody,
      taskId: id,
      projectId: row.project_id as string,
    });
  }

  return rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row);
}

// -------------------------
// Stage weekly update helpers
// -------------------------
export function getStageWeeklyUpdates(stageId: string): Array<{
  id: string; stageId: string; weekLabel: string; content: string; createdBy: string; createdAt: string; updatedAt: string;
}> {
  const rows = db.prepare(`SELECT * FROM stage_weekly_updates WHERE stage_id = ? ORDER BY created_at DESC`).all(stageId) as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    stageId: r.stage_id as string,
    weekLabel: r.week_label as string,
    content: r.content as string,
    createdBy: (r.created_by as string) ?? '',
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));
}

export function createWeeklyUpdate(data: {
  stageId: string; weekLabel: string; content: string; createdBy: string;
}) {
  const id = require('crypto').randomUUID();
  db.prepare(`
    INSERT INTO stage_weekly_updates (id, stage_id, week_label, content, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.stageId, data.weekLabel, data.content, data.createdBy);
  return db.prepare('SELECT * FROM stage_weekly_updates WHERE id = ?').get(id) as Row;
}

export function updateWeeklyUpdate(id: string, data: { weekLabel?: string; content?: string }): Row | undefined {
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: unknown[] = [];
  if (data.weekLabel !== undefined) { sets.unshift('week_label = ?'); params.push(data.weekLabel); }
  if (data.content !== undefined) { sets.unshift('content = ?'); params.push(data.content); }
  params.push(id);
  db.prepare(`UPDATE stage_weekly_updates SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return db.prepare('SELECT * FROM stage_weekly_updates WHERE id = ?').get(id) as Row | undefined;
}

export function deleteWeeklyUpdate(id: string): boolean {
  const result = db.prepare('DELETE FROM stage_weekly_updates WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------
// Notification helpers
// -------------------------
export function createNotification(data: {
  userId: string; type: string; title: string; body: string;
  taskId?: string | null; projectId?: string | null;
}): void {
  const id = require('crypto').randomUUID();
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, task_id, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.userId, data.type, data.title, data.body, data.taskId ?? null, data.projectId ?? null);
}

export function getNotifications(userId: string): Array<{
  id: string; userId: string; type: string; title: string; body: string;
  taskId: string | null; projectId: string | null; isRead: boolean; createdAt: string;
}> {
  const rows = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(userId) as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    type: r.type as string,
    title: r.title as string,
    body: r.body as string,
    taskId: (r.task_id as string) ?? null,
    projectId: (r.project_id as string) ?? null,
    isRead: r.is_read === 1,
    createdAt: r.created_at as string,
  }));
}

export function getUnreadNotificationCount(userId: string): number {
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0`).get(userId) as { cnt: number };
  return row.cnt;
}

export function markNotificationsRead(userId: string): void {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`).run(userId);
}

// Lịch sử phê duyệt của một task
export function getApprovalHistory(taskId: string): Array<{
  id: string; taskId: string; action: string; byName: string; byId: string | null;
  targetName: string | null; targetId: string | null; notes: string | null; createdAt: string;
}> {
  const rows = db.prepare(`
    SELECT * FROM task_approval_history WHERE task_id = ? ORDER BY created_at ASC
  `).all(taskId) as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    taskId: r.task_id as string,
    action: r.action as string,
    byName: (r.by_name as string) ?? '',
    byId: (r.by_id as string) ?? null,
    targetName: (r.target_name as string) ?? null,
    targetId: (r.target_id as string) ?? null,
    notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

// -------------------------
// Risk helpers
// -------------------------
export function getRisksByProject(projectId: string): Risk[] {
  return (db.prepare('SELECT * FROM risks WHERE project_id = ? ORDER BY rowid DESC').all(projectId) as Row[])
    .map(rowToRisk);
}

export function createRisk(data: {
  id: string;
  projectId: string;
  stageId: string | null;
  title: string;
  description: string;
  severity: string;
  likelihood: string;
  mitigation: string;
  status: string;
}): Risk {
  db.prepare(`
    INSERT INTO risks (id, project_id, stage_id, title, description, severity, likelihood, mitigation, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.projectId, data.stageId, data.title, data.description,
    data.severity, data.likelihood, data.mitigation, data.status
  );
  return rowToRisk(db.prepare('SELECT * FROM risks WHERE id = ?').get(data.id) as Row);
}

export function updateRisk(id: string, data: Partial<{
  stageId: string | null;
  title: string;
  description: string;
  severity: string;
  likelihood: string;
  mitigation: string;
  status: string;
}>): Risk | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.stageId !== undefined) { sets.push('stage_id = ?'); params.push(data.stageId); }
  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  if (data.severity !== undefined) { sets.push('severity = ?'); params.push(data.severity); }
  if (data.likelihood !== undefined) { sets.push('likelihood = ?'); params.push(data.likelihood); }
  if (data.mitigation !== undefined) { sets.push('mitigation = ?'); params.push(data.mitigation); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }

  if (sets.length === 0) return undefined;

  params.push(id);
  db.prepare(`UPDATE risks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM risks WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToRisk(row) : undefined;
}

export function deleteRisk(id: string): boolean {
  const result = db.prepare('DELETE FROM risks WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------
// Document helpers
// -------------------------
export function getDocumentsByProject(projectId: string): Document[] {
  return (db.prepare('SELECT * FROM documents WHERE project_id = ? ORDER BY uploaded_at DESC').all(projectId) as Row[])
    .map(rowToDocument);
}

export function createDocument(data: {
  id: string;
  projectId: string;
  stageId: string | null;
  title: string;
  type: string;
  url: string;
  uploadedBy: string;
}): Document {
  db.prepare(`
    INSERT INTO documents (id, project_id, stage_id, title, type, url, uploaded_by, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(data.id, data.projectId, data.stageId, data.title, data.type, data.url, data.uploadedBy);
  return rowToDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(data.id) as Row);
}

export function deleteDocument(id: string): boolean {
  const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------
// Activity log helpers
// -------------------------
export function getActivitiesByProject(
  projectId: string,
  page = 1,
  limit = 50
): ActivityLog[] {
  const offset = (page - 1) * limit;
  return (db.prepare(`
    SELECT * FROM activity_logs
    WHERE project_id = ?
    ORDER BY performed_at DESC
    LIMIT ? OFFSET ?
  `).all(projectId, limit, offset) as Row[]).map(rowToActivityLog);
}

// -------------------------
// Dashboard stats
// -------------------------
export function getDashboardStats(): {
  activeProjects: number;
  upcomingDeadlines: number;
  overdueTasks: number;
  highRisks: number;
} {
  const activeProjects = (db.prepare(`
    SELECT COUNT(*) as cnt FROM projects WHERE status = 'active'
  `).get() as { cnt: number }).cnt;

  const upcomingDeadlines = (db.prepare(`
    SELECT COUNT(*) as cnt FROM projects
    WHERE status = 'active'
      AND target_launch_date BETWEEN date('now') AND date('now', '+30 days')
  `).get() as { cnt: number }).cnt;

  const overdueTasks = (db.prepare(`
    SELECT COUNT(*) as cnt FROM tasks
    WHERE status NOT IN ('done')
      AND due_date < date('now')
      AND due_date IS NOT NULL
  `).get() as { cnt: number }).cnt;

  const highRisks = (db.prepare(`
    SELECT COUNT(*) as cnt FROM risks
    WHERE severity IN ('high', 'critical')
      AND status IN ('open', 'monitoring')
  `).get() as { cnt: number }).cnt;

  return { activeProjects, upcomingDeadlines, overdueTasks, highRisks };
}

// -------------------------
// Search
// -------------------------
export function searchAll(q: string): {
  projects: Array<{ id: string; name: string; status: string; productCategory: string }>;
  tasks: Array<{ id: string; title: string; status: string; priority: string; projectId: string; projectName: string }>;
} {
  const like = `%${q}%`;

  const projects = (db.prepare(`
    SELECT id, name, status, product_category FROM projects
    WHERE name LIKE ? OR description LIKE ?
    LIMIT 10
  `).all(like, like) as Row[]).map((r) => ({
    id: r.id, name: r.name, status: r.status, productCategory: r.product_category,
  }));

  const tasks = (db.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.project_id, p.name as project_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.title LIKE ? OR t.description LIKE ?
    LIMIT 10
  `).all(like, like) as Row[]).map((r) => ({
    id: r.id, title: r.title, status: r.status, priority: r.priority,
    projectId: r.project_id, projectName: r.project_name,
  }));

  return { projects, tasks };
}

// -------------------------
// Task attachment helpers
// -------------------------
function rowToAttachment(row: Row): TaskAttachment {
  return {
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    filename: row.filename,
    originalName: row.original_name,
    mimetype: row.mimetype,
    size: row.size,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

export function getAttachmentsByTask(taskId: string): TaskAttachment[] {
  return (db.prepare('SELECT * FROM task_attachments WHERE task_id = ? ORDER BY uploaded_at DESC').all(taskId) as Row[])
    .map(rowToAttachment);
}

export function createAttachment(data: {
  id: string;
  taskId: string;
  projectId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadedBy: string;
}): TaskAttachment {
  db.prepare(`
    INSERT INTO task_attachments (id, task_id, project_id, filename, original_name, mimetype, size, uploaded_by, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(data.id, data.taskId, data.projectId, data.filename, data.originalName, data.mimetype, data.size, data.uploadedBy);
  return rowToAttachment(db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(data.id) as Row);
}

export function getAttachmentById(id: string): TaskAttachment | undefined {
  const row = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToAttachment(row) : undefined;
}

export function deleteAttachment(id: string): boolean {
  const result = db.prepare('DELETE FROM task_attachments WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------
// Task link helpers
// -------------------------
function rowToLink(row: Row): TaskLink {
  return {
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    title: row.title,
    url: row.url,
    linkType: row.link_type,
    addedBy: row.added_by,
    addedAt: row.added_at,
  };
}

export function getLinksByTask(taskId: string): TaskLink[] {
  return (db.prepare('SELECT * FROM task_links WHERE task_id = ? ORDER BY added_at DESC').all(taskId) as Row[])
    .map(rowToLink);
}

export function createLink(data: {
  id: string;
  taskId: string;
  projectId: string;
  title: string;
  url: string;
  linkType: string;
  addedBy: string;
}): TaskLink {
  db.prepare(`
    INSERT INTO task_links (id, task_id, project_id, title, url, link_type, added_by, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(data.id, data.taskId, data.projectId, data.title, data.url, data.linkType, data.addedBy);
  return rowToLink(db.prepare('SELECT * FROM task_links WHERE id = ?').get(data.id) as Row);
}

export function deleteLink(id: string): boolean {
  const result = db.prepare('DELETE FROM task_links WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============================================================
// Factory Liaison helpers
// ============================================================

// -------------------------
// Row → Interface converters
// -------------------------
function rowToFactory(row: Row): Factory {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    address: row.address,
    country: row.country,
    specialties: JSON.parse(row.specialties || '[]'),
    certifications: JSON.parse(row.certifications || '[]'),
    moqDefault: row.moq_default,
    leadTimeDays: row.lead_time_days,
    paymentTerms: row.payment_terms,
    rating: row.rating,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToFactoryContact(row: Row): FactoryContact {
  return {
    id: row.id,
    factoryId: row.factory_id,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    zalo: row.zalo,
    wechat: row.wechat,
    isPrimary: row.is_primary !== 0,
    notes: row.notes,
  };
}

function rowToEngagement(row: Row): FactoryEngagement {
  return {
    id: row.id,
    projectId: row.project_id,
    factoryId: row.factory_id,
    scope: row.scope,
    scopeDescription: row.scope_description,
    status: row.status,
    primaryContactId: row.primary_contact_id,
    internalOwner: row.internal_owner,
    startDate: row.start_date,
    targetCompletionDate: row.target_completion_date,
    finalUnitPrice: row.final_unit_price,
    finalMOQ: row.final_moq,
    currency: row.currency,
    linkedStageId: row.linked_stage_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEngagementWithFactory(row: Row): FactoryEngagementWithFactory {
  return {
    ...rowToEngagement(row),
    factoryName: row.factory_name,
    factoryShortName: row.factory_short_name,
    factoryCountry: row.factory_country,
  };
}

function rowToQuoteRequest(row: Row): QuoteRequest {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    requestNumber: row.request_number,
    requestedAt: row.requested_at,
    requestedBy: row.requested_by,
    specifications: row.specifications,
    quantityRange: row.quantity_range,
    deadlineForResponse: row.deadline_for_response,
    status: row.status,
    notes: row.notes,
  };
}

function rowToQuote(row: Row): Quote {
  return {
    id: row.id,
    quoteRequestId: row.quote_request_id,
    version: row.version,
    receivedAt: row.received_at,
    validUntil: row.valid_until,
    pricingTerms: row.pricing_terms ?? 'EXW',
    currency: row.currency,
    leadTimeDays: row.lead_time_days,
    paymentTerms: row.payment_terms ?? '',
    // v2 fields
    productName: row.product_name ?? '',
    specification: row.specification ?? '',
    quantityScenario: row.quantity_scenario ?? '',
    generalNotes: row.general_notes ?? '',
    totalUnitPrice: row.total_unit_price ?? 0,
    laborCostPerUnit: row.labor_cost_per_unit ?? 0,
    // v1 legacy
    productLines: JSON.parse(row.product_lines || '[]'),
    status: row.status,
    internalNotes: row.internal_notes ?? '',
    unitPrice: row.unit_price ?? 0,
    moq: row.moq ?? 0,
  };
}

function rowToMaterialCost(row: Row): QuoteMaterialCost {
  return {
    id: row.id,
    quoteId: row.quote_id,
    calculationMethod: row.calculation_method,
    pricePerKg: row.price_per_kg,
    pricePerUnit: row.price_per_unit,
    weightPerUnit: row.weight_per_unit,
    totalMaterialCost: row.total_material_cost ?? 0,
    materialNotes: row.material_notes ?? '',
  };
}

function rowToPackagingItem(row: Row): QuotePackagingItem {
  return {
    id: row.id,
    quotePackagingCostId: row.quote_packaging_cost_id,
    order: row.order,
    componentName: row.component_name ?? '',
    componentType: row.component_type,
    unitCost: row.unit_cost ?? 0,
    quantity: row.quantity ?? 1,
    totalCost: row.total_cost ?? 0,
    notes: row.notes ?? '',
  };
}

function rowToPackagingCost(row: Row, items: QuotePackagingItem[]): QuotePackagingCost {
  return {
    id: row.id,
    quoteId: row.quote_id,
    totalPackagingCost: row.total_packaging_cost ?? 0,
    wastageCost: row.wastage_cost ?? 0,
    packagingNotes: row.packaging_notes ?? '',
    items,
  };
}

function rowToTemplate(row: Row): QuotePackagingTemplate {
  return {
    id: row.id,
    name: row.name,
    productCategory: row.product_category ?? '',
    items: JSON.parse(row.items || '[]'),
    createdBy: row.created_by ?? 'System',
    createdAt: row.created_at,
    usageCount: row.usage_count ?? 0,
  };
}

function rowToTimelineEstimate(row: Row): QuoteTimelineEstimate {
  return {
    id: row.id,
    quoteId: row.quote_id,
    packagingMinDays: row.packaging_min_days ?? 0,
    packagingMaxDays: row.packaging_max_days ?? 0,
    materialMinDays: row.material_min_days ?? 0,
    materialMaxDays: row.material_max_days ?? 0,
    fillingMinDays: row.filling_min_days ?? 0,
    fillingMaxDays: row.filling_max_days ?? 0,
    shippingMinDays: row.shipping_min_days ?? 0,
    shippingMaxDays: row.shipping_max_days ?? 0,
    totalMinDays: row.total_min_days ?? 0,
    totalMaxDays: row.total_max_days ?? 0,
    stageOverlaps: JSON.parse(row.stage_overlaps || '{"packagingMaterial":true,"materialFilling":false}'),
    estimateNotes: row.estimate_notes ?? '',
  };
}

function rowToProductionExecution(row: Row): ProductionExecution {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    quoteId: row.quote_id,
    productionOrderNumber: row.production_order_number ?? '',
    orderConfirmedAt: row.order_confirmed_at,
    depositPaidAt: row.deposit_paid_at,
    status: row.status,
    overallNotes: row.overall_notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToProductionPhase(row: Row): ProductionPhase {
  return {
    id: row.id,
    productionExecutionId: row.production_execution_id,
    phaseType: row.phase_type,
    phaseName: row.phase_name ?? '',
    plannedStartDate: row.planned_start_date,
    plannedEndDate: row.planned_end_date,
    actualStartDate: row.actual_start_date,
    actualEndDate: row.actual_end_date,
    plannedDays: row.planned_days,
    actualDays: row.actual_days,
    status: row.status,
    delayReason: row.delay_reason,
    dependsOn: JSON.parse(row.depends_on || '[]'),
    notes: row.notes ?? '',
    order: row.order ?? 1,
  };
}

function rowToDocumentationWorkflow(row: Row): DocumentationWorkflow {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    productionExecutionId: row.production_execution_id,
    status: row.status,
    overallNotes: row.overall_notes ?? '',
  };
}

function rowToDocumentationStep(row: Row): DocumentationStep {
  return {
    id: row.id,
    documentationWorkflowId: row.documentation_workflow_id,
    documentType: row.document_type,
    documentTypeCustom: row.document_type_custom,
    issuingCountry: row.issuing_country,
    estimatedMinDays: row.estimated_min_days ?? 0,
    estimatedMaxDays: row.estimated_max_days ?? 0,
    estimatedCost: row.estimated_cost ?? 0,
    estimatedCostCurrency: row.estimated_cost_currency ?? 'CNY',
    plannedStartDate: row.planned_start_date,
    plannedEndDate: row.planned_end_date,
    actualStartDate: row.actual_start_date,
    actualEndDate: row.actual_end_date,
    actualCost: row.actual_cost,
    status: row.status,
    documentNumber: row.document_number ?? '',
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    handlerName: row.handler_name ?? '',
    handlerContact: row.handler_contact ?? '',
    attachmentUrls: JSON.parse(row.attachment_urls || '[]'),
    notes: row.notes ?? '',
    order: row.order ?? 1,
  };
}

function rowToShippingLeg(row: Row): ShippingLeg {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    productionExecutionId: row.production_execution_id,
    legType: row.leg_type,
    origin: row.origin ?? '',
    destination: row.destination ?? '',
    plannedStartDate: row.planned_start_date,
    plannedEndDate: row.planned_end_date,
    actualStartDate: row.actual_start_date,
    actualEndDate: row.actual_end_date,
    plannedDays: row.planned_days,
    actualDays: row.actual_days,
    mode: row.mode,
    cost: row.cost ?? 0,
    costCurrency: row.cost_currency ?? 'USD',
    trackingNumber: row.tracking_number ?? '',
    carrier: row.carrier ?? '',
    status: row.status,
    notes: row.notes ?? '',
    order: row.order ?? 1,
  };
}

function rowToNegotiationLog(row: Row): NegotiationLog {
  let updates: NegotiationLog['updates'] = [];
  try { updates = JSON.parse(row.updates || '[]'); } catch { updates = []; }
  return {
    id: row.id,
    engagementId: row.engagement_id,
    quoteId: row.quote_id,
    loggedAt: row.logged_at,
    loggedBy: row.logged_by,
    type: row.type,
    subject: row.subject,
    ourPosition: row.our_position,
    theirPosition: row.their_position,
    outcome: row.outcome,
    nextSteps: row.next_steps,
    assignedTo: row.assigned_to ?? '',
    status: row.status ?? 'open',
    targetObjective: row.target_objective ?? '',
    deadline: row.deadline ?? null,
    updates,
  };
}

function rowToSample(row: Row): Sample {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    sampleNumber: row.sample_number,
    type: row.type,
    version: row.version,
    receivedAt: row.received_at,
    receivedBy: row.received_by,
    description: row.description,
    evaluationStatus: row.evaluation_status,
    evaluatedBy: row.evaluated_by,
    evaluatedAt: row.evaluated_at,
    evaluationCriteria: JSON.parse(row.evaluation_criteria || '[]'),
    overallRating: row.overall_rating,
    feedbackToFactory: row.feedback_to_factory,
    revisionRequested: row.revision_requested !== 0,
    revisionDetails: row.revision_details,
    attachments: JSON.parse(row.attachments || '[]'),
    links: JSON.parse(row.links || '[]'),
    formula: JSON.parse(row.formula || '{}'),
  };
}

function rowToPackagingDesign(row: Row): PackagingDesign {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    projectId: row.project_id,
    componentType: row.component_type,
    name: row.name,
    currentVersion: row.current_version,
    status: row.status,
    briefSentAt: row.brief_sent_at,
    briefDocument: row.brief_document,
    specifications: JSON.parse(row.specifications || '{}'),
    targetCost: row.target_cost,
    actualCost: row.actual_cost,
    finalizedAt: row.finalized_at,
  };
}

function rowToPackagingRevision(row: Row): PackagingRevision {
  return {
    id: row.id,
    packagingDesignId: row.packaging_design_id,
    revisionNumber: row.revision_number,
    submittedByFactoryAt: row.submitted_by_factory_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    issues: JSON.parse(row.issues || '[]'),
    overallDecision: row.overall_decision,
    feedbackSummary: row.feedback_summary,
    factoryResponseAt: row.factory_response_at,
    factoryResponse: row.factory_response,
  };
}

function rowToFactoryCommunication(row: Row): FactoryCommunication {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    contactId: row.contact_id,
    channel: row.channel,
    direction: row.direction,
    loggedAt: row.logged_at,
    loggedBy: row.logged_by,
    subject: row.subject,
    summary: row.summary,
    actionItems: JSON.parse(row.action_items || '[]'),
  };
}

// -------------------------
// Factory CRUD
// -------------------------
export function getAllFactories(filters: { status?: string; country?: string } = {}): Factory[] {
  let query = `SELECT * FROM factories WHERE 1=1`;
  const params: unknown[] = [];

  if (filters.status) { query += ` AND status = ?`; params.push(filters.status); }
  if (filters.country) { query += ` AND country LIKE ?`; params.push(`%${filters.country}%`); }

  query += ` ORDER BY name ASC`;
  return (db.prepare(query).all(...params) as Row[]).map(rowToFactory);
}

export function getFactoryById(id: string): Factory | undefined {
  const row = db.prepare('SELECT * FROM factories WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToFactory(row) : undefined;
}

export function createFactory(data: {
  id: string;
  name: string;
  shortName: string;
  address: string;
  country: string;
  specialties: string[];
  certifications: string[];
  moqDefault: number | null;
  leadTimeDays: number | null;
  paymentTerms: string;
  rating: number;
  notes: string;
  status: string;
}): Factory {
  db.prepare(`
    INSERT INTO factories (id, name, short_name, address, country, specialties, certifications,
      moq_default, lead_time_days, payment_terms, rating, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    data.id, data.name, data.shortName, data.address, data.country,
    JSON.stringify(data.specialties), JSON.stringify(data.certifications),
    data.moqDefault, data.leadTimeDays, data.paymentTerms,
    data.rating, data.notes, data.status
  );
  return rowToFactory(db.prepare('SELECT * FROM factories WHERE id = ?').get(data.id) as Row);
}

export function updateFactory(id: string, data: Partial<{
  name: string;
  shortName: string;
  address: string;
  country: string;
  specialties: string[];
  certifications: string[];
  moqDefault: number | null;
  leadTimeDays: number | null;
  paymentTerms: string;
  rating: number;
  notes: string;
  status: string;
}>): Factory | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.shortName !== undefined) { sets.push('short_name = ?'); params.push(data.shortName); }
  if (data.address !== undefined) { sets.push('address = ?'); params.push(data.address); }
  if (data.country !== undefined) { sets.push('country = ?'); params.push(data.country); }
  if (data.specialties !== undefined) { sets.push('specialties = ?'); params.push(JSON.stringify(data.specialties)); }
  if (data.certifications !== undefined) { sets.push('certifications = ?'); params.push(JSON.stringify(data.certifications)); }
  if (data.moqDefault !== undefined) { sets.push('moq_default = ?'); params.push(data.moqDefault); }
  if (data.leadTimeDays !== undefined) { sets.push('lead_time_days = ?'); params.push(data.leadTimeDays); }
  if (data.paymentTerms !== undefined) { sets.push('payment_terms = ?'); params.push(data.paymentTerms); }
  if (data.rating !== undefined) { sets.push('rating = ?'); params.push(data.rating); }
  if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }

  if (sets.length === 0) return getFactoryById(id);

  sets.push(`updated_at = datetime('now')`);
  params.push(id);

  db.prepare(`UPDATE factories SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM factories WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToFactory(row) : undefined;
}

export function deleteFactory(id: string): boolean {
  const result = db.prepare('DELETE FROM factories WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------
// FactoryContact CRUD
// -------------------------
export function getContactsByFactory(factoryId: string): FactoryContact[] {
  return (db.prepare('SELECT * FROM factory_contacts WHERE factory_id = ? ORDER BY is_primary DESC, name ASC').all(factoryId) as Row[])
    .map(rowToFactoryContact);
}

export function getContactById(id: string): FactoryContact | undefined {
  const row = db.prepare('SELECT * FROM factory_contacts WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToFactoryContact(row) : undefined;
}

export function createFactoryContact(data: {
  id: string;
  factoryId: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  zalo: string;
  wechat: string;
  isPrimary: boolean;
  notes: string;
}): FactoryContact {
  db.prepare(`
    INSERT INTO factory_contacts (id, factory_id, name, role, phone, email, zalo, wechat, is_primary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.factoryId, data.name, data.role, data.phone,
    data.email, data.zalo, data.wechat, data.isPrimary ? 1 : 0, data.notes
  );
  return rowToFactoryContact(db.prepare('SELECT * FROM factory_contacts WHERE id = ?').get(data.id) as Row);
}

export function updateFactoryContact(id: string, data: Partial<{
  name: string;
  role: string;
  phone: string;
  email: string;
  zalo: string;
  wechat: string;
  isPrimary: boolean;
  notes: string;
}>): FactoryContact | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.role !== undefined) { sets.push('role = ?'); params.push(data.role); }
  if (data.phone !== undefined) { sets.push('phone = ?'); params.push(data.phone); }
  if (data.email !== undefined) { sets.push('email = ?'); params.push(data.email); }
  if (data.zalo !== undefined) { sets.push('zalo = ?'); params.push(data.zalo); }
  if (data.wechat !== undefined) { sets.push('wechat = ?'); params.push(data.wechat); }
  if (data.isPrimary !== undefined) { sets.push('is_primary = ?'); params.push(data.isPrimary ? 1 : 0); }
  if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }

  if (sets.length === 0) return getContactById(id);

  params.push(id);
  db.prepare(`UPDATE factory_contacts SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM factory_contacts WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToFactoryContact(row) : undefined;
}

export function deleteFactoryContact(id: string): boolean {
  const result = db.prepare('DELETE FROM factory_contacts WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------
// WechatGroup CRUD
// -------------------------
function rowToWechatGroup(row: Row): WechatGroup {
  return {
    id: row.id,
    factoryId: row.factory_id,
    groupName: row.group_name,
    purpose: row.purpose,
    ourMembers: row.our_members,
    theirMembers: row.their_members,
    qrCodePath: row.qr_code_path ?? '',
    active: row.active !== 0,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function getWechatGroupsByFactory(factoryId: string): WechatGroup[] {
  return (db.prepare('SELECT * FROM factory_wechat_groups WHERE factory_id = ? ORDER BY active DESC, created_at ASC').all(factoryId) as Row[])
    .map(rowToWechatGroup);
}

export function getWechatGroupById(id: string): WechatGroup | undefined {
  const row = db.prepare('SELECT * FROM factory_wechat_groups WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToWechatGroup(row) : undefined;
}

export function createWechatGroup(data: {
  id: string; factoryId: string; groupName: string; purpose: string;
  ourMembers: string; theirMembers: string; active: boolean; notes: string;
}): WechatGroup {
  db.prepare(`
    INSERT INTO factory_wechat_groups (id, factory_id, group_name, purpose, our_members, their_members, qr_code_path, active, notes)
    VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)
  `).run(data.id, data.factoryId, data.groupName, data.purpose, data.ourMembers, data.theirMembers, data.active ? 1 : 0, data.notes);
  return rowToWechatGroup(db.prepare('SELECT * FROM factory_wechat_groups WHERE id = ?').get(data.id) as Row);
}

export function updateWechatGroup(id: string, data: Partial<{
  groupName: string; purpose: string; ourMembers: string; theirMembers: string; qrCodePath: string; active: boolean; notes: string;
}>): WechatGroup | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.groupName !== undefined) { sets.push('group_name = ?'); params.push(data.groupName); }
  if (data.purpose !== undefined) { sets.push('purpose = ?'); params.push(data.purpose); }
  if (data.ourMembers !== undefined) { sets.push('our_members = ?'); params.push(data.ourMembers); }
  if (data.theirMembers !== undefined) { sets.push('their_members = ?'); params.push(data.theirMembers); }
  if (data.qrCodePath !== undefined) { sets.push('qr_code_path = ?'); params.push(data.qrCodePath); }
  if (data.active !== undefined) { sets.push('active = ?'); params.push(data.active ? 1 : 0); }
  if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }

  if (sets.length === 0) return getWechatGroupById(id);

  params.push(id);
  db.prepare(`UPDATE factory_wechat_groups SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM factory_wechat_groups WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToWechatGroup(row) : undefined;
}

export function deleteWechatGroup(id: string): boolean {
  const result = db.prepare('DELETE FROM factory_wechat_groups WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------
// FactoryEngagement CRUD
// -------------------------
const ENGAGEMENT_JOIN = `
  SELECT fe.*, f.name as factory_name, f.short_name as factory_short_name, f.country as factory_country
  FROM factory_engagements fe
  JOIN factories f ON f.id = fe.factory_id
`;

export function getEngagementsByProject(projectId: string): FactoryEngagementWithFactory[] {
  return (db.prepare(`${ENGAGEMENT_JOIN} WHERE fe.project_id = ? ORDER BY fe.created_at DESC`).all(projectId) as Row[])
    .map(rowToEngagementWithFactory);
}

export function getEngagementById(id: string): FactoryEngagementWithFactory | undefined {
  const row = db.prepare(`${ENGAGEMENT_JOIN} WHERE fe.id = ?`).get(id) as Row | undefined;
  return row ? rowToEngagementWithFactory(row) : undefined;
}

export function createEngagement(data: {
  id: string;
  projectId: string;
  factoryId: string;
  scope: string;
  scopeDescription: string;
  status: string;
  primaryContactId: string | null;
  internalOwner: string;
  startDate: string;
  targetCompletionDate: string | null;
  finalUnitPrice: number | null;
  finalMOQ: number | null;
  currency: string;
  linkedStageId: string | null;
}): FactoryEngagementWithFactory {
  db.prepare(`
    INSERT INTO factory_engagements (id, project_id, factory_id, scope, scope_description, status,
      primary_contact_id, internal_owner, start_date, target_completion_date,
      final_unit_price, final_moq, currency, linked_stage_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    data.id, data.projectId, data.factoryId, data.scope, data.scopeDescription,
    data.status, data.primaryContactId, data.internalOwner, data.startDate,
    data.targetCompletionDate, data.finalUnitPrice, data.finalMOQ,
    data.currency, data.linkedStageId
  );
  return getEngagementById(data.id) as FactoryEngagementWithFactory;
}

export function updateEngagement(id: string, data: Partial<{
  factoryId: string;
  scope: string;
  scopeDescription: string;
  status: string;
  primaryContactId: string | null;
  internalOwner: string;
  startDate: string;
  targetCompletionDate: string | null;
  finalUnitPrice: number | null;
  finalMOQ: number | null;
  currency: string;
  linkedStageId: string | null;
}>): FactoryEngagementWithFactory | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.factoryId !== undefined) { sets.push('factory_id = ?'); params.push(data.factoryId); }
  if (data.scope !== undefined) { sets.push('scope = ?'); params.push(data.scope); }
  if (data.scopeDescription !== undefined) { sets.push('scope_description = ?'); params.push(data.scopeDescription); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.primaryContactId !== undefined) { sets.push('primary_contact_id = ?'); params.push(data.primaryContactId); }
  if (data.internalOwner !== undefined) { sets.push('internal_owner = ?'); params.push(data.internalOwner); }
  if (data.startDate !== undefined) { sets.push('start_date = ?'); params.push(data.startDate); }
  if (data.targetCompletionDate !== undefined) { sets.push('target_completion_date = ?'); params.push(data.targetCompletionDate); }
  if (data.finalUnitPrice !== undefined) { sets.push('final_unit_price = ?'); params.push(data.finalUnitPrice); }
  if (data.finalMOQ !== undefined) { sets.push('final_moq = ?'); params.push(data.finalMOQ); }
  if (data.currency !== undefined) { sets.push('currency = ?'); params.push(data.currency); }
  if (data.linkedStageId !== undefined) { sets.push('linked_stage_id = ?'); params.push(data.linkedStageId); }

  if (sets.length === 0) return getEngagementById(id);

  sets.push(`updated_at = datetime('now')`);
  params.push(id);

  db.prepare(`UPDATE factory_engagements SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getEngagementById(id);
}

export function deleteEngagement(id: string): boolean {
  const result = db.prepare('DELETE FROM factory_engagements WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------
// QuoteRequest CRUD
// -------------------------
export function getNextRFQNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `RFQ-${year}-`;
  const row = db.prepare(`
    SELECT request_number FROM quote_requests
    WHERE request_number LIKE ?
    ORDER BY request_number DESC LIMIT 1
  `).get(`${prefix}%`) as Row | undefined;

  if (!row) return `${prefix}001`;
  const last = row.request_number as string;
  const num = parseInt(last.replace(prefix, ''), 10);
  return `${prefix}${String(num + 1).padStart(3, '0')}`;
}

export function getRFQsByEngagement(engagementId: string): QuoteRequest[] {
  return (db.prepare('SELECT * FROM quote_requests WHERE engagement_id = ? ORDER BY requested_at DESC').all(engagementId) as Row[])
    .map(rowToQuoteRequest);
}

export function getRFQById(id: string): QuoteRequest | undefined {
  const row = db.prepare('SELECT * FROM quote_requests WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToQuoteRequest(row) : undefined;
}

export function createRFQ(data: {
  id: string;
  engagementId: string;
  requestNumber: string;
  requestedBy: string;
  specifications: string;
  quantityRange: string;
  deadlineForResponse: string | null;
  status: string;
  notes: string;
}): QuoteRequest {
  db.prepare(`
    INSERT INTO quote_requests (id, engagement_id, request_number, requested_at, requested_by,
      specifications, quantity_range, deadline_for_response, status, notes)
    VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.engagementId, data.requestNumber, data.requestedBy,
    data.specifications, data.quantityRange, data.deadlineForResponse,
    data.status, data.notes
  );
  return rowToQuoteRequest(db.prepare('SELECT * FROM quote_requests WHERE id = ?').get(data.id) as Row);
}

export function updateRFQ(id: string, data: Partial<{
  requestedBy: string;
  specifications: string;
  quantityRange: string;
  deadlineForResponse: string | null;
  status: string;
  notes: string;
}>): QuoteRequest | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.requestedBy !== undefined) { sets.push('requested_by = ?'); params.push(data.requestedBy); }
  if (data.specifications !== undefined) { sets.push('specifications = ?'); params.push(data.specifications); }
  if (data.quantityRange !== undefined) { sets.push('quantity_range = ?'); params.push(data.quantityRange); }
  if (data.deadlineForResponse !== undefined) { sets.push('deadline_for_response = ?'); params.push(data.deadlineForResponse); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }

  if (sets.length === 0) return getRFQById(id);

  params.push(id);
  db.prepare(`UPDATE quote_requests SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM quote_requests WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToQuoteRequest(row) : undefined;
}

// -------------------------
// Quote CRUD
// -------------------------

function enrichQuote(quote: Quote): QuoteWithDetails {
  const matRow = db.prepare('SELECT * FROM quote_material_costs WHERE quote_id = ?').get(quote.id) as Row | undefined;
  const pkgRow = db.prepare('SELECT * FROM quote_packaging_costs WHERE quote_id = ?').get(quote.id) as Row | undefined;
  const tlRow = db.prepare('SELECT * FROM quote_timeline_estimates WHERE quote_id = ?').get(quote.id) as Row | undefined;
  let packagingCost = null;
  if (pkgRow) {
    const items = (db.prepare('SELECT * FROM quote_packaging_items WHERE quote_packaging_cost_id = ? ORDER BY "order"').all(pkgRow.id) as Row[]).map(rowToPackagingItem);
    packagingCost = rowToPackagingCost(pkgRow, items);
  }
  return {
    ...quote,
    materialCost: matRow ? rowToMaterialCost(matRow) : null,
    packagingCost,
    timelineEstimate: tlRow ? rowToTimelineEstimate(tlRow) : null,
  };
}

export function getQuotesByRFQ(rfqId: string): QuoteWithDetails[] {
  const quotes = (db.prepare('SELECT * FROM quotes WHERE quote_request_id = ? ORDER BY version DESC').all(rfqId) as Row[]).map(rowToQuote);
  return quotes.map(enrichQuote);
}

export function getQuotesByEngagement(engagementId: string): QuoteWithDetails[] {
  const quotes = (db.prepare(`
    SELECT q.* FROM quotes q
    JOIN quote_requests r ON q.quote_request_id = r.id
    WHERE r.engagement_id = ?
    ORDER BY q.version DESC
  `).all(engagementId) as Row[]).map(rowToQuote);
  return quotes.map(enrichQuote);
}

export function getQuoteById(id: string): QuoteWithDetails | undefined {
  const row = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as Row | undefined;
  if (!row) return undefined;
  return enrichQuote(rowToQuote(row));
}

export function createQuote(data: {
  id: string;
  quoteRequestId: string;
  version: number;
  validUntil: string | null;
  pricingTerms: string;
  currency: string;
  leadTimeDays: number | null;
  paymentTerms: string;
  // v2 fields
  productName?: string;
  specification?: string;
  quantityScenario?: string;
  generalNotes?: string;
  laborCostPerUnit?: number;
  totalUnitPrice?: number;
  materialCost?: {
    calculationMethod: string;
    pricePerKg?: number | null;
    pricePerUnit?: number | null;
    weightPerUnit?: number | null;
    materialNotes?: string;
  };
  packagingCost?: {
    wastageCost?: number;
    packagingNotes?: string;
    items: Array<{ order: number; componentName: string; componentType: string; unitCost: number; quantity: number; notes?: string }>;
  };
  timelineEstimate?: {
    packagingMinDays?: number; packagingMaxDays?: number;
    materialMinDays?: number; materialMaxDays?: number;
    fillingMinDays?: number; fillingMaxDays?: number;
    shippingMinDays?: number; shippingMaxDays?: number;
    stageOverlaps?: object; estimateNotes?: string;
  };
  // v1 legacy
  productLines?: import('@rd/shared').QuoteProductLine[];
  status: string;
  internalNotes: string;
}): QuoteWithDetails {
  const productLines = data.productLines ?? [];
  const firstLine = productLines[0];
  const unitPrice = firstLine?.totalRMB ?? 0;
  const moq = firstLine?.moq ?? 0;

  // Compute totalUnitPrice if not provided
  let totalUnitPrice = data.totalUnitPrice ?? 0;
  if (!totalUnitPrice && data.materialCost && data.packagingCost) {
    const mat = data.materialCost.pricePerUnit ?? (data.materialCost.pricePerKg ?? 0) * (data.materialCost.weightPerUnit ?? 0);
    const pkg = data.packagingCost.items.reduce((s, i) => s + i.unitCost * i.quantity, 0) + (data.packagingCost.wastageCost ?? 0);
    totalUnitPrice = mat + pkg + (data.laborCostPerUnit ?? 0);
  }

  db.prepare(`
    INSERT INTO quotes (id, quote_request_id, version, received_at, valid_until, pricing_terms,
      unit_price, currency, moq, lead_time_days, payment_terms, product_lines, status, internal_notes,
      product_name, specification, quantity_scenario, general_notes, total_unit_price, labor_cost_per_unit)
    VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.quoteRequestId, data.version, data.validUntil, data.pricingTerms,
    unitPrice, data.currency, moq, data.leadTimeDays, data.paymentTerms,
    JSON.stringify(productLines), data.status, data.internalNotes,
    data.productName ?? '', data.specification ?? '', data.quantityScenario ?? '',
    data.generalNotes ?? '', totalUnitPrice, data.laborCostPerUnit ?? 0
  );

  // Create sub-entities if provided
  if (data.materialCost) {
    const matId = uuidv4();
    const mc = data.materialCost;
    const total = mc.pricePerUnit != null
      ? mc.pricePerUnit
      : (mc.pricePerKg ?? 0) * (mc.weightPerUnit ?? 0);
    db.prepare(`INSERT INTO quote_material_costs (id, quote_id, calculation_method, price_per_kg, price_per_unit, weight_per_unit, total_material_cost, material_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(matId, data.id, mc.calculationMethod, mc.pricePerKg ?? null, mc.pricePerUnit ?? null, mc.weightPerUnit ?? null, total, mc.materialNotes ?? '');
  }

  if (data.packagingCost) {
    const pkgId = uuidv4();
    const pc = data.packagingCost;
    const itemsTotal = pc.items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
    const total = itemsTotal + (pc.wastageCost ?? 0);
    db.prepare(`INSERT INTO quote_packaging_costs (id, quote_id, total_packaging_cost, wastage_cost, packaging_notes) VALUES (?, ?, ?, ?, ?)`)
      .run(pkgId, data.id, total, pc.wastageCost ?? 0, pc.packagingNotes ?? '');
    for (const item of pc.items) {
      db.prepare(`INSERT INTO quote_packaging_items (id, quote_packaging_cost_id, "order", component_name, component_type, unit_cost, quantity, total_cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), pkgId, item.order, item.componentName, item.componentType, item.unitCost, item.quantity, item.unitCost * item.quantity, item.notes ?? '');
    }
  }

  if (data.timelineEstimate) {
    const te = data.timelineEstimate;
    const overlaps = te.stageOverlaps ?? { packagingMaterial: true, materialFilling: false };
    const pkgMin = te.packagingMinDays ?? 0; const pkgMax = te.packagingMaxDays ?? 0;
    const matMin = te.materialMinDays ?? 0; const matMax = te.materialMaxDays ?? 0;
    const fillMin = te.fillingMinDays ?? 0; const fillMax = te.fillingMaxDays ?? 0;
    const shipMin = te.shippingMinDays ?? 0; const shipMax = te.shippingMaxDays ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ov = overlaps as any;
    const totalMin = (ov.packagingMaterial ? Math.max(pkgMin, matMin) : pkgMin + matMin) + fillMin + shipMin;
    const totalMax = (ov.packagingMaterial ? Math.max(pkgMax, matMax) : pkgMax + matMax) + fillMax + shipMax;
    db.prepare(`INSERT INTO quote_timeline_estimates (id, quote_id, packaging_min_days, packaging_max_days, material_min_days, material_max_days, filling_min_days, filling_max_days, shipping_min_days, shipping_max_days, total_min_days, total_max_days, stage_overlaps, estimate_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), data.id, pkgMin, pkgMax, matMin, matMax, fillMin, fillMax, shipMin, shipMax, totalMin, totalMax, JSON.stringify(overlaps), te.estimateNotes ?? '');
  }

  return getQuoteById(data.id)!;
}

export function updateQuote(id: string, data: Partial<{
  validUntil: string | null;
  pricingTerms: string;
  currency: string;
  leadTimeDays: number | null;
  paymentTerms: string;
  productLines: import('@rd/shared').QuoteProductLine[];
  status: string;
  internalNotes: string;
  productName: string;
  specification: string;
  quantityScenario: string;
  generalNotes: string;
  laborCostPerUnit: number;
  totalUnitPrice: number;
}>): QuoteWithDetails | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.validUntil !== undefined) { sets.push('valid_until = ?'); params.push(data.validUntil); }
  if (data.pricingTerms !== undefined) { sets.push('pricing_terms = ?'); params.push(data.pricingTerms); }
  if (data.currency !== undefined) { sets.push('currency = ?'); params.push(data.currency); }
  if (data.leadTimeDays !== undefined) { sets.push('lead_time_days = ?'); params.push(data.leadTimeDays); }
  if (data.paymentTerms !== undefined) { sets.push('payment_terms = ?'); params.push(data.paymentTerms); }
  if (data.productLines !== undefined) {
    sets.push('product_lines = ?'); params.push(JSON.stringify(data.productLines));
    const first = data.productLines[0];
    if (first) { sets.push('unit_price = ?'); params.push(first.totalRMB); sets.push('moq = ?'); params.push(first.moq); }
  }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.internalNotes !== undefined) { sets.push('internal_notes = ?'); params.push(data.internalNotes); }
  if (data.productName !== undefined) { sets.push('product_name = ?'); params.push(data.productName); }
  if (data.specification !== undefined) { sets.push('specification = ?'); params.push(data.specification); }
  if (data.quantityScenario !== undefined) { sets.push('quantity_scenario = ?'); params.push(data.quantityScenario); }
  if (data.generalNotes !== undefined) { sets.push('general_notes = ?'); params.push(data.generalNotes); }
  if (data.laborCostPerUnit !== undefined) { sets.push('labor_cost_per_unit = ?'); params.push(data.laborCostPerUnit); }
  if (data.totalUnitPrice !== undefined) { sets.push('total_unit_price = ?'); params.push(data.totalUnitPrice); }

  if (sets.length === 0) return getQuoteById(id);

  params.push(id);
  db.prepare(`UPDATE quotes SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getQuoteById(id);
}

// -------------------------
// Packaging Templates CRUD
// -------------------------
export function getPackagingTemplates(): QuotePackagingTemplate[] {
  return (db.prepare('SELECT * FROM quote_packaging_templates ORDER BY usage_count DESC, name').all() as Row[]).map(rowToTemplate);
}

export function createPackagingTemplate(data: { id: string; name: string; productCategory: string; items: object[]; createdBy: string }): QuotePackagingTemplate {
  db.prepare('INSERT INTO quote_packaging_templates (id, name, product_category, items, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(data.id, data.name, data.productCategory, JSON.stringify(data.items), data.createdBy);
  return rowToTemplate(db.prepare('SELECT * FROM quote_packaging_templates WHERE id = ?').get(data.id) as Row);
}

export function deletePackagingTemplate(id: string): void {
  db.prepare('DELETE FROM quote_packaging_templates WHERE id = ?').run(id);
}

export function incrementTemplateUsage(id: string): void {
  db.prepare('UPDATE quote_packaging_templates SET usage_count = usage_count + 1 WHERE id = ?').run(id);
}

// -------------------------
// Quote sub-entity updates (inline upsert)
// -------------------------
export function upsertMaterialCost(quoteId: string, data: {
  calculationMethod: string; pricePerKg?: number | null; pricePerUnit?: number | null; weightPerUnit?: number | null; materialNotes?: string;
}): QuoteMaterialCost {
  const existing = db.prepare('SELECT * FROM quote_material_costs WHERE quote_id = ?').get(quoteId) as Row | undefined;
  const total = data.pricePerUnit != null ? data.pricePerUnit : (data.pricePerKg ?? 0) * (data.weightPerUnit ?? 0);
  if (existing) {
    db.prepare('UPDATE quote_material_costs SET calculation_method=?, price_per_kg=?, price_per_unit=?, weight_per_unit=?, total_material_cost=?, material_notes=? WHERE id=?')
      .run(data.calculationMethod, data.pricePerKg ?? null, data.pricePerUnit ?? null, data.weightPerUnit ?? null, total, data.materialNotes ?? '', existing.id);
    return rowToMaterialCost(db.prepare('SELECT * FROM quote_material_costs WHERE id = ?').get(existing.id) as Row);
  }
  const id = uuidv4();
  db.prepare('INSERT INTO quote_material_costs (id, quote_id, calculation_method, price_per_kg, price_per_unit, weight_per_unit, total_material_cost, material_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, quoteId, data.calculationMethod, data.pricePerKg ?? null, data.pricePerUnit ?? null, data.weightPerUnit ?? null, total, data.materialNotes ?? '');
  return rowToMaterialCost(db.prepare('SELECT * FROM quote_material_costs WHERE id = ?').get(id) as Row);
}

export function upsertPackagingCost(quoteId: string, data: {
  wastageCost?: number; packagingNotes?: string;
  items: Array<{ order: number; componentName: string; componentType: string; unitCost: number; quantity: number; notes?: string }>;
}): QuotePackagingCost {
  const existing = db.prepare('SELECT * FROM quote_packaging_costs WHERE quote_id = ?').get(quoteId) as Row | undefined;
  const itemsTotal = data.items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const total = itemsTotal + (data.wastageCost ?? 0);
  let pkgId: string;
  if (existing) {
    pkgId = existing.id;
    db.prepare('UPDATE quote_packaging_costs SET total_packaging_cost=?, wastage_cost=?, packaging_notes=? WHERE id=?')
      .run(total, data.wastageCost ?? 0, data.packagingNotes ?? '', pkgId);
    db.prepare('DELETE FROM quote_packaging_items WHERE quote_packaging_cost_id = ?').run(pkgId);
  } else {
    pkgId = uuidv4();
    db.prepare('INSERT INTO quote_packaging_costs (id, quote_id, total_packaging_cost, wastage_cost, packaging_notes) VALUES (?, ?, ?, ?, ?)')
      .run(pkgId, quoteId, total, data.wastageCost ?? 0, data.packagingNotes ?? '');
  }
  for (const item of data.items) {
    db.prepare('INSERT INTO quote_packaging_items (id, quote_packaging_cost_id, "order", component_name, component_type, unit_cost, quantity, total_cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), pkgId, item.order, item.componentName, item.componentType, item.unitCost, item.quantity, item.unitCost * item.quantity, item.notes ?? '');
  }
  const pkgRow = db.prepare('SELECT * FROM quote_packaging_costs WHERE id = ?').get(pkgId) as Row;
  const items = (db.prepare('SELECT * FROM quote_packaging_items WHERE quote_packaging_cost_id = ? ORDER BY "order"').all(pkgId) as Row[]).map(rowToPackagingItem);
  return rowToPackagingCost(pkgRow, items);
}

export function upsertTimelineEstimate(quoteId: string, data: {
  packagingMinDays?: number; packagingMaxDays?: number;
  materialMinDays?: number; materialMaxDays?: number;
  fillingMinDays?: number; fillingMaxDays?: number;
  shippingMinDays?: number; shippingMaxDays?: number;
  stageOverlaps?: object; estimateNotes?: string;
}): QuoteTimelineEstimate {
  const pkgMin = data.packagingMinDays ?? 0; const pkgMax = data.packagingMaxDays ?? 0;
  const matMin = data.materialMinDays ?? 0; const matMax = data.materialMaxDays ?? 0;
  const fillMin = data.fillingMinDays ?? 0; const fillMax = data.fillingMaxDays ?? 0;
  const shipMin = data.shippingMinDays ?? 0; const shipMax = data.shippingMaxDays ?? 0;
  const overlaps = data.stageOverlaps ?? { packagingMaterial: true, materialFilling: false };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ov = overlaps as any;
  const totalMin = (ov.packagingMaterial ? Math.max(pkgMin, matMin) : pkgMin + matMin) + fillMin + shipMin;
  const totalMax = (ov.packagingMaterial ? Math.max(pkgMax, matMax) : pkgMax + matMax) + fillMax + shipMax;
  const existing = db.prepare('SELECT * FROM quote_timeline_estimates WHERE quote_id = ?').get(quoteId) as Row | undefined;
  if (existing) {
    db.prepare('UPDATE quote_timeline_estimates SET packaging_min_days=?, packaging_max_days=?, material_min_days=?, material_max_days=?, filling_min_days=?, filling_max_days=?, shipping_min_days=?, shipping_max_days=?, total_min_days=?, total_max_days=?, stage_overlaps=?, estimate_notes=? WHERE id=?')
      .run(pkgMin, pkgMax, matMin, matMax, fillMin, fillMax, shipMin, shipMax, totalMin, totalMax, JSON.stringify(overlaps), data.estimateNotes ?? '', existing.id);
    return rowToTimelineEstimate(db.prepare('SELECT * FROM quote_timeline_estimates WHERE id = ?').get(existing.id) as Row);
  }
  const id = uuidv4();
  db.prepare('INSERT INTO quote_timeline_estimates (id, quote_id, packaging_min_days, packaging_max_days, material_min_days, material_max_days, filling_min_days, filling_max_days, shipping_min_days, shipping_max_days, total_min_days, total_max_days, stage_overlaps, estimate_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, quoteId, pkgMin, pkgMax, matMin, matMax, fillMin, fillMax, shipMin, shipMax, totalMin, totalMax, JSON.stringify(overlaps), data.estimateNotes ?? '');
  return rowToTimelineEstimate(db.prepare('SELECT * FROM quote_timeline_estimates WHERE id = ?').get(id) as Row);
}

// -------------------------
// NegotiationLog CRUD
// -------------------------
export function getNegotiationsByEngagement(engagementId: string): NegotiationLog[] {
  return (db.prepare('SELECT * FROM negotiation_logs WHERE engagement_id = ? ORDER BY logged_at DESC').all(engagementId) as Row[])
    .map(rowToNegotiationLog);
}

export function getNegotiationById(id: string): NegotiationLog | undefined {
  const row = db.prepare('SELECT * FROM negotiation_logs WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToNegotiationLog(row) : undefined;
}

export function createNegotiationLog(data: {
  id: string;
  engagementId: string;
  quoteId: string | null;
  loggedBy: string;
  type: string;
  subject: string;
  ourPosition: string;
  theirPosition: string;
  outcome: string;
  nextSteps: string;
  assignedTo?: string;
  status?: string;
  targetObjective?: string;
  deadline?: string | null;
}): NegotiationLog {
  db.prepare(`
    INSERT INTO negotiation_logs (id, engagement_id, quote_id, logged_at, logged_by, type,
      subject, our_position, their_position, outcome, next_steps,
      assigned_to, status, target_objective, deadline, updates)
    VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
  `).run(
    data.id, data.engagementId, data.quoteId, data.loggedBy, data.type,
    data.subject, data.ourPosition, data.theirPosition, data.outcome, data.nextSteps,
    data.assignedTo ?? '', data.status ?? 'open', data.targetObjective ?? '', data.deadline ?? null
  );
  return rowToNegotiationLog(db.prepare('SELECT * FROM negotiation_logs WHERE id = ?').get(data.id) as Row);
}

export function updateNegotiationLog(id: string, data: Partial<{
  quoteId: string | null;
  loggedBy: string;
  type: string;
  subject: string;
  ourPosition: string;
  theirPosition: string;
  outcome: string;
  nextSteps: string;
  assignedTo: string;
  status: string;
  targetObjective: string;
  deadline: string | null;
  updates: string;
}>): NegotiationLog | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.quoteId !== undefined) { sets.push('quote_id = ?'); params.push(data.quoteId); }
  if (data.loggedBy !== undefined) { sets.push('logged_by = ?'); params.push(data.loggedBy); }
  if (data.type !== undefined) { sets.push('type = ?'); params.push(data.type); }
  if (data.subject !== undefined) { sets.push('subject = ?'); params.push(data.subject); }
  if (data.ourPosition !== undefined) { sets.push('our_position = ?'); params.push(data.ourPosition); }
  if (data.theirPosition !== undefined) { sets.push('their_position = ?'); params.push(data.theirPosition); }
  if (data.outcome !== undefined) { sets.push('outcome = ?'); params.push(data.outcome); }
  if (data.nextSteps !== undefined) { sets.push('next_steps = ?'); params.push(data.nextSteps); }
  if (data.assignedTo !== undefined) { sets.push('assigned_to = ?'); params.push(data.assignedTo); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.targetObjective !== undefined) { sets.push('target_objective = ?'); params.push(data.targetObjective); }
  if (data.deadline !== undefined) { sets.push('deadline = ?'); params.push(data.deadline); }
  if (data.updates !== undefined) { sets.push('updates = ?'); params.push(data.updates); }

  if (sets.length === 0) return getNegotiationById(id);

  params.push(id);
  db.prepare(`UPDATE negotiation_logs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM negotiation_logs WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToNegotiationLog(row) : undefined;
}

export function deleteNegotiationLog(id: string): void {
  db.prepare('DELETE FROM negotiation_logs WHERE id = ?').run(id);
}

export function addNegotiationUpdate(id: string, update: {
  id: string; date: string; factoryResponseAt: string | null; updatedBy: string;
  ourPosition: string; theirPosition: string; outcome: string; nextSteps: string;
  attachments: unknown[];
}): NegotiationLog | undefined {
  const row = db.prepare('SELECT * FROM negotiation_logs WHERE id = ?').get(id) as Row | undefined;
  if (!row) return undefined;
  let updates: unknown[] = [];
  try { updates = JSON.parse(row.updates || '[]'); } catch { updates = []; }
  updates.push(update);
  db.prepare('UPDATE negotiation_logs SET updates = ?, status = ? WHERE id = ?').run(
    JSON.stringify(updates),
    row.status === 'open' ? 'in-progress' : row.status,
    id
  );
  return rowToNegotiationLog(db.prepare('SELECT * FROM negotiation_logs WHERE id = ?').get(id) as Row);
}

export function addNegotiationAttachment(
  negId: string,
  updateId: string,
  attachment: { id: string; filename: string; originalName: string; mimetype: string; size: number; uploadedAt: string; uploadedBy: string }
): NegotiationLog | undefined {
  const row = db.prepare('SELECT * FROM negotiation_logs WHERE id = ?').get(negId) as Row | undefined;
  if (!row) return undefined;
  let updates: Row[] = [];
  try { updates = JSON.parse(row.updates || '[]'); } catch { updates = []; }
  const idx = updates.findIndex((u) => u.id === updateId);
  if (idx === -1) return undefined;
  const u = updates[idx];
  const atts: unknown[] = Array.isArray(u.attachments) ? u.attachments : [];
  atts.push(attachment);
  updates[idx] = { ...u, attachments: atts };
  db.prepare('UPDATE negotiation_logs SET updates = ? WHERE id = ?').run(JSON.stringify(updates), negId);
  return rowToNegotiationLog(db.prepare('SELECT * FROM negotiation_logs WHERE id = ?').get(negId) as Row);
}

export function removeNegotiationAttachment(
  negId: string,
  updateId: string,
  attachmentId: string
): { log: NegotiationLog | undefined; filename: string | undefined } {
  const row = db.prepare('SELECT * FROM negotiation_logs WHERE id = ?').get(negId) as Row | undefined;
  if (!row) return { log: undefined, filename: undefined };
  let updates: Row[] = [];
  try { updates = JSON.parse(row.updates || '[]'); } catch { updates = []; }
  const idx = updates.findIndex((u) => u.id === updateId);
  if (idx === -1) return { log: undefined, filename: undefined };
  const u = updates[idx];
  const atts: Row[] = Array.isArray(u.attachments) ? u.attachments : [];
  const att = atts.find((a) => a.id === attachmentId);
  updates[idx] = { ...u, attachments: atts.filter((a) => a.id !== attachmentId) };
  db.prepare('UPDATE negotiation_logs SET updates = ? WHERE id = ?').run(JSON.stringify(updates), negId);
  return {
    log: rowToNegotiationLog(db.prepare('SELECT * FROM negotiation_logs WHERE id = ?').get(negId) as Row),
    filename: att?.filename as string | undefined,
  };
}

// -------------------------
// Sample CRUD
// -------------------------
export function getNextSampleNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `SMP-${year}-`;
  const row = db.prepare(`
    SELECT sample_number FROM samples
    WHERE sample_number LIKE ?
    ORDER BY sample_number DESC LIMIT 1
  `).get(`${prefix}%`) as Row | undefined;

  if (!row) return `${prefix}001`;
  const last = row.sample_number as string;
  const num = parseInt(last.replace(prefix, ''), 10);
  return `${prefix}${String(num + 1).padStart(3, '0')}`;
}

export function getSamplesByEngagement(engagementId: string): Sample[] {
  return (db.prepare('SELECT * FROM samples WHERE engagement_id = ? ORDER BY received_at DESC').all(engagementId) as Row[])
    .map(rowToSample);
}

export function getSampleById(id: string): Sample | undefined {
  const row = db.prepare('SELECT * FROM samples WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToSample(row) : undefined;
}

export function createSample(data: {
  id: string;
  engagementId: string;
  sampleNumber: string;
  type: string;
  version: number;
  receivedBy: string;
  description: string;
  evaluationStatus: string;
  evaluatedBy: string;
  evaluatedAt: string | null;
  evaluationCriteria: Array<{ criterion: string; rating: number; notes: string }>;
  overallRating: number | null;
  feedbackToFactory: string;
  revisionRequested: boolean;
  revisionDetails: string;
}): Sample {
  db.prepare(`
    INSERT INTO samples (id, engagement_id, sample_number, type, version, received_at,
      received_by, description, evaluation_status, evaluated_by, evaluated_at,
      evaluation_criteria, overall_rating, feedback_to_factory, revision_requested, revision_details)
    VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.engagementId, data.sampleNumber, data.type, data.version,
    data.receivedBy, data.description, data.evaluationStatus, data.evaluatedBy,
    data.evaluatedAt, JSON.stringify(data.evaluationCriteria),
    data.overallRating, data.feedbackToFactory,
    data.revisionRequested ? 1 : 0, data.revisionDetails
  );
  return rowToSample(db.prepare('SELECT * FROM samples WHERE id = ?').get(data.id) as Row);
}

export function updateSample(id: string, data: Partial<{
  type: string;
  version: number;
  receivedBy: string;
  description: string;
  evaluationStatus: string;
  evaluatedBy: string;
  evaluatedAt: string | null;
  evaluationCriteria: Array<{ criterion: string; rating: number; notes: string }>;
  overallRating: number | null;
  feedbackToFactory: string;
  revisionRequested: boolean;
  revisionDetails: string;
  formula: object;
}>): Sample | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.type !== undefined) { sets.push('type = ?'); params.push(data.type); }
  if (data.version !== undefined) { sets.push('version = ?'); params.push(data.version); }
  if (data.receivedBy !== undefined) { sets.push('received_by = ?'); params.push(data.receivedBy); }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  if (data.evaluationStatus !== undefined) { sets.push('evaluation_status = ?'); params.push(data.evaluationStatus); }
  if (data.evaluatedBy !== undefined) { sets.push('evaluated_by = ?'); params.push(data.evaluatedBy); }
  if (data.evaluatedAt !== undefined) { sets.push('evaluated_at = ?'); params.push(data.evaluatedAt); }
  if (data.evaluationCriteria !== undefined) { sets.push('evaluation_criteria = ?'); params.push(JSON.stringify(data.evaluationCriteria)); }
  if (data.overallRating !== undefined) { sets.push('overall_rating = ?'); params.push(data.overallRating); }
  if (data.feedbackToFactory !== undefined) { sets.push('feedback_to_factory = ?'); params.push(data.feedbackToFactory); }
  if (data.revisionRequested !== undefined) { sets.push('revision_requested = ?'); params.push(data.revisionRequested ? 1 : 0); }
  if (data.revisionDetails !== undefined) { sets.push('revision_details = ?'); params.push(data.revisionDetails); }
  if (data.formula !== undefined) { sets.push('formula = ?'); params.push(JSON.stringify(data.formula)); }

  if (sets.length === 0) return getSampleById(id);

  params.push(id);
  db.prepare(`UPDATE samples SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM samples WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToSample(row) : undefined;
}

export function addSampleAttachment(
  sampleId: string,
  attachment: { id: string; filename: string; originalName: string; mimetype: string; size: number; uploadedAt: string; uploadedBy: string }
): Sample | undefined {
  const row = db.prepare('SELECT * FROM samples WHERE id = ?').get(sampleId) as Row | undefined;
  if (!row) return undefined;
  let atts: unknown[] = [];
  try { atts = JSON.parse(row.attachments || '[]'); } catch { atts = []; }
  atts.push(attachment);
  db.prepare('UPDATE samples SET attachments = ? WHERE id = ?').run(JSON.stringify(atts), sampleId);
  return rowToSample(db.prepare('SELECT * FROM samples WHERE id = ?').get(sampleId) as Row);
}

export function removeSampleAttachment(
  sampleId: string,
  attachmentId: string
): { sample: Sample | undefined; filename: string | undefined } {
  const row = db.prepare('SELECT * FROM samples WHERE id = ?').get(sampleId) as Row | undefined;
  if (!row) return { sample: undefined, filename: undefined };
  let atts: Row[] = [];
  try { atts = JSON.parse(row.attachments || '[]'); } catch { atts = []; }
  const att = atts.find((a) => a.id === attachmentId);
  db.prepare('UPDATE samples SET attachments = ? WHERE id = ?').run(
    JSON.stringify(atts.filter((a) => a.id !== attachmentId)),
    sampleId
  );
  return {
    sample: rowToSample(db.prepare('SELECT * FROM samples WHERE id = ?').get(sampleId) as Row),
    filename: att?.filename as string | undefined,
  };
}

export function addSampleLink(
  sampleId: string,
  link: { id: string; title: string; url: string; addedAt: string; addedBy: string }
): Sample | undefined {
  const row = db.prepare('SELECT * FROM samples WHERE id = ?').get(sampleId) as Row | undefined;
  if (!row) return undefined;
  let links: unknown[] = [];
  try { links = JSON.parse(row.links || '[]'); } catch { links = []; }
  links.push(link);
  db.prepare('UPDATE samples SET links = ? WHERE id = ?').run(JSON.stringify(links), sampleId);
  return rowToSample(db.prepare('SELECT * FROM samples WHERE id = ?').get(sampleId) as Row);
}

export function removeSampleLink(sampleId: string, linkId: string): Sample | undefined {
  const row = db.prepare('SELECT * FROM samples WHERE id = ?').get(sampleId) as Row | undefined;
  if (!row) return undefined;
  let links: Row[] = [];
  try { links = JSON.parse(row.links || '[]'); } catch { links = []; }
  db.prepare('UPDATE samples SET links = ? WHERE id = ?').run(
    JSON.stringify(links.filter((l) => l.id !== linkId)),
    sampleId
  );
  return rowToSample(db.prepare('SELECT * FROM samples WHERE id = ?').get(sampleId) as Row);
}

// -------------------------
// PackagingDesign CRUD
// -------------------------
export function getPackagingByProject(projectId: string): PackagingDesign[] {
  return (db.prepare('SELECT * FROM packaging_designs WHERE project_id = ? ORDER BY name ASC').all(projectId) as Row[])
    .map(rowToPackagingDesign);
}

export function getPackagingByEngagement(engagementId: string): PackagingDesign[] {
  return (db.prepare('SELECT * FROM packaging_designs WHERE engagement_id = ? ORDER BY name ASC').all(engagementId) as Row[])
    .map(rowToPackagingDesign);
}

export function getPackagingById(id: string): PackagingDesign | undefined {
  const row = db.prepare('SELECT * FROM packaging_designs WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToPackagingDesign(row) : undefined;
}

export function createPackagingDesign(data: {
  id: string;
  engagementId: string | null;
  projectId: string;
  componentType: string;
  name: string;
  currentVersion: number;
  status: string;
  briefSentAt: string | null;
  briefDocument: string;
  specifications: Record<string, string>;
  targetCost: number | null;
  actualCost: number | null;
  finalizedAt: string | null;
}): PackagingDesign {
  db.prepare(`
    INSERT INTO packaging_designs (id, engagement_id, project_id, component_type, name,
      current_version, status, brief_sent_at, brief_document, specifications,
      target_cost, actual_cost, finalized_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.engagementId, data.projectId, data.componentType, data.name,
    data.currentVersion, data.status, data.briefSentAt, data.briefDocument,
    JSON.stringify(data.specifications), data.targetCost, data.actualCost, data.finalizedAt
  );
  return rowToPackagingDesign(db.prepare('SELECT * FROM packaging_designs WHERE id = ?').get(data.id) as Row);
}

export function updatePackagingDesign(id: string, data: Partial<{
  engagementId: string | null;
  componentType: string;
  name: string;
  currentVersion: number;
  status: string;
  briefSentAt: string | null;
  briefDocument: string;
  specifications: Record<string, string>;
  targetCost: number | null;
  actualCost: number | null;
  finalizedAt: string | null;
}>): PackagingDesign | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.engagementId !== undefined) { sets.push('engagement_id = ?'); params.push(data.engagementId); }
  if (data.componentType !== undefined) { sets.push('component_type = ?'); params.push(data.componentType); }
  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.currentVersion !== undefined) { sets.push('current_version = ?'); params.push(data.currentVersion); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.briefSentAt !== undefined) { sets.push('brief_sent_at = ?'); params.push(data.briefSentAt); }
  if (data.briefDocument !== undefined) { sets.push('brief_document = ?'); params.push(data.briefDocument); }
  if (data.specifications !== undefined) { sets.push('specifications = ?'); params.push(JSON.stringify(data.specifications)); }
  if (data.targetCost !== undefined) { sets.push('target_cost = ?'); params.push(data.targetCost); }
  if (data.actualCost !== undefined) { sets.push('actual_cost = ?'); params.push(data.actualCost); }
  if (data.finalizedAt !== undefined) { sets.push('finalized_at = ?'); params.push(data.finalizedAt); }

  if (sets.length === 0) return getPackagingById(id);

  params.push(id);
  db.prepare(`UPDATE packaging_designs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM packaging_designs WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToPackagingDesign(row) : undefined;
}

// -------------------------
// PackagingRevision CRUD
// -------------------------
export function getRevisionsByDesign(designId: string): PackagingRevision[] {
  return (db.prepare('SELECT * FROM packaging_revisions WHERE packaging_design_id = ? ORDER BY revision_number ASC').all(designId) as Row[])
    .map(rowToPackagingRevision);
}

export function getRevisionById(id: string): PackagingRevision | undefined {
  const row = db.prepare('SELECT * FROM packaging_revisions WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToPackagingRevision(row) : undefined;
}

export function createPackagingRevision(data: {
  id: string;
  packagingDesignId: string;
  revisionNumber: number;
  submittedByFactoryAt: string;
  reviewedAt: string | null;
  reviewedBy: string;
  issues: Array<{ category: string; severity: 'low' | 'medium' | 'high'; description: string }>;
  overallDecision: string | null;
  feedbackSummary: string;
  factoryResponseAt: string | null;
  factoryResponse: string;
}): PackagingRevision {
  db.prepare(`
    INSERT INTO packaging_revisions (id, packaging_design_id, revision_number, submitted_by_factory_at,
      reviewed_at, reviewed_by, issues, overall_decision, feedback_summary,
      factory_response_at, factory_response)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.packagingDesignId, data.revisionNumber, data.submittedByFactoryAt,
    data.reviewedAt, data.reviewedBy, JSON.stringify(data.issues),
    data.overallDecision, data.feedbackSummary, data.factoryResponseAt, data.factoryResponse
  );
  return rowToPackagingRevision(db.prepare('SELECT * FROM packaging_revisions WHERE id = ?').get(data.id) as Row);
}

export function updatePackagingRevision(id: string, data: Partial<{
  submittedByFactoryAt: string;
  reviewedAt: string | null;
  reviewedBy: string;
  issues: Array<{ category: string; severity: 'low' | 'medium' | 'high'; description: string }>;
  overallDecision: string | null;
  feedbackSummary: string;
  factoryResponseAt: string | null;
  factoryResponse: string;
}>): PackagingRevision | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.submittedByFactoryAt !== undefined) { sets.push('submitted_by_factory_at = ?'); params.push(data.submittedByFactoryAt); }
  if (data.reviewedAt !== undefined) { sets.push('reviewed_at = ?'); params.push(data.reviewedAt); }
  if (data.reviewedBy !== undefined) { sets.push('reviewed_by = ?'); params.push(data.reviewedBy); }
  if (data.issues !== undefined) { sets.push('issues = ?'); params.push(JSON.stringify(data.issues)); }
  if (data.overallDecision !== undefined) { sets.push('overall_decision = ?'); params.push(data.overallDecision); }
  if (data.feedbackSummary !== undefined) { sets.push('feedback_summary = ?'); params.push(data.feedbackSummary); }
  if (data.factoryResponseAt !== undefined) { sets.push('factory_response_at = ?'); params.push(data.factoryResponseAt); }
  if (data.factoryResponse !== undefined) { sets.push('factory_response = ?'); params.push(data.factoryResponse); }

  if (sets.length === 0) return getRevisionById(id);

  params.push(id);
  db.prepare(`UPDATE packaging_revisions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM packaging_revisions WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToPackagingRevision(row) : undefined;
}

// -------------------------
// FactoryCommunication CRUD
// -------------------------
export function getCommunicationsByEngagement(engagementId: string): FactoryCommunication[] {
  return (db.prepare('SELECT * FROM factory_communications WHERE engagement_id = ? ORDER BY logged_at DESC').all(engagementId) as Row[])
    .map(rowToFactoryCommunication);
}

export function getCommunicationById(id: string): FactoryCommunication | undefined {
  const row = db.prepare('SELECT * FROM factory_communications WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToFactoryCommunication(row) : undefined;
}

export function createCommunication(data: {
  id: string;
  engagementId: string;
  contactId: string | null;
  channel: string;
  direction: string;
  loggedBy: string;
  subject: string;
  summary: string;
  actionItems: Array<{ who: string; what: string; due: string | null; done: boolean }>;
}): FactoryCommunication {
  db.prepare(`
    INSERT INTO factory_communications (id, engagement_id, contact_id, channel, direction,
      logged_at, logged_by, subject, summary, action_items)
    VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?)
  `).run(
    data.id, data.engagementId, data.contactId, data.channel, data.direction,
    data.loggedBy, data.subject, data.summary, JSON.stringify(data.actionItems)
  );
  return rowToFactoryCommunication(db.prepare('SELECT * FROM factory_communications WHERE id = ?').get(data.id) as Row);
}

export function updateCommunication(id: string, data: Partial<{
  contactId: string | null;
  channel: string;
  direction: string;
  loggedBy: string;
  subject: string;
  summary: string;
  actionItems: Array<{ who: string; what: string; due: string | null; done: boolean }>;
}>): FactoryCommunication | undefined {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.contactId !== undefined) { sets.push('contact_id = ?'); params.push(data.contactId); }
  if (data.channel !== undefined) { sets.push('channel = ?'); params.push(data.channel); }
  if (data.direction !== undefined) { sets.push('direction = ?'); params.push(data.direction); }
  if (data.loggedBy !== undefined) { sets.push('logged_by = ?'); params.push(data.loggedBy); }
  if (data.subject !== undefined) { sets.push('subject = ?'); params.push(data.subject); }
  if (data.summary !== undefined) { sets.push('summary = ?'); params.push(data.summary); }
  if (data.actionItems !== undefined) { sets.push('action_items = ?'); params.push(JSON.stringify(data.actionItems)); }

  if (sets.length === 0) return getCommunicationById(id);

  params.push(id);
  db.prepare(`UPDATE factory_communications SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM factory_communications WHERE id = ?').get(id) as Row | undefined;
  return row ? rowToFactoryCommunication(row) : undefined;
}

export function deleteCommunication(id: string): boolean {
  const result = db.prepare('DELETE FROM factory_communications WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------
// Factory Stats & Alerts
// -------------------------
export function getFactoryStats(factoryId: string): {
  totalEngagements: number;
  activeEngagements: number;
  avgLeadTime: number | null;
  sampleApprovalRate: number | null;
} {
  const totalEngagements = (db.prepare(`
    SELECT COUNT(*) as cnt FROM factory_engagements WHERE factory_id = ?
  `).get(factoryId) as { cnt: number }).cnt;

  const activeEngagements = (db.prepare(`
    SELECT COUNT(*) as cnt FROM factory_engagements
    WHERE factory_id = ? AND status NOT IN ('completed','cancelled')
  `).get(factoryId) as { cnt: number }).cnt;

  const avgLeadTimeRow = db.prepare(`
    SELECT AVG(q.lead_time_days) as avg_lt
    FROM quotes q
    JOIN quote_requests qr ON qr.id = q.quote_request_id
    JOIN factory_engagements fe ON fe.id = qr.engagement_id
    WHERE fe.factory_id = ? AND q.lead_time_days IS NOT NULL AND q.status = 'accepted'
  `).get(factoryId) as { avg_lt: number | null };

  const sampleRow = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN evaluation_status IN ('approved','approved-with-changes') THEN 1 ELSE 0 END) as approved
    FROM samples s
    JOIN factory_engagements fe ON fe.id = s.engagement_id
    WHERE fe.factory_id = ? AND evaluation_status != 'pending-evaluation'
  `).get(factoryId) as { total: number; approved: number };

  const sampleApprovalRate = sampleRow.total > 0
    ? Math.round((sampleRow.approved / sampleRow.total) * 100)
    : null;

  return {
    totalEngagements,
    activeEngagements,
    avgLeadTime: avgLeadTimeRow.avg_lt,
    sampleApprovalRate,
  };
}

export function getFactoryAlerts(projectId: string): Array<{
  type: string;
  message: string;
  engagementId: string;
  severity: 'low' | 'medium' | 'high';
}> {
  const alerts: Array<{ type: string; message: string; engagementId: string; severity: 'low' | 'medium' | 'high' }> = [];

  // Overdue RFQs: sent/received/clarifying past deadline
  const overdueRFQs = db.prepare(`
    SELECT qr.*, fe.id as eng_id
    FROM quote_requests qr
    JOIN factory_engagements fe ON fe.id = qr.engagement_id
    WHERE fe.project_id = ?
      AND qr.status IN ('sent','received','clarifying')
      AND qr.deadline_for_response < date('now')
      AND qr.deadline_for_response IS NOT NULL
  `).all(projectId) as Row[];

  for (const r of overdueRFQs) {
    alerts.push({
      type: 'overdue_rfq',
      message: `RFQ ${r.request_number} đã quá hạn phản hồi`,
      engagementId: r.eng_id,
      severity: 'high',
    });
  }

  // Pending samples awaiting evaluation
  const pendingSamples = db.prepare(`
    SELECT s.sample_number, fe.id as eng_id
    FROM samples s
    JOIN factory_engagements fe ON fe.id = s.engagement_id
    WHERE fe.project_id = ?
      AND s.evaluation_status = 'pending-evaluation'
  `).all(projectId) as Row[];

  for (const r of pendingSamples) {
    alerts.push({
      type: 'pending_sample',
      message: `Mẫu ${r.sample_number} đang chờ đánh giá`,
      engagementId: r.eng_id,
      severity: 'medium',
    });
  }

  // Expiring quotes (valid_until within next 7 days)
  const expiringQuotes = db.prepare(`
    SELECT q.id, qr.request_number, q.valid_until, fe.id as eng_id
    FROM quotes q
    JOIN quote_requests qr ON qr.id = q.quote_request_id
    JOIN factory_engagements fe ON fe.id = qr.engagement_id
    WHERE fe.project_id = ?
      AND q.status = 'pending-review'
      AND q.valid_until IS NOT NULL
      AND q.valid_until BETWEEN date('now') AND date('now', '+7 days')
  `).all(projectId) as Row[];

  for (const r of expiringQuotes) {
    alerts.push({
      type: 'expiring_quote',
      message: `Báo giá cho RFQ ${r.request_number} sẽ hết hạn vào ${r.valid_until}`,
      engagementId: r.eng_id,
      severity: 'low',
    });
  }

  return alerts;
}

// -------------------------
// Production Execution CRUD
// -------------------------
export function getProductionsByEngagement(engagementId: string): ProductionExecution[] {
  return (db.prepare('SELECT * FROM production_executions WHERE engagement_id = ? ORDER BY created_at DESC').all(engagementId) as Row[]).map(rowToProductionExecution);
}

export function getProductionById(id: string): ProductionExecutionWithPhases | undefined {
  const row = db.prepare('SELECT * FROM production_executions WHERE id = ?').get(id) as Row | undefined;
  if (!row) return undefined;
  const phases = (db.prepare('SELECT * FROM production_phases WHERE production_execution_id = ? ORDER BY "order"').all(id) as Row[]).map(rowToProductionPhase);
  return { ...rowToProductionExecution(row), phases };
}

export function createProductionExecution(data: {
  id: string; engagementId: string; quoteId: string;
  productionOrderNumber?: string; orderConfirmedAt?: string;
  depositPaidAt?: string | null; status?: string; overallNotes?: string;
}): ProductionExecution {
  db.prepare(`INSERT INTO production_executions (id, engagement_id, quote_id, production_order_number, order_confirmed_at, deposit_paid_at, status, overall_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(data.id, data.engagementId, data.quoteId, data.productionOrderNumber ?? '', data.orderConfirmedAt ?? new Date().toISOString().slice(0, 10), data.depositPaidAt ?? null, data.status ?? 'not-started', data.overallNotes ?? '');
  return rowToProductionExecution(db.prepare('SELECT * FROM production_executions WHERE id = ?').get(data.id) as Row);
}

export function updateProductionExecution(id: string, data: Partial<{
  productionOrderNumber: string; orderConfirmedAt: string; depositPaidAt: string | null;
  status: string; overallNotes: string;
}>): ProductionExecution | undefined {
  const sets: string[] = []; const params: unknown[] = [];
  if (data.productionOrderNumber !== undefined) { sets.push('production_order_number = ?'); params.push(data.productionOrderNumber); }
  if (data.orderConfirmedAt !== undefined) { sets.push('order_confirmed_at = ?'); params.push(data.orderConfirmedAt); }
  if (data.depositPaidAt !== undefined) { sets.push('deposit_paid_at = ?'); params.push(data.depositPaidAt); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.overallNotes !== undefined) { sets.push('overall_notes = ?'); params.push(data.overallNotes); }
  if (sets.length === 0) { const r = db.prepare('SELECT * FROM production_executions WHERE id = ?').get(id) as Row | undefined; return r ? rowToProductionExecution(r) : undefined; }
  sets.push('updated_at = datetime(\'now\')'); params.push(id);
  db.prepare(`UPDATE production_executions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const r = db.prepare('SELECT * FROM production_executions WHERE id = ?').get(id) as Row | undefined;
  return r ? rowToProductionExecution(r) : undefined;
}

export function createProductionPhase(data: {
  id: string; productionExecutionId: string; phaseType: string; phaseName: string;
  plannedStartDate?: string | null; plannedEndDate?: string | null;
  actualStartDate?: string | null; actualEndDate?: string | null;
  status?: string; delayReason?: string | null; dependsOn?: string[]; notes?: string; order?: number;
}): ProductionPhase {
  const plannedDays = (data.plannedStartDate && data.plannedEndDate)
    ? Math.round((new Date(data.plannedEndDate).getTime() - new Date(data.plannedStartDate).getTime()) / 86400000)
    : null;
  const actualDays = (data.actualStartDate && data.actualEndDate)
    ? Math.round((new Date(data.actualEndDate).getTime() - new Date(data.actualStartDate).getTime()) / 86400000)
    : null;
  db.prepare(`INSERT INTO production_phases (id, production_execution_id, phase_type, phase_name, planned_start_date, planned_end_date, actual_start_date, actual_end_date, planned_days, actual_days, status, delay_reason, depends_on, notes, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(data.id, data.productionExecutionId, data.phaseType, data.phaseName, data.plannedStartDate ?? null, data.plannedEndDate ?? null, data.actualStartDate ?? null, data.actualEndDate ?? null, plannedDays, actualDays, data.status ?? 'not-started', data.delayReason ?? null, JSON.stringify(data.dependsOn ?? []), data.notes ?? '', data.order ?? 1);
  return rowToProductionPhase(db.prepare('SELECT * FROM production_phases WHERE id = ?').get(data.id) as Row);
}

export function updateProductionPhase(id: string, data: Partial<{
  phaseType: string; phaseName: string; plannedStartDate: string | null; plannedEndDate: string | null;
  actualStartDate: string | null; actualEndDate: string | null; status: string; delayReason: string | null; notes: string; order: number;
}>): ProductionPhase | undefined {
  const sets: string[] = []; const params: unknown[] = [];
  if (data.phaseType !== undefined) { sets.push('phase_type = ?'); params.push(data.phaseType); }
  if (data.phaseName !== undefined) { sets.push('phase_name = ?'); params.push(data.phaseName); }
  if (data.plannedStartDate !== undefined) { sets.push('planned_start_date = ?'); params.push(data.plannedStartDate); }
  if (data.plannedEndDate !== undefined) { sets.push('planned_end_date = ?'); params.push(data.plannedEndDate); }
  if (data.actualStartDate !== undefined) { sets.push('actual_start_date = ?'); params.push(data.actualStartDate); }
  if (data.actualEndDate !== undefined) { sets.push('actual_end_date = ?'); params.push(data.actualEndDate); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.delayReason !== undefined) { sets.push('delay_reason = ?'); params.push(data.delayReason); }
  if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }
  if (data.order !== undefined) { sets.push('"order" = ?'); params.push(data.order); }
  // auto-recalculate days
  const existing = db.prepare('SELECT * FROM production_phases WHERE id = ?').get(id) as Row | undefined;
  if (existing) {
    const ps = data.plannedStartDate !== undefined ? data.plannedStartDate : existing.planned_start_date;
    const pe = data.plannedEndDate !== undefined ? data.plannedEndDate : existing.planned_end_date;
    const as_ = data.actualStartDate !== undefined ? data.actualStartDate : existing.actual_start_date;
    const ae = data.actualEndDate !== undefined ? data.actualEndDate : existing.actual_end_date;
    if (ps && pe) { sets.push('planned_days = ?'); params.push(Math.round((new Date(pe).getTime() - new Date(ps).getTime()) / 86400000)); }
    if (as_ && ae) { sets.push('actual_days = ?'); params.push(Math.round((new Date(ae).getTime() - new Date(as_).getTime()) / 86400000)); }
  }
  if (sets.length === 0) { const r = db.prepare('SELECT * FROM production_phases WHERE id = ?').get(id) as Row | undefined; return r ? rowToProductionPhase(r) : undefined; }
  params.push(id);
  db.prepare(`UPDATE production_phases SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const r = db.prepare('SELECT * FROM production_phases WHERE id = ?').get(id) as Row | undefined;
  return r ? rowToProductionPhase(r) : undefined;
}

export function deleteProductionPhase(id: string): void {
  db.prepare('DELETE FROM production_phases WHERE id = ?').run(id);
}

// -------------------------
// Documentation Workflow CRUD
// -------------------------
export function getDocumentationWorkflowByEngagement(engagementId: string): DocumentationWorkflowWithSteps | null {
  const row = db.prepare('SELECT * FROM documentation_workflows WHERE engagement_id = ?').get(engagementId) as Row | undefined;
  if (!row) return null;
  const steps = (db.prepare('SELECT * FROM documentation_steps WHERE documentation_workflow_id = ? ORDER BY "order"').all(row.id) as Row[]).map(rowToDocumentationStep);
  return { ...rowToDocumentationWorkflow(row), steps };
}

export function createDocumentationWorkflow(data: {
  id: string; engagementId: string; productionExecutionId?: string | null; status?: string; overallNotes?: string;
}): DocumentationWorkflow {
  db.prepare('INSERT INTO documentation_workflows (id, engagement_id, production_execution_id, status, overall_notes) VALUES (?, ?, ?, ?, ?)')
    .run(data.id, data.engagementId, data.productionExecutionId ?? null, data.status ?? 'not-started', data.overallNotes ?? '');
  return rowToDocumentationWorkflow(db.prepare('SELECT * FROM documentation_workflows WHERE id = ?').get(data.id) as Row);
}

export function updateDocumentationWorkflow(id: string, data: Partial<{ status: string; overallNotes: string; productionExecutionId: string | null }>): DocumentationWorkflow | undefined {
  const sets: string[] = []; const params: unknown[] = [];
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.overallNotes !== undefined) { sets.push('overall_notes = ?'); params.push(data.overallNotes); }
  if (data.productionExecutionId !== undefined) { sets.push('production_execution_id = ?'); params.push(data.productionExecutionId); }
  if (sets.length === 0) { const r = db.prepare('SELECT * FROM documentation_workflows WHERE id = ?').get(id) as Row | undefined; return r ? rowToDocumentationWorkflow(r) : undefined; }
  params.push(id);
  db.prepare(`UPDATE documentation_workflows SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const r = db.prepare('SELECT * FROM documentation_workflows WHERE id = ?').get(id) as Row | undefined;
  return r ? rowToDocumentationWorkflow(r) : undefined;
}

export function createDocumentationStep(data: {
  id: string; documentationWorkflowId: string; documentType: string; issuingCountry: string;
  estimatedMinDays?: number; estimatedMaxDays?: number; estimatedCost?: number; estimatedCostCurrency?: string;
  plannedStartDate?: string | null; plannedEndDate?: string | null; handlerName?: string; handlerContact?: string;
  status?: string; notes?: string; order?: number; documentTypeCustom?: string | null;
}): DocumentationStep {
  db.prepare(`INSERT INTO documentation_steps (id, documentation_workflow_id, document_type, document_type_custom, issuing_country, estimated_min_days, estimated_max_days, estimated_cost, estimated_cost_currency, planned_start_date, planned_end_date, handler_name, handler_contact, status, notes, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(data.id, data.documentationWorkflowId, data.documentType, data.documentTypeCustom ?? null, data.issuingCountry, data.estimatedMinDays ?? 0, data.estimatedMaxDays ?? 0, data.estimatedCost ?? 0, data.estimatedCostCurrency ?? 'CNY', data.plannedStartDate ?? null, data.plannedEndDate ?? null, data.handlerName ?? '', data.handlerContact ?? '', data.status ?? 'not-started', data.notes ?? '', data.order ?? 1);
  return rowToDocumentationStep(db.prepare('SELECT * FROM documentation_steps WHERE id = ?').get(data.id) as Row);
}

export function updateDocumentationStep(id: string, data: Partial<{
  documentType: string; issuingCountry: string; estimatedMinDays: number; estimatedMaxDays: number;
  estimatedCost: number; estimatedCostCurrency: string; plannedStartDate: string | null; plannedEndDate: string | null;
  actualStartDate: string | null; actualEndDate: string | null; actualCost: number | null;
  status: string; documentNumber: string; issueDate: string | null; expiryDate: string | null;
  handlerName: string; handlerContact: string; notes: string; order: number;
}>): DocumentationStep | undefined {
  const sets: string[] = []; const params: unknown[] = [];
  if (data.documentType !== undefined) { sets.push('document_type = ?'); params.push(data.documentType); }
  if (data.issuingCountry !== undefined) { sets.push('issuing_country = ?'); params.push(data.issuingCountry); }
  if (data.estimatedMinDays !== undefined) { sets.push('estimated_min_days = ?'); params.push(data.estimatedMinDays); }
  if (data.estimatedMaxDays !== undefined) { sets.push('estimated_max_days = ?'); params.push(data.estimatedMaxDays); }
  if (data.estimatedCost !== undefined) { sets.push('estimated_cost = ?'); params.push(data.estimatedCost); }
  if (data.estimatedCostCurrency !== undefined) { sets.push('estimated_cost_currency = ?'); params.push(data.estimatedCostCurrency); }
  if (data.plannedStartDate !== undefined) { sets.push('planned_start_date = ?'); params.push(data.plannedStartDate); }
  if (data.plannedEndDate !== undefined) { sets.push('planned_end_date = ?'); params.push(data.plannedEndDate); }
  if (data.actualStartDate !== undefined) { sets.push('actual_start_date = ?'); params.push(data.actualStartDate); }
  if (data.actualEndDate !== undefined) { sets.push('actual_end_date = ?'); params.push(data.actualEndDate); }
  if (data.actualCost !== undefined) { sets.push('actual_cost = ?'); params.push(data.actualCost); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.documentNumber !== undefined) { sets.push('document_number = ?'); params.push(data.documentNumber); }
  if (data.issueDate !== undefined) { sets.push('issue_date = ?'); params.push(data.issueDate); }
  if (data.expiryDate !== undefined) { sets.push('expiry_date = ?'); params.push(data.expiryDate); }
  if (data.handlerName !== undefined) { sets.push('handler_name = ?'); params.push(data.handlerName); }
  if (data.handlerContact !== undefined) { sets.push('handler_contact = ?'); params.push(data.handlerContact); }
  if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }
  if (data.order !== undefined) { sets.push('"order" = ?'); params.push(data.order); }
  if (sets.length === 0) { const r = db.prepare('SELECT * FROM documentation_steps WHERE id = ?').get(id) as Row | undefined; return r ? rowToDocumentationStep(r) : undefined; }
  params.push(id);
  db.prepare(`UPDATE documentation_steps SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const r = db.prepare('SELECT * FROM documentation_steps WHERE id = ?').get(id) as Row | undefined;
  return r ? rowToDocumentationStep(r) : undefined;
}

export function deleteDocumentationStep(id: string): void {
  db.prepare('DELETE FROM documentation_steps WHERE id = ?').run(id);
}

// -------------------------
// Shipping Legs CRUD
// -------------------------
export function getShippingLegsByEngagement(engagementId: string): ShippingLeg[] {
  return (db.prepare('SELECT * FROM shipping_legs WHERE engagement_id = ? ORDER BY "order"').all(engagementId) as Row[]).map(rowToShippingLeg);
}

export function createShippingLeg(data: {
  id: string; engagementId: string; productionExecutionId?: string | null;
  legType?: string; origin?: string; destination?: string;
  plannedStartDate?: string | null; plannedEndDate?: string | null;
  actualStartDate?: string | null; actualEndDate?: string | null;
  mode?: string; cost?: number; costCurrency?: string;
  trackingNumber?: string; carrier?: string; status?: string; notes?: string; order?: number;
}): ShippingLeg {
  const plannedDays = (data.plannedStartDate && data.plannedEndDate)
    ? Math.round((new Date(data.plannedEndDate).getTime() - new Date(data.plannedStartDate).getTime()) / 86400000)
    : null;
  const actualDays = (data.actualStartDate && data.actualEndDate)
    ? Math.round((new Date(data.actualEndDate).getTime() - new Date(data.actualStartDate).getTime()) / 86400000)
    : null;
  db.prepare(`INSERT INTO shipping_legs (id, engagement_id, production_execution_id, leg_type, origin, destination, planned_start_date, planned_end_date, actual_start_date, actual_end_date, planned_days, actual_days, mode, cost, cost_currency, tracking_number, carrier, status, notes, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(data.id, data.engagementId, data.productionExecutionId ?? null, data.legType ?? 'custom', data.origin ?? '', data.destination ?? '', data.plannedStartDate ?? null, data.plannedEndDate ?? null, data.actualStartDate ?? null, data.actualEndDate ?? null, plannedDays, actualDays, data.mode ?? 'sea', data.cost ?? 0, data.costCurrency ?? 'USD', data.trackingNumber ?? '', data.carrier ?? '', data.status ?? 'not-booked', data.notes ?? '', data.order ?? 1);
  return rowToShippingLeg(db.prepare('SELECT * FROM shipping_legs WHERE id = ?').get(data.id) as Row);
}

export function updateShippingLeg(id: string, data: Partial<{
  legType: string; origin: string; destination: string;
  plannedStartDate: string | null; plannedEndDate: string | null;
  actualStartDate: string | null; actualEndDate: string | null;
  mode: string; cost: number; costCurrency: string;
  trackingNumber: string; carrier: string; status: string; notes: string; order: number;
  productionExecutionId: string | null;
}>): ShippingLeg | undefined {
  const sets: string[] = []; const params: unknown[] = [];
  if (data.legType !== undefined) { sets.push('leg_type = ?'); params.push(data.legType); }
  if (data.origin !== undefined) { sets.push('origin = ?'); params.push(data.origin); }
  if (data.destination !== undefined) { sets.push('destination = ?'); params.push(data.destination); }
  if (data.plannedStartDate !== undefined) { sets.push('planned_start_date = ?'); params.push(data.plannedStartDate); }
  if (data.plannedEndDate !== undefined) { sets.push('planned_end_date = ?'); params.push(data.plannedEndDate); }
  if (data.actualStartDate !== undefined) { sets.push('actual_start_date = ?'); params.push(data.actualStartDate); }
  if (data.actualEndDate !== undefined) { sets.push('actual_end_date = ?'); params.push(data.actualEndDate); }
  if (data.mode !== undefined) { sets.push('mode = ?'); params.push(data.mode); }
  if (data.cost !== undefined) { sets.push('cost = ?'); params.push(data.cost); }
  if (data.costCurrency !== undefined) { sets.push('cost_currency = ?'); params.push(data.costCurrency); }
  if (data.trackingNumber !== undefined) { sets.push('tracking_number = ?'); params.push(data.trackingNumber); }
  if (data.carrier !== undefined) { sets.push('carrier = ?'); params.push(data.carrier); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }
  if (data.order !== undefined) { sets.push('"order" = ?'); params.push(data.order); }
  if (data.productionExecutionId !== undefined) { sets.push('production_execution_id = ?'); params.push(data.productionExecutionId); }
  // auto-recalculate days
  const existing = db.prepare('SELECT * FROM shipping_legs WHERE id = ?').get(id) as Row | undefined;
  if (existing) {
    const ps = data.plannedStartDate !== undefined ? data.plannedStartDate : existing.planned_start_date;
    const pe = data.plannedEndDate !== undefined ? data.plannedEndDate : existing.planned_end_date;
    const as_ = data.actualStartDate !== undefined ? data.actualStartDate : existing.actual_start_date;
    const ae = data.actualEndDate !== undefined ? data.actualEndDate : existing.actual_end_date;
    if (ps && pe) { sets.push('planned_days = ?'); params.push(Math.round((new Date(pe).getTime() - new Date(ps).getTime()) / 86400000)); }
    if (as_ && ae) { sets.push('actual_days = ?'); params.push(Math.round((new Date(ae).getTime() - new Date(as_).getTime()) / 86400000)); }
  }
  if (sets.length === 0) { const r = db.prepare('SELECT * FROM shipping_legs WHERE id = ?').get(id) as Row | undefined; return r ? rowToShippingLeg(r) : undefined; }
  params.push(id);
  db.prepare(`UPDATE shipping_legs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const r = db.prepare('SELECT * FROM shipping_legs WHERE id = ?').get(id) as Row | undefined;
  return r ? rowToShippingLeg(r) : undefined;
}

export function deleteShippingLeg(id: string): void {
  db.prepare('DELETE FROM shipping_legs WHERE id = ?').run(id);
}

// -------------------------
// RD Overview Report
// -------------------------
export function getRDOverview() {
  // Projects with aggregated task/risk/engagement stats
  const projectRows = db.prepare(`
    SELECT
      p.id, p.name, p.product_category AS productCategory,
      p.market, p.brand, p.progress_summary AS progressSummary, p.status,
      p.target_launch_date AS targetLaunchDate,
      CAST(julianday(p.target_launch_date) - julianday('now') AS INTEGER) AS daysUntilDeadline,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS tasksTotal,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS tasksDone,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'blocked') AS tasksBlocked,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < date('now')) AS tasksOverdue,
      (SELECT COUNT(*) FROM risks r WHERE r.project_id = p.id AND r.severity IN ('high','critical') AND r.status IN ('open','monitoring')) AS risksHigh,
      (SELECT COUNT(*) FROM factory_engagements fe WHERE fe.project_id = p.id AND fe.status NOT IN ('completed','cancelled')) AS engagementsActive
    FROM projects p
    WHERE p.status IN ('active', 'on-hold')
    ORDER BY p.target_launch_date ASC, p.created_at DESC
  `).all() as any[];

  // Stages for each project (to determine current stage)
  const projectIds = projectRows.map((p: any) => p.id);
  const stagesByProject = new Map<string, any[]>();
  if (projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(',');
    const stages = db.prepare(`
      SELECT project_id AS projectId, name, gate_status AS gateStatus, "order"
      FROM stages WHERE project_id IN (${placeholders}) ORDER BY "order" ASC
    `).all(...projectIds) as any[];
    for (const s of stages) {
      if (!stagesByProject.has(s.projectId)) stagesByProject.set(s.projectId, []);
      stagesByProject.get(s.projectId)!.push(s);
    }
  }

  const projects = projectRows.map((p: any) => {
    const stages = stagesByProject.get(p.id) || [];
    const current =
      stages.find((s: any) => s.gateStatus === 'in-progress') ||
      stages.find((s: any) => s.gateStatus === 'not-started') ||
      stages[stages.length - 1];
    return {
      ...p,
      currentStageName: current?.name || '—',
      currentStageOrder: current?.order || 0,
      currentStageStatus: current?.gateStatus || '—',
      stagesTotal: stages.length,
      stagesPassed: stages.filter((s: any) => s.gateStatus === 'passed').length,
    };
  });

  // Active engagements with factory & project context
  const engagements = db.prepare(`
    SELECT
      fe.id, fe.status, fe.scope, fe.internal_owner AS internalOwner,
      fe.start_date AS startDate, fe.target_completion_date AS targetCompletionDate,
      f.name AS factoryName, f.short_name AS factoryShortName,
      p.name AS projectName, p.id AS projectId
    FROM factory_engagements fe
    JOIN factories f ON f.id = fe.factory_id
    JOIN projects p ON p.id = fe.project_id
    WHERE fe.status NOT IN ('completed', 'cancelled') AND p.status IN ('active', 'on-hold')
    ORDER BY fe.created_at DESC
  `).all() as any[];

  // Samples needing attention
  const pendingSamples = db.prepare(`
    SELECT
      s.id, s.sample_number AS sampleNumber, s.evaluation_status AS evaluationStatus,
      s.received_at AS receivedAt, s.type,
      p.name AS projectName, f.name AS factoryName, fe.id AS engagementId
    FROM samples s
    JOIN factory_engagements fe ON fe.id = s.engagement_id
    JOIN projects p ON p.id = fe.project_id
    JOIN factories f ON f.id = fe.factory_id
    WHERE s.evaluation_status IN ('pending-evaluation','evaluating','reworking')
    ORDER BY s.received_at ASC LIMIT 30
  `).all() as any[];

  // Quotes pending review
  const pendingQuotes = db.prepare(`
    SELECT
      q.id, q.version, q.received_at AS receivedAt, q.currency, q.valid_until AS validUntil,
      p.name AS projectName, f.name AS factoryName, fe.id AS engagementId
    FROM quotes q
    JOIN quote_requests qr ON qr.id = q.quote_request_id
    JOIN factory_engagements fe ON fe.id = qr.engagement_id
    JOIN projects p ON p.id = fe.project_id
    JOIN factories f ON f.id = fe.factory_id
    WHERE q.status = 'pending-review'
    ORDER BY q.received_at ASC LIMIT 30
  `).all() as any[];

  // Blocked tasks
  const blockedTasks = db.prepare(`
    SELECT
      t.id, t.title, t.owner, t.assignee_name AS assigneeName,
      t.due_date AS dueDate, t.blocker_reason AS blockerReason,
      p.name AS projectName, p.id AS projectId,
      st.name AS stageName
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN stages st ON st.id = t.stage_id
    WHERE t.status = 'blocked' AND p.status = 'active'
    ORDER BY t.due_date ASC LIMIT 30
  `).all() as any[];

  // High/critical open risks
  const highRisks = db.prepare(`
    SELECT
      r.id, r.title, r.severity, r.likelihood, r.status, r.mitigation,
      p.name AS projectName, p.id AS projectId
    FROM risks r
    JOIN projects p ON p.id = r.project_id
    WHERE r.severity IN ('high','critical') AND r.status IN ('open','monitoring') AND p.status = 'active'
    ORDER BY
      CASE r.severity WHEN 'critical' THEN 0 ELSE 1 END,
      CASE r.likelihood WHEN 'certain' THEN 0 WHEN 'likely' THEN 1 WHEN 'possible' THEN 2 ELSE 3 END
    LIMIT 30
  `).all() as any[];

  const stats = {
    activeProjects: projects.filter((p: any) => p.status === 'active').length,
    onHoldProjects: projects.filter((p: any) => p.status === 'on-hold').length,
    activeEngagements: engagements.length,
    pendingSamples: pendingSamples.length,
    pendingQuotes: pendingQuotes.length,
    blockedTasks: blockedTasks.length,
    highRisks: highRisks.length,
    upcomingDeadlines: projects.filter((p: any) => p.daysUntilDeadline !== null && p.daysUntilDeadline >= 0 && p.daysUntilDeadline <= 30).length,
  };

  return { generatedAt: new Date().toISOString(), stats, projects, engagements, pendingSamples, pendingQuotes, blockedTasks, highRisks };
}

export function getWorkspaceTasks(params: {
  assigneeId?: string;
  status?: string;
  projectId?: string;
}) {
  const conditions = ["p.status IN ('active', 'on-hold')"];
  const args: unknown[] = [];

  if (params.assigneeId) {
    conditions.push('t.assignee_id = ?');
    args.push(params.assigneeId);
  }
  if (params.status) {
    conditions.push('t.status = ?');
    args.push(params.status);
  }
  if (params.projectId) {
    conditions.push('t.project_id = ?');
    args.push(params.projectId);
  }

  return db.prepare(`
    SELECT
      t.id, t.title, t.status, t.priority,
      t.due_date AS dueDate, t.owner,
      t.assignee_id AS assigneeId, t.assignee_name AS assigneeName,
      t.blocker_reason AS blockerReason,
      t.approval_status AS approvalStatus,
      CAST(t.approval_required AS INTEGER) AS approvalRequired,
      p.id AS projectId, p.name AS projectName,
      s.id AS stageId, s.name AS stageName
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN stages s ON s.id = t.stage_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE t.status WHEN 'blocked' THEN 0 WHEN 'doing' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
      CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.due_date ASC
  `).all(...args) as any[];
}

export function getWeeklyFeed() {
  return db.prepare(`
    SELECT
      wu.id, wu.week_label AS weekLabel, wu.content, wu.created_by AS createdBy,
      wu.created_at AS createdAt,
      s.id AS stageId, s.name AS stageName, s.gate_status AS gateStatus,
      p.id AS projectId, p.name AS projectName, p.status AS projectStatus,
      CAST(julianday('now') - julianday(wu.created_at) AS INTEGER) AS daysSinceUpdate
    FROM stage_weekly_updates wu
    JOIN stages s ON s.id = wu.stage_id
    JOIN projects p ON p.id = s.project_id
    WHERE p.status IN ('active', 'on-hold')
    ORDER BY wu.created_at DESC
    LIMIT 100
  `).all() as any[];
}
