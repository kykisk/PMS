import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Sparkles, Loader2, CheckCircle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'
import apiClient from '@/api/client'
import { requirementApi } from '@/api/requirement.api'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  queryKey: string[]
}

export function MarkdownImportModal({ open, onClose, projectId, queryKey }: Props) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [content, setContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [generated, setGenerated] = useState(false)
  const [saved, setSaved] = useState(false)

  const parseMutation = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/ai/parse-markdown`, { content }).then(r => r.data),
    onSuccess: (data: any) => {
      setItems(Array.isArray(data) ? data.map((i: any) => ({ ...i, _selected: true })) : [])
      setGenerated(true)
    },
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const selected = items.filter(i => i._selected)
      for (const item of selected) {
        await requirementApi.create(projectId, {
          title: item.title, description: item.description,
          category: item.category, priority: item.priority ?? 'medium', status: 'new',
        })
      }
      return selected.length
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      setSaved(true)
    },
  })

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => setContent(e.target?.result as string ?? '')
    reader.readAsText(file)
  }

  const handleClose = () => {
    setContent(''); setFileName(''); setItems([]); setGenerated(false); setSaved(false)
    onClose()
  }

  const toggle = (i: number) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, _selected: !item._selected } : item))

  return (
    <Modal open={open} onClose={handleClose} title="📄 마크다운 AI 분석 Import" className="max-w-2xl">
      <div className="space-y-4">
        {saved ? (
          <div className="text-center py-6">
            <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
            <p className="font-medium">{items.filter(i => i._selected).length}건 요구사항 생성 완료</p>
            <Button className="mt-4" onClick={handleClose}>확인</Button>
          </div>
        ) : !generated ? (
          <>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onDragOver={e => e.preventDefault()}
            >
              <FileText size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">{fileName || '.md 파일을 선택하거나 드롭하세요'}</p>
            </div>
            <input ref={fileRef} type="file" accept=".md,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            {content && (
              <div className="bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">{content.slice(0, 500)}{content.length > 500 ? '...' : ''}</pre>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>취소</Button>
              <Button disabled={!content || parseMutation.isPending} onClick={() => parseMutation.mutate()}>
                {parseMutation.isPending ? <><Loader2 size={14} className="animate-spin" />분석 중...</> : <><Sparkles size={14} />AI 분석</>}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">{items.length}개 요구사항 추출됨</p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {items.map((item, i) => (
                <div key={i} onClick={() => toggle(i)}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer ${item._selected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 opacity-50'}`}>
                  <input type="checkbox" checked={item._selected} onChange={() => toggle(i)} className="mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    {item.category && <span className="text-xs text-gray-400 mr-2">{item.category}</span>}
                    {item.priority && <span className="text-xs bg-gray-100 px-1 rounded">{item.priority}</span>}
                    {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setGenerated(false)}>다시 분석</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>취소</Button>
                <Button disabled={items.filter(i => i._selected).length === 0 || confirmMutation.isPending} onClick={() => confirmMutation.mutate()}>
                  {confirmMutation.isPending ? '저장 중...' : `✅ ${items.filter(i => i._selected).length}개 확정 저장`}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
