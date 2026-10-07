import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { StatusBadge } from '../components/Badge'
import { getDailyBrief, getDashboard } from '../services/resources'
import { useAuth } from '../state/AuthContext'

function Section({ title, children, to }: { title: string; children: React.ReactNode; to?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
        {to && (
          <Link to={to} className="text-xs text-[#1f3a5f] font-medium">
            View all
          </Link>
        )}
      </div>
      {children}
    </Card>
  )
}

export default function Dashboard() {
  const { me } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, refetchInterval: 30000 })
  const { data: brief } = useQuery({ queryKey: ['daily-brief'], queryFn: getDailyBrief })

  if (isLoading || !data) return <Spinner />

  return (
    <div>
      <PageHeader title={`Welcome back, ${me?.user.full_name?.split(' ')[0] ?? ''}`} subtitle={brief?.summary_text} />

      {data.recommendations.length > 0 && (
        <Card className="p-4 mb-6 border-amber-200 bg-amber-50/50">
          <h3 className="text-sm font-semibold text-amber-900 mb-2">AI Recommendations</h3>
          <ul className="space-y-1.5">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                <span className="mt-0.5">&bull;</span>
                <span>
                  {rec.link ? (
                    <Link to={rec.link} className="underline hover:no-underline">
                      {rec.text}
                    </Link>
                  ) : (
                    rec.text
                  )}
                  <span className="text-amber-700 text-xs ml-1">({rec.reason})</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Urgent tasks" to="/tasks">
          {data.urgent_tasks.length === 0 ? (
            <EmptyState title="No urgent tasks" />
          ) : (
            <ul className="space-y-2">
              {data.urgent_tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{t.title}</span>
                  <StatusBadge status={t.priority} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Overdue tasks" to="/tasks">
          {data.overdue_tasks.length === 0 ? (
            <EmptyState title="Nothing overdue" />
          ) : (
            <ul className="space-y-2">
              {data.overdue_tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{t.title}</span>
                  <span className="text-xs text-red-600">
                    {t.due_date && new Date(t.due_date).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="New leads this week" to="/leads">
          {data.new_leads.length === 0 ? (
            <EmptyState title="No new leads" />
          ) : (
            <ul className="space-y-2">
              {data.new_leads.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <Link to={`/leads/${l.id}`} className="text-slate-700 hover:underline">
                    {l.title}
                  </Link>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Leads going cold" to="/leads">
          {data.leads_needing_follow_up.length === 0 ? (
            <EmptyState title="All leads are active" />
          ) : (
            <ul className="space-y-2">
              {data.leads_needing_follow_up.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <Link to={`/leads/${l.id}`} className="text-slate-700 hover:underline">
                    {l.title}
                  </Link>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Quotations awaiting approval" to="/quotes">
          {data.quotations_awaiting_approval.length === 0 ? (
            <EmptyState title="Nothing pending" />
          ) : (
            <ul className="space-y-2">
              {data.quotations_awaiting_approval.map((q) => (
                <li key={q.id} className="flex items-center justify-between text-sm">
                  <Link to={`/quotes/${q.id}`} className="text-slate-700 hover:underline">
                    {q.number}
                  </Link>
                  <span className="font-medium">{q.total.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Invoice alerts" to="/invoices">
          {data.invoice_alerts.length === 0 ? (
            <EmptyState title="No overdue invoices" />
          ) : (
            <ul className="space-y-2">
              {data.invoice_alerts.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between text-sm">
                  <Link to={`/invoices/${inv.id}`} className="text-slate-700 hover:underline">
                    {inv.number}
                  </Link>
                  <span className="font-medium text-red-600">{inv.total.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Recent AI activity">
        {data.recent_activity.length === 0 ? (
          <EmptyState title="No activity yet" subtitle="Try asking the AI Agent to do something." />
        ) : (
          <ul className="space-y-2">
            {data.recent_activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  <span className="text-xs text-slate-400 mr-2">{a.actor}</span>
                  {a.action}
                </span>
                <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
