import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import { useAuth } from '../state/AuthContext'
import { Button, ErrorBanner, Field, Input } from '../components/ui'
import { apiErrorMessage } from '../services/api'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Sign in</h2>
      <ErrorBanner message={error} />
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Email">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full mt-2" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
      <p className="text-sm text-slate-500 text-center mt-4">
        No account yet?{' '}
        <Link to="/register" className="text-[#1f3a5f] font-medium">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
