import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Button, Card, Input, PageHeader, Spinner } from '../components/ui'
import { StatusBadge } from '../components/Badge'
import { getBusiness, getCustomer, getInvoice, invoicePdfUrl, updateInvoice } from '../services/resources'
import { apiErrorMessage } from '../services/api'

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['ISSUED', 'CANCELLED', 'DRAFT'],
  ISSUED: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'CANCELLED'],
  PAID: [],
  OVERDUE: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  CANCELLED: [],
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [amountPaid, setAmountPaid] = useState('')

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id!),
    enabled: !!id,
  })
  const { data: business } = useQuery({ queryKey: ['business'], queryFn: getBusiness })
  const { data: customer } = useQuery({
    queryKey: ['customer', invoice?.customer_id],
    queryFn: () => getCustomer(invoice!.customer_id!),
    enabled: !!invoice?.customer_id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateInvoice(id!, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoice', id] }),
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const paymentMutation = useMutation({
    mutationFn: (amount: number) => updateInvoice(id!, { amount_paid: amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      setAmountPaid('')
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  if (isLoading || !invoice) return <Spinner />
  const currency = business?.currency ?? ''

  return (
    <div>
      <PageHeader
        title={invoice.number}
        subtitle={customer?.name}
        actions={
          <a href={invoicePdfUrl(invoice.id)} target="_blank" rel="noreferrer">
            <Button variant="secondary">Download PDF</Button>
          </a>
        }
      />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <StatusBadge status={invoice.status} />
              <StatusBadge status={invoice.payment_status} />
            </div>
            <span className="text-xs text-slate-400">
              Issued {new Date(invoice.issue_date).toLocaleDateString()}
              {invoice.due_date && ` · due ${new Date(invoice.due_date).toLocaleDateString()}`}
            </span>
          </div>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-1.5 font-medium">Description</th>
                <th className="py-1.5 font-medium text-right">Qty</th>
                <th className="py-1.5 font-medium text-right">Price</th>
                <th className="py-1.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-700">{item.description}</td>
                  <td className="py-1.5 text-right text-slate-600">{item.quantity}</td>
                  <td className="py-1.5 text-right text-slate-600">{item.unit_price.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-medium">{item.line_total?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-right text-sm space-y-0.5">
            <p className="text-slate-500">
              Subtotal: {currency} {invoice.subtotal.toLocaleString()}
            </p>
            <p className="text-slate-500">
              Tax ({invoice.tax_percent}%): {currency} {invoice.tax_amount.toLocaleString()}
            </p>
            <p className="font-semibold text-slate-800">
              Total: {currency} {invoice.total.toLocaleString()}
            </p>
            <p className="text-emerald-700">
              Paid: {currency} {invoice.amount_paid.toLocaleString()}
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            This is an internally generated draft invoice and may not meet official e-invoicing or legal
            compliance requirements.
          </p>
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Status</h3>
            <div className="space-y-2">
              {TRANSITIONS[invoice.status]?.map((next) => (
                <Button
                  key={next}
                  variant={next === 'CANCELLED' ? 'danger' : 'secondary'}
                  className="w-full"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate(next)}
                >
                  Mark as {next.replace(/_/g, ' ')}
                </Button>
              ))}
              {(!TRANSITIONS[invoice.status] || TRANSITIONS[invoice.status].length === 0) && (
                <p className="text-xs text-slate-400">No further transitions from this status.</p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Record payment</h3>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount received"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
              <Button
                disabled={!amountPaid || paymentMutation.isPending}
                onClick={() => paymentMutation.mutate(Number(amountPaid))}
              >
                Save
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Confirm payment manually once you've verified it was received.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
