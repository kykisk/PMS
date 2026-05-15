import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Square, Search, AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AIProgressBar } from './AIProgressBar'
import apiClient from '@/api/client'
import { aiStatusApi } from '@/api/admin.api'
import { featureApi } from '@/api/feature.api'
import { taskApi } from '@/api/task.api'

const TEMPLATES = [
  { label: '개발 환경', value: '기술 스택: \n예상 공수(일): \n담당자 역할: \n참고사항: ' },
  { label: '제약 조건', value: '의존성: \n선행 작업: \n제외 항목: ' },
]

interface GeneratedTask {
  title: string
  description?: string
  _featureCode: string
  _featureTitle: string
  _featureId: string
  _selected?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
}

const MAX_SELECT = 20
const WARN_THRESHOLD = 10

export function MultiTaskGenerateModal({ open, onClose, projectId }: Props) {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [results, setResults] = useState<GeneratedTask[]>([])
  const [saving, setSaving] = useState(false)
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [showTemplate, setShowTemplate] = useState(false)

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId),
    enabled: !!projectId && open,
  })

  const { data: featResult } = useQuery({
    queryKey: ['features-confirmed', projectId],
    queryFn: () => featureApi.list(projectId!, { limit: 500, status: 'confirmed' }),
    enabled: !!projectId && open,
  })

  const { data: taskResult } = useQuery({
    queryKey: ['tasks-for-filter', projectId],
    queryFn: () => taskApi.list(projectId!, { limit: 500 }),
    enabled: !!projectId && open,
  })

  const featureIdsWithTasks = new Set((taskResult?.data ?? []).filter((t: any) => t.featureId).map((t: any) => t.featureId))

  const filtered = useMemo(() => {
    const features = (featResult?.data ?? []).filter((f: any) => !featureIdsWithTasks.has(f.id))
    if (!searchFilter) return features
    const q = searchFilter.toLowerCase()
    return features.filter((f: any) => f.code.toLowerCase().includes(q) || f.title.toLowerCase().includes(q))
  }, [featResult, featureIdsWithTasks, searchFilter])

  const toggleFeature = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else if (next.size < MAX_SELECT) { next.add(id) }
      return next
    })
  }

  const generateMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/projects/${projectId}/ai/generate-tasks-multi`, {
        featureIds: [...selectedIds],
        modelId: selectedModel || undefined,
        additionalInfo: additionalInfo || undefined,
      }).then(r => r.data),
    onSuccess: (data: any) => {
      if (Array.isArray(data)) {
        setResults(data.map((item: any) => ({ ...item, _selected: true })))
      }
      setStep(3)
    },
  })

  const handleGenerate = () => {
    setStep(2)
    generateMutation.mutate()
  }

  const toggleResult = (idx: number) => {
    setResults(prev => prev.map((item, i) => i === idx ? { ...item, _selected: !item._selected } : item))
  }

  const toggleGroupAll = (featureId: string) => {
    const group = results.filter(r => r._featureId === featureId)
    const allSelected = group.every(r => r._selected)
    setResults(prev => prev.map(item => item._featureId === featureId ? { ...item, _selected: !allSelected } : item))
  }

  const toggleAllResults = () => {
    const allSelected = results.every(r => r._selected)
    setResults(prev => prev.map(item => ({ ...item, _selected: !allSelected })))
  }

  const handleSave = async () => {
    const selected = results.filter(r => r._selected)
    if (selected.length === 0) return
    setSaving(true)
    try {
      for (const item of selected) {
        await taskApi.create(projectId, {
          title: item.title,
          description: item.description,
          featureId: item._featureId,
          status: 'pending',
        } as any)
      }
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      qc.invalidateQueries({ queryKey: ['tasks-all', projectId] })
      qc.invalidateQueries({ queryKey: ['tasks-for-filter', projectId] })
      handleClose()
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setSelectedIds(new Set())
    setSearchFilter('')
    setSelectedModel('')
    setResults([])
    setAdditionalInfo('')
    setShowTemplate(false)
    onClose()
  }

  const grouped = useMemo(() => {
    const map: Record<string, { code: string; title: string; items: (GeneratedTask & { _idx: number })[] }> = {}
    results.forEach((r, idx) => {
      if (!map[r._featureId]) {
        map[r._featureId] = { code: r._featureCode, title: r._featureTitle, items: [] }
      }
      map[r._featureId].items.push({ ...r, _idx: idx })
    })
    return Object.entries(map)
  }, [results])

  const selectedCount = results.filter(r => r._selected).length

  return (
    <Modal open={open} onClose={handleClose} title="다중 AI Task 생성" className="max-w-4xl">
      <div className="flex flex-col max-h-[calc(85vh-4rem)]">
        <div className="flex items-center gap-2 text-[11px] text-gray-400 border-b pb-2 flex-shrink-0 px-1">
          <span className={step === 1 ? 'text-[#5E6AD2] font-semibold' : ''}>1. 기능 선택</span>
          <span>→</span>
          <span className={step === 2 ? 'text-[#5E6AD2] font-semibold' : ''}>2. AI 생성</span>
          <span>→</span>
          <span className={step === 3 ? 'text-[#5E6AD2] font-semibold' : ''}>3. 결과 확인</span>
        </div>

        {step === 1 && (
          <div className="flex flex-1 min-h-0">
            {/* 왼쪽: 선택 목록 */}
            <div className="w-[55%] border-r flex flex-col p-4 gap-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={filtered.length > 0 && filtered.every((f: any) => selectedIds.has(f.id))}
                    onChange={() => {
                      const allSelected = filtered.every((f: any) => selectedIds.has(f.id))
                      if (allSelected) { setSelectedIds(new Set()) }
                      else { setSelectedIds(new Set(filtered.slice(0, MAX_SELECT).map((f: any) => f.id))) }
                    }}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-xs text-gray-500">전체 선택</span>
                </label>
                <span className="text-xs text-gray-600 font-medium">{selectedIds.size}개 선택됨</span>
                {selectedIds.size >= MAX_SELECT && <span className="text-[10px] text-red-500">최대 {MAX_SELECT}개</span>}
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input className="pl-7 h-7 text-xs" placeholder="검색..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
              </div>

              {selectedIds.size >= WARN_THRESHOLD && selectedIds.size < MAX_SELECT && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex-shrink-0">
                  <AlertTriangle size={12} className="flex-shrink-0" />
                  10개 이상 선택 시 처리 시간이 길어질 수 있습니다
                </div>
              )}

              <div className="flex-1 overflow-y-auto border rounded-md divide-y min-h-0">
                {filtered.map((feat: any) => {
                  const checked = selectedIds.has(feat.id)
                  const disabled = !checked && selectedIds.size >= MAX_SELECT
                  return (
                    <label key={feat.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded flex-shrink-0" checked={checked} disabled={disabled} onChange={() => toggleFeature(feat.id)} />
                      <span className="font-mono text-[#5E6AD2] flex-shrink-0">{feat.code}</span>
                      <span className="truncate text-gray-700">{feat.title.length > 30 ? feat.title.slice(0, 30) + '...' : feat.title}</span>
                    </label>
                  )
                })}
                {filtered.length === 0 && <div className="py-8 text-center text-xs text-gray-400">항목이 없습니다</div>}
              </div>

              <p className="text-[10px] text-gray-400 flex-shrink-0">✓ 확정 항목 중 미생성 건만 표시</p>
            </div>

            {/* 오른쪽: 설정 */}
            <div className="flex-1 flex flex-col p-4 gap-3">
              {aiStatus?.models && aiStatus.models.length > 0 && (
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">AI 모델</label>
                  <select className="border rounded-md px-2 h-7 text-xs w-full text-gray-600" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                    <option value="">자동 선택</option>
                    {aiStatus.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
              )}

              <div className="flex-1 flex flex-col gap-1 min-h-0">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-gray-600">추가 정보 <span className="text-gray-400 font-normal">(선택)</span></label>
                  <div className="relative">
                    <button type="button" onClick={() => setShowTemplate(p => !p)} className="text-[10px] text-[#5E6AD2] hover:underline">📋 템플릿</button>
                    {showTemplate && (
                      <div className="absolute right-0 top-5 z-10 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px]">
                        {TEMPLATES.map(t => (
                          <button key={t.label} onClick={() => { setAdditionalInfo(t.value); setShowTemplate(false) }}
                            className="block w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50">{t.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <textarea
                  className="flex-1 min-h-[80px] border rounded-md px-2 py-1.5 text-xs text-gray-700 resize-none placeholder:text-gray-300"
                  placeholder="AI가 더 정확하게 생성할 수 있도록 추가 요건이나 제약 조건을 입력해 주세요."
                  value={additionalInfo}
                  onChange={e => setAdditionalInfo(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleClose}>취소</Button>
                <Button size="sm" className="h-7 text-xs" disabled={selectedIds.size === 0} disabledReason="항목을 선택하세요" onClick={handleGenerate}>
                  AI 생성 →
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="py-8 text-center">
            <AIProgressBar isActive={generateMutation.isPending} type="generate" />
            {generateMutation.isError && (
              <div className="mt-4 text-sm text-red-600">
                생성 중 오류가 발생했습니다.
                <Button variant="outline" size="sm" className="ml-2 h-7 text-xs" onClick={() => generateMutation.mutate()}>재시도</Button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-1 min-h-0">
            {/* 왼쪽: 결과 목록 */}
            <div className="flex-1 border-r flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto border-b min-h-0">
                {grouped.map(([featureId, group]) => (
                  <div key={featureId}>
                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b sticky top-0 z-10">
                      <span className="text-xs font-medium">
                        <span className="text-[#5E6AD2] font-mono">{group.code}</span>
                        <span className="text-gray-600 ml-1.5">{group.title.length > 25 ? group.title.slice(0, 25) + '...' : group.title}</span>
                        <span className="text-[10px] text-gray-400 ml-1">({group.items.length})</span>
                      </span>
                      <button onClick={() => toggleGroupAll(featureId)} className="text-[10px] text-gray-500 hover:text-[#5E6AD2]">
                        {group.items.every(i => i._selected) ? '해제' : '선택'}
                      </button>
                    </div>
                    <div className="divide-y">
                      {group.items.map(item => (
                        <div key={item._idx} onClick={() => toggleResult(item._idx)}
                          className={`flex items-start gap-2 px-3 py-2 cursor-pointer ${item._selected ? 'bg-blue-50/30' : 'opacity-50'}`}>
                          <div className="mt-0.5 flex-shrink-0">
                            {item._selected ? <CheckSquare size={14} className="text-[#5E6AD2]" /> : <Square size={14} className="text-gray-300" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{item.title}</p>
                            {item.description && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 오른쪽: 선택 관리 + 액션 */}
            <div className="w-[220px] flex-shrink-0 flex flex-col p-4 gap-3 overflow-y-auto">
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">선택 관리</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>선택됨</span>
                    <span className="font-medium text-[#5E6AD2]">{selectedCount}개</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>전체</span>
                    <span>{results.length}개</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-[#5E6AD2] rounded-full transition-all" style={{ width: results.length > 0 ? `${(selectedCount / results.length) * 100}%` : '0%' }} />
                  </div>
                </div>
              </div>
              <button onClick={toggleAllResults} className="text-[11px] text-[#5E6AD2] hover:underline text-left">
                {results.every(r => r._selected) ? '전체 해제' : '전체 선택'}
              </button>

              

              <div className="mt-auto space-y-2">
                <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => { setStep(1); setResults([]) }}>← 다시 선택</Button>
                <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={handleClose}>취소</Button>
                <Button size="sm" className="w-full h-7 text-xs"
                  disabled={selectedCount === 0 || saving}
                  disabledReason={saving ? '저장 중...' : '항목을 선택하세요'}
                  onClick={handleSave}>
                  {saving ? '저장 중...' : `${selectedCount}개 저장`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
