import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button, Card, EmptyState, Field, Modal, PageHeader, Select, Spinner } from '../components/ui'
import { StatusBadge } from '../components/Badge'
import LineItemsEditor from '../components/LineItemsEditor'
import { createInvoice, getBusiness, listCustomers, listInvoices } from '../services/resources'
import { apiErrorMessage } from '../services/api'
import type { LineItem } from '../types'

export default function Invoices() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0, discount_percent: 0 }])
  const [error, setError] = useState('')

  const { data: invoices, isLoading } = useQuery({ queryKey: ['invoices'], queryFn: () => listInvoices() })
  const { data: customers } = useQuery({ queryKey: ['customers', ''], queryFn: () => listCustomers() })
  const { data: business } = useQuery({ queryKey: ['business'], queryFn: getBusiness })

  const mutation = useMutation({
    mutationFn: () => createInvoice({ customer_id: customerId || null, items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setModalOpen(false)
      setItems([{ description: '', quantity: 1, unit_price: 0, discount_percent: 0 }])
      setCustomerId('')
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const customerName = (id: string | null) => customers?.find((c) => c.id === id)?.name ?? '-'

  return (
    <div>
      <PageHeader title="Invoices" actions={<Button onClick={() => setModalOpen(true)}>+ New invoice draft</Button>} />

      <Card>
        {isLoading ? (
          <Spinner />
        ) : invoices?.length === 0 ? (
          <EmptyState title="No invoices yet" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices?.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/invoices/${inv.id}`} className="font-medium text-[#1f3a5f] hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{customerName(inv.customer_id)}</td>
                  <td className="px-4 py-3 font-medium">
                    {business?.currency} {inv.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.payment_status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New invoice draft">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            mutation.mutate()
          }}
        >
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Field label="Customer">
            <Select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Line items">
            <LineItemsEditor items={items} onChange={setItems} currency={business?.currency ?? ''} />
          </Field>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            Create invoice draft
          </Button>
        </form>
      </Modal>
    </div>
  )
}
