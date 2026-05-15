import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Square, Search, AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AIProgressBar } from './AIProgressBar'
import apiClient from '@/api/client'
import { aiStatusApi } from '@/api/admin.api'
import { requirementApi } from '@/api/requirement.api'
import { testApi } from '@/api/test.api'

const TEMPLATES = [
  { label: '테스트 환경', value: '테스트 환경: \n선행 조건: \n제외 시나리오: \n참고사항: ' },
  { label: '테스트 범위', value: '우선순위 높은 기능: \n엣지 케이스: \n성능 기준: ' },
]

interface GeneratedScenario {
  title: string
  description?: string
  type?: string
  testType?: string
  _requirementCode: string
  _requirementTitle: string
  _requirementId: string
  _selected?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
}

const MAX_SELECT = 20
const WARN_THRESHOLD = 10

export function MultiScenarioGenerateModal({ open, onClose, projectId }: Props) {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [results, setResults] = useState<GeneratedScenario[]>([])
  const [saving, setSaving] = useState(false)
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [showTemplate, setShowTemplate] = useState(false)
  const [detailLevel, setDetailLevel] = useState(5)

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId),
    enabled: !!projectId && open,
  })

  const { data: reqResult } = useQuery({
    queryKey: ['requirements-confirmed-no-scenarios', projectId],
    queryFn: () => requirementApi.list(projectId!, { limit: 500, status: 'confirmed' }),
    enabled: !!projectId && open,
  })

  const { data: existingScenarioResult } = useQuery({
    queryKey: ['scenarios-req-filter', projectId],
    queryFn: () => testApi.listScenarios(projectId!, { limit: 2000 }),
    enabled: !!projectId && open,
  })

  const reqIdsWithScenarios = useMemo(() =>
    new Set((existingScenarioResult?.data ?? []).filter((s: any) => s.reqId).map((s: any) => s.reqId)),
    [existingScenarioResult]
  )

  const filtered = useMemo(() => {
    const reqs = (reqResult?.data ?? []).filter((r: any) => !reqIdsWithScenarios.has(r.id))
    if (!searchFilter) return reqs
    const q = searchFilter.toLowerCase()
    return reqs.filter((r: any) => r.code.toLowerCase().includes(q) || r.title.toLowerCase().includes(q))
  }, [reqResult, reqIdsWithScenarios, searchFilter])

  const toggleFeature = (id: string) => {    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else if (next.size < MAX_SELECT) { next.add(id) }
      return next
    })
  }

  const generateMutation = useMutation({
    mutationFn: () => {
      const body = { requirementIds: [...selectedIds], modelId: selectedModel || undefined, additionalInfo: additionalInfo || undefined, detailLevel };

      return apiClient.post(`/projects/${projectId}/ai/generate-test-scenarios-multi-for-requirements`, body).then(r => r.data);
    },
    onSuccess: (data: any) => {
      if (Array.isArray(data)) {
        setResults(data.filter((item: any) => item.title).map((item: any) => ({ ...item, _selected: true })))
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

  const toggleGroupAll = (requirementId: string) => {
    const group = results.filter(r => r._requirementId === requirementId)
    const allSelected = group.every(r => r._selected)
    setResults(prev => prev.map(item => item._requirementId === requirementId ? { ...item, _selected: !allSelected } : item))
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
        if (!item.title) continue
        await testApi.createScenario(projectId, {
          title: item.title,
          description: item.description || undefined,
          reqId: item._requirementId || undefined,
          type: item.type || 'system',
          testType: item.testType || 'functional',
          status: 'draft',
        })
      }
      qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
      qc.invalidateQueries({ queryKey: ['scenarios-req-filter', projectId] })
      qc.invalidateQueries({ queryKey: ['requirements-confirmed-no-scenarios', projectId] })
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
    setDetailLevel(5)
    onClose()
  }

  const grouped = useMemo(() => {
    const map: Record<string, { code: string; title: string; items: (GeneratedScenario & { _idx: number })[] }> = {}
    results.forEach((r, idx) => {
      if (!map[r._requirementId]) {
        map[r._requirementId] = { code: r._requirementCode, title: r._requirementTitle, items: [] }
      }
      map[r._requirementId].items.push({ ...r, _idx: idx })
    })
    return Object.entries(map)
  }, [results])

  const selectedCount = results.filter(r => r._selected).length

  return (
    <Modal open={open} onClose={handleClose} title="다중 AI 테스트 시나리오 생성" className="max-w-2xl">
      <div className="flex flex-col max-h-[calc(85vh-8rem)]">
        <div className="flex items-center gap-2 text-[11px] text-gray-400 border-b pb-2 flex-shrink-0">
          <span className={step === 1 ? 'text-[#5E6AD2] font-semibold' : ''}>1. 기능 선택</span>
          <span>→</span>
          <span className={step === 2 ? 'text-[#5E6AD2] font-semibold' : ''}>2. AI 생성</span>
          <span>→</span>
          <span className={step === 3 ? 'text-[#5E6AD2] font-semibold' : ''}>3. 결과 확인</span>
        </div>

        {step === 1 && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 pt-3">
              <div className="relative">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input className="pl-7 h-7 text-xs" placeholder="기능 검색..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox"
                    checked={filtered.length > 0 && filtered.every((f: any) => selectedIds.has(f.id))}
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
                {selectedIds.size >= MAX_SELECT && <span className="text-[10px] text-red-500 font-medium">최대 {MAX_SELECT}개까지 선택 가능</span>}
              </div>

              {selectedIds.size >= WARN_THRESHOLD && selectedIds.size < MAX_SELECT && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                  <AlertTriangle size={12} className="flex-shrink-0" />
                  10개 이상 선택 시 AI 처리 시간이 길어질 수 있습니다
                </div>
              )}

              <p className="text-[10px] text-gray-400">✓ 확정(confirmed) 요구사항 중 시나리오가 없는 항목만 표시</p>
              <div className="border rounded-md divide-y">
                {filtered.map((feat: any) => {
                  const checked = selectedIds.has(feat.id)
                  const disabled = !checked && selectedIds.size >= MAX_SELECT
                  return (
                    <label key={feat.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={checked} disabled={disabled} onChange={() => toggleFeature(feat.id)} />
                      <span className="font-mono text-[#5E6AD2] flex-shrink-0">{feat.code}</span>
                      <span className="truncate text-gray-700">{feat.title.length > 40 ? feat.title.slice(0, 40) + '...' : feat.title}</span>
                    </label>
                  )
                })}
                {filtered.length === 0 && (
                  <div className="py-6 text-center text-xs text-gray-400">확정된 요구사항이 없거나 모든 요구사항에 테스트 시나리오가 이미 생성되었습니다</div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-gray-100 pt-3 mt-2 space-y-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-gray-600">상세도</label>
                  <span className="text-[10px] text-gray-400">
                    {detailLevel <= 3 ? '간략 (핵심만)' : detailLevel <= 7 ? '보통 (권장)' : '상세 (엣지케이스 포함)'}
                  </span>
                </div>
                <div className="flex gap-1.5 mb-1">
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
                <div className="flex justify-between text-[9px] text-gray-400 px-0.5">
                  <span>1개</span><span>10개</span><span>20개</span>
                </div>
              </div>
              {aiStatus?.models && aiStatus.models.length > 0 && (
                <select className="border rounded-md px-2 h-7 text-xs w-full text-gray-600" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                  <option value="">AI 모델 자동 선택</option>
                  {aiStatus.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              )}
              <div className="space-y-1">
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
                <textarea className="w-full border rounded-md px-2 py-1.5 text-xs text-gray-700 resize-none placeholder:text-gray-300"
                  rows={2} placeholder="AI가 더 정확하게 생성할 수 있도록 추가 요건이나 제약 조건을 입력해 주세요."
                  value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleClose}>취소</Button>
                <Button size="sm" className="h-7 text-xs" disabled={selectedIds.size === 0} disabledReason="기능을 선택하세요" onClick={handleGenerate}>다음</Button>
              </div>
            </div>
          </>
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
          <>
            <div className="flex items-center justify-between pt-3 pb-2 flex-shrink-0">
              <p className="text-xs text-gray-600">{results.length}개 생성됨 · {selectedCount}개 선택</p>
              <button onClick={toggleAllResults} className="text-[11px] text-[#5E6AD2] hover:underline">
                {results.every(r => r._selected) ? '전체 해제' : '전체 선택'}
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
              {grouped.map(([requirementId, group]) => (
                <div key={requirementId}>
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b sticky top-0">
                    <span className="text-xs font-medium">
                      <span className="text-[#5E6AD2] font-mono">{group.code}</span>
                      <span className="text-gray-600 ml-1.5">{group.title.length > 30 ? group.title.slice(0, 30) + '...' : group.title}</span>
                      <span className="text-[10px] text-gray-400 ml-1">({group.items.length})</span>
                    </span>
                    <button onClick={() => toggleGroupAll(requirementId)} className="text-[10px] text-gray-500 hover:text-[#5E6AD2]">
                      {group.items.every(i => i._selected) ? '해제' : '선택'}
                    </button>
                  </div>
                  <div className="divide-y">
                    {group.items.map(item => (
                      <div key={item._idx} onClick={() => toggleResult(item._idx)}
                        className={`flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors ${item._selected ? 'bg-blue-50/50' : 'opacity-50'}`}>
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

            <div className="flex-shrink-0 border-t border-gray-100 pt-3 mt-2 flex justify-between items-center">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setStep(1); setResults([]) }}>이전</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleClose}>취소</Button>
                <Button size="sm" className="h-7 text-xs" disabled={selectedCount === 0 || saving}
                  disabledReason={saving ? '저장 중...' : '항목을 선택하세요'} onClick={handleSave}>
                  {saving ? '저장 중...' : `${selectedCount}개 저장`}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
