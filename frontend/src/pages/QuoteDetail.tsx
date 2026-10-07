import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Button, Card, Field, PageHeader, Spinner, Textarea } from '../components/ui'
import { StatusBadge } from '../components/Badge'
import LineItemsEditor from '../components/LineItemsEditor'
import { getBusiness, getCustomer, getQuote, quotePdfUrl, updateQuote } from '../services/resources'
import { apiErrorMessage } from '../services/api'
import type { LineItem } from '../types'

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'DRAFT'],
  APPROVED: ['SENT', 'REJECTED'],
  SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
}

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [items, setItems] = useState<LineItem[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const { data: quote, isLoading } = useQuery({ queryKey: ['quote', id], queryFn: () => getQuote(id!), enabled: !!id })
  const { data: business } = useQuery({ queryKey: ['business'], queryFn: getBusiness })
  const { data: customer } = useQuery({
    queryKey: ['customer', quote?.customer_id],
    queryFn: () => getCustomer(quote!.customer_id!),
    enabled: !!quote?.customer_id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateQuote(id!, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quote', id] }),
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const saveMutation = useMutation({
    mutationFn: () => updateQuote(id!, { items, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] })
      setEditing(false)
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  if (isLoading || !quote) return <Spinner />

  const currency = business?.currency ?? ''

  return (
    <div>
      <PageHeader
        title={quote.number}
        subtitle={customer?.name}
        actions={
          <>
            <a href={quotePdfUrl(quote.id)} target="_blank" rel="noreferrer">
              <Button variant="secondary">Download PDF</Button>
            </a>
            {quote.status === 'DRAFT' && !editing && (
              <Button
                variant="secondary"
                onClick={() => {
                  setItems(quote.items)
                  setNotes(quote.notes)
                  setEditing(true)
                }}
              >
                Edit
              </Button>
            )}
          </>
        }
      />

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <StatusBadge status={quote.status} />
            <span className="text-xs text-slate-400">
              Issued {new Date(quote.issue_date).toLocaleDateString()}
              {quote.expiry_date && ` · valid until ${new Date(quote.expiry_date).toLocaleDateString()}`}
            </span>
          </div>

          {editing ? (
            <>
              <LineItemsEditor items={items} onChange={setItems} currency={currency} />
              <Field label="Notes">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <div className="flex gap-2 mt-3">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  Save changes
                </Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
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
                  {quote.items.map((item, i) => (
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
                  Subtotal: {currency} {quote.subtotal.toLocaleString()}
                </p>
                <p className="text-slate-500">
                  Tax ({quote.tax_percent}%): {currency} {quote.tax_amount.toLocaleString()}
                </p>
                <p className="font-semibold text-slate-800">
                  Total: {currency} {quote.total.toLocaleString()}
                </p>
              </div>
              {quote.notes && <p className="text-sm text-slate-600 mt-4">{quote.notes}</p>}
            </>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Status</h3>
          <div className="space-y-2">
            {TRANSITIONS[quote.status]?.map((next) => (
              <Button
                key={next}
                variant={next === 'REJECTED' ? 'danger' : 'secondary'}
                className="w-full"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(next)}
              >
                Mark as {next.replace(/_/g, ' ')}
              </Button>
            ))}
            {(!TRANSITIONS[quote.status] || TRANSITIONS[quote.status].length === 0) && (
              <p className="text-xs text-slate-400">No further transitions from this status.</p>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-3">Payment terms: {quote.payment_terms || '-'}</p>
        </Card>
      </div>
    </div>
  )
}
