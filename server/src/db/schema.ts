// ============================================================
// SQLite Database Schema & Initialization
// ============================================================
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createHash, randomBytes } from 'crypto';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/rd_projects.db');

// Đảm bảo thư mục data tồn tại
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable WAL mode để tăng hiệu năng đọc/ghi đồng thời
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    -- =====================
    -- Users table
    -- =====================
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee'
        CHECK(role IN ('admin','manager','employee')),
      avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =====================
    -- Projects table
    -- =====================
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      product_category TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      target_launch_date TEXT NOT NULL,
      budget REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'on-hold', 'completed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =====================
    -- Stages table (7 stages per project: 1 main, 4 parallel development, 1 production, 1 launch)
    -- =====================
    CREATE TABLE IF NOT EXISTS stages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL CHECK("order" BETWEEN 1 AND 7),
      name TEXT NOT NULL,
      stage_group TEXT,
      gate_status TEXT NOT NULL DEFAULT 'not-started'
        CHECK(gate_status IN ('not-started', 'in-progress', 'passed', 'failed')),
      gate_approved_by TEXT,
      gate_approved_at TEXT,
      gate_notes TEXT,
      UNIQUE(project_id, "order")
    );

    -- =====================
    -- Tasks table
    -- =====================
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      owner TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'todo'
        CHECK(status IN ('todo', 'doing', 'done', 'blocked')),
      priority TEXT NOT NULL DEFAULT 'medium'
        CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      estimated_hours REAL,
      actual_hours REAL,
      blocker_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =====================
    -- Risks table
    -- =====================
    CREATE TABLE IF NOT EXISTS risks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      stage_id TEXT REFERENCES stages(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'medium'
        CHECK(severity IN ('low', 'medium', 'high', 'critical')),
      likelihood TEXT NOT NULL DEFAULT 'possible'
        CHECK(likelihood IN ('rare', 'possible', 'likely', 'certain')),
      mitigation TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open'
        CHECK(status IN ('open', 'monitoring', 'mitigated', 'occurred'))
    );

    -- =====================
    -- Documents table
    -- =====================
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      stage_id TEXT REFERENCES stages(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other'
        CHECK(type IN ('market-research', 'technical-spec', 'design', 'test-report', 'business-case', 'other')),
      url TEXT NOT NULL,
      uploaded_by TEXT NOT NULL DEFAULT '',
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =====================
    -- Task attachments table
    -- =====================
    CREATE TABLE IF NOT EXISTS task_attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mimetype TEXT NOT NULL DEFAULT '',
      size INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT NOT NULL DEFAULT '',
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

    CREATE TABLE IF NOT EXISTS task_links (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      link_type TEXT NOT NULL DEFAULT 'other',
      added_by TEXT NOT NULL DEFAULT '',
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_task_links_task_id ON task_links(task_id);

    -- =====================
    -- Activity logs table
    -- =====================
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL
        CHECK(entity_type IN ('project', 'stage', 'task', 'risk', 'document', 'factory', 'engagement', 'rfq', 'sample', 'packaging')),
      entity_id TEXT NOT NULL,
      performed_by TEXT NOT NULL DEFAULT 'System',
      performed_at TEXT NOT NULL DEFAULT (datetime('now')),
      details TEXT NOT NULL DEFAULT '{}'
    );

    -- =====================
    -- Factory module tables
    -- =====================
    CREATE TABLE IF NOT EXISTS factories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'Việt Nam',
      specialties TEXT NOT NULL DEFAULT '[]',
      certifications TEXT NOT NULL DEFAULT '[]',
      moq_default REAL,
      lead_time_days INTEGER,
      payment_terms TEXT NOT NULL DEFAULT '',
      rating REAL NOT NULL DEFAULT 3,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active','inactive','blacklisted')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS factory_contacts (
      id TEXT PRIMARY KEY,
      factory_id TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      zalo TEXT NOT NULL DEFAULT '',
      wechat TEXT NOT NULL DEFAULT '',
      is_primary INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS factory_engagements (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      factory_id TEXT NOT NULL REFERENCES factories(id),
      scope TEXT NOT NULL DEFAULT 'other'
        CHECK(scope IN ('formula','packaging','filling','labeling','full-production','testing','other')),
      scope_description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'sourcing'
        CHECK(status IN ('sourcing','quoting','negotiating','sampling','approved','in-production','completed','cancelled')),
      primary_contact_id TEXT REFERENCES factory_contacts(id) ON DELETE SET NULL,
      internal_owner TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL DEFAULT (date('now')),
      target_completion_date TEXT,
      final_unit_price REAL,
      final_moq REAL,
      currency TEXT NOT NULL DEFAULT 'VND'
        CHECK(currency IN ('VND','USD','CNY')),
      linked_stage_id TEXT REFERENCES stages(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quote_requests (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES factory_engagements(id) ON DELETE CASCADE,
      request_number TEXT NOT NULL,
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      requested_by TEXT NOT NULL DEFAULT '',
      specifications TEXT NOT NULL DEFAULT '',
      quantity_range TEXT NOT NULL DEFAULT '',
      deadline_for_response TEXT,
      status TEXT NOT NULL DEFAULT 'sent'
        CHECK(status IN ('sent','received','clarifying','expired','cancelled')),
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      quote_request_id TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      received_at TEXT NOT NULL DEFAULT (datetime('now')),
      valid_until TEXT,
      unit_price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'VND',
      moq REAL NOT NULL DEFAULT 0,
      lead_time_days INTEGER,
      payment_terms TEXT NOT NULL DEFAULT '',
      includes_packaging INTEGER NOT NULL DEFAULT 0,
      includes_shipping INTEGER NOT NULL DEFAULT 0,
      price_breaks TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending-review'
        CHECK(status IN ('pending-review','accepted','rejected','countering')),
      internal_notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS negotiation_logs (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES factory_engagements(id) ON DELETE CASCADE,
      quote_id TEXT REFERENCES quotes(id) ON DELETE SET NULL,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      logged_by TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'other'
        CHECK(type IN ('price-negotiation','terms-negotiation','spec-clarification','timeline-negotiation','other')),
      subject TEXT NOT NULL DEFAULT '',
      our_position TEXT NOT NULL DEFAULT '',
      their_position TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL DEFAULT '',
      next_steps TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS samples (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES factory_engagements(id) ON DELETE CASCADE,
      sample_number TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other'
        CHECK(type IN ('formula','packaging','label','finished-product','raw-material','other')),
      version INTEGER NOT NULL DEFAULT 1,
      received_at TEXT NOT NULL DEFAULT (datetime('now')),
      received_by TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      evaluation_status TEXT NOT NULL DEFAULT 'pending-evaluation'
        CHECK(evaluation_status IN ('pending-evaluation','evaluating','approved','approved-with-changes','rejected','reworking')),
      evaluated_by TEXT NOT NULL DEFAULT '',
      evaluated_at TEXT,
      evaluation_criteria TEXT NOT NULL DEFAULT '[]',
      overall_rating REAL,
      feedback_to_factory TEXT NOT NULL DEFAULT '',
      revision_requested INTEGER NOT NULL DEFAULT 0,
      revision_details TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS packaging_designs (
      id TEXT PRIMARY KEY,
      engagement_id TEXT REFERENCES factory_engagements(id) ON DELETE SET NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      component_type TEXT NOT NULL DEFAULT 'other'
        CHECK(component_type IN ('bottle','cap','label','box','inner-packaging','shipping-carton','other')),
      name TEXT NOT NULL,
      current_version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'briefing'
        CHECK(status IN ('briefing','designing','review-round-1','review-round-2','review-round-3','finalized','on-hold')),
      brief_sent_at TEXT,
      brief_document TEXT NOT NULL DEFAULT '',
      specifications TEXT NOT NULL DEFAULT '{}',
      target_cost REAL,
      actual_cost REAL,
      finalized_at TEXT
    );

    CREATE TABLE IF NOT EXISTS packaging_revisions (
      id TEXT PRIMARY KEY,
      packaging_design_id TEXT NOT NULL REFERENCES packaging_designs(id) ON DELETE CASCADE,
      revision_number INTEGER NOT NULL DEFAULT 1,
      submitted_by_factory_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      reviewed_by TEXT NOT NULL DEFAULT '',
      issues TEXT NOT NULL DEFAULT '[]',
      overall_decision TEXT
        CHECK(overall_decision IN ('approved','minor-revision-needed','major-revision-needed','rejected') OR overall_decision IS NULL),
      feedback_summary TEXT NOT NULL DEFAULT '',
      factory_response_at TEXT,
      factory_response TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS factory_communications (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES factory_engagements(id) ON DELETE CASCADE,
      contact_id TEXT REFERENCES factory_contacts(id) ON DELETE SET NULL,
      channel TEXT NOT NULL DEFAULT 'other'
        CHECK(channel IN ('email','phone-call','zalo','wechat','wechat-video','in-person-visit','other')),
      direction TEXT NOT NULL DEFAULT 'outgoing'
        CHECK(direction IN ('outgoing','incoming')),
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      logged_by TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      action_items TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS factory_wechat_groups (
      id TEXT PRIMARY KEY,
      factory_id TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
      group_name TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      our_members TEXT NOT NULL DEFAULT '',
      their_members TEXT NOT NULL DEFAULT '',
      qr_code_path TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_factory_contacts_factory_id ON factory_contacts(factory_id);
    CREATE INDEX IF NOT EXISTS idx_factory_wechat_groups_factory_id ON factory_wechat_groups(factory_id);
    CREATE INDEX IF NOT EXISTS idx_factory_engagements_project_id ON factory_engagements(project_id);
    CREATE INDEX IF NOT EXISTS idx_factory_engagements_factory_id ON factory_engagements(factory_id);
    CREATE INDEX IF NOT EXISTS idx_quote_requests_engagement_id ON quote_requests(engagement_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_quote_request_id ON quotes(quote_request_id);
    CREATE INDEX IF NOT EXISTS idx_samples_engagement_id ON samples(engagement_id);
    CREATE INDEX IF NOT EXISTS idx_packaging_designs_project_id ON packaging_designs(project_id);
    CREATE INDEX IF NOT EXISTS idx_packaging_revisions_design_id ON packaging_revisions(packaging_design_id);
    CREATE INDEX IF NOT EXISTS idx_factory_communications_engagement_id ON factory_communications(engagement_id);

    -- =====================
    -- Quote cost breakdown tables (structured)
    -- =====================
    CREATE TABLE IF NOT EXISTS quote_material_costs (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE CASCADE,
      calculation_method TEXT NOT NULL DEFAULT 'by-weight'
        CHECK(calculation_method IN ('by-weight', 'by-unit', 'mixed')),
      price_per_kg REAL,
      price_per_unit REAL,
      weight_per_unit REAL,
      total_material_cost REAL NOT NULL DEFAULT 0,
      material_notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS quote_packaging_costs (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE CASCADE,
      total_packaging_cost REAL NOT NULL DEFAULT 0,
      wastage_cost REAL NOT NULL DEFAULT 0,
      packaging_notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS quote_packaging_items (
      id TEXT PRIMARY KEY,
      quote_packaging_cost_id TEXT NOT NULL REFERENCES quote_packaging_costs(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL DEFAULT 1,
      component_name TEXT NOT NULL DEFAULT '',
      component_type TEXT NOT NULL DEFAULT 'other'
        CHECK(component_type IN ('bottle','cap','label','box','inner-bag','outer-box','pump','dropper','sleeve','shrink-wrap','tube','other')),
      unit_cost REAL NOT NULL DEFAULT 0,
      quantity REAL NOT NULL DEFAULT 1,
      total_cost REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS quote_packaging_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_category TEXT NOT NULL DEFAULT '',
      items TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL DEFAULT 'System',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      usage_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS quote_timeline_estimates (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE CASCADE,
      packaging_min_days INTEGER NOT NULL DEFAULT 0,
      packaging_max_days INTEGER NOT NULL DEFAULT 0,
      material_min_days INTEGER NOT NULL DEFAULT 0,
      material_max_days INTEGER NOT NULL DEFAULT 0,
      filling_min_days INTEGER NOT NULL DEFAULT 0,
      filling_max_days INTEGER NOT NULL DEFAULT 0,
      shipping_min_days INTEGER NOT NULL DEFAULT 0,
      shipping_max_days INTEGER NOT NULL DEFAULT 0,
      total_min_days INTEGER NOT NULL DEFAULT 0,
      total_max_days INTEGER NOT NULL DEFAULT 0,
      stage_overlaps TEXT NOT NULL DEFAULT '{"packagingMaterial":true,"materialFilling":false}',
      estimate_notes TEXT NOT NULL DEFAULT ''
    );

    -- =====================
    -- Production execution tracking
    -- =====================
    CREATE TABLE IF NOT EXISTS production_executions (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES factory_engagements(id) ON DELETE CASCADE,
      quote_id TEXT NOT NULL REFERENCES quotes(id),
      production_order_number TEXT NOT NULL DEFAULT '',
      order_confirmed_at TEXT NOT NULL DEFAULT (date('now')),
      deposit_paid_at TEXT,
      status TEXT NOT NULL DEFAULT 'not-started'
        CHECK(status IN ('not-started','in-progress','delayed','completed','on-hold')),
      overall_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS production_phases (
      id TEXT PRIMARY KEY,
      production_execution_id TEXT NOT NULL REFERENCES production_executions(id) ON DELETE CASCADE,
      phase_type TEXT NOT NULL DEFAULT 'other'
        CHECK(phase_type IN ('bottle-production','packaging-production','material-production','filling','shipping-internal','other')),
      phase_name TEXT NOT NULL DEFAULT '',
      planned_start_date TEXT,
      planned_end_date TEXT,
      actual_start_date TEXT,
      actual_end_date TEXT,
      planned_days INTEGER,
      actual_days INTEGER,
      status TEXT NOT NULL DEFAULT 'not-started'
        CHECK(status IN ('not-started','in-progress','completed','delayed','blocked')),
      delay_reason TEXT,
      depends_on TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      "order" INTEGER NOT NULL DEFAULT 1
    );

    -- =====================
    -- Documentation workflow
    -- =====================
    CREATE TABLE IF NOT EXISTS documentation_workflows (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL UNIQUE REFERENCES factory_engagements(id) ON DELETE CASCADE,
      production_execution_id TEXT REFERENCES production_executions(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'not-started'
        CHECK(status IN ('not-started','in-progress','completed','blocked')),
      overall_notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS documentation_steps (
      id TEXT PRIMARY KEY,
      documentation_workflow_id TEXT NOT NULL REFERENCES documentation_workflows(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL DEFAULT 'other'
        CHECK(document_type IN ('loa-china','cfs-china','product-declaration-vn','iso-cert','halal-cert','quality-cert','import-permit','customs-clearance','other')),
      document_type_custom TEXT,
      issuing_country TEXT NOT NULL DEFAULT 'china'
        CHECK(issuing_country IN ('china','vietnam','other')),
      estimated_min_days INTEGER NOT NULL DEFAULT 0,
      estimated_max_days INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL DEFAULT 0,
      estimated_cost_currency TEXT NOT NULL DEFAULT 'CNY'
        CHECK(estimated_cost_currency IN ('VND','USD','CNY')),
      planned_start_date TEXT,
      planned_end_date TEXT,
      actual_start_date TEXT,
      actual_end_date TEXT,
      actual_cost REAL,
      status TEXT NOT NULL DEFAULT 'not-started'
        CHECK(status IN ('not-started','preparing','submitted','under-review','approved','rejected','expired')),
      document_number TEXT NOT NULL DEFAULT '',
      issue_date TEXT,
      expiry_date TEXT,
      handler_name TEXT NOT NULL DEFAULT '',
      handler_contact TEXT NOT NULL DEFAULT '',
      attachment_urls TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      "order" INTEGER NOT NULL DEFAULT 1
    );

    -- =====================
    -- Shipping legs
    -- =====================
    CREATE TABLE IF NOT EXISTS shipping_legs (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES factory_engagements(id) ON DELETE CASCADE,
      production_execution_id TEXT REFERENCES production_executions(id) ON DELETE SET NULL,
      leg_type TEXT NOT NULL DEFAULT 'custom'
        CHECK(leg_type IN ('factory-to-port-china','china-to-vietnam-sea','china-to-vietnam-air','vietnam-port-to-warehouse','custom')),
      origin TEXT NOT NULL DEFAULT '',
      destination TEXT NOT NULL DEFAULT '',
      planned_start_date TEXT,
      planned_end_date TEXT,
      actual_start_date TEXT,
      actual_end_date TEXT,
      planned_days INTEGER,
      actual_days INTEGER,
      mode TEXT NOT NULL DEFAULT 'sea'
        CHECK(mode IN ('sea','air','road','rail')),
      cost REAL NOT NULL DEFAULT 0,
      cost_currency TEXT NOT NULL DEFAULT 'USD'
        CHECK(cost_currency IN ('VND','USD','CNY')),
      tracking_number TEXT NOT NULL DEFAULT '',
      carrier TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'not-booked'
        CHECK(status IN ('not-booked','booked','in-transit','customs-clearance','delivered','delayed')),
      notes TEXT NOT NULL DEFAULT '',
      "order" INTEGER NOT NULL DEFAULT 1
    );

    -- =====================
    -- Indexes để tối ưu query
    -- =====================
    CREATE INDEX IF NOT EXISTS idx_stages_project_id ON stages(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_stage_id ON tasks(stage_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_risks_project_id ON risks(project_id);
    CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_performed_at ON activity_logs(performed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_production_executions_engagement_id ON production_executions(engagement_id);
    CREATE INDEX IF NOT EXISTS idx_production_phases_execution_id ON production_phases(production_execution_id);
    CREATE INDEX IF NOT EXISTS idx_documentation_steps_workflow_id ON documentation_steps(documentation_workflow_id);
    CREATE INDEX IF NOT EXISTS idx_shipping_legs_engagement_id ON shipping_legs(engagement_id);
    CREATE INDEX IF NOT EXISTS idx_quote_material_costs_quote_id ON quote_material_costs(quote_id);
    CREATE INDEX IF NOT EXISTS idx_quote_packaging_costs_quote_id ON quote_packaging_costs(quote_id);
    CREATE INDEX IF NOT EXISTS idx_quote_packaging_items_cost_id ON quote_packaging_items(quote_packaging_cost_id);
  `);

  // Migration: thêm cột mới nếu chưa tồn tại
  const migrations = [
    `ALTER TABLE tasks ADD COLUMN completion_report TEXT`,
    `ALTER TABLE tasks ADD COLUMN issue_notes TEXT`,
    `ALTER TABLE quotes ADD COLUMN product_lines TEXT`,
    `ALTER TABLE quotes ADD COLUMN pricing_terms TEXT NOT NULL DEFAULT 'EXW'`,
    // Quote v2: structured cost breakdown
    `ALTER TABLE quotes ADD COLUMN product_name TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE quotes ADD COLUMN specification TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE quotes ADD COLUMN quantity_scenario TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE quotes ADD COLUMN general_notes TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE quotes ADD COLUMN total_unit_price REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE quotes ADD COLUMN labor_cost_per_unit REAL NOT NULL DEFAULT 0`,
    // Negotiation v2: manager/employee workflow
    `ALTER TABLE negotiation_logs ADD COLUMN assigned_to TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE negotiation_logs ADD COLUMN status TEXT NOT NULL DEFAULT 'open'`,
    `ALTER TABLE negotiation_logs ADD COLUMN target_objective TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE negotiation_logs ADD COLUMN deadline TEXT`,
    `ALTER TABLE negotiation_logs ADD COLUMN updates TEXT NOT NULL DEFAULT '[]'`,
    // Task assignee
    `ALTER TABLE tasks ADD COLUMN assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE tasks ADD COLUMN assignee_name TEXT NOT NULL DEFAULT ''`,
    // Sample attachments + links
    `ALTER TABLE samples ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE samples ADD COLUMN links TEXT NOT NULL DEFAULT '[]'`,
    // WeChat group QR code
    `ALTER TABLE factory_wechat_groups ADD COLUMN qr_code_path TEXT NOT NULL DEFAULT ''`,
    // Sample formula / ingredient list
    `ALTER TABLE samples ADD COLUMN formula TEXT NOT NULL DEFAULT '{}'`,
    // Project: market, brand, progress summary
    `ALTER TABLE projects ADD COLUMN market TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE projects ADD COLUMN brand TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE projects ADD COLUMN progress_summary TEXT NOT NULL DEFAULT ''`,
    // Stage summary (per-stage progress note)
    `ALTER TABLE stages ADD COLUMN stage_summary TEXT NOT NULL DEFAULT ''`,
    // Task approval workflow
    `ALTER TABLE tasks ADD COLUMN approval_required INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE tasks ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'not-required'`,
    `ALTER TABLE tasks ADD COLUMN approval_by TEXT`,
    `ALTER TABLE tasks ADD COLUMN approval_notes TEXT`,
    `ALTER TABLE tasks ADD COLUMN approval_at TEXT`,
    // Approval target (who the request is directed to)
    `ALTER TABLE tasks ADD COLUMN approval_target_id TEXT`,
    `ALTER TABLE tasks ADD COLUMN approval_target_name TEXT`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  // Stage weekly progress updates
  db.exec(`
    CREATE TABLE IF NOT EXISTS stage_weekly_updates (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
      week_label TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      task_id TEXT,
      project_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Approval history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_approval_history (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK(action IN ('requested', 'approved', 'rejected')),
      by_name TEXT NOT NULL DEFAULT '',
      by_id TEXT,
      target_name TEXT,
      target_id TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migration: recreate stages table with 7-stage design (order 1-7, stage_group column)
  const stagesInfo = db.prepare(`SELECT COUNT(*) as cnt FROM pragma_table_info('stages') WHERE name = 'stage_group'`).get() as { cnt: number };
  if (stagesInfo.cnt === 0) {
    try {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE stages_v2 (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          "order" INTEGER NOT NULL CHECK("order" BETWEEN 1 AND 7),
          name TEXT NOT NULL,
          stage_group TEXT,
          gate_status TEXT NOT NULL DEFAULT 'not-started'
            CHECK(gate_status IN ('not-started', 'in-progress', 'passed', 'failed')),
          gate_approved_by TEXT,
          gate_approved_at TEXT,
          gate_notes TEXT,
          UNIQUE(project_id, "order")
        );
        INSERT INTO stages_v2 (id, project_id, "order", name, stage_group, gate_status, gate_approved_by, gate_approved_at, gate_notes)
          SELECT id, project_id, "order", name, NULL, gate_status, gate_approved_by, gate_approved_at, gate_notes FROM stages;
        DROP TABLE stages;
        ALTER TABLE stages_v2 RENAME TO stages;
        CREATE INDEX IF NOT EXISTS idx_stages_project_id ON stages(project_id);
        UPDATE stages SET name = 'Ý tưởng & Nghiên cứu' WHERE "order" = 1;
        UPDATE stages SET name = 'R&D Công thức & Báo giá', stage_group = 'development' WHERE "order" = 2;
        UPDATE stages SET name = 'Pháp lý & Đăng ký', stage_group = 'development' WHERE "order" = 3;
        UPDATE stages SET name = 'Bao bì & Thiết kế', stage_group = 'development' WHERE "order" = 4;
        UPDATE stages SET name = 'Thử nghiệm & Đánh giá', stage_group = 'development' WHERE "order" = 5;
      `);
      db.pragma('foreign_keys = ON');

      // Add stages 6 and 7 for each existing project
      const { v4: uuidv4M } = require('uuid');
      const existingProjects = db.prepare('SELECT id FROM projects').all() as { id: string }[];
      for (const project of existingProjects) {
        db.prepare(`INSERT OR IGNORE INTO stages (id, project_id, "order", name, stage_group, gate_status) VALUES (?, ?, 6, 'Sản xuất', NULL, 'not-started')`)
          .run(uuidv4M(), project.id);
        db.prepare(`INSERT OR IGNORE INTO stages (id, project_id, "order", name, stage_group, gate_status) VALUES (?, ?, 7, 'Ra mắt thị trường', NULL, 'not-started')`)
          .run(uuidv4M(), project.id);
      }
      console.log('✅ Migrated stages to 7-stage design');
    } catch (err) {
      db.pragma('foreign_keys = ON');
      console.error('❌ Stage migration failed:', err);
    }
  }

  // Seed default admin account nếu chưa có user nào
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  if (userCount === 0) {
    const { v4: uuidv4 } = require('uuid');
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, avatar_color)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), 'Quản trị viên', 'admin@rd.local', hashPassword('admin123'), 'admin', '#6366f1');
    console.log('👤 Đã tạo tài khoản admin mặc định: admin@rd.local / admin123');
  }

  console.log('✅ Database initialized at:', DB_PATH);
}
