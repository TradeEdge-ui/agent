import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea } from '../components/ui'
import { StatusBadge } from '../components/Badge'
import { getCustomer, listLeads, updateCustomer } from '../services/resources'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
    enabled: !!id,
  })
  const { data: allLeads } = useQuery({ queryKey: ['leads'], queryFn: () => listLeads() })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', notes: '', status: 'ACTIVE' })

  const mutation = useMutation({
    mutationFn: (payload: typeof form) => updateCustomer(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] })
      setEditing(false)
    },
  })

  if (isLoading || !customer) return <Spinner />

  const leads = allLeads?.filter((l) => l.customer_id === id) ?? []

  function startEdit() {
    if (!customer) return
    setForm({
      name: customer.name, email: customer.email, phone: customer.phone,
      company: customer.company, notes: customer.notes, status: customer.status,
    })
    setEditing(true)
  }

  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle={customer.company}
        actions={
          !editing ? (
            <Button variant="secondary" onClick={startEdit}>
              Edit
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 md:col-span-2">
          {!editing ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-400">Email</dt>
                <dd className="text-slate-800">{customer.email || '-'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Phone</dt>
                <dd className="text-slate-800">{customer.phone || '-'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Status</dt>
                <dd>
                  <StatusBadge status={customer.status} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Source</dt>
                <dd className="text-slate-800">{customer.source || '-'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-400">Notes</dt>
                <dd className="text-slate-800 whitespace-pre-wrap">{customer.notes || 'No notes yet.'}</dd>
              </div>
            </dl>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                mutation.mutate(form)
              }}
            >
              <Field label="Name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
              </div>
              <Field label="Company">
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </Field>
              <Field label="Notes">
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={mutation.isPending}>
                  Save
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Leads</h3>
          {leads.length === 0 ? (
            <p className="text-sm text-slate-400">No leads yet.</p>
          ) : (
            <ul className="space-y-2">
              {leads.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <Link to={`/leads/${l.id}`} className="text-[#1f3a5f] hover:underline">
                    {l.title}
                  </Link>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
