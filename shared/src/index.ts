// ============================================================
// Shared Types — dùng chung cho client và server
// ============================================================

// -------------------------
// Auth / Users
// -------------------------
export type UserRole = 'admin' | 'manager' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarColor: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// -------------------------
// Enums
// -------------------------
export type ProjectStatus = 'active' | 'on-hold' | 'completed' | 'cancelled';

export type GateStatus = 'not-started' | 'in-progress' | 'passed' | 'failed';

export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RiskLikelihood = 'rare' | 'possible' | 'likely' | 'certain';

export type RiskStatus = 'open' | 'monitoring' | 'mitigated' | 'occurred';

export type DocumentType =
  | 'market-research'
  | 'technical-spec'
  | 'design'
  | 'test-report'
  | 'business-case'
  | 'other';

export type ActivityEntityType =
  | 'project'
  | 'stage'
  | 'task'
  | 'risk'
  | 'document'
  | 'factory'
  | 'engagement'
  | 'rfq'
  | 'sample'
  | 'packaging';

// -------------------------
// Core Models
// -------------------------
export interface Project {
  id: string;
  name: string;
  description: string;
  productCategory: string;
  market: string;
  brand: string;
  progressSummary: string;
  startDate: string;
  targetLaunchDate: string;
  budget: number;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Stage {
  id: string;
  projectId: string;
  order: number;
  name: string;
  stageGroup: string | null;
  stageSummary: string;
  gateStatus: GateStatus;
  gateApprovedBy: string | null;
  gateApprovedAt: string | null;
  gateNotes: string | null;
}

export interface Task {
  id: string;
  projectId: string;
  stageId: string;
  title: string;
  description: string;
  owner: string;
  assigneeId: string | null;
  assigneeName: string;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number | null;
  actualHours: number | null;
  blockerReason: string | null;
  completionReport: string | null;
  issueNotes: string | null;
  approvalRequired: boolean;
  approvalStatus: 'not-required' | 'pending' | 'approved' | 'rejected';
  approvalBy: string | null;
  approvalNotes: string | null;
  approvalAt: string | null;
  approvalTargetId: string | null;
  approvalTargetName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalTask extends Task {
  projectName: string;
  stageName: string;
}

export interface ApprovalHistoryEntry {
  id: string;
  taskId: string;
  action: 'requested' | 'approved' | 'rejected';
  byName: string;
  byId: string | null;
  targetName: string | null;
  targetId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface StageWeeklyUpdate {
  id: string;
  stageId: string;
  weekLabel: string;
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'task_approved' | 'task_rejected';
  title: string;
  body: string;
  taskId: string | null;
  projectId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Risk {
  id: string;
  projectId: string;
  stageId: string | null;
  title: string;
  description: string;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  mitigation: string;
  status: RiskStatus;
}

export interface Document {
  id: string;
  projectId: string;
  stageId: string | null;
  title: string;
  type: DocumentType;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  projectId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TaskLink {
  id: string;
  taskId: string;
  projectId: string;
  title: string;
  url: string;
  linkType: string;
  addedBy: string;
  addedAt: string;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string;
  performedBy: string;
  performedAt: string;
  details: Record<string, unknown>;
}

// -------------------------
// Extended / Computed Types
// -------------------------
export interface StageWithProgress extends Stage {
  totalTasks: number;
  doneTasks: number;
  progressPercent: number;
  isLocked: boolean;
  lockReason: string | null;
}

export interface ProjectWithProgress extends Project {
  stages: StageWithProgress[];
  totalTasks: number;
  doneTasks: number;
  progressPercent: number;
  currentStage: StageWithProgress | null;
}

// -------------------------
// API Request/Response Types
// -------------------------
export interface CreateProjectInput {
  name: string;
  description?: string;
  productCategory?: string;
  market?: string;
  brand?: string;
  progressSummary?: string;
  startDate: string;
  targetLaunchDate: string;
  budget?: number;
  status?: ProjectStatus;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {}

export interface UpdateStageInput {
  gateStatus?: GateStatus;
  gateApprovedBy?: string;
  gateNotes?: string;
  stageSummary?: string;
}

export interface CreateTaskInput {
  stageId: string;
  title: string;
  description?: string;
  owner?: string;
  assigneeId?: string | null;
  assigneeName?: string;
  dueDate?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  estimatedHours?: number;
  actualHours?: number;
  blockerReason?: string;
  completionReport?: string;
  issueNotes?: string;
  approvalRequired?: boolean;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {}

export interface CreateRiskInput {
  stageId?: string;
  title: string;
  description?: string;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  mitigation?: string;
  status?: RiskStatus;
}

export interface UpdateRiskInput extends Partial<CreateRiskInput> {}

export interface CreateDocumentInput {
  stageId?: string;
  title: string;
  type: DocumentType;
  url: string;
  uploadedBy?: string;
}

export interface DashboardStats {
  activeProjects: number;
  upcomingDeadlines: number;
  overdueTasks: number;
  highRisks: number;
}

export interface SearchResult {
  projects: Array<Pick<Project, 'id' | 'name' | 'status' | 'productCategory'>>;
  tasks: Array<
    Pick<Task, 'id' | 'title' | 'status' | 'priority'> & {
      projectId: string;
      projectName: string;
    }
  >;
}

// -------------------------
// Factory Liaison Types
// -------------------------
export type FactoryStatus = 'active' | 'inactive' | 'blacklisted';
export type EngagementScope = 'formula' | 'packaging' | 'filling' | 'labeling' | 'full-production' | 'testing' | 'other';
export type EngagementStatus = 'sourcing' | 'quoting' | 'negotiating' | 'sampling' | 'approved' | 'in-production' | 'completed' | 'cancelled';
export type Currency = 'VND' | 'USD' | 'CNY';
export type RFQStatus = 'sent' | 'received' | 'clarifying' | 'expired' | 'cancelled';
export type QuoteStatus = 'pending-review' | 'accepted' | 'rejected' | 'countering';
export type NegotiationType = 'price-negotiation' | 'terms-negotiation' | 'spec-clarification' | 'timeline-negotiation' | 'other';
export type SampleType = 'formula' | 'packaging' | 'label' | 'finished-product' | 'raw-material' | 'other';
export type EvaluationStatus = 'pending-evaluation' | 'evaluating' | 'approved' | 'approved-with-changes' | 'rejected' | 'reworking';
export type PackagingComponentType = 'bottle' | 'cap' | 'label' | 'box' | 'inner-packaging' | 'shipping-carton' | 'other';
export type PackagingStatus = 'briefing' | 'designing' | 'review-round-1' | 'review-round-2' | 'review-round-3' | 'finalized' | 'on-hold';
export type RevisionDecision = 'approved' | 'minor-revision-needed' | 'major-revision-needed' | 'rejected';
export type CommunicationChannel = 'email' | 'phone-call' | 'zalo' | 'wechat' | 'wechat-video' | 'in-person-visit' | 'other';
export type CommunicationDirection = 'outgoing' | 'incoming';

export interface Factory {
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
  status: FactoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FactoryContact {
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
}

export interface WechatGroup {
  id: string;
  factoryId: string;
  groupName: string;
  purpose: string;
  ourMembers: string;
  theirMembers: string;
  qrCodePath: string;
  active: boolean;
  notes: string;
  createdAt: string;
}

export interface FactoryEngagement {
  id: string;
  projectId: string;
  factoryId: string;
  scope: EngagementScope;
  scopeDescription: string;
  status: EngagementStatus;
  primaryContactId: string | null;
  internalOwner: string;
  startDate: string;
  targetCompletionDate: string | null;
  finalUnitPrice: number | null;
  finalMOQ: number | null;
  currency: Currency;
  linkedStageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FactoryEngagementWithFactory extends FactoryEngagement {
  factoryName: string;
  factoryShortName: string;
  factoryCountry: string;
}

export interface QuoteRequest {
  id: string;
  engagementId: string;
  requestNumber: string;
  requestedAt: string;
  requestedBy: string;
  specifications: string;
  quantityRange: string;
  deadlineForResponse: string | null;
  status: RFQStatus;
  notes: string;
}

export interface QuoteProductLine {
  stt: number;
  productName: string;
  specs: string;          // quy cách (50g, 100ml...)
  productionQty: number;  // số lượng sản xuất (min batch)
  contentPriceKg: number | null;  // giá nội dung (kg)
  contentPricePcs: number;        // giá nội dung (pcs)
  processingFee: number;          // phí gia công (pcs)
  packagingODM: number;           // bao bì ODM (pcs)
  totalRMB: number;               // giá thành (RMB/pcs)
  totalUSD: number | null;        // giá USD
  packagingComponents: string;    // thành phần bao bì
  moq: number;                    // số lượng đặt hàng tối thiểu
  notes: string;                  // ghi chú cho dòng sản phẩm
}

export interface Quote {
  id: string;
  quoteRequestId: string;
  version: number;
  receivedAt: string;
  validUntil: string | null;
  pricingTerms: string;   // EXW, FOB, CIF...
  currency: Currency;
  leadTimeDays: number | null;
  paymentTerms: string;
  // v2 structured fields
  productName: string;
  specification: string;
  quantityScenario: string;
  generalNotes: string;
  totalUnitPrice: number;
  laborCostPerUnit: number;
  // legacy v1 product lines (flat JSON array)
  productLines: QuoteProductLine[];
  status: QuoteStatus;
  internalNotes: string;
  // legacy backward compat
  unitPrice: number;
  moq: number;
}

// -------------------------
// Quote cost breakdown types (v2)
// -------------------------
export type QuotePackagingComponentType =
  | 'bottle' | 'cap' | 'label' | 'box' | 'inner-bag' | 'outer-box'
  | 'pump' | 'dropper' | 'sleeve' | 'shrink-wrap' | 'tube' | 'other';

export type MaterialCalculationMethod = 'by-weight' | 'by-unit' | 'mixed';

export interface QuoteMaterialCost {
  id: string;
  quoteId: string;
  calculationMethod: MaterialCalculationMethod;
  pricePerKg: number | null;
  pricePerUnit: number | null;
  weightPerUnit: number | null;
  totalMaterialCost: number;
  materialNotes: string;
}

export interface QuotePackagingItem {
  id: string;
  quotePackagingCostId: string;
  order: number;
  componentName: string;
  componentType: QuotePackagingComponentType;
  unitCost: number;
  quantity: number;
  totalCost: number;
  notes: string;
}

export interface QuotePackagingCost {
  id: string;
  quoteId: string;
  totalPackagingCost: number;
  wastageCost: number;
  packagingNotes: string;
  items: QuotePackagingItem[];
}

export interface QuotePackagingTemplateItem {
  componentName: string;
  componentType: QuotePackagingComponentType;
  defaultQuantity: number;
  orderIndex: number;
}

export interface QuotePackagingTemplate {
  id: string;
  name: string;
  productCategory: string;
  items: QuotePackagingTemplateItem[];
  createdBy: string;
  createdAt: string;
  usageCount: number;
}

export interface QuoteTimelineEstimate {
  id: string;
  quoteId: string;
  packagingMinDays: number;
  packagingMaxDays: number;
  materialMinDays: number;
  materialMaxDays: number;
  fillingMinDays: number;
  fillingMaxDays: number;
  shippingMinDays: number;
  shippingMaxDays: number;
  totalMinDays: number;
  totalMaxDays: number;
  stageOverlaps: { packagingMaterial: boolean; materialFilling: boolean };
  estimateNotes: string;
}

export interface QuoteWithDetails extends Quote {
  materialCost: QuoteMaterialCost | null;
  packagingCost: QuotePackagingCost | null;
  timelineEstimate: QuoteTimelineEstimate | null;
}

// -------------------------
// Production tracking types
// -------------------------
export type ProductionExecutionStatus = 'not-started' | 'in-progress' | 'delayed' | 'completed' | 'on-hold';
export type ProductionPhaseType = 'bottle-production' | 'packaging-production' | 'material-production' | 'filling' | 'shipping-internal' | 'other';
export type ProductionPhaseStatus = 'not-started' | 'in-progress' | 'completed' | 'delayed' | 'blocked';

export interface ProductionExecution {
  id: string;
  engagementId: string;
  quoteId: string;
  productionOrderNumber: string;
  orderConfirmedAt: string;
  depositPaidAt: string | null;
  status: ProductionExecutionStatus;
  overallNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionPhase {
  id: string;
  productionExecutionId: string;
  phaseType: ProductionPhaseType;
  phaseName: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  plannedDays: number | null;
  actualDays: number | null;
  status: ProductionPhaseStatus;
  delayReason: string | null;
  dependsOn: string[];
  notes: string;
  order: number;
}

export interface ProductionExecutionWithPhases extends ProductionExecution {
  phases: ProductionPhase[];
}

// -------------------------
// Documentation workflow types
// -------------------------
export type DocumentationType =
  | 'loa-china' | 'cfs-china' | 'product-declaration-vn'
  | 'iso-cert' | 'halal-cert' | 'quality-cert'
  | 'import-permit' | 'customs-clearance' | 'other';
export type DocumentationStepStatus = 'not-started' | 'preparing' | 'submitted' | 'under-review' | 'approved' | 'rejected' | 'expired';
export type IssuingCountry = 'china' | 'vietnam' | 'other';
export type DocumentationWorkflowStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked';

export interface DocumentationWorkflow {
  id: string;
  engagementId: string;
  productionExecutionId: string | null;
  status: DocumentationWorkflowStatus;
  overallNotes: string;
}

export interface DocumentationStep {
  id: string;
  documentationWorkflowId: string;
  documentType: DocumentationType;
  documentTypeCustom: string | null;
  issuingCountry: IssuingCountry;
  estimatedMinDays: number;
  estimatedMaxDays: number;
  estimatedCost: number;
  estimatedCostCurrency: Currency;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  actualCost: number | null;
  status: DocumentationStepStatus;
  documentNumber: string;
  issueDate: string | null;
  expiryDate: string | null;
  handlerName: string;
  handlerContact: string;
  attachmentUrls: string[];
  notes: string;
  order: number;
}

export interface DocumentationWorkflowWithSteps extends DocumentationWorkflow {
  steps: DocumentationStep[];
}

// -------------------------
// Shipping leg types
// -------------------------
export type ShippingLegType = 'factory-to-port-china' | 'china-to-vietnam-sea' | 'china-to-vietnam-air' | 'vietnam-port-to-warehouse' | 'custom';
export type ShippingMode = 'sea' | 'air' | 'road' | 'rail';
export type ShippingLegStatus = 'not-booked' | 'booked' | 'in-transit' | 'customs-clearance' | 'delivered' | 'delayed';

export interface ShippingLeg {
  id: string;
  engagementId: string;
  productionExecutionId: string | null;
  legType: ShippingLegType;
  origin: string;
  destination: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  plannedDays: number | null;
  actualDays: number | null;
  mode: ShippingMode;
  cost: number;
  costCurrency: Currency;
  trackingNumber: string;
  carrier: string;
  status: ShippingLegStatus;
  notes: string;
  order: number;
}

export type NegotiationStatus = 'open' | 'in-progress' | 'closed-win' | 'closed-loss' | 'on-hold';

export interface NegotiationAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface NegotiationUpdate {
  id: string;
  date: string;            // thời điểm nhân viên ghi nhận
  factoryResponseAt: string | null; // thời điểm nhà máy thực sự phản hồi
  updatedBy: string;
  ourPosition: string;
  theirPosition: string;
  outcome: string;
  nextSteps: string;
  attachments: NegotiationAttachment[];
}

export interface NegotiationLog {
  id: string;
  engagementId: string;
  quoteId: string | null;
  loggedAt: string;
  loggedBy: string;
  type: NegotiationType;
  subject: string;
  ourPosition: string;
  theirPosition: string;
  outcome: string;
  nextSteps: string;
  // v2 fields
  assignedTo: string;
  status: NegotiationStatus;
  targetObjective: string;
  deadline: string | null;
  updates: NegotiationUpdate[];
}

export type IngredientWarningLevel = 'banned' | 'restricted' | 'caution';

export interface FormulaIngredient {
  id: string;
  tradeName: string;       // tên thương mại nguyên liệu thô
  inciName: string;        // INCI name / tên khoa học quốc tế
  function: string;        // chức năng ghi trong tài liệu/Excel
  aiFunction: string;      // chức năng AI kiểm chứng
  activeRatio: string;     // tỷ lệ hoạt chất trong nguyên liệu thô (VD: "30%")
  rawPercentage: string;   // % nguyên liệu thô trong công thức cuối
  supplier: string;
  notes: string;
  warningLevel: IngredientWarningLevel | null;
  warningDetail: string;
}

export interface SampleFormula {
  dosageForm: string;
  totalWeight: string;
  servingSize: string;
  formulaNotes: string;
  ingredients: FormulaIngredient[];
}

export interface SampleAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface SampleLink {
  id: string;
  title: string;
  url: string;
  addedAt: string;
  addedBy: string;
}

export interface Sample {
  id: string;
  engagementId: string;
  sampleNumber: string;
  type: SampleType;
  version: number;
  receivedAt: string;
  receivedBy: string;
  description: string;
  evaluationStatus: EvaluationStatus;
  evaluatedBy: string;
  evaluatedAt: string | null;
  evaluationCriteria: Array<{ criterion: string; rating: number; notes: string }>;
  overallRating: number | null;
  feedbackToFactory: string;
  revisionRequested: boolean;
  revisionDetails: string;
  attachments: SampleAttachment[];
  links: SampleLink[];
  formula: SampleFormula;
}

export interface PackagingDesign {
  id: string;
  engagementId: string | null;
  projectId: string;
  componentType: PackagingComponentType;
  name: string;
  currentVersion: number;
  status: PackagingStatus;
  briefSentAt: string | null;
  briefDocument: string;
  specifications: Record<string, string>;
  targetCost: number | null;
  actualCost: number | null;
  finalizedAt: string | null;
}

export interface PackagingRevision {
  id: string;
  packagingDesignId: string;
  revisionNumber: number;
  submittedByFactoryAt: string;
  reviewedAt: string | null;
  reviewedBy: string;
  issues: Array<{ category: string; severity: 'low' | 'medium' | 'high'; description: string }>;
  overallDecision: RevisionDecision | null;
  feedbackSummary: string;
  factoryResponseAt: string | null;
  factoryResponse: string;
}

export interface FactoryCommunication {
  id: string;
  engagementId: string;
  contactId: string | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  loggedAt: string;
  loggedBy: string;
  subject: string;
  summary: string;
  actionItems: Array<{ who: string; what: string; due: string | null; done: boolean }>;
}

// -------------------------
// Stage name constants
// -------------------------
export const STAGE_NAMES = [
  'Ý tưởng & Nghiên cứu',
  'R&D Công thức & Báo giá',
  'Pháp lý & Đăng ký',
  'Bao bì & Thiết kế',
  'Thử nghiệm & Đánh giá',
  'Sản xuất',
  'Ra mắt thị trường',
] as const;

// Orders 2-5 belong to the 'development' parallel group
export const DEVELOPMENT_STAGE_ORDERS = [2, 3, 4, 5] as const;

export const STAGE_COLORS = [
  '#7F77DD', // 1 - Ý tưởng & Nghiên cứu (tím)
  '#2563EB', // 2 - R&D Công thức (xanh dương)
  '#16A34A', // 3 - Pháp lý (xanh lá)
  '#D97706', // 4 - Bao bì (hổ phách)
  '#DB2777', // 5 - Thử nghiệm (hồng)
  '#9333EA', // 6 - Sản xuất (tím đậm)
  '#D85A30', // 7 - Ra mắt (đỏ cam)
] as const;
