import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Square } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'
import { AIProgressBar } from './AIProgressBar'
import apiClient from '@/api/client'
import { aiStatusApi } from '@/api/admin.api'
import { featureApi } from '@/api/feature.api'
import { projectApi } from '@/api/project.api'

const TEMPLATES = [
  { label: '변경 배경', value: '변경 배경: \n영향 범위: \n유지해야 할 기능: \n추가 방향: ' },
  { label: '기술 제약', value: '기술 스택: \n제약사항: \n참고사항: ' },
]

interface ResultItem {
  title: string
  description?: string
  action?: 'new' | 'update' | 'skip'
  _existingFeatureId?: string
  _existingFeatureCode?: string
  _reason?: string
  _selected?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  requirement: { id: string; code: string; title: string; status: string }
}

export function RequirementFeatureUpdateModal({ open, onClose, projectId, requirement }: Props) {
  const qc = useQueryClient()
  const [step, setStep] = useState<'confirm' | 'analyzing' | 'preview' | 'done'>('confirm')
  const [selectedModel, setSelectedModel] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [showTemplate, setShowTemplate] = useState(false)

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId),
    enabled: open,
  })

  const analyzeMutation = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/ai/update-features-for-requirement`, {
      requirementId: requirement.id,
      modelId: selectedModel || undefined,
      additionalInfo: additionalInfo || undefined,
    }).then(r => r.data),
    onSuccess: async (data) => {
      if (Array.isArray(data)) {
        const actionable = data.filter((item: any) => item.action !== 'skip')
        if (actionable.length === 0) {
          await projectApi.clearOutdatedByRequirement(projectId, requirement.id)
          qc.invalidateQueries({ queryKey: ['features', projectId] })
          setStep('done')
          return
        }
        setResults(data.map((item: any) => ({ ...item, _selected: item.action !== 'skip' })))
        setStep('preview')
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selected = results.filter(r => r._selected && r.action !== 'skip')
      for (const item of selected) {
        if (item.action === 'update' && item._existingFeatureId) {
          await featureApi.update(projectId, item._existingFeatureId, { title: item.title, description: item.description })
        } else if (item.action !== 'skip') {
          await featureApi.create(projectId, { title: item.title, description: item.description, reqId: requirement.id, status: 'new' })
        }
      }
      return selected.length
    },
    onSuccess: async () => {
      await projectApi.clearOutdatedByRequirement(projectId, requirement.id)
      qc.invalidateQueries({ queryKey: ['features', projectId] })
      qc.invalidateQueries({ queryKey: ['feature', projectId] })
      setStep('done')
    },
  })

  const toggleResult = (idx: number) => {
    setResults(prev => prev.map((item, i) => i === idx ? { ...item, _selected: !item._selected } : item))
  }

  const toggleAll = () => {
    const allSelected = results.every(r => r._selected)
    setResults(prev => prev.map(item => ({ ...item, _selected: !allSelected })))
  }

  const handleClose = () => {
    setStep('confirm')
    setSelectedModel('')
    setResults([])
    setAdditionalInfo('')
    setShowTemplate(false)
    onClose()
  }

  const selectedCount = results.filter(r => r._selected && r.action !== 'skip').length

  return (
    <Modal open={open} onClose={handleClose} title="AI 기능 업데이트" className="max-w-lg">
      <div className="space-y-3">
        {step === 'confirm' && (
          <div className="space-y-3">
            <div className="px-3 py-2 bg-gray-50 rounded-md border">
              <p className="text-[11px] text-gray-400">대상 요구사항</p>
              <p className="text-xs font-medium mt-0.5">
                <span className="text-[#5E6AD2] font-mono">{requirement.code}</span>
                <span className="text-gray-700 ml-1.5">{requirement.title}</span>
              </p>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              AI가 이전 확정 이력과 현재 요구사항을 비교하여 기능을 업데이트합니다.
            </p>

            {aiStatus?.models && aiStatus.models.length > 0 && (
              <select
                className="border rounded-md px-2 h-7 text-xs w-full text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                <option value="">AI 모델 자동 선택</option>
                {aiStatus.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
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

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleClose}>취소</Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => { setStep('analyzing'); analyzeMutation.mutate() }}>
                분석 시작
              </Button>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-8 text-center">
            <AIProgressBar isActive={analyzeMutation.isPending} type="generate" />
            {analyzeMutation.isError && (
              <div className="mt-4 text-sm text-red-600">
                분석 중 오류가 발생했습니다.
                <Button variant="outline" size="sm" className="ml-2 h-7 text-xs" onClick={() => analyzeMutation.mutate()}>재시도</Button>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">{results.length}개 항목 · {selectedCount}개 선택</p>
              <button onClick={toggleAll} className="text-[11px] text-[#5E6AD2] hover:underline">
                {results.every(r => r._selected) ? '전체 해제' : '전체 선택'}
              </button>
            </div>

            <div className="max-h-[350px] overflow-y-auto border rounded-md divide-y">
              {results.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleResult(idx)}
                  className={`flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors ${item._selected ? 'bg-blue-50/50' : 'opacity-50'}`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {item._selected ? <CheckSquare size={14} className="text-[#5E6AD2]" /> : <Square size={14} className="text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.action === 'new' && <span className="text-[9px] px-1 rounded bg-green-100 text-green-700 font-medium">신규</span>}
                      {item.action === 'update' && <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-700 font-medium">수정</span>}
                      {item.action === 'skip' && <span className="text-[9px] px-1 rounded bg-gray-100 text-gray-500 font-medium">기존</span>}
                      <p className="text-xs font-medium text-gray-800 truncate">{item.title}</p>
                    </div>
                    {item.description && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>}
                    {item.action === 'update' && item._existingFeatureCode && <p className="text-[10px] text-amber-600 mt-0.5">← {item._existingFeatureCode} 수정</p>}
                    {item.action === 'skip' && item._reason && <p className="text-[10px] text-gray-400 mt-0.5">{item._reason}</p>}
                  </div>
                </div>
              ))}
              {results.length === 0 && (
                <div className="py-6 text-center text-xs text-gray-400">분석 결과가 없습니다</div>
              )}
            </div>

            <div className="flex justify-between items-center pt-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setStep('confirm'); setResults([]) }}>이전</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleClose}>취소</Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={selectedCount === 0 || saveMutation.isPending}
                  disabledReason={saveMutation.isPending ? '저장 중...' : '항목을 선택하세요'}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? '저장 중...' : `${selectedCount}개 저장`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-gray-700 font-medium">업데이트가 완료되었습니다.</p>
            <Button size="sm" className="h-7 text-xs" onClick={handleClose}>닫기</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
