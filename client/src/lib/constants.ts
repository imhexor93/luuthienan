import type { TaskStatus, TaskPriority, RiskSeverity, RiskLikelihood, RiskStatus, DocumentType, ProjectStatus, GateStatus } from '@rd/shared';

export const STAGE_COLORS = [
  '#7F77DD', // 1 - Ý tưởng & Nghiên cứu
  '#2563EB', // 2 - R&D Công thức
  '#16A34A', // 3 - Pháp lý
  '#D97706', // 4 - Bao bì
  '#DB2777', // 5 - Thử nghiệm
  '#9333EA', // 6 - Sản xuất
  '#D85A30', // 7 - Ra mắt
];

export const STAGE_NAMES = [
  'Ý tưởng & Nghiên cứu',
  'R&D Công thức & Báo giá',
  'Pháp lý & Đăng ký',
  'Bao bì & Thiết kế',
  'Thử nghiệm & Đánh giá',
  'Sản xuất',
  'Ra mắt thị trường',
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Đang hoạt động',
  'on-hold': 'Tạm dừng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'on-hold': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const GATE_STATUS_LABELS: Record<GateStatus, string> = {
  'not-started': 'Chưa đánh giá',
  'in-progress': 'Đang thực hiện',
  passed: 'Đã thông qua',
  failed: 'Không đạt',
};

export const GATE_STATUS_COLORS: Record<GateStatus, string> = {
  'not-started': 'text-muted-foreground',
  'in-progress': 'text-blue-500',
  passed: 'text-green-500',
  failed: 'text-red-500',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Chưa làm',
  doing: 'Đang làm',
  done: 'Hoàn thành',
  blocked: 'Bị chặn',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  doing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  done: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Khẩn cấp',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'border-l-slate-300',
  medium: 'border-l-blue-400',
  high: 'border-l-orange-400',
  critical: 'border-l-red-500',
};

export const RISK_SEVERITY_LABELS: Record<RiskSeverity, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
};

export const RISK_SEVERITY_COLORS: Record<RiskSeverity, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const RISK_LIKELIHOOD_LABELS: Record<RiskLikelihood, string> = {
  rare: 'Hiếm',
  possible: 'Có thể',
  likely: 'Có khả năng',
  certain: 'Chắc chắn',
};

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  open: 'Đang mở',
  monitoring: 'Đang theo dõi',
  mitigated: 'Đã giảm thiểu',
  occurred: 'Đã xảy ra',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  'market-research': 'Nghiên cứu thị trường',
  'technical-spec': 'Đặc tả kỹ thuật',
  design: 'Thiết kế',
  'test-report': 'Báo cáo kiểm thử',
  'business-case': 'Business Case',
  other: 'Khác',
};

export const PRODUCT_CATEGORIES = [
  'Thực phẩm chức năng',
  'Mỹ phẩm',
  'Thiết bị điện tử',
  'Phần mềm',
  'Dược phẩm',
  'Đồ gia dụng',
  'Thời trang',
  'Thực phẩm',
  'Khác',
];
