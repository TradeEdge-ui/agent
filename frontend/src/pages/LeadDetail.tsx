import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Button, Card, Field, PageHeader, Select, Spinner, Textarea } from '../components/ui'
import { StatusBadge } from '../components/Badge'
import { createInteraction, getCustomer, getLead, listLeadInteractions, updateLead } from '../services/resources'

const STAGES = ['NEW', 'QUALIFIED', 'QUOTED', 'NEGOTIATING', 'WON', 'LOST'] as const

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')

  const { data: lead, isLoading } = useQuery({ queryKey: ['lead', id], queryFn: () => getLead(id!), enabled: !!id })
  const { data: customer } = useQuery({
    queryKey: ['customer', lead?.customer_id],
    queryFn: () => getCustomer(lead!.customer_id!),
    enabled: !!lead?.customer_id,
  })
  const { data: interactions } = useQuery({
    queryKey: ['lead-interactions', id],
    queryFn: () => listLeadInteractions(id!),
    enabled: !!id,
  })

  const stageMutation = useMutation({
    mutationFn: (status: string) => updateLead(id!, { status: status as never }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead', id] }),
  })

  const noteMutation = useMutation({
    mutationFn: () => createInteraction({ lead_id: id, customer_id: lead?.customer_id, channel: 'note', direction: 'inbound', content: note }),
    onSuccess: () => {
      setNote('')
      queryClient.invalidateQueries({ queryKey: ['lead-interactions', id] })
    },
  })

  if (isLoading || !lead) return <Spinner />

  return (
    <div>
      <PageHeader title={lead.title} subtitle={customer?.name} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 md:col-span-2">
          <dl className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <dt className="text-slate-400">Value</dt>
              <dd className="text-slate-800 font-medium">{lead.value.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Source</dt>
              <dd className="text-slate-800">{lead.source || '-'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400 mb-1">Stage</dt>
              <dd>
                <Select value={lead.status} onChange={(e) => stageMutation.mutate(e.target.value)} className="max-w-xs">
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">Notes</dt>
              <dd className="text-slate-800 whitespace-pre-wrap">{lead.notes || 'No notes yet.'}</dd>
            </div>
          </dl>

          <h3 className="text-sm font-semibold text-slate-700 mb-2">Interaction log</h3>
          <div className="space-y-2 mb-3">
            {interactions?.length === 0 && <p className="text-sm text-slate-400">No interactions logged yet.</p>}
            {interactions?.map((i) => (
              <div key={i.id} className="text-sm bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>
                    {i.channel} &middot; {i.direction} &middot; logged by {i.created_by}
                  </span>
                  <span>{new Date(i.created_at).toLocaleString()}</span>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap">{i.content}</p>
              </div>
            ))}
          </div>
          <Field label="Add a note or paste a customer message">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button className="mt-2" disabled={!note.trim() || noteMutation.isPending} onClick={() => noteMutation.mutate()}>
            Log interaction
          </Button>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Pipeline stage</h3>
          <StatusBadge status={lead.status} />
          <p className="text-xs text-slate-400 mt-3">
            Next follow-up: {lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleDateString() : 'not scheduled'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Last activity: {lead.last_activity_at ? new Date(lead.last_activity_at).toLocaleDateString() : 'never'}
          </p>
        </Card>
      </div>
    </div>
  )
}
