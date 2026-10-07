import type { LineItem } from '../types'
import { Button, Input } from './ui'

export default function LineItemsEditor({
  items,
  onChange,
  currency,
}: {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  currency: string
}) {
  function update(i: number, patch: Partial<LineItem>) {
    const next = items.map((item, idx) => (idx === i ? { ...item, ...patch } : item))
    onChange(next)
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...items, { description: '', quantity: 1, unit_price: 0, discount_percent: 0 }])
  }

  const total = items.reduce((sum, it) => {
    const gross = it.quantity * it.unit_price
    return sum + gross - gross * (it.discount_percent / 100)
  }, 0)

  return (
    <div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <Input
              placeholder="Description"
              className="flex-1"
              value={item.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Qty"
              className="w-20"
              value={item.quantity}
              onChange={(e) => update(i, { quantity: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="Price"
              className="w-28"
              value={item.unit_price}
              onChange={(e) => update(i, { unit_price: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="Disc %"
              className="w-20"
              value={item.discount_percent}
              onChange={(e) => update(i, { discount_percent: Number(e.target.value) })}
            />
            <button type="button" onClick={() => remove(i)} className="text-slate-400 hover:text-red-500 px-1">
              &times;
            </button>
          </div>
        ))}
      </div>
      <Button type="button" variant="ghost" className="mt-2 px-0" onClick={add}>
        + Add line item
      </Button>
      <div className="text-right text-sm font-medium text-slate-700 mt-2">
        Subtotal: {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>
    </div>
  )
}
