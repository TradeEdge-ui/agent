import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { Button, Card, Field, Input, Select, Textarea } from '../components/ui'
import { getAgentStatus, loadDemoData, updateBusiness } from '../services/resources'
import { apiErrorMessage } from '../services/api'
import type { AgentStatus } from '../types'

const STEPS = ['Business profile', 'Currency & rules', 'AI provider', 'Check Ollama', 'Demo data', 'Done']

export default function Onboarding() {
  const { refreshMe } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [profile, setProfile] = useState({
    description: '',
    industry: '',
    contact_email: '',
    contact_phone: '',
    address: '',
  })
  const [rules, setRules] = useState({
    currency: 'USD',
    timezone: 'UTC',
    default_quotation_validity_days: 7,
    default_payment_terms: 'Due on receipt',
    tax_label: 'Tax',
    tax_rate_percent: 0,
  })
  const [aiConfig, setAiConfig] = useState({ ai_provider: 'ollama', ai_model: 'llama3.1', autonomy_level: 'DRAFT' as const })
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [demoLoaded, setDemoLoaded] = useState(false)

  async function saveAndNext(payload: Record<string, unknown>) {
    setError('')
    setSaving(true)
    try {
      await updateBusiness(payload)
      setStep((s) => s + 1)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function checkOllama() {
    setError('')
    try {
      const data = await getAgentStatus()
      setStatus(data)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  async function handleLoadDemoData() {
    setSaving(true)
    setError('')
    try {
      await loadDemoData()
      setDemoLoaded(true)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function finish() {
    setSaving(true)
    try {
      await updateBusiness({ onboarding_completed: true })
      await refreshMe()
      navigate('/')
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1b30] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  i <= step ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-white/50'
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/20" />}
            </div>
          ))}
        </div>
        <Card className="p-6">
          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}

          {step === 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Tell us about your business</h2>
              <p className="text-sm text-slate-500 mb-2">This helps the AI agent give relevant answers.</p>
              <Field label="What does your business do?">
                <Textarea
                  rows={2}
                  value={profile.description}
                  onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                />
              </Field>
              <Field label="Industry">
                <Input value={profile.industry} onChange={(e) => setProfile({ ...profile, industry: e.target.value })} />
              </Field>
              <Field label="Contact email">
                <Input
                  type="email"
                  value={profile.contact_email}
                  onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })}
                />
              </Field>
              <Field label="Contact phone">
                <Input
                  value={profile.contact_phone}
                  onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })}
                />
              </Field>
              <Field label="Business address">
                <Textarea rows={2} value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
              </Field>
              <Button className="w-full mt-2" disabled={saving} onClick={() => saveAndNext(profile)}>
                Continue
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Currency & business rules</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Currency code">
                  <Input value={rules.currency} onChange={(e) => setRules({ ...rules, currency: e.target.value })} />
                </Field>
                <Field label="Timezone">
                  <Input value={rules.timezone} onChange={(e) => setRules({ ...rules, timezone: e.target.value })} />
                </Field>
              </div>
              <Field label="Default quotation validity (days)">
                <Input
                  type="number"
                  value={rules.default_quotation_validity_days}
                  onChange={(e) => setRules({ ...rules, default_quotation_validity_days: Number(e.target.value) })}
                />
              </Field>
              <Field label="Default payment terms">
                <Input
                  value={rules.default_payment_terms}
                  onChange={(e) => setRules({ ...rules, default_payment_terms: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tax label">
                  <Input value={rules.tax_label} onChange={(e) => setRules({ ...rules, tax_label: e.target.value })} />
                </Field>
                <Field label="Tax rate (%)">
                  <Input
                    type="number"
                    value={rules.tax_rate_percent}
                    onChange={(e) => setRules({ ...rules, tax_rate_percent: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <p className="text-xs text-slate-400">
                Tax configuration here does not constitute tax or legal advice -- consult a professional for
                compliance requirements.
              </p>
              <Button className="w-full mt-2" disabled={saving} onClick={() => saveAndNext(rules)}>
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">AI provider</h2>
              <p className="text-sm text-slate-500">
                This MVP runs entirely on a local Ollama model -- no data leaves your machine and no API
                key is required.
              </p>
              <Field label="Provider">
                <Select value={aiConfig.ai_provider} disabled>
                  <option value="ollama">Ollama (local)</option>
                </Select>
              </Field>
              <Field label="Model name">
                <Input
                  value={aiConfig.ai_model}
                  onChange={(e) => setAiConfig({ ...aiConfig, ai_model: e.target.value })}
                />
              </Field>
              <Field label="Autonomy level">
                <Select
                  value={aiConfig.autonomy_level}
                  onChange={(e) => setAiConfig({ ...aiConfig, autonomy_level: e.target.value as typeof aiConfig.autonomy_level })}
                >
                  <option value="SUGGEST">Suggest only -- agent recommends, never acts</option>
                  <option value="DRAFT">Draft -- agent prepares drafts, asks before anything risky</option>
                  <option value="EXECUTE">Execute -- agent handles low-risk actions automatically</option>
                </Select>
              </Field>
              <Button className="w-full mt-2" disabled={saving} onClick={() => saveAndNext(aiConfig)}>
                Continue
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Check Ollama connection</h2>
              <p className="text-sm text-slate-500">
                Make sure Ollama is running locally (<code className="bg-slate-100 px-1 rounded">ollama serve</code>)
                and the model is installed (<code className="bg-slate-100 px-1 rounded">ollama pull {aiConfig.ai_model}</code>).
              </p>
              <Button variant="secondary" onClick={checkOllama} className="w-full">
                Test connection
              </Button>
              {status && (
                <div
                  className={`text-sm rounded-lg px-3 py-2 ${
                    status.available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {status.message}
                </div>
              )}
              <p className="text-xs text-slate-400">
                You can continue even if Ollama isn't ready yet -- you can finish setup and start it later from
                Settings.
              </p>
              <Button className="w-full mt-2" onClick={() => setStep(4)}>
                Continue
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Load sample data?</h2>
              <p className="text-sm text-slate-500">
                Optionally add a few fictional customers, leads, tasks and a draft quotation so you can explore
                the app immediately. You can skip this and add your own real data instead.
              </p>
              {demoLoaded ? (
                <div className="bg-emerald-50 text-emerald-700 text-sm rounded-lg px-3 py-2">
                  Sample data loaded.
                </div>
              ) : (
                <Button variant="secondary" className="w-full" disabled={saving} onClick={handleLoadDemoData}>
                  {saving ? 'Loading...' : 'Load sample data'}
                </Button>
              )}
              <Button className="w-full mt-2" onClick={() => setStep(5)}>
                {demoLoaded ? 'Continue' : 'Skip and continue'}
              </Button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3 text-center">
              <h2 className="text-lg font-semibold">You're all set</h2>
              <p className="text-sm text-slate-500">
                I can help organize your customers, leads, tasks, quotations, documents and follow-ups. I can
                prepare actions for your approval and automatically handle low-risk internal work -- you stay
                the final decision-maker.
              </p>
              <Button className="w-full mt-2" disabled={saving} onClick={finish}>
                Enter Command Center
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
