import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../state/AuthContext'
import { useDesktopNotifications } from '../hooks/useDesktopNotifications'
import { listApprovals } from '../services/resources'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/agent', label: 'AI Agent', icon: '✦' },
  { to: '/customers', label: 'Customers', icon: '○' },
  { to: '/leads', label: 'Leads', icon: '↑' },
  { to: '/tasks', label: 'Tasks', icon: '✓' },
  { to: '/quotes', label: 'Quotes', icon: '☷' },
  { to: '/invoices', label: 'Invoices', icon: '☷' },
  { to: '/documents', label: 'Documents', icon: '☷' },
  { to: '/knowledge', label: 'Knowledge', icon: '✎' },
  { to: '/workflows', label: 'Workflows', icon: '⟳' },
  { to: '/approvals', label: 'Approvals', icon: '⚑' },
  { to: '/activity', label: 'Activity', icon: '⧗' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function AppLayout() {
  const { me, logout } = useAuth()
  const { data: approvals } = useQuery({
    queryKey: ['approvals', 'PENDING'],
    queryFn: () => listApprovals('PENDING'),
    refetchInterval: 15000,
  })
  const pendingCount = approvals?.length ?? 0
  const { unreadCount } = useDesktopNotifications(true)

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-[#13203a] text-slate-200 flex-shrink-0 flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="text-white font-semibold text-sm tracking-wide">OPERATIONS AGENT</div>
            {unreadCount > 0 && (
              <span
                title={`${unreadCount} unread notification(s)`}
                className="bg-sky-400 text-sky-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">{me?.business_name}</div>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-5 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white/10 text-white border-r-2 border-emerald-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span>{item.label}</span>
              {item.to === '/approvals' && pendingCount > 0 && (
                <span className="bg-amber-400 text-amber-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-slate-400">
          <div className="truncate">{me?.user.full_name}</div>
          <div className="truncate text-slate-500">{me?.role}</div>
          <button onClick={logout} className="mt-2 text-slate-300 hover:text-white underline">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-[#f5f6f8] min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
