import { useQuery } from '@tanstack/react-query'
import { Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { listAuditLogs } from '../services/resources'

export default function Activity() {
  const { data: logs, isLoading } = useQuery({ queryKey: ['audit-logs'], queryFn: () => listAuditLogs(200) })

  return (
    <div>
      <PageHeader title="Activity Log" subtitle="A complete, auditable record of every meaningful action taken by you and the AI agent." />
      {isLoading ? (
        <Spinner />
      ) : logs?.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {logs?.map((log) => (
              <li key={log.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge ${
                        log.actor === 'agent' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {log.actor}
                    </span>
                    <span className="text-sm text-slate-800">{log.action}</span>
                    {!log.success && <span className="badge bg-red-100 text-red-700">failed</span>}
                    {log.approval_required && (
                      <span className="badge bg-amber-100 text-amber-800">
                        approval: {log.approval_result || 'pending'}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                {(log.input_summary || log.output_summary || log.error) && (
                  <div className="text-xs text-slate-400 mt-1 pl-1">
                    {log.error && <p className="text-red-500">{log.error}</p>}
                    {log.output_summary && <p>{log.output_summary}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
