// ============================================================
// API Client — tất cả HTTP calls đến backend
// ============================================================
import type {
  ProjectWithProgress,
  StageWithProgress,
  Task,
  ApprovalTask,
  ApprovalHistoryEntry,
  AppNotification,
  StageWeeklyUpdate,
  Risk,
  Document,
  TaskAttachment,
  TaskLink,
  ActivityLog,
  CreateProjectInput,
  UpdateProjectInput,
  UpdateStageInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateRiskInput,
  UpdateRiskInput,
  CreateDocumentInput,
  DashboardStats,
  SearchResult,
  TaskStatus,
  Factory,
  FactoryContact,
  WechatGroup,
  FactoryEngagementWithFactory,
  QuoteRequest,
  Quote,
  QuoteWithDetails,
  QuotePackagingTemplate,
  NegotiationLog,
  Sample,
  SampleFormula,
  PackagingDesign,
  PackagingRevision,
  FactoryCommunication,
  ProductionExecution,
  ProductionExecutionWithPhases,
  ProductionPhase,
  DocumentationWorkflowWithSteps,
  DocumentationStep,
  ShippingLeg,
  User,
  AuthResponse,
} from '@rd/shared';

const BASE_URL = '/api';
const TOKEN_KEY = 'rd_auth_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken();
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Lỗi không xác định' }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

// -------------------------
// RD Overview types
// -------------------------
export interface RDOverviewProject {
  id: string; name: string; productCategory: string; market: string; brand: string;
  progressSummary: string; status: string;
  targetLaunchDate: string | null; daysUntilDeadline: number | null;
  tasksTotal: number; tasksDone: number; tasksBlocked: number; tasksOverdue: number;
  risksHigh: number; engagementsActive: number;
  currentStageName: string; currentStageOrder: number; currentStageStatus: string;
  stagesTotal: number; stagesPassed: number;
}
export interface RDOverviewEngagement {
  id: string; status: string; scope: string; internalOwner: string;
  startDate: string | null; targetCompletionDate: string | null;
  factoryName: string; factoryShortName: string; projectName: string; projectId: string;
}
export interface RDOverviewSample {
  id: string; sampleNumber: string; evaluationStatus: string; receivedAt: string;
  type: string; projectName: string; factoryName: string; engagementId: string;
}
export interface RDOverviewQuote {
  id: string; version: number; receivedAt: string; currency: string;
  validUntil: string | null; projectName: string; factoryName: string; engagementId: string;
}
export interface RDOverviewBlockedTask {
  id: string; title: string; owner: string; assigneeName: string;
  dueDate: string | null; blockerReason: string;
  projectName: string; projectId: string; stageName: string;
}
export interface RDOverviewRisk {
  id: string; title: string; severity: string; likelihood: string;
  status: string; mitigation: string; projectName: string; projectId: string;
}
export interface WorkspaceTask {
  id: string; title: string; status: string; priority: string;
  dueDate: string | null; owner: string;
  assigneeId: string | null; assigneeName: string;
  blockerReason: string | null;
  approvalStatus: string; approvalRequired: boolean;
  projectId: string; projectName: string;
  stageId: string | null; stageName: string | null;
}

export interface WeeklyFeedEntry {
  id: string; weekLabel: string; content: string; createdBy: string; createdAt: string;
  stageId: string; stageName: string; gateStatus: string;
  projectId: string; projectName: string; projectStatus: string;
  daysSinceUpdate: number;
}

export interface RDOverviewData {
  generatedAt: string;
  stats: {
    activeProjects: number; onHoldProjects: number; activeEngagements: number;
    pendingSamples: number; pendingQuotes: number; blockedTasks: number;
    highRisks: number; upcomingDeadlines: number;
  };
  projects: RDOverviewProject[];
  engagements: RDOverviewEngagement[];
  pendingSamples: RDOverviewSample[];
  pendingQuotes: RDOverviewQuote[];
  blockedTasks: RDOverviewBlockedTask[];
  highRisks: RDOverviewRisk[];
}

// -------------------------
// Projects
// -------------------------
export const api = {
  projects: {
    list: (params?: { status?: string; category?: string; brand?: string; sortBy?: string }) => {
      const qs = params
        ? '?' + new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null) as [string, string][]
          ).toString()
        : '';
      return request<ProjectWithProgress[]>(`/projects${qs}`);
    },
    get: (id: string) => request<ProjectWithProgress>(`/projects/${id}`),
    create: (data: CreateProjectInput) =>
      request<ProjectWithProgress>('/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateProjectInput) =>
      request<ProjectWithProgress>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/projects/${id}`, { method: 'DELETE' }),
  },

  stages: {
    list: (projectId: string) =>
      request<StageWithProgress[]>(`/projects/${projectId}/stages`),
    update: (id: string, data: UpdateStageInput) =>
      request<StageWithProgress>(`/stages/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    weeklyUpdates: {
      list: (stageId: string) =>
        request<StageWeeklyUpdate[]>(`/stages/${stageId}/weekly-updates`),
      create: (stageId: string, data: { weekLabel: string; content: string; createdBy: string }) =>
        request<StageWeeklyUpdate>(`/stages/${stageId}/weekly-updates`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: { weekLabel?: string; content?: string }) =>
        request<StageWeeklyUpdate>(`/weekly-updates/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        request<{ message: string }>(`/weekly-updates/${id}`, { method: 'DELETE' }),
    },
  },

  tasks: {
    list: (
      projectId: string,
      params?: { stageId?: string; status?: string; priority?: string; owner?: string }
    ) => {
      const qs = params
        ? '?' + new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null) as [string, string][]
          ).toString()
        : '';
      return request<Task[]>(`/projects/${projectId}/tasks${qs}`);
    },
    create: (projectId: string, data: CreateTaskInput) =>
      request<Task>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateTaskInput) =>
      request<Task>(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: TaskStatus) =>
      request<Task>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/tasks/${id}`, { method: 'DELETE' }),
    requestApproval: (id: string, targetId?: string | null, targetName?: string) =>
      request<Task>(`/tasks/${id}/request-approval`, {
        method: 'POST',
        body: JSON.stringify({ targetId: targetId ?? null, targetName: targetName ?? '' }),
      }),
    processApproval: (id: string, action: 'approved' | 'rejected', approvalBy: string, approvalNotes: string) =>
      request<Task>(`/tasks/${id}/process-approval`, {
        method: 'POST',
        body: JSON.stringify({ action, approvalBy, approvalNotes }),
      }),
    getApprovalHistory: (id: string) =>
      request<ApprovalHistoryEntry[]>(`/tasks/${id}/approval-history`),
  },

  approvals: {
    list: () => request<ApprovalTask[]>('/approvals'),
  },

  notifications: {
    list: (userId: string) => request<AppNotification[]>(`/notifications?userId=${encodeURIComponent(userId)}`),
    unreadCount: (userId: string) => request<{ count: number }>(`/notifications/unread-count?userId=${encodeURIComponent(userId)}`),
    markAllRead: (userId: string) => request<{ ok: boolean }>(`/notifications/read-all?userId=${encodeURIComponent(userId)}`, { method: 'PUT' }),
  },

  risks: {
    list: (projectId: string) => request<Risk[]>(`/projects/${projectId}/risks`),
    create: (projectId: string, data: CreateRiskInput) =>
      request<Risk>(`/projects/${projectId}/risks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateRiskInput) =>
      request<Risk>(`/risks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/risks/${id}`, { method: 'DELETE' }),
  },

  documents: {
    list: (projectId: string) => request<Document[]>(`/projects/${projectId}/documents`),
    create: (projectId: string, data: CreateDocumentInput) =>
      request<Document>(`/projects/${projectId}/documents`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/documents/${id}`, { method: 'DELETE' }),
  },

  activities: {
    list: (projectId: string, page = 1) =>
      request<ActivityLog[]>(`/projects/${projectId}/activities?page=${page}`),
  },

  dashboard: {
    stats: () => request<DashboardStats>('/dashboard/stats'),
    rdOverview: () => request<RDOverviewData>('/dashboard/rd-overview'),
    weeklyFeed: () => request<WeeklyFeedEntry[]>('/weekly-updates/feed'),
  },

  workspace: {
    tasks: (params?: { assigneeId?: string; status?: string; projectId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.assigneeId) qs.set('assigneeId', params.assigneeId);
      if (params?.status) qs.set('status', params.status);
      if (params?.projectId) qs.set('projectId', params.projectId);
      const q = qs.toString();
      return request<WorkspaceTask[]>(`/workspace/tasks${q ? `?${q}` : ''}`);
    },
  },

  search: (q: string) => request<SearchResult>(`/search?q=${encodeURIComponent(q)}`),

  packagingTemplates: {
    list: () => request<QuotePackagingTemplate[]>('/packaging-templates'),
    create: (data: Record<string, unknown>) => request<QuotePackagingTemplate>('/packaging-templates', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ message: string }>(`/packaging-templates/${id}`, { method: 'DELETE' }),
  },

  attachments: {
    list: (taskId: string) => request<TaskAttachment[]>(`/tasks/${taskId}/attachments`),
    upload: (taskId: string, file: File, uploadedBy: string) => {
      const form = new FormData();
      form.append('file', file);
      form.append('uploadedBy', uploadedBy);
      return fetch(`${BASE_URL}/tasks/${taskId}/attachments`, { method: 'POST', body: form })
        .then(async (res) => {
          if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Upload thất bại'); }
          return res.json() as Promise<TaskAttachment>;
        });
    },
    delete: (id: string) => request<{ message: string }>(`/attachments/${id}`, { method: 'DELETE' }),
    downloadUrl: (id: string) => `/api/attachments/${id}/download`,
  },

  links: {
    list: (taskId: string) => request<TaskLink[]>(`/tasks/${taskId}/links`),
    create: (taskId: string, data: { title: string; url: string; addedBy?: string }) =>
      request<TaskLink>(`/tasks/${taskId}/links`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ message: string }>(`/links/${id}`, { method: 'DELETE' }),
  },

  factories: {
    list: (params?: { status?: string; country?: string }) => {
      const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : '';
      return request<Factory[]>(`/factories${qs}`);
    },
    get: (id: string) => request<Factory & { contacts: FactoryContact[]; wechatGroups: WechatGroup[]; stats: Record<string, unknown>; engagements: FactoryEngagementWithFactory[] }>(`/factories/${id}`),
    create: (data: Partial<Factory>) => request<Factory>('/factories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Factory>) => request<Factory>(`/factories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ message: string }>(`/factories/${id}`, { method: 'DELETE' }),
    contacts: {
      list: (factoryId: string) => request<FactoryContact[]>(`/factories/${factoryId}/contacts`),
      create: (factoryId: string, data: Partial<FactoryContact>) => request<FactoryContact>(`/factories/${factoryId}/contacts`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<FactoryContact>) => request<FactoryContact>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) => request<{ message: string }>(`/contacts/${id}`, { method: 'DELETE' }),
    },
    wechatGroups: {
      list: (factoryId: string) => request<WechatGroup[]>(`/factories/${factoryId}/wechat-groups`),
      create: (factoryId: string, data: Partial<WechatGroup>) => request<WechatGroup>(`/factories/${factoryId}/wechat-groups`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<WechatGroup>) => request<WechatGroup>(`/wechat-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) => request<{ message: string }>(`/wechat-groups/${id}`, { method: 'DELETE' }),
      uploadQr: (id: string, file: File): Promise<WechatGroup> => {
        const form = new FormData();
        form.append('qrCode', file);
        return request<WechatGroup>(`/wechat-groups/${id}/qr-code`, { method: 'POST', body: form });
      },
      removeQr: (id: string) => request<WechatGroup>(`/wechat-groups/${id}/qr-code`, { method: 'DELETE' }),
    },
  },

  engagements: {
    listByProject: (projectId: string) => request<FactoryEngagementWithFactory[]>(`/projects/${projectId}/engagements`),
    get: (id: string) => request<FactoryEngagementWithFactory>(`/engagements/${id}`),
    create: (projectId: string, data: Partial<FactoryEngagementWithFactory>) => request<FactoryEngagementWithFactory>(`/projects/${projectId}/engagements`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<FactoryEngagementWithFactory>) => request<FactoryEngagementWithFactory>(`/engagements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ message: string }>(`/engagements/${id}`, { method: 'DELETE' }),
    quotes: (engagementId: string) => request<QuoteWithDetails[]>(`/engagements/${engagementId}/quotes`),
    rfqs: {
      list: (engagementId: string) => request<QuoteRequest[]>(`/engagements/${engagementId}/rfqs`),
      create: (engagementId: string, data: Partial<QuoteRequest>) => request<QuoteRequest>(`/engagements/${engagementId}/rfqs`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<QuoteRequest>) => request<QuoteRequest>(`/rfqs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      quotes: {
        list: (rfqId: string) => request<QuoteWithDetails[]>(`/rfqs/${rfqId}/quotes`),
        create: (rfqId: string, data: Partial<QuoteWithDetails> & Record<string, unknown>) => request<QuoteWithDetails>(`/rfqs/${rfqId}/quotes`, { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Partial<QuoteWithDetails> & Record<string, unknown>) => request<QuoteWithDetails>(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      },
    },
    production: {
      list: (engagementId: string) => request<ProductionExecution[]>(`/engagements/${engagementId}/production`),
      get: (id: string) => request<ProductionExecutionWithPhases>(`/production/${id}`),
      create: (engagementId: string, data: Record<string, unknown>) => request<ProductionExecution>(`/engagements/${engagementId}/production`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<ProductionExecution>) => request<ProductionExecution>(`/production/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      phases: {
        create: (executionId: string, data: Record<string, unknown>) => request<ProductionPhase>(`/production/${executionId}/phases`, { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Partial<ProductionPhase>) => request<ProductionPhase>(`/production-phases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => request<{ message: string }>(`/production-phases/${id}`, { method: 'DELETE' }),
      },
    },
    documentation: {
      get: (engagementId: string) => request<DocumentationWorkflowWithSteps | null>(`/engagements/${engagementId}/documentation`),
      create: (engagementId: string) => request<DocumentationWorkflowWithSteps>(`/engagements/${engagementId}/documentation`, { method: 'POST', body: JSON.stringify({}) }),
      steps: {
        create: (workflowId: string, data: Record<string, unknown>) => request<DocumentationStep>(`/documentation/${workflowId}/steps`, { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Partial<DocumentationStep>) => request<DocumentationStep>(`/documentation-steps/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => request<{ message: string }>(`/documentation-steps/${id}`, { method: 'DELETE' }),
      },
    },
    shipping: {
      list: (engagementId: string) => request<ShippingLeg[]>(`/engagements/${engagementId}/shipping`),
      create: (engagementId: string, data: Record<string, unknown>) => request<ShippingLeg>(`/engagements/${engagementId}/shipping`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<ShippingLeg>) => request<ShippingLeg>(`/shipping-legs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) => request<{ message: string }>(`/shipping-legs/${id}`, { method: 'DELETE' }),
    },
    negotiations: {
      list: (engagementId: string) => request<NegotiationLog[]>(`/engagements/${engagementId}/negotiations`),
      create: (engagementId: string, data: Partial<NegotiationLog>) => request<NegotiationLog>(`/engagements/${engagementId}/negotiations`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<NegotiationLog>) => request<NegotiationLog>(`/negotiations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) => request<{ message: string }>(`/negotiations/${id}`, { method: 'DELETE' }),
      addUpdate: (id: string, data: { updatedBy: string; factoryResponseAt?: string | null; ourPosition: string; theirPosition: string; outcome: string; nextSteps: string }) => request<NegotiationLog>(`/negotiations/${id}/updates`, { method: 'POST', body: JSON.stringify(data) }),
      uploadAttachment: (negId: string, updateId: string, file: File, uploadedBy: string): Promise<NegotiationLog> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadedBy', uploadedBy);
        const token = getToken();
        return fetch(`${BASE_URL}/negotiations/${negId}/updates/${updateId}/attachments`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }).then(async (r) => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({ error: 'Lỗi upload' }));
            throw new Error(err.error || 'Lỗi upload');
          }
          return r.json();
        });
      },
      deleteAttachment: (negId: string, updateId: string, attachmentId: string) =>
        request<NegotiationLog>(`/negotiations/${negId}/updates/${updateId}/attachments/${attachmentId}`, { method: 'DELETE' }),
    },
    samples: {
      list: (engagementId: string) => request<Sample[]>(`/engagements/${engagementId}/samples`),
      create: (engagementId: string, data: Partial<Sample>) => request<Sample>(`/engagements/${engagementId}/samples`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<Sample>) => request<Sample>(`/samples/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      uploadAttachment: (sampleId: string, file: File, uploadedBy: string): Promise<Sample> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadedBy', uploadedBy);
        const token = getToken();
        return fetch(`${BASE_URL}/samples/${sampleId}/attachments`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }).then(async (r) => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({ error: 'Lỗi upload' }));
            throw new Error(err.error || 'Lỗi upload');
          }
          return r.json();
        });
      },
      deleteAttachment: (sampleId: string, attachmentId: string) =>
        request<Sample>(`/samples/${sampleId}/attachments/${attachmentId}`, { method: 'DELETE' }),
      addLink: (sampleId: string, data: { title: string; url: string; addedBy: string }) =>
        request<Sample>(`/samples/${sampleId}/links`, { method: 'POST', body: JSON.stringify(data) }),
      deleteLink: (sampleId: string, linkId: string) =>
        request<Sample>(`/samples/${sampleId}/links/${linkId}`, { method: 'DELETE' }),
      parseFormulaExcel: (file: File): Promise<SampleFormula> => {
        const formData = new FormData();
        formData.append('file', file);
        const token = getToken();
        return fetch(`${BASE_URL}/formula/parse-excel`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }).then(async (r) => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({ error: 'Lỗi phân tích file' }));
            throw new Error(err.error || 'Lỗi phân tích file');
          }
          return r.json();
        });
      },
    },
    packaging: {
      list: (engagementId: string) => request<PackagingDesign[]>(`/engagements/${engagementId}/packaging`),
      create: (engagementId: string, data: Partial<PackagingDesign>) => request<PackagingDesign>(`/engagements/${engagementId}/packaging`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<PackagingDesign>) => request<PackagingDesign>(`/packaging/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      revisions: {
        list: (packagingId: string) => request<PackagingRevision[]>(`/packaging/${packagingId}/revisions`),
        create: (packagingId: string, data: Partial<PackagingRevision>) => request<PackagingRevision>(`/packaging/${packagingId}/revisions`, { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Partial<PackagingRevision>) => request<PackagingRevision>(`/revisions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      },
    },
    communications: {
      list: (engagementId: string) => request<FactoryCommunication[]>(`/engagements/${engagementId}/communications`),
      create: (engagementId: string, data: Partial<FactoryCommunication>) => request<FactoryCommunication>(`/engagements/${engagementId}/communications`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<FactoryCommunication>) => request<FactoryCommunication>(`/communications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) => request<{ message: string }>(`/communications/${id}`, { method: 'DELETE' }),
    },
  },

  users: {
    list: () => request<User[]>('/users'),
    listActive: () => request<User[]>('/users/list'),
    create: (data: { name: string; email: string; password: string; role: string; avatarColor?: string }) =>
      request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; email: string; password: string; role: string; avatarColor: string; isActive: boolean }>) =>
      request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ message: string }>(`/users/${id}`, { method: 'DELETE' }),
  },
};
