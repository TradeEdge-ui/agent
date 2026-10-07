import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, EmptyState, PageHeader, Spinner, Textarea } from '../components/ui'
import { RiskBadge, StatusBadge } from '../components/Badge'
import { approveApproval, listApprovals, rejectApproval } from '../services/resources'
import { apiErrorMessage } from '../services/api'
import type { Approval } from '../types'

function ApprovalCard({ approval }: { approval: Approval }) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState('')
  const [editedJson, setEditedJson] = useState(JSON.stringify(approval.tool_input, null, 2))
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')

  const approveMutation = useMutation({
    mutationFn: (edited?: Record<string, unknown>) => approveApproval(approval.id, notes, edited),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals'] }),
    onError: (err) => setError(apiErrorMessage(err)),
  })
  const rejectMutation = useMutation({
    mutationFn: () => rejectApproval(approval.id, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals'] }),
    onError: (err) => setError(apiErrorMessage(err)),
  })

  function submitEdit() {
    try {
      const parsed = JSON.parse(editedJson)
      approveMutation.mutate(parsed)
    } catch {
      setError('Edited data must be valid JSON.')
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{approval.action}</p>
          {approval.tool_name && <p className="text-xs text-slate-400 font-mono mt-0.5">{approval.tool_name}</p>}
        </div>
        <div className="flex gap-2">
          <RiskBadge risk={approval.risk_level} />
          <StatusBadge status={approval.status} />
        </div>
      </div>

      <dl className="text-sm space-y-2 mb-3">
        <div>
          <dt className="text-xs text-slate-400 uppercase tracking-wide">Why</dt>
          <dd className="text-slate-700">{approval.reason}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400 uppercase tracking-wide">Data being used</dt>
          <dd>
            {editing ? (
              <Textarea rows={5} className="font-mono text-xs" value={editedJson} onChange={(e) => setEditedJson(e.target.value)} />
            ) : (
              <pre className="bg-slate-50 rounded-lg p-2 text-xs text-slate-600 whitespace-pre-wrap">
                {JSON.stringify(approval.data, null, 2)}
              </pre>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400 uppercase tracking-wide">Expected result</dt>
          <dd className="text-slate-700">{approval.expected_result}</dd>
        </div>
      </dl>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {approval.status === 'PENDING' ? (
        <>
          <Textarea
            placeholder="Optional notes about your decision"
            rows={1}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mb-3"
          />
          <div className="flex gap-2">
            {!editing ? (
              <>
                <Button onClick={() => approveMutation.mutate(undefined)} disabled={approveMutation.isPending}>
                  Approve
                </Button>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                  Reject
                </Button>
              </>
            ) : (
              <>
                <Button onClick={submitEdit} disabled={approveMutation.isPending}>
                  Approve with edits
                </Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400">
          Decided by {approval.decided_by ? 'you' : 'system'} &middot; {approval.decision_notes || 'no notes'}
        </p>
      )}
    </Card>
  )
}

export default function Approvals() {
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING')
  const { data: approvals, isLoading } = useQuery({
    queryKey: ['approvals', filter],
    queryFn: () => listApprovals(filter === 'ALL' ? undefined : 'PENDING'),
  })

  return (
    <div>
      <PageHeader
        title="Approval Center"
        subtitle="Review high-impact actions the AI agent wants to take before they happen."
        actions={
          <div className="flex gap-2">
            {(['PENDING', 'ALL'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium ${
                  filter === f ? 'bg-[#1f3a5f] text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      />
      {isLoading ? (
        <Spinner />
      ) : approvals?.length === 0 ? (
        <EmptyState title="Nothing waiting for your decision" />
      ) : (
        <div className="space-y-4">
          {approvals?.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
        </div>
      )}
    </div>
  )
}
