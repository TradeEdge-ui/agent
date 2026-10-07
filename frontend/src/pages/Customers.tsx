import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner } from '../components/ui'
import { StatusBadge } from '../components/Badge'
import { createCustomer, listCustomers } from '../services/resources'
import { apiErrorMessage } from '../services/api'

export default function Customers() {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '' })
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['customers', search], queryFn: () => listCustomers(search) })

  const mutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setModalOpen(false)
      setForm({ name: '', email: '', phone: '', company: '' })
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader
        title="Customers"
        actions={<Button onClick={() => setModalOpen(true)}>+ New customer</Button>}
      />
      <div className="mb-4 max-w-sm">
        <Input placeholder="Search by name, email, company..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : data?.length === 0 ? (
          <EmptyState title="No customers yet" subtitle="Add your first customer to get started." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/customers/${c.id}`} className="font-medium text-[#1f3a5f] hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.company || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email || '-'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New customer">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            mutation.mutate(form)
          }}
        >
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Field label="Name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Company">
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            Create customer
          </Button>
        </form>
      </Modal>
    </div>
  )
}
