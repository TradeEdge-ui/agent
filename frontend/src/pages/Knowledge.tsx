import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Textarea } from '../components/ui'
import {
  createKnowledge,
  deleteKnowledge,
  listKnowledge,
  searchKnowledge,
  uploadKnowledge,
} from '../services/resources'
import { apiErrorMessage } from '../services/api'

export default function Knowledge() {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', raw_text: '' })
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchKnowledge>> | null>(null)
  const [error, setError] = useState('')

  const { data: docs, isLoading } = useQuery({ queryKey: ['knowledge'], queryFn: listKnowledge })

  const createMutation = useMutation({
    mutationFn: () => createKnowledge(form.title, form.raw_text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      setModalOpen(false)
      setForm({ title: '', raw_text: '' })
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadKnowledge(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      if (fileInput.current) fileInput.current.value = ''
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteKnowledge,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge'] }),
  })

  async function runSearch() {
    if (!query.trim()) return
    const res = await searchKnowledge(query.trim())
    setResults(res)
  }

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        subtitle="Upload SOPs, pricing sheets, FAQs and policies so the AI agent can answer questions accurately, with sources."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => {
                setError('')
                const file = e.target.files?.[0]
                if (file) uploadMutation.mutate(file)
              }}
            />
            <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={uploadMutation.isPending}>
              Upload file
            </Button>
            <Button onClick={() => setModalOpen(true)}>+ Add text</Button>
          </>
        }
      />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <Card className="p-4 mb-6">
        <div className="flex gap-2">
          <Input
            placeholder="Ask something, e.g. 'what is our standard deposit?'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
          <Button onClick={runSearch}>Search</Button>
        </div>
        {results && (
          <div className="mt-4 space-y-3">
            {results.length === 0 ? (
              <p className="text-sm text-slate-400">No matching knowledge found.</p>
            ) : (
              results.map((r, i) => (
                <div key={i} className="text-sm bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-400 mb-1">Source: {r.document_title}</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{r.chunk_content}</p>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {isLoading ? (
        <Spinner />
      ) : docs?.length === 0 ? (
        <EmptyState title="No knowledge documents yet" />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {docs?.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{d.title}</p>
                  <p className="text-xs text-slate-400">{d.source_type}</p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(d.id)}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add knowledge text">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            createMutation.mutate()
          }}
        >
          <Field label="Title">
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Content">
            <Textarea
              rows={8}
              required
              value={form.raw_text}
              onChange={(e) => setForm({ ...form, raw_text: e.target.value })}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            Save
          </Button>
        </form>
      </Modal>
    </div>
  )
}
