import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './state/AuthContext'
import AppLayout from './layouts/AppLayout'
import { Spinner } from './components/ui'

import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Agent from './pages/Agent'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Tasks from './pages/Tasks'
import Quotes from './pages/Quotes'
import QuoteDetail from './pages/QuoteDetail'
import Invoices from './pages/Invoices'
import InvoiceDetail from './pages/InvoiceDetail'
import Documents from './pages/Documents'
import Knowledge from './pages/Knowledge'
import Approvals from './pages/Approvals'
import Activity from './pages/Activity'
import Settings from './pages/Settings'

function ProtectedArea() {
  const { me, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!me) return <Navigate to="/login" replace />
  if (!me.onboarding_completed) return <Navigate to="/onboarding" replace />
  return <AppLayout />
}

export default function App() {
  const { me, loading } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={me ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={me ? <Navigate to="/" replace /> : <Register />} />
      <Route
        path="/onboarding"
        element={!loading && me ? <Onboarding /> : loading ? <Spinner /> : <Navigate to="/login" replace />}
      />
      <Route element={<ProtectedArea />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agent" element={<Agent />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/quotes/:id" element={<QuoteDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
