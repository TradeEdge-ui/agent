import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button, Card, Field, Input, Modal, PageHeader, Select, Spinner } from '../components/ui'
import { createLead, listCustomers, listLeads, updateLead } from '../services/resources'

const STAGES = ['NEW', 'QUALIFIED', 'QUOTED', 'NEGOTIATING', 'WON', 'LOST'] as const

export default function Leads() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', customer_id: '', value: 0, source: '', notes: '' })

  const { data: leads, isLoading } = useQuery({ queryKey: ['leads'], queryFn: () => listLeads() })
  const { data: customers } = useQuery({ queryKey: ['customers', ''], queryFn: () => listCustomers() })

  const createMutation = useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setModalOpen(false)
      setForm({ title: '', customer_id: '', value: 0, source: '', notes: '' })
    },
  })

  const stageMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateLead(id, { status: status as never }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })

  const customerName = (customerId: string | null) => customers?.find((c) => c.id === customerId)?.name ?? '-'

  return (
    <div>
      <PageHeader title="Leads" subtitle="Pipeline view" actions={<Button onClick={() => setModalOpen(true)}>+ New lead</Button>} />

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {STAGES.map((stage) => {
            const stageLeads = leads?.filter((l) => l.status === stage) ?? []
            return (
              <div key={stage} className="min-w-0">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                  <span>{stage}</span>
                  <span className="bg-slate-200 text-slate-600 rounded-full px-1.5 text-[10px]">{stageLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.map((lead) => (
                    <Card key={lead.id} className="p-3">
                      <Link to={`/leads/${lead.id}`} className="text-sm font-medium text-slate-800 hover:underline block">
                        {lead.title}
                      </Link>
                      <p className="text-xs text-slate-400 mt-0.5">{customerName(lead.customer_id)}</p>
                      <p className="text-xs font-medium text-slate-600 mt-1">{lead.value.toLocaleString()}</p>
                      <select
                        className="mt-2 w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white"
                        value={lead.status}
                        onChange={(e) => stageMutation.mutate({ id: lead.id, status: e.target.value })}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            Move to {s}
                          </option>
                        ))}
                      </select>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New lead">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate({ ...form, customer_id: form.customer_id || null })
          }}
        >
          <Field label="Title">
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Customer (optional)">
            <Select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">No customer linked</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estimated value">
            <Input
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            />
          </Field>
          <Field label="Source">
            <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </Field>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            Create lead
          </Button>
        </form>
      </Modal>
    </div>
  )
}
