import { api } from './api'
import type {
  AgentRun,
  AgentStatus,
  AppNotification,
  Approval,
  AuditLogEntry,
  Business,
  Customer,
  DailyBrief,
  DashboardData,
  DocumentRecord,
  FollowUp,
  Interaction,
  Invoice,
  KnowledgeDocument,
  KnowledgeSearchResult,
  Lead,
  Quotation,
  Task,
  Workflow,
  WorkflowRun,
} from '../types'

// Business
export const getBusiness = () => api.get<Business>('/business').then((r) => r.data)
export const updateBusiness = (payload: Partial<Business>) =>
  api.patch<Business>('/business', payload).then((r) => r.data)
export const loadDemoData = () => api.post('/business/demo-data').then((r) => r.data)

// Customers
export const listCustomers = (q?: string) =>
  api.get<Customer[]>('/customers', { params: { q } }).then((r) => r.data)
export const getCustomer = (id: string) => api.get<Customer>(`/customers/${id}`).then((r) => r.data)
export const createCustomer = (payload: Partial<Customer>) =>
  api.post<Customer>('/customers', payload).then((r) => r.data)
export const updateCustomer = (id: string, payload: Partial<Customer>) =>
  api.patch<Customer>(`/customers/${id}`, payload).then((r) => r.data)
export const deleteCustomer = (id: string) => api.delete(`/customers/${id}`)

// Leads
export const listLeads = (status?: string) =>
  api.get<Lead[]>('/leads', { params: { status } }).then((r) => r.data)
export const getLead = (id: string) => api.get<Lead>(`/leads/${id}`).then((r) => r.data)
export const createLead = (payload: Partial<Lead>) => api.post<Lead>('/leads', payload).then((r) => r.data)
export const updateLead = (id: string, payload: Partial<Lead>) =>
  api.patch<Lead>(`/leads/${id}`, payload).then((r) => r.data)
export const listLeadInteractions = (id: string) =>
  api.get<Interaction[]>(`/leads/${id}/interactions`).then((r) => r.data)
export const createInteraction = (payload: Partial<Interaction>) =>
  api.post<Interaction>('/interactions', payload).then((r) => r.data)

// Tasks
export const listTasks = (params?: { status?: string; overdue_only?: boolean }) =>
  api.get<Task[]>('/tasks', { params }).then((r) => r.data)
export const createTask = (payload: Partial<Task>) => api.post<Task>('/tasks', payload).then((r) => r.data)
export const updateTask = (id: string, payload: Partial<Task>) =>
  api.patch<Task>(`/tasks/${id}`, payload).then((r) => r.data)
export const completeTask = (id: string) => api.post<Task>(`/tasks/${id}/complete`).then((r) => r.data)
export const reopenTask = (id: string) => api.post<Task>(`/tasks/${id}/reopen`).then((r) => r.data)

// Follow-ups
export const listFollowUps = (params?: { overdue_only?: boolean; status?: string }) =>
  api.get<FollowUp[]>('/follow-ups', { params }).then((r) => r.data)
export const createFollowUp = (payload: Partial<FollowUp>) =>
  api.post<FollowUp>('/follow-ups', payload).then((r) => r.data)
export const completeFollowUp = (id: string, outcome: string) =>
  api.post<FollowUp>(`/follow-ups/${id}/complete`, { outcome }).then((r) => r.data)

// Quotations
export const listQuotes = (status?: string) =>
  api.get<Quotation[]>('/quotes', { params: { status } }).then((r) => r.data)
export const getQuote = (id: string) => api.get<Quotation>(`/quotes/${id}`).then((r) => r.data)
export const createQuote = (payload: Record<string, unknown>) =>
  api.post<Quotation>('/quotes', payload).then((r) => r.data)
export const updateQuote = (id: string, payload: Record<string, unknown>) =>
  api.patch<Quotation>(`/quotes/${id}`, payload).then((r) => r.data)
export const quotePdfUrl = (id: string) => `${api.defaults.baseURL}/quotes/${id}/pdf`

// Invoices
export const listInvoices = (status?: string) =>
  api.get<Invoice[]>('/invoices', { params: { status } }).then((r) => r.data)
export const getInvoice = (id: string) => api.get<Invoice>(`/invoices/${id}`).then((r) => r.data)
export const createInvoice = (payload: Record<string, unknown>) =>
  api.post<Invoice>('/invoices', payload).then((r) => r.data)
export const updateInvoice = (id: string, payload: Record<string, unknown>) =>
  api.patch<Invoice>(`/invoices/${id}`, payload).then((r) => r.data)
export const invoicePdfUrl = (id: string) => `${api.defaults.baseURL}/invoices/${id}/pdf`

// Documents
export const listDocuments = () => api.get<DocumentRecord[]>('/documents').then((r) => r.data)
export const uploadDocument = (file: File, customerId?: string) => {
  const form = new FormData()
  form.append('file', file)
  const params = customerId ? { customer_id: customerId } : {}
  return api
    .post<DocumentRecord>('/documents/upload', form, {
      params,
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)
}

// Knowledge
export const listKnowledge = () => api.get<KnowledgeDocument[]>('/knowledge').then((r) => r.data)
export const createKnowledge = (title: string, raw_text: string) =>
  api.post<KnowledgeDocument>('/knowledge', { title, raw_text }).then((r) => r.data)
export const uploadKnowledge = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api
    .post<KnowledgeDocument>('/knowledge/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)
}
export const deleteKnowledge = (id: string) => api.delete(`/knowledge/${id}`)
export const searchKnowledge = (q: string) =>
  api.get<KnowledgeSearchResult[]>('/knowledge/search', { params: { q } }).then((r) => r.data)

// Approvals
export const listApprovals = (status?: string) =>
  api.get<Approval[]>('/approvals', { params: { status } }).then((r) => r.data)
export const approveApproval = (id: string, notes: string, editedInput?: Record<string, unknown>) =>
  api.post<Approval>(`/approvals/${id}/approve`, { notes, edited_input: editedInput }).then((r) => r.data)
export const rejectApproval = (id: string, notes: string) =>
  api.post<Approval>(`/approvals/${id}/reject`, { notes }).then((r) => r.data)

// Audit
export const listAuditLogs = (limit = 100) =>
  api.get<AuditLogEntry[]>('/audit', { params: { limit } }).then((r) => r.data)

// Dashboard
export const getDashboard = () => api.get<DashboardData>('/dashboard').then((r) => r.data)
export const getDailyBrief = () => api.get<DailyBrief>('/dashboard/daily-brief').then((r) => r.data)

// Agent
export const runAgent = (message: string) => api.post<AgentRun>('/agent/run', { message }).then((r) => r.data)
export const listAgentRuns = () => api.get<AgentRun[]>('/agent/runs').then((r) => r.data)
export const getAgentRun = (id: string) => api.get<AgentRun>(`/agent/runs/${id}`).then((r) => r.data)
export const getAgentStatus = () => api.get<AgentStatus>('/agent/status').then((r) => r.data)

// Notifications
export const listNotifications = (unreadOnly = false) =>
  api.get<AppNotification[]>('/notifications', { params: { unread_only: unreadOnly } }).then((r) => r.data)
export const markNotificationRead = (id: string) =>
  api.post<AppNotification>(`/notifications/${id}/read`).then((r) => r.data)
export const markAllNotificationsRead = () => api.post('/notifications/read-all').then((r) => r.data)

// Workflows
export const listWorkflows = () => api.get<Workflow[]>('/workflows').then((r) => r.data)
export const getWorkflow = (id: string) => api.get<Workflow>(`/workflows/${id}`).then((r) => r.data)
export const createWorkflow = (payload: Partial<Workflow>) =>
  api.post<Workflow>('/workflows', payload).then((r) => r.data)
export const updateWorkflow = (id: string, payload: Partial<Workflow>) =>
  api.patch<Workflow>(`/workflows/${id}`, payload).then((r) => r.data)
export const deleteWorkflow = (id: string) => api.delete(`/workflows/${id}`)
export const runWorkflowNow = (id: string) => api.post<WorkflowRun>(`/workflows/${id}/run`).then((r) => r.data)
export const listWorkflowRuns = (id: string) => api.get<WorkflowRun[]>(`/workflows/${id}/runs`).then((r) => r.data)
