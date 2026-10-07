import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1b30] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-white font-semibold tracking-wide text-sm">OPERATIONS AGENT</div>
          <p className="text-slate-400 text-xs mt-1">Your AI employee for day-to-day operations</p>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-6">{children}</div>
      </div>
    </div>
  )
}
