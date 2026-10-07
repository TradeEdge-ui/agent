import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LineItemsEditor from './LineItemsEditor'
import type { LineItem } from '../types'

describe('LineItemsEditor', () => {
  it('shows a subtotal that accounts for quantity, price and per-line discount', () => {
    const items: LineItem[] = [
      { description: 'Website', quantity: 2, unit_price: 100, discount_percent: 10 },
    ]
    render(<LineItemsEditor items={items} onChange={() => {}} currency="USD" />)
    // 2 * 100 = 200, minus 10% = 180
    expect(screen.getByText(/Subtotal: USD 180/)).toBeInTheDocument()
  })

  it('adds a new blank line item when "Add line item" is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<LineItemsEditor items={[]} onChange={onChange} currency="USD" />)
    await user.click(screen.getByText('+ Add line item'))
    expect(onChange).toHaveBeenCalledWith([
      { description: '', quantity: 1, unit_price: 0, discount_percent: 0 },
    ])
  })
})
