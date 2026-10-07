import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from '../components/ui'
import { getAgentStatus, getBusiness, updateBusiness } from '../services/resources'
import { apiErrorMessage } from '../services/api'
import type { Business } from '../types'

const TABS = ['Business', 'AI & Automation', 'Tax & Billing', 'Integrations', 'Security'] as const

export default function Settings() {
  const [tab, setTab] = useState<typeof TABS[number]>('Business')
  const queryClient = useQueryClient()
  const { data: business } = useQuery({ queryKey: ['business'], queryFn: getBusiness })
  const { data: agentStatus, refetch: refetchStatus } = useQuery({ queryKey: ['agent-status'], queryFn: getAgentStatus })
  const [form, setForm] = useState<Partial<Business>>({})
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (business) setForm(business)
  }, [business])

  const mutation = useMutation({
    mutationFn: (payload: Partial<Business>) => updateBusiness(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  if (!business) return null

  function save(fields: Partial<Business>) {
    setError('')
    mutation.mutate(fields)
  }

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-4 py-2.5 font-medium border-b-2 -mb-px ${
              tab === t ? 'border-[#1f3a5f] text-[#1f3a5f]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {saved && <p className="text-sm text-emerald-600 mb-3">Saved.</p>}

      {tab === 'Business' && (
        <Card className="p-5 max-w-xl space-y-3">
          <Field label="Business name">
            <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Industry">
            <Input value={form.industry ?? ''} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact email">
              <Input value={form.contact_email ?? ''} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </Field>
            <Field label="Contact phone">
              <Input value={form.contact_phone ?? ''} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Address">
            <Textarea rows={2} value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Button onClick={() => save(form)} disabled={mutation.isPending}>
            Save changes
          </Button>
        </Card>
      )}

      {tab === 'AI & Automation' && (
        <Card className="p-5 max-w-xl space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Ollama connection</h3>
            <div
              className={`text-sm rounded-lg px-3 py-2 ${
                agentStatus?.available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {agentStatus?.message ?? 'Checking...'}
            </div>
            <Button variant="secondary" className="mt-2" onClick={() => refetchStatus()}>
              Re-check connection
            </Button>
          </div>
          <Field label="Model name">
            <Input value={form.ai_model ?? ''} onChange={(e) => setForm({ ...form, ai_model: e.target.value })} />
          </Field>
          <Field label="Autonomy level">
            <Select value={form.autonomy_level ?? 'DRAFT'} onChange={(e) => setForm({ ...form, autonomy_level: e.target.value as Business['autonomy_level'] })}>
              <option value="SUGGEST">Suggest only -- agent recommends, never acts</option>
              <option value="DRAFT">Draft -- agent prepares drafts, asks before anything risky</option>
              <option value="EXECUTE">Execute -- agent handles low-risk actions automatically</option>
            </Select>
          </Field>
          <Field label="Stale lead threshold (days with no activity)">
            <Input
              type="number"
              value={form.stale_lead_days_threshold ?? 5}
              onChange={(e) => setForm({ ...form, stale_lead_days_threshold: Number(e.target.value) })}
            />
          </Field>
          <Field label="Preferred communication style">
            <Select
              value={form.communication_style ?? 'professional'}
              onChange={(e) => setForm({ ...form, communication_style: e.target.value })}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
            </Select>
          </Field>
          <Button onClick={() => save(form)} disabled={mutation.isPending}>
            Save changes
          </Button>
        </Card>
      )}

      {tab === 'Tax & Billing' && (
        <Card className="p-5 max-w-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency code">
              <Input value={form.currency ?? ''} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </Field>
            <Field label="Timezone">
              <Input value={form.timezone ?? ''} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax label">
              <Input value={form.tax_label ?? ''} onChange={(e) => setForm({ ...form, tax_label: e.target.value })} />
            </Field>
            <Field label="Tax rate (%)">
              <Input
                type="number"
                value={form.tax_rate_percent ?? 0}
                onChange={(e) => setForm({ ...form, tax_rate_percent: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Default quotation validity (days)">
            <Input
              type="number"
              value={form.default_quotation_validity_days ?? 7}
              onChange={(e) => setForm({ ...form, default_quotation_validity_days: Number(e.target.value) })}
            />
          </Field>
          <Field label="Default payment terms">
            <Input
              value={form.default_payment_terms ?? ''}
              onChange={(e) => setForm({ ...form, default_payment_terms: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quotation number prefix">
              <Input
                value={form.quotation_numbering_prefix ?? ''}
                onChange={(e) => setForm({ ...form, quotation_numbering_prefix: e.target.value })}
              />
            </Field>
            <Field label="Invoice number prefix">
              <Input
                value={form.invoice_numbering_prefix ?? ''}
                onChange={(e) => setForm({ ...form, invoice_numbering_prefix: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-xs text-slate-400">
            This application organizes financial drafts; it does not provide tax or legal compliance advice.
            Consult a professional for your jurisdiction's requirements.
          </p>
          <Button onClick={() => save(form)} disabled={mutation.isPending}>
            Save changes
          </Button>
        </Card>
      )}

      {tab === 'Integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          {['Email', 'Calendar', 'Cloud storage', 'Payments', 'Accounting', 'E-invoicing'].map((name) => (
            <Card key={name} className="p-4">
              <p className="text-sm font-medium text-slate-800">{name}</p>
              <p className="text-xs text-slate-400 mt-1">Not connected -- planned for a future release.</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'Security' && (
        <Card className="p-5 max-w-xl space-y-2">
          <p className="text-sm text-slate-600">
            Passwords are hashed with bcrypt and never stored in plain text. Sessions use signed JWT tokens.
            Every business record is scoped to your account and checked server-side on every request.
          </p>
          <p className="text-sm text-slate-600">
            All AI agent actions are logged in the Activity page. High-impact actions always require your
            approval, regardless of autonomy level.
          </p>
        </Card>
      )}
    </div>
  )
}
