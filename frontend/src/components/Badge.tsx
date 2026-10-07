const TONE_STYLES: Record<string, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-blue-100 text-blue-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  primary: 'bg-[#1f3a5f]/10 text-[#1f3a5f]',
}

const STATUS_TONE: Record<string, string> = {
  // generic
  ACTIVE: 'success', INACTIVE: 'neutral', OPEN: 'info', IN_PROGRESS: 'warning', DONE: 'success',
  // leads
  NEW: 'info', QUALIFIED: 'primary', QUOTED: 'warning', NEGOTIATING: 'warning', WON: 'success', LOST: 'danger',
  // quotes/invoices
  DRAFT: 'neutral', PENDING_APPROVAL: 'warning', APPROVED: 'primary', SENT: 'info', ACCEPTED: 'success',
  REJECTED: 'danger', EXPIRED: 'danger', ISSUED: 'info', PARTIALLY_PAID: 'warning', PAID: 'success',
  OVERDUE: 'danger', CANCELLED: 'neutral',
  // priority
  LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', URGENT: 'danger',
  // approvals
  PENDING: 'warning', EDITED_APPROVED: 'primary',
  // agent run
  WAITING_FOR_APPROVAL: 'warning', COMPLETED: 'success', FAILED: 'danger', RUNNING: 'info',
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral'
  return <span className={`badge ${TONE_STYLES[tone]}`}>{status.replace(/_/g, ' ')}</span>
}

export function RiskBadge({ risk }: { risk: string }) {
  const tone = risk === 'HIGH' ? 'danger' : risk === 'MEDIUM' ? 'warning' : 'neutral'
  return <span className={`badge ${TONE_STYLES[tone]}`}>{risk} risk</span>
}
