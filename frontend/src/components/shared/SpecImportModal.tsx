import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Download, Sparkles, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'
import apiClient from '@/api/client'
import { requirementApi } from '@/api/requirement.api'

type DiffItem = {
  type: 'new' | 'changed' | 'unchanged'
  item: { title: string; description?: string; category?: string; priority?: string; status?: string }
  existingId?: string
  _selected?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  queryKey: string[]
  mode?: 'initial' | 'update'
}

export function SpecImportModal({ open, onClose, projectId, queryKey, mode = 'initial' }: Props) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<'upload' | 'preview' | 'done'>('upload')
  const [items, setItems] = useState<DiffItem[]>([])
  const [rawText, setRawText] = useState('')

  const parseMutation = useMutation({
    mutationFn: async (f: File) => {
      const form = new FormData()
      form.append('file', f)
      const endpoint = mode === 'update'
        ? `/projects/${projectId}/ai/diff-spec-upload`
        : `/projects/${projectId}/ai/parse-spec-upload`
      const res = await apiClient.post(endpoint, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      return res.data
    },
    onSuccess: (data: any) => {
      if (Array.isArray(data)) {
        if (data[0]?._parseError) {
          setRawText(data[0]._rawText ?? '')
          setItems([])
        } else if (mode === 'update') {
          setItems(data.map((d: DiffItem) => ({ ...d, _selected: d.type !== 'unchanged' })))
        } else {
          setItems(data.map((item: any) => ({ type: 'new', item, _selected: true })))
        }
      }
      setStage('preview')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const selected = items.filter(i => i._selected)
      for (const diff of selected) {
        if (diff.type === 'new') {
          await requirementApi.create(projectId, {
            title: diff.item.title,
            description: diff.item.description,
            category: diff.item.category,
            priority: diff.item.priority ?? 'medium',
            status: 'new',
          })
        } else if (diff.type === 'changed' && diff.existingId) {
          await requirementApi.update(projectId, diff.existingId, {
            description: diff.item.description,
            category: diff.item.category,
          })
        }
      }
      return selected.length
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      setStage('done')
    },
  })

  const toggle = (i: number) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, _selected: !item._selected } : item))

  const handleClose = () => {
    setFile(null); setStage('upload'); setItems([]); setRawText('')
    onClose()
  }

  const typeLabel: Record<string, { label: string; color: string }> = {
    new: { label: '신규', color: 'bg-green-100 text-green-700' },
    changed: { label: '변경', color: 'bg-blue-100 text-blue-700' },
    unchanged: { label: '동일', color: 'bg-gray-100 text-gray-500' },
  }

  const title = mode === 'update' ? '📊 기술서 업데이트 Import (diff)' : '📋 요구사항 기술서 AI Import'

  return (
    <Modal open={open} onClose={handleClose} title={title} className="max-w-2xl">
      <div className="space-y-4">
        {stage === 'upload' && (
          <>
            <Button variant="outline" size="sm" className="w-full"
              onClick={() => window.open(`/api/v1/projects/${projectId}/ai/spec-template`, '_blank')}>
              <Download size={14} />기술서 템플릿 다운로드 (요구사항구분/요청사항/상세내용)
            </Button>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
              onDragOver={e => e.preventDefault()}
            >
              <Upload size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">{file ? file.name : '.xlsx 파일을 선택하거나 드롭하세요'}</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>취소</Button>
              <Button disabled={!file || parseMutation.isPending} onClick={() => file && parseMutation.mutate(file)}>
                {parseMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-1" />AI 분석중...</> : <><Sparkles size={14} />AI 분석</>}
              </Button>
            </div>
          </>
        )}

        {stage === 'preview' && rawText && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p>AI 응답 파싱에 실패했습니다. 다시 시도하거나 다른 LLM을 사용해 보세요.</p>
            </div>
            <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto max-h-48">{rawText.slice(0, 1000)}</pre>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setStage('upload'); setRawText('') }}>다시 시도</Button>
              <Button variant="outline" onClick={handleClose}>닫기</Button>
            </div>
          </div>
        )}

        {stage === 'preview' && !rawText && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {mode === 'update'
                  ? `${items.filter(i => i.type === 'new').length}개 신규 · ${items.filter(i => i.type === 'changed').length}개 변경 · ${items.filter(i => i.type === 'unchanged').length}개 동일`
                  : `${items.length}개 요구사항 추출`}
              </p>
              <button className="text-xs text-blue-600 hover:underline"
                onClick={() => setItems(prev => { const all = prev.every(i => i._selected); return prev.map(i => ({ ...i, _selected: !all })) })}>
                전체 {items.every(i => i._selected) ? '해제' : '선택'}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {items.map((d, i) => (
                <div key={i} onClick={() => toggle(i)}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer ${d._selected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 opacity-50'}`}>
                  <input type="checkbox" checked={d._selected} onChange={() => toggle(i)} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeLabel[d.type].color}`}>{typeLabel[d.type].label}</span>
                      <p className="font-medium text-sm">{d.item.title}</p>
                    </div>
                    {d.item.category && <span className="text-xs text-gray-400 mr-2">{d.item.category}</span>}
                    {d.item.priority && <span className="text-xs bg-gray-100 px-1 rounded">{d.item.priority}</span>}
                    {d.item.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{d.item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setStage('upload')}><RefreshCw size={12} />다시 분석</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>취소</Button>
                <Button disabled={items.filter(i => i._selected).length === 0 || confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate()}>
                  {confirmMutation.isPending ? '저장중...' : `✅ ${items.filter(i => i._selected && i.type !== 'unchanged').length}개 반영`}
                </Button>
              </div>
            </div>
          </>
        )}

        {stage === 'done' && (
          <div className="text-center py-6">
            <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
            <p className="font-medium">요구사항 반영 완료</p>
            <Button className="mt-4" onClick={handleClose}>확인</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
