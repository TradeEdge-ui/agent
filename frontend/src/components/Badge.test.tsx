import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RiskBadge, StatusBadge } from './Badge'

describe('StatusBadge', () => {
  it('renders the status text with spaces instead of underscores', () => {
    render(<StatusBadge status="PENDING_APPROVAL" />)
    expect(screen.getByText('PENDING APPROVAL')).toBeInTheDocument()
  })

  it('falls back to neutral styling for unknown statuses', () => {
    render(<StatusBadge status="SOMETHING_UNKNOWN" />)
    expect(screen.getByText('SOMETHING UNKNOWN')).toBeInTheDocument()
  })
})

describe('RiskBadge', () => {
  it('labels high risk clearly', () => {
    render(<RiskBadge risk="HIGH" />)
    expect(screen.getByText('HIGH risk')).toBeInTheDocument()
  })
})
