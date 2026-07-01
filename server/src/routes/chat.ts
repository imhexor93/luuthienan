import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getProjectById, getTasksByProject, getRisksByProject, getDocumentsByProject, getRDOverview, getWeeklyFeed } from '../db/helpers';
import type { ProjectWithProgress, Task, Risk, Document } from '@rd/shared';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1),
});

function buildProjectContext(
  project: ProjectWithProgress,
  tasks: Task[],
  risks: Risk[],
  docs: Document[],
): string {
  if (!project) return '';

  const statusLabel: Record<string, string> = {
    planning: 'Lên kế hoạch',
    active: 'Đang thực hiện',
    on_hold: 'Tạm dừng',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  };

  const gateLabel: Record<string, string> = {
    'not-started': 'Chưa đánh giá',
    'in-progress': 'Đang thực hiện',
    passed: 'Đã thông qua',
    failed: 'Không đạt',
  };

  const taskStatusLabel: Record<string, string> = {
    todo: 'Chưa làm',
    doing: 'Đang làm',
    done: 'Hoàn thành',
    blocked: 'Bị chặn',
  };

  const priorityLabel: Record<string, string> = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    critical: 'Khẩn cấp',
  };

  const severityLabel: Record<string, string> = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    critical: 'Nghiêm trọng',
  };

  const riskStatusLabel: Record<string, string> = {
    open: 'Đang mở',
    monitoring: 'Đang theo dõi',
    mitigated: 'Đã giảm thiểu',
    occurred: 'Đã xảy ra',
  };

  let ctx = `# Dự án: ${project.name}\n`;
  ctx += `Trạng thái: ${statusLabel[project.status] ?? project.status}\n`;
  ctx += `Tiến độ tổng: ${project.progressPercent}% (${project.doneTasks}/${project.totalTasks} việc hoàn thành)\n`;
  if (project.description) ctx += `Mô tả: ${project.description}\n`;
  if (project.productCategory) ctx += `Danh mục sản phẩm: ${project.productCategory}\n`;
  ctx += `Ngày bắt đầu: ${project.startDate}\n`;
  ctx += `Ngày ra mắt mục tiêu: ${project.targetLaunchDate}\n`;
  if (project.budget) ctx += `Ngân sách: ${project.budget.toLocaleString('vi-VN')} VND\n`;

  ctx += `\n## Các giai đoạn (Stage-Gate)\n`;
  for (const stage of project.stages) {
    ctx += `\n### Giai đoạn ${stage.order}: ${stage.name}\n`;
    ctx += `  - Tiến độ: ${stage.progressPercent}% (${stage.doneTasks}/${stage.totalTasks} việc)\n`;
    ctx += `  - Trạng thái cổng: ${gateLabel[stage.gateStatus] ?? stage.gateStatus}\n`;
    if (stage.gateApprovedBy) ctx += `  - Người phê duyệt: ${stage.gateApprovedBy}\n`;
    if (stage.gateNotes) ctx += `  - Ghi chú cổng: ${stage.gateNotes}\n`;
  }

  ctx += `\n## Công việc (${tasks.length} tổng)\n`;
  const byStatus = { todo: 0, doing: 0, done: 0, blocked: 0 };
  for (const t of tasks) {
    const s = t.status as keyof typeof byStatus;
    if (s in byStatus) byStatus[s]++;
  }
  ctx += `Chưa làm: ${byStatus.todo} | Đang làm: ${byStatus.doing} | Hoàn thành: ${byStatus.done} | Bị chặn: ${byStatus.blocked}\n\n`;

  for (const task of tasks) {
    const stage = project.stages.find((s) => s.id === task.stageId);
    ctx += `- [${taskStatusLabel[task.status] ?? task.status}] ${task.title}`;
    if (stage) ctx += ` (${stage.name})`;
    if (task.owner) ctx += ` — Phụ trách: ${task.owner}`;
    if (task.dueDate) ctx += ` — Deadline: ${task.dueDate}`;
    if (task.priority !== 'medium') ctx += ` — Ưu tiên: ${priorityLabel[task.priority] ?? task.priority}`;
    if (task.estimatedHours != null) ctx += ` — Dự kiến: ${task.estimatedHours}h`;
    if (task.actualHours != null) ctx += ` — Thực tế: ${task.actualHours}h`;
    ctx += '\n';
    if (task.description) ctx += `  Mô tả: ${task.description}\n`;
    if (task.status === 'blocked' && task.blockerReason) ctx += `  Lý do bị chặn: ${task.blockerReason}\n`;
  }

  ctx += `\n## Rủi ro (${risks.length} tổng)\n`;
  for (const risk of risks) {
    const stage = project.stages.find((s) => s.id === risk.stageId);
    ctx += `- [${severityLabel[risk.severity] ?? risk.severity}/${risk.likelihood}] ${risk.title}`;
    ctx += ` — Trạng thái: ${riskStatusLabel[risk.status] ?? risk.status}`;
    if (stage) ctx += ` (${stage.name})`;
    ctx += '\n';
    if (risk.description) ctx += `  Mô tả: ${risk.description}\n`;
    if (risk.mitigation) ctx += `  Giảm thiểu: ${risk.mitigation}\n`;
  }

  ctx += `\n## Tài liệu (${docs.length} tổng)\n`;
  for (const doc of docs) {
    const stage = project.stages.find((s) => s.id === doc.stageId);
    ctx += `- ${doc.title} (${doc.type})`;
    if (stage) ctx += ` — ${stage.name}`;
    if (doc.uploadedBy) ctx += ` — Người đăng: ${doc.uploadedBy}`;
    ctx += '\n';
  }

  return ctx;
}

// POST /api/projects/:id/chat
router.post('/projects/:id/chat', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const project = getProjectById(id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const tasks = getTasksByProject(id);
  const risks = getRisksByProject(id);
  const docs = getDocumentsByProject(id);

  const projectContext = buildProjectContext(project, tasks, risks, docs);

  const systemPrompt = `Bạn là một trợ lý quản lý dự án R&D thông minh. Bạn có quyền truy cập vào toàn bộ thông tin của dự án dưới đây và có thể trả lời bất kỳ câu hỏi nào về dự án này.

Hãy trả lời bằng tiếng Việt, chính xác, súc tích và hữu ích. Khi phân tích dữ liệu, hãy đưa ra nhận xét và đề xuất cụ thể dựa trên dữ liệu thực tế của dự án.

---

${projectContext}`;

  // Set up SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: parsed.data.messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`);
        }
      } else if (event.type === 'message_stop') {
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      }
    }

    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi gọi AI';
    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    res.end();
  }
});

// ── Overview chat — covers ALL projects ─────────────────────────────────────

function buildOverviewContext(overview: ReturnType<typeof getRDOverview>, feed: ReturnType<typeof getWeeklyFeed>): string {
  const { stats, projects, engagements, pendingSamples, pendingQuotes, blockedTasks, highRisks } = overview;

  let ctx = `# Tổng quan toàn bộ danh mục R&D\n`;
  ctx += `Ngày báo cáo: ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;

  ctx += `## Số liệu tổng\n`;
  ctx += `- Dự án đang hoạt động: ${stats.activeProjects}\n`;
  ctx += `- Dự án tạm dừng: ${stats.onHoldProjects}\n`;
  ctx += `- Engagements nhà máy đang chạy: ${stats.activeEngagements}\n`;
  ctx += `- Mẫu chờ đánh giá: ${stats.pendingSamples}\n`;
  ctx += `- Báo giá chờ xem xét: ${stats.pendingQuotes}\n`;
  ctx += `- Công việc bị chặn: ${stats.blockedTasks}\n`;
  ctx += `- Rủi ro cao/nghiêm trọng: ${stats.highRisks}\n`;
  ctx += `- Dự án deadline trong 30 ngày: ${stats.upcomingDeadlines}\n\n`;

  ctx += `## Chi tiết từng dự án\n`;
  for (const p of projects) {
    const progress = p.tasksTotal > 0 ? Math.round((p.tasksDone / p.tasksTotal) * 100) : 0;
    ctx += `\n### ${p.name}\n`;
    ctx += `- Trạng thái: ${p.status}\n`;
    ctx += `- Danh mục: ${p.productCategory || '—'} | Thương hiệu: ${p.brand || '—'} | Thị trường: ${p.market || '—'}\n`;
    ctx += `- Tiến độ: ${progress}% (${p.tasksDone}/${p.tasksTotal} việc hoàn thành)\n`;
    ctx += `- Việc bị chặn: ${p.tasksBlocked} | Quá hạn: ${p.tasksOverdue}\n`;
    ctx += `- Giai đoạn hiện tại: ${p.currentStageName} (${p.stagesPassed}/${p.stagesTotal} giai đoạn đã qua)\n`;
    if (p.targetLaunchDate) ctx += `- Deadline ra mắt: ${p.targetLaunchDate}${p.daysUntilDeadline != null ? ` (còn ${p.daysUntilDeadline} ngày)` : ''}\n`;
    if (p.progressSummary) ctx += `- Tóm tắt: ${p.progressSummary}\n`;
    if (p.risksHigh > 0) ctx += `- ⚠️ Rủi ro cao/nghiêm trọng đang mở: ${p.risksHigh}\n`;
    if (p.engagementsActive > 0) ctx += `- Engagements nhà máy đang chạy: ${p.engagementsActive}\n`;
  }

  if (blockedTasks.length > 0) {
    ctx += `\n## Công việc đang bị chặn (${blockedTasks.length})\n`;
    for (const t of blockedTasks) {
      ctx += `- [${t.projectName}] ${t.title}`;
      if (t.owner) ctx += ` — Phụ trách: ${t.owner}`;
      if (t.dueDate) ctx += ` — Deadline: ${t.dueDate}`;
      ctx += '\n';
      if (t.blockerReason) ctx += `  Lý do: ${t.blockerReason}\n`;
    }
  }

  if (highRisks.length > 0) {
    ctx += `\n## Rủi ro cao / nghiêm trọng (${highRisks.length})\n`;
    for (const r of highRisks) {
      ctx += `- [${r.projectName}] [${r.severity}] ${r.title} — ${r.status}\n`;
      if (r.description) ctx += `  ${r.description.slice(0, 150)}\n`;
    }
  }

  if (engagements.length > 0) {
    ctx += `\n## Pipeline nhà máy (${engagements.length} engagements đang hoạt động)\n`;
    const byStatus: Record<string, typeof engagements> = {};
    for (const e of engagements) {
      if (!byStatus[e.status]) byStatus[e.status] = [];
      byStatus[e.status].push(e);
    }
    const statusLabel: Record<string, string> = {
      sampling: 'Lấy mẫu', quoting: 'Báo giá', negotiating: 'Đàm phán',
      sourcing: 'Test mẫu', approved: 'Đã chốt', 'in-production': 'Đang sản xuất',
    };
    for (const [status, items] of Object.entries(byStatus)) {
      ctx += `- ${statusLabel[status] ?? status}: ${items.map((e) => `${e.projectName} (${e.factoryName})`).join(', ')}\n`;
    }
  }

  if (pendingSamples.length > 0) {
    ctx += `\n## Mẫu chờ đánh giá (${pendingSamples.length})\n`;
    for (const s of pendingSamples) {
      ctx += `- [${s.projectName}] Mẫu #${s.sampleNumber} từ ${s.factoryName} — Trạng thái: ${s.evaluationStatus}\n`;
    }
  }

  if (pendingQuotes.length > 0) {
    ctx += `\n## Báo giá chờ xem xét (${pendingQuotes.length})\n`;
    for (const q of pendingQuotes) {
      ctx += `- [${q.projectName}] v${q.version} từ ${q.factoryName}`;
      if (q.currency && q.unitPrice) ctx += ` — ${q.unitPrice} ${q.currency}`;
      ctx += '\n';
    }
  }

  // Weekly updates: last 2 weeks
  const recentFeed = feed.slice(0, 40);
  if (recentFeed.length > 0) {
    ctx += `\n## Cập nhật tuần gần nhất\n`;
    const byWeek: Record<string, typeof recentFeed> = {};
    for (const e of recentFeed) {
      if (!byWeek[e.weekLabel]) byWeek[e.weekLabel] = [];
      byWeek[e.weekLabel].push(e);
    }
    for (const [week, entries] of Object.entries(byWeek).slice(0, 2)) {
      ctx += `\n### ${week}\n`;
      for (const e of entries) {
        ctx += `- [${e.projectName} / ${e.stageName}] ${e.content}\n`;
      }
    }
  }

  return ctx;
}

// POST /api/rd/chat
router.post('/rd/chat', async (req: Request, res: Response): Promise<void> => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const overview = getRDOverview();
  const feed = getWeeklyFeed();
  const overviewContext = buildOverviewContext(overview, feed);

  const systemPrompt = `Bạn là trợ lý AI quản lý danh mục R&D. Bạn có quyền truy cập toàn bộ dữ liệu thực tế của tất cả dự án dưới đây.

Trả lời bằng tiếng Việt, ngắn gọn, chính xác. Khi phân tích hãy dựa trên số liệu thực. Có thể đưa ra nhận xét, cảnh báo và đề xuất hành động cụ thể.

---

${overviewContext}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: parsed.data.messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`);
      } else if (event.type === 'message_stop') {
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      }
    }
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi gọi AI';
    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    res.end();
  }
});

export default router;
