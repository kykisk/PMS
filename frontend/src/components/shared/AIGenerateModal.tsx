import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Sparkles, CheckSquare, Square, AlertCircle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'
import { AIProgressBar } from './AIProgressBar'
import apiClient from '@/api/client'
import { aiStatusApi } from '@/api/admin.api'

const TEMPLATES = [
  { label: '기술 스택 명시', value: '기술 스택: \n주요 제약사항: \n참고사항: ' },
  { label: '비기능 요건', value: '성능 요건: \n보안 요건: \n호환성: ' },
]

interface GeneratedItem {
  title: string
  description?: string
  [key: string]: any
  _selected?: boolean
  _rawText?: string
  _parseError?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  projectId: string
  endpoint: string
  payload: Record<string, any>
  onConfirm: (items: GeneratedItem[]) => void | Promise<void>
  renderItem?: (item: GeneratedItem) => React.ReactNode
}

export function AIGenerateModal({ open, onClose, title, projectId, endpoint, payload, onConfirm, renderItem, showDetailLevel }: Props & { showDetailLevel?: boolean }) {
  const [items, setItems] = useState<GeneratedItem[]>([])
  const [generated, setGenerated] = useState(false)
  const [rawText, setRawText] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [showTemplate, setShowTemplate] = useState(false)
  const [detailLevel, setDetailLevel] = useState(5)

  const { data: aiStatus } = useQuery({ queryKey: ['ai-status', projectId], queryFn: () => aiStatusApi.check(projectId), enabled: !!projectId })

  const generateMutation = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/${endpoint}`, {
      ...payload,
      modelId: selectedModel || undefined,
      additionalInfo: additionalInfo || undefined,
      ...(showDetailLevel ? { detailLevel } : {}),
    }).then(r => r.data),
    onSuccess: (data: any) => {
      if (Array.isArray(data)) {
        if (data[0]?._parseError) {
          setRawText(data[0]._rawText ?? '')
          setItems([])
        } else {
          setItems(data.map((item: any) => ({ ...item, _selected: true })))
          setRawText('')
        }
      }
      setGenerated(true)
    },
  })

  const toggle = (i: number) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, _selected: !item._selected } : item))
  const toggleAll = () => {
    const allSelected = items.every(i => i._selected)
    setItems(prev => prev.map(i => ({ ...i, _selected: !allSelected })))
  }

  const handleConfirm = async () => {
    const selected = items.filter(i => i._selected)
    await onConfirm(selected)
    handleClose()
  }

  const handleClose = () => {
    setItems([])
    setGenerated(false)
    setRawText('')
    setAdditionalInfo('')
    setShowTemplate(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={title} className="max-w-2xl">
      <div className="space-y-4">
        {!generated ? (
          <div className="text-center py-8">
            <Sparkles size={32} className="mx-auto mb-3 text-blue-400" />
            <p className="text-gray-600 mb-4">AI가 자동으로 초안을 생성합니다.<br />생성된 결과를 검토하고 선택 후 확정하세요.</p>
            {aiStatus?.models && aiStatus.models.length > 0 && (
              <select className="border rounded px-2 h-7 text-xs w-full mb-3" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                <option value="">자동 선택 (기본)</option>
                {aiStatus.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            )}
            {showDetailLevel && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-gray-600">상세도</label>
                  <span className="text-[10px] text-gray-400">
                    {detailLevel <= 3 ? '간략 (핵심만)' : detailLevel <= 7 ? '보통 (권장)' : '상세 (엣지케이스 포함)'}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[{ label: '간략', val: 3 }, { label: '보통', val: 5 }, { label: '상세', val: 10 }].map(p => (
                    <button key={p.val} onClick={() => setDetailLevel(p.val)}
                      className={`flex-1 text-[10px] py-1 rounded border transition-colors ${detailLevel === p.val ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]' : 'border-gray-200 text-gray-500 hover:border-[#5E6AD2]/50'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <input type="range" min={1} max={20} step={1} value={detailLevel}
                  onChange={e => setDetailLevel(Number(e.target.value))}
                  className="w-full accent-[#5E6AD2] h-1.5" />
                <div className="flex justify-between text-[9px] text-gray-400">
                  <span>1개</span><span>10개</span><span>20개</span>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-gray-600">추가 정보 <span className="text-gray-400 font-normal">(선택)</span></label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplate(prev => !prev)}
                    className="text-[10px] text-[#5E6AD2] hover:underline flex items-center gap-0.5"
                  >📋 템플릿</button>
                  {showTemplate && (
                    <div className="absolute right-0 top-5 z-10 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px]">
                      {TEMPLATES.map(t => (
                        <button
                          key={t.label}
                          onClick={() => { setAdditionalInfo(t.value); setShowTemplate(false) }}
                          className="block w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50"
                        >{t.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <textarea
                className="w-full border rounded-md px-2 py-1.5 text-xs text-gray-700 resize-none focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] placeholder:text-gray-300"
                rows={3}
                placeholder="AI가 더 정확하게 생성할 수 있도록 추가 요건이나 제약 조건을 입력해 주세요."
                value={additionalInfo}
                onChange={e => setAdditionalInfo(e.target.value)}
              />
            </div>
            <AIProgressBar isActive={generateMutation.isPending} type="generate" />
            {!generateMutation.isPending && (
            <Button
              onClick={() => generateMutation.mutate()}
              className="gap-2"
            >
              <Sparkles size={16} />AI 생성 시작
            </Button>
            )}
          </div>
        ) : rawText ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p>응답 파싱에 실패했습니다. 아래 원본 텍스트를 수동으로 편집하세요.</p>
            </div>
            <textarea
              className="w-full border rounded-md p-3 text-sm font-mono resize-none"
              rows={10}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>닫기</Button>
              <Button onClick={() => { generateMutation.mutate() }}>재시도</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">{items.length}개 생성됨 — 체크 해제로 제외 가능</p>
              <button onClick={toggleAll} className="text-xs text-blue-600 hover:underline">
                {items.every(i => i._selected) ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {items.map((item, i) => (
                <div
                  key={i}
                  onClick={() => toggle(i)}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${item._selected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {item._selected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-400" />}
                  </div>
                  <div className="flex-1">
                    {renderItem ? renderItem(item) : (
                      <>
                        <p className="font-medium text-sm">{item.title}</p>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" size="sm" onClick={() => { setGenerated(false); setItems([]) }}>다시 생성</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>취소</Button>
                <Button disabled={items.filter(i => i._selected).length === 0} disabledReason="항목을 선택하세요" onClick={handleConfirm}>
                  ✅ {items.filter(i => i._selected).length}개 확정 저장
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
