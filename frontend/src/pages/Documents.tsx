import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { listDocuments, uploadDocument } from '../services/resources'
import { apiErrorMessage } from '../services/api'

export default function Documents() {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const { data: documents, isLoading } = useQuery({ queryKey: ['documents'], queryFn: listDocuments })

  const mutation = useMutation({
    mutationFn: (file: File) => uploadDocument(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      if (fileInput.current) fileInput.current.value = ''
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Upload receipts, quotations, or customer files. The system extracts what it can and flags anything uncertain for your review."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => {
                setError('')
                const file = e.target.files?.[0]
                if (file) mutation.mutate(file)
              }}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Uploading...' : '+ Upload document'}
            </Button>
          </>
        }
      />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {isLoading ? (
        <Spinner />
      ) : documents?.length === 0 ? (
        <EmptyState title="No documents uploaded yet" subtitle="Supported: PDF, DOCX, XLSX, TXT, CSV" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents?.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{doc.filename}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {doc.category} &middot; {(doc.size_bytes / 1024).toFixed(1)} KB
                  </p>
                </div>
                {doc.needs_review && (
                  <span className="badge bg-amber-100 text-amber-800">Needs review</span>
                )}
              </div>
              {Object.keys(doc.extracted_fields).length > 0 ? (
                <table className="w-full text-xs mt-3">
                  <tbody>
                    {Object.entries(doc.extracted_fields).map(([key, field]) => (
                      <tr key={key} className="border-t border-slate-50">
                        <td className="py-1 text-slate-400">{key.replace(/_/g, ' ')}</td>
                        <td className="py-1 text-slate-700 text-right">{String(field.value)}</td>
                        <td className="py-1 text-slate-400 text-right w-16">
                          {Math.round(field.confidence * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-slate-400 mt-3">No structured fields could be extracted.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
