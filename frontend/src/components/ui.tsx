import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}>{children}</div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-[#1f3a5f] text-white hover:bg-[#16294a]',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1f3a5f]/30 focus:border-[#1f3a5f] ${props.className ?? ''}`}
    />
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1f3a5f]/30 focus:border-[#1f3a5f] ${props.className ?? ''}`}
    />
  )
}

export function Select({
  children,
  className = '',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f3a5f]/30 focus:border-[#1f3a5f] ${className}`}
    >
      {children}
    </select>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <p className="font-medium text-slate-500">{title}</p>
      {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-slate-300 border-t-[#1f3a5f] rounded-full animate-spin" />
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">
            &times;
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 mb-4">
      {message}
    </div>
  )
}
