import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button, Card, PageHeader, Spinner, Textarea } from '../components/ui'
import { StatusBadge } from '../components/Badge'
import { useSpeech } from '../hooks/useSpeech'
import { getAgentStatus, listAgentRuns, runAgent } from '../services/resources'
import { apiErrorMessage } from '../services/api'
import type { AgentRun } from '../types'

const SUGGESTIONS = [
  'What should I focus on today?',
  'Which leads are going cold?',
  'Summarize my business activity this week',
  'Create a task to follow up with John next Monday',
]

function RunCard({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{run.request_text}</p>
          <p className="text-xs text-slate-400 mt-0.5">{new Date(run.created_at).toLocaleString()}</p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      {run.final_response && (
        <p className="text-sm text-slate-700 mt-3 bg-slate-50 rounded-lg px-3 py-2">{run.final_response}</p>
      )}

      {run.status === 'WAITING_FOR_APPROVAL' && (
        <p className="text-sm text-amber-700 mt-3 bg-amber-50 rounded-lg px-3 py-2">
          Waiting for your decision in the{' '}
          <Link to="/approvals" className="underline font-medium">
            Approval Center
          </Link>
          .
        </p>
      )}

      {run.status === 'FAILED' && run.error && (
        <p className="text-sm text-red-700 mt-3 bg-red-50 rounded-lg px-3 py-2">{run.error}</p>
      )}

      {run.tool_executions.length > 0 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-slate-400 mt-3 hover:text-slate-600"
        >
          {expanded ? 'Hide' : 'Show'} {run.tool_executions.length} tool action(s)
        </button>
      )}

      {expanded && (
        <div className="mt-2 space-y-2">
          {run.tool_executions.map((t, i) => (
            <div key={i} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium text-slate-700">{t.tool_name}</span>
                <span className={t.success ? 'text-emerald-600' : 'text-red-600'}>
                  {t.success ? 'ok' : 'failed'}
                  {t.required_approval ? ' (approval)' : ''}
                </span>
              </div>
              <pre className="whitespace-pre-wrap text-slate-500 mt-1">
                {JSON.stringify(t.success ? t.output : { error: t.error }, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function Agent() {
  const [message, setMessage] = useState('')
  const [speakResponses, setSpeakResponses] = useState(false)
  const queryClient = useQueryClient()
  const { data: status } = useQuery({ queryKey: ['agent-status'], queryFn: getAgentStatus })
  const { data: runs, isLoading } = useQuery({ queryKey: ['agent-runs'], queryFn: listAgentRuns })
  const speech = useSpeech()
  const lastSpokenRunId = useRef<string | null>(null)

  const mutation = useMutation({
    mutationFn: runAgent,
    onSuccess: (run) => {
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (speakResponses && run.final_response && lastSpokenRunId.current !== run.id) {
        lastSpokenRunId.current = run.id
        speech.speak(run.final_response)
      }
    },
  })

  function submit() {
    if (!message.trim()) return
    mutation.mutate(message.trim())
  }

  // While listening, keep the textarea in sync with the live transcript.
  useEffect(() => {
    if (speech.listening) setMessage(speech.transcript)
  }, [speech.transcript, speech.listening])

  return (
    <div>
      <PageHeader
        title="AI Agent"
        subtitle="Tell it what you need handled. It will look things up, prepare drafts, and ask for your approval on anything risky."
      />

      {status && !status.available && (
        <Card className="p-4 mb-4 border-amber-200 bg-amber-50/60">
          <p className="text-sm text-amber-800">{status.message}</p>
        </Card>
      )}

      <Card className="p-4 mb-6">
        <Textarea
          rows={3}
          placeholder="e.g. Prepare a quotation for a basic website at $1,500, valid for 7 days"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
        />
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap items-center">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setMessage(s)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title={speech.sttSupported ? 'Speak your request' : 'Voice input is not supported in this browser'}
              onClick={() => (speech.listening ? speech.stopListening() : speech.startListening())}
              disabled={!speech.sttSupported}
              className={`w-9 h-9 flex items-center justify-center rounded-full border text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${
                speech.listening
                  ? 'bg-red-500 border-red-500 text-white animate-pulse'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {speech.listening ? '■' : '🎤'}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 select-none">
              <input
                type="checkbox"
                checked={speakResponses}
                disabled={!speech.ttsSupported}
                onChange={(e) => setSpeakResponses(e.target.checked)}
              />
              Speak responses
            </label>
            {speech.speaking && (
              <button type="button" onClick={speech.stopSpeaking} className="text-xs text-slate-500 underline">
                Stop speaking
              </button>
            )}
            <Button onClick={submit} disabled={mutation.isPending || !message.trim()}>
              {mutation.isPending ? 'Working...' : 'Send'}
            </Button>
          </div>
        </div>
        {speech.error && <p className="text-xs text-amber-700 mt-2">{speech.error}</p>}
        {mutation.isError && (
          <p className="text-sm text-red-600 mt-2">{apiErrorMessage(mutation.error)}</p>
        )}
      </Card>

      <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Recent requests</h3>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {runs?.length === 0 && <p className="text-sm text-slate-400">No requests yet.</p>}
          {runs?.map((run) => <RunCard key={run.id} run={run} />)}
        </div>
      )}
    </div>
  )
}
