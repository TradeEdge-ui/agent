export type AutonomyLevel = 'SUGGEST' | 'DRAFT' | 'EXECUTE'

export interface User {
  id: string
  email: string
  full_name: string
}

export interface Me {
  user: User
  business_id: string
  business_name: string
  role: 'OWNER' | 'ADMIN' | 'USER'
  onboarding_completed: boolean
}

export interface Business {
  id: string
  name: string
  description: string
  industry: string
  currency: string
  timezone: string
  contact_email: string
  contact_phone: string
  address: string
  default_quotation_validity_days: number
  default_payment_terms: string
  invoice_numbering_prefix: string
  quotation_numbering_prefix: string
  tax_label: string
  tax_rate_percent: number
  tax_registered: boolean
  communication_style: string
  autonomy_level: AutonomyLevel
  ai_provider: string
  ai_model: string
  stale_lead_days_threshold: number
  onboarding_completed: boolean
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  company: string
  notes: string
  status: string
  source: string
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  customer_id: string | null
  title: string
  value: number
  source: string
  status: 'NEW' | 'QUALIFIED' | 'QUOTED' | 'NEGOTIATING' | 'WON' | 'LOST'
  notes: string
  next_follow_up: string | null
  last_activity_at: string | null
  created_at: string
  updated_at: string
}

export interface Interaction {
  id: string
  customer_id: string | null
  lead_id: string | null
  channel: string
  direction: string
  content: string
  created_by: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE'
  due_date: string | null
  customer_id: string | null
  lead_id: string | null
  project: string
  created_by: string
  assigned_to: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface FollowUp {
  id: string
  customer_id: string | null
  lead_id: string | null
  quotation_id: string | null
  trigger_at: string
  due_at: string
  reason: string
  status: 'PENDING' | 'DONE' | 'CANCELLED'
  outcome: string
  created_by: string
  created_at: string
}

export interface LineItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  line_total?: number
}

export interface Quotation {
  id: string
  number: string
  customer_id: string | null
  lead_id: string | null
  issue_date: string
  expiry_date: string | null
  discount_percent: number
  tax_percent: number
  subtotal: number
  tax_amount: number
  total: number
  notes: string
  payment_terms: string
  status: string
  created_by: string
  items: LineItem[]
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  number: string
  customer_id: string | null
  quotation_id: string | null
  issue_date: string
  due_date: string | null
  discount_percent: number
  tax_percent: number
  subtotal: number
  tax_amount: number
  total: number
  amount_paid: number
  notes: string
  payment_terms: string
  payment_status: string
  status: string
  created_by: string
  items: LineItem[]
  created_at: string
  updated_at: string
}

export interface DocumentRecord {
  id: string
  filename: string
  content_type: string
  size_bytes: number
  category: string
  extracted_fields: Record<string, { value: unknown; confidence: number }>
  extraction_confidence: number
  needs_review: boolean
  customer_id: string | null
  uploaded_by: string
  created_at: string
}

export interface KnowledgeDocument {
  id: string
  title: string
  source_type: string
  created_at: string
}

export interface KnowledgeSearchResult {
  document_id: string
  document_title: string
  chunk_content: string
  score: number
}

export interface Approval {
  id: string
  run_id: string | null
  action: string
  reason: string
  data: Record<string, unknown>
  expected_result: string
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  tool_name: string
  tool_input: Record<string, unknown>
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EDITED_APPROVED'
  decided_by: string
  decision_notes: string
  edited_input: Record<string, unknown> | null
  created_at: string
}

export interface AuditLogEntry {
  id: string
  actor: string
  action: string
  tool_name: string
  input_summary: string
  output_summary: string
  approval_required: boolean
  approval_result: string
  success: boolean
  error: string
  created_at: string
}

export interface AgentMessage {
  role: string
  content: string
  created_at: string
}

export interface ToolExecution {
  tool_name: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  success: boolean
  error: string
  required_approval: boolean
}

export interface AgentRun {
  id: string
  request_text: string
  status: 'PENDING' | 'RUNNING' | 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  current_step: string
  iteration_count: number
  final_response: string
  error: string
  messages: AgentMessage[]
  tool_executions: ToolExecution[]
  created_at: string
}

export interface Recommendation {
  text: string
  reason: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  link: string
}

export interface DashboardData {
  urgent_tasks: Task[]
  new_leads: Lead[]
  leads_needing_follow_up: Lead[]
  quotations_awaiting_approval: { id: string; number: string; total: number; status: string }[]
  overdue_tasks: Task[]
  invoice_alerts: { id: string; number: string; total: number; due_date: string | null }[]
  recent_activity: { id: string; actor: string; action: string; created_at: string; success: boolean }[]
  recommendations: Recommendation[]
}

export interface DailyBrief {
  generated_at: string
  urgent_tasks_count: number
  new_leads_count: number
  overdue_follow_ups_count: number
  pending_quotations_count: number
  important_invoices_count: number
  summary_text: string
  recommendations: Recommendation[]
}

export interface AgentStatus {
  provider: string
  model: string
  available: boolean
  message: string
  autonomy_level: AutonomyLevel
}

export interface AppNotification {
  id: string
  title: string
  body: string
  level: 'info' | 'warning' | 'action_required'
  link: string
  read: boolean
  created_at: string
}

export interface WorkflowStep {
  id?: string
  order?: number
  step_type: 'TOOL_CALL' | 'CONDITION'
  tool_name: string
  tool_input: Record<string, unknown>
  condition_field: string
  condition_operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'exists'
  condition_value: string
  on_false: 'stop' | 'skip_next'
}

export interface Workflow {
  id: string
  name: string
  description: string
  trigger_type: 'MANUAL' | 'CRON'
  cron_expression: string
  enabled: boolean
  created_by: string
  steps: WorkflowStep[]
  created_at: string
  updated_at: string
}

export interface WorkflowStepResult {
  step_id: string
  type: 'TOOL_CALL' | 'CONDITION'
  tool_name?: string
  success?: boolean
  output?: Record<string, unknown>
  error?: string
  skipped?: boolean
  passed?: boolean
  detail?: string
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  triggered_by: string
  step_results: WorkflowStepResult[]
  error: string
  started_at: string
  completed_at: string | null
  created_at: string
}
