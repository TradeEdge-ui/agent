import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import { useAuth } from '../state/AuthContext'
import { Button, ErrorBanner, Field, Input } from '../components/ui'
import { apiErrorMessage } from '../services/api'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', business_name: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(form)
      navigate('/onboarding')
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Create your account</h2>
      <ErrorBanner message={error} />
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Your name">
          <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label="Business name">
          <Input
            required
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Password (min 8 characters)">
          <Input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Button type="submit" className="w-full mt-2" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
      <p className="text-sm text-slate-500 text-center mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-[#1f3a5f] font-medium">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
