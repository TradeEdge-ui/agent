import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner } from '../components/ui'
import { StatusBadge } from '../components/Badge'
import { completeTask, createTask, listTasks, reopenTask } from '../services/resources'

export default function Tasks() {
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'DONE'>('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', due_date: '' })
  const queryClient = useQueryClient()

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => listTasks(filter === 'ALL' ? undefined : { status: filter }),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createTask({ ...form, due_date: form.due_date ? new Date(form.due_date).toISOString() : null } as never),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setModalOpen(false)
      setForm({ title: '', description: '', priority: 'MEDIUM', due_date: '' })
    },
  })

  const completeMutation = useMutation({
    mutationFn: completeTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
  const reopenMutation = useMutation({
    mutationFn: reopenTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const now = Date.now()

  return (
    <div>
      <PageHeader title="Tasks" actions={<Button onClick={() => setModalOpen(true)}>+ New task</Button>} />

      <div className="flex gap-2 mb-4">
        {(['ALL', 'OPEN', 'DONE'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${
              filter === f ? 'bg-[#1f3a5f] text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : tasks?.length === 0 ? (
          <EmptyState title="No tasks" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks?.map((t) => {
              const overdue = t.due_date && new Date(t.due_date).getTime() < now && t.status !== 'DONE'
              return (
                <li key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className={`text-sm font-medium ${t.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {t.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={t.priority} />
                      {t.due_date && (
                        <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                          Due {new Date(t.due_date).toLocaleDateString()}
                          {overdue ? ' (overdue)' : ''}
                        </span>
                      )}
                      {t.created_by === 'agent' && <span className="text-xs text-indigo-500">by AI agent</span>}
                    </div>
                  </div>
                  {t.status === 'DONE' ? (
                    <Button variant="secondary" onClick={() => reopenMutation.mutate(t.id)}>
                      Reopen
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => completeMutation.mutate(t.id)}>
                      Mark done
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New task">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
        >
          <Field label="Title">
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            Create task
          </Button>
        </form>
      </Modal>
    </div>
  )
}
