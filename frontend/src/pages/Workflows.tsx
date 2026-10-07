import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui'
import { StatusBadge } from '../components/Badge'
import {
  createWorkflow,
  deleteWorkflow,
  listWorkflowRuns,
  listWorkflows,
  runWorkflowNow,
  updateWorkflow,
} from '../services/resources'
import { apiErrorMessage } from '../services/api'
import type { Workflow, WorkflowStep } from '../types'

const LOW_RISK_TOOL_HINTS = [
  'create_task', 'complete_task', 'update_task', 'create_follow_up', 'search_tasks',
  'search_customers', 'search_leads', 'get_business_summary', 'get_daily_summary',
  'retrieve_business_rule', 'record_interaction', 'browser_open', 'browser_navigate',
  'browser_read_page', 'browser_find', 'browser_close',
]

function emptyStep(): WorkflowStep {
  return {
    step_type: 'TOOL_CALL', tool_name: '', tool_input: {},
    condition_field: '', condition_operator: 'eq', condition_value: '', on_false: 'stop',
  }
}

function StepEditor({ step, onChange, onRemove }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void; onRemove: () => void }) {
  const [toolInputText, setToolInputText] = useState(JSON.stringify(step.tool_input ?? {}, null, 2))
  const [jsonError, setJsonError] = useState('')

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/60">
      <div className="flex items-center justify-between">
        <Select
          value={step.step_type}
          onChange={(e) => onChange({ ...step, step_type: e.target.value as WorkflowStep['step_type'] })}
          className="w-40"
        >
          <option value="TOOL_CALL">Action (tool call)</option>
          <option value="CONDITION">Condition</option>
        </Select>
        <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:underline">
          Remove step
        </button>
      </div>

      {step.step_type === 'TOOL_CALL' ? (
        <>
          <Field label="Tool name">
            <Input
              list="low-risk-tools"
              value={step.tool_name}
              onChange={(e) => onChange({ ...step, tool_name: e.target.value })}
              placeholder="e.g. create_task"
            />
            <datalist id="low-risk-tools">
              {LOW_RISK_TOOL_HINTS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Tool input (JSON)">
            <Textarea
              rows={3}
              className="font-mono text-xs"
              value={toolInputText}
              onChange={(e) => {
                setToolInputText(e.target.value)
                try {
                  onChange({ ...step, tool_input: JSON.parse(e.target.value || '{}') })
                  setJsonError('')
                } catch {
                  setJsonError('Invalid JSON')
                }
              }}
            />
          </Field>
          {jsonError && <p className="text-xs text-red-600">{jsonError}</p>}
          <p className="text-[11px] text-slate-400">
            Only LOW-risk tools can run unattended -- anything higher gets rejected when you save.
          </p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Field (from previous step's output)">
              <Input value={step.condition_field} onChange={(e) => onChange({ ...step, condition_field: e.target.value })} placeholder="e.g. created" />
            </Field>
            <Field label="Operator">
              <Select value={step.condition_operator} onChange={(e) => onChange({ ...step, condition_operator: e.target.value as WorkflowStep['condition_operator'] })}>
                <option value="eq">equals</option>
                <option value="ne">not equals</option>
                <option value="gt">greater than</option>
                <option value="lt">less than</option>
                <option value="contains">contains</option>
                <option value="exists">exists</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Value to compare">
              <Input value={step.condition_value} onChange={(e) => onChange({ ...step, condition_value: e.target.value })} />
            </Field>
            <Field label="If false">
              <Select value={step.on_false} onChange={(e) => onChange({ ...step, on_false: e.target.value as WorkflowStep['on_false'] })}>
                <option value="stop">Stop the workflow</option>
                <option value="skip_next">Skip next step only</option>
              </Select>
            </Field>
          </div>
        </>
      )}
    </div>
  )
}

function CreateWorkflowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState<'MANUAL' | 'CRON'>('MANUAL')
  const [cron, setCron] = useState('0 9 * * *')
  const [steps, setSteps] = useState<WorkflowStep[]>([emptyStep()])
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      createWorkflow({
        name, description, trigger_type: triggerType, cron_expression: triggerType === 'CRON' ? cron : '',
        enabled: true, steps,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      onClose()
      setName(''); setDescription(''); setSteps([emptyStep()])
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <Modal open={open} onClose={onClose} title="New workflow">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          mutation.mutate()
        }}
      >
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Start my work setup" />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Trigger">
            <Select value={triggerType} onChange={(e) => setTriggerType(e.target.value as 'MANUAL' | 'CRON')}>
              <option value="MANUAL">Manual (run on demand)</option>
              <option value="CRON">Scheduled (cron)</option>
            </Select>
          </Field>
          {triggerType === 'CRON' && (
            <Field label="Cron expression (UTC)">
              <Input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 9 * * *" />
            </Field>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Steps</span>
            <button type="button" className="text-xs text-[#1f3a5f] underline" onClick={() => setSteps([...steps, emptyStep()])}>
              + Add step
            </button>
          </div>
          {steps.map((step, i) => (
            <StepEditor
              key={i}
              step={step}
              onChange={(s) => setSteps(steps.map((old, idx) => (idx === i ? s : old)))}
              onRemove={() => setSteps(steps.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={mutation.isPending || steps.length === 0}>
          Create workflow
        </Button>
      </form>
    </Modal>
  )
}

function RunHistory({ workflowId }: { workflowId: string }) {
  const { data: runs, isLoading } = useQuery({
    queryKey: ['workflow-runs', workflowId],
    queryFn: () => listWorkflowRuns(workflowId),
  })
  if (isLoading) return <Spinner />
  if (!runs || runs.length === 0) return <p className="text-xs text-slate-400 py-2">No runs yet.</p>
  return (
    <div className="space-y-2 py-2">
      {runs.map((r) => (
        <div key={r.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{new Date(r.created_at).toLocaleString()} &middot; by {r.triggered_by}</span>
            <StatusBadge status={r.status} />
          </div>
          {r.error && <p className="text-red-600 mt-1">{r.error}</p>}
          <p className="text-slate-400 mt-1">{r.step_results.length} step(s) executed</p>
        </div>
      ))}
    </div>
  )
}

function WorkflowRow({ workflow }: { workflow: Workflow }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [runError, setRunError] = useState('')

  const runMutation = useMutation({
    mutationFn: () => runWorkflowNow(workflow.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-runs', workflow.id] })
      setExpanded(true)
    },
    onError: (err) => setRunError(apiErrorMessage(err)),
  })
  const toggleMutation = useMutation({
    mutationFn: () => updateWorkflow(workflow.id, { enabled: !workflow.enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkflow(workflow.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  })

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{workflow.name}</p>
          {workflow.description && <p className="text-xs text-slate-500 mt-0.5">{workflow.description}</p>}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-slate-400">{workflow.steps.length} step(s)</span>
            <span className="text-xs text-slate-400">
              {workflow.trigger_type === 'CRON' ? `cron: ${workflow.cron_expression}` : 'manual'}
            </span>
            {!workflow.enabled && <StatusBadge status="INACTIVE" />}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="secondary" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
            {runMutation.isPending ? 'Running...' : 'Run now'}
          </Button>
          <Button variant="ghost" onClick={() => toggleMutation.mutate()}>
            {workflow.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate()}>
            Delete
          </Button>
        </div>
      </div>
      {runError && <p className="text-xs text-red-600 mt-2">{runError}</p>}
      <button className="text-xs text-slate-400 mt-2 hover:text-slate-600" onClick={() => setExpanded((e) => !e)}>
        {expanded ? 'Hide' : 'Show'} run history
      </button>
      {expanded && <RunHistory workflowId={workflow.id} />}
    </Card>
  )
}

export default function Workflows() {
  const [modalOpen, setModalOpen] = useState(false)
  const { data: workflows, isLoading } = useQuery({ queryKey: ['workflows'], queryFn: listWorkflows })

  return (
    <div>
      <PageHeader
        title="Workflows"
        subtitle="Reusable routines: trigger, then a sequence of LOW-risk actions (and optional conditions) the agent can run unattended -- on demand, on a schedule, or by name from the AI Agent chat."
        actions={<Button onClick={() => setModalOpen(true)}>+ New workflow</Button>}
      />
      {isLoading ? (
        <Spinner />
      ) : workflows?.length === 0 ? (
        <EmptyState title="No workflows yet" subtitle="Create one to automate a routine like 'start my work setup'." />
      ) : (
        <div className="space-y-3">
          {workflows?.map((w) => (
            <WorkflowRow key={w.id} workflow={w} />
          ))}
        </div>
      )}
      <CreateWorkflowModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
