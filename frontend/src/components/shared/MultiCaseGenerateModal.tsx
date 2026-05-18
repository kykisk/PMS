import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Square, Search, AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AIProgressBar } from './AIProgressBar'
import apiClient from '@/api/client'
import { aiStatusApi } from '@/api/admin.api'
import { testApi } from '@/api/test.api'

const TEMPLATES = [
  { label: '테스트 환경', value: '테스트 환경: \n사전 조건: \n제외 케이스: ' },
  { label: '보안 관점', value: '보안 체크포인트: \n권한 검증: \n입력값 검증: ' },
]

interface GeneratedCase {
  title: string
  description?: string
  priority?: string
  steps?: any
  testData?: string
  expected?: string
  _scenarioId: string
  _scenarioCode: string
  _scenarioTitle: string
  _selected?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  preSelectedIds?: string[]
}

const MAX_SELECT = 20
const WARN_THRESHOLD = 10

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-yellow-50 text-yellow-600',
  low: 'bg-gray-100 text-gray-500',
}
const PRIORITY_LABEL: Record<string, string> = {
  high: '상', medium: '중', low: '하',
}

export function MultiCaseGenerateModal({ open, onClose, projectId, preSelectedIds }: Props) {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preSelectedIds ?? []))
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [results, setResults] = useState<GeneratedCase[]>([])
  const [saving, setSaving] = useState(false)
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [showTemplate, setShowTemplate] = useState(false)
  const [detailLevel, setDetailLevel] = useState(6)

  useState(() => {
    if (preSelectedIds && preSelectedIds.length > 0) {
      setSelectedIds(new Set(preSelectedIds))
    }
  })

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId),
    enabled: !!projectId && open,
  })

  const { data: scenarioResult } = useQuery({
    queryKey: ['scenarios', projectId],
    queryFn: () => testApi.listScenarios(projectId!, { limit: 2000 }),
    enabled: !!projectId && open,
  })

  const filtered = useMemo(() => {
    const scenarios = scenarioResult?.data ?? []
    if (!searchFilter) return scenarios
    const q = searchFilter.toLowerCase()
    return scenarios.filter((s: any) => s.code.toLowerCase().includes(q) || s.title.toLowerCase().includes(q))
  }, [scenarioResult, searchFilter])

  const toggleScenario = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else if (next.size < MAX_SELECT) { next.add(id) }
      return next
    })
  }

  const generateMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/projects/${projectId}/ai/generate-test-cases-multi`, {
        scenarioIds: [...selectedIds],
        modelId: selectedModel || undefined,
        additionalInfo: additionalInfo || undefined,
        detailLevel,
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

  const toggleGroupAll = (scenarioId: string) => {
    const group = results.filter(r => r._scenarioId === scenarioId)
    const allSelected = group.every(r => r._selected)
    setResults(prev => prev.map(item => item._scenarioId === scenarioId ? { ...item, _selected: !allSelected } : item))
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
        await testApi.createCase(projectId, item._scenarioId, {
          title: item.title,
          priority: item.priority ?? 'medium',
          steps: item.steps,
          testData: item.testData,
          expected: item.expected,
        } as any)
      }
      qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
      qc.invalidateQueries({ queryKey: ['scenarios-flat', projectId] })
      qc.invalidateQueries({ queryKey: ['scenario', projectId] })
      handleClose()
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setSelectedIds(new Set(preSelectedIds ?? []))
    setSearchFilter('')
    setSelectedModel('')
    setResults([])
    setAdditionalInfo('')
    setShowTemplate(false)
    setDetailLevel(6)
    onClose()
  }

  const grouped = useMemo(() => {
    const map: Record<string, { code: string; title: string; items: (GeneratedCase & { _idx: number })[] }> = {}
    results.forEach((r, idx) => {
      if (!map[r._scenarioId]) {
        map[r._scenarioId] = { code: r._scenarioCode, title: r._scenarioTitle, items: [] }
      }
      map[r._scenarioId].items.push({ ...r, _idx: idx })
    })
    return Object.entries(map)
  }, [results])

  const selectedCount = results.filter(r => r._selected).length

  return (
    <Modal open={open} onClose={handleClose} title="다중 AI 케이스 생성" className="max-w-4xl">
      <div className="flex flex-col max-h-[calc(85vh-4rem)]">
        <div className="flex items-center gap-2 text-[11px] text-gray-400 border-b pb-2 flex-shrink-0 px-1">
          <span className={step === 1 ? 'text-[#5E6AD2] font-semibold' : ''}>1. 시나리오 선택</span>
          <span>→</span>
          <span className={step === 2 ? 'text-[#5E6AD2] font-semibold' : ''}>2. AI 생성</span>
          <span>→</span>
          <span className={step === 3 ? 'text-[#5E6AD2] font-semibold' : ''}>3. 결과 확인</span>
        </div>

        {step === 1 && (
          <div className="flex flex-1 min-h-0">
            {/* 왼쪽: 시나리오 선택 목록 */}
            <div className="w-[55%] border-r flex flex-col p-4 gap-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={filtered.length > 0 && filtered.every((s: any) => selectedIds.has(s.id))}
                    onChange={() => {
                      const allSelected = filtered.every((s: any) => selectedIds.has(s.id))
                      if (allSelected) { setSelectedIds(new Set()) }
                      else { setSelectedIds(new Set(filtered.slice(0, MAX_SELECT).map((s: any) => s.id))) }
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
                <Input className="pl-7 h-7 text-xs" placeholder="제목/코드 검색..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
              </div>

              {selectedIds.size >= WARN_THRESHOLD && selectedIds.size < MAX_SELECT && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex-shrink-0">
                  <AlertTriangle size={12} className="flex-shrink-0" />
                  10개 이상 선택 시 처리 시간이 길어질 수 있습니다
                </div>
              )}

              <div className="flex-1 overflow-y-auto border rounded-md divide-y min-h-0">
                {filtered.map((s: any) => {
                  const checked = selectedIds.has(s.id)
                  const disabled = !checked && selectedIds.size >= MAX_SELECT
                  return (
                    <label key={s.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded flex-shrink-0" checked={checked} disabled={disabled} onChange={() => toggleScenario(s.id)} />
                      <span className="font-mono text-[#5E6AD2] flex-shrink-0">{s.code}</span>
                      <span className="truncate text-gray-700">{s.title.length > 30 ? s.title.slice(0, 30) + '...' : s.title}</span>
                      <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">{s._count?.testCases ?? 0}건</span>
                    </label>
                  )
                })}
                {filtered.length === 0 && <div className="py-8 text-center text-xs text-gray-400">시나리오가 없습니다</div>}
              </div>

              <p className="text-[10px] text-gray-400 flex-shrink-0">✓ 이미 케이스가 있는 시나리오도 선택 가능 (케이스 추가)</p>
            </div>

            {/* 오른쪽: 설정 */}
            <div className="flex-1 flex flex-col p-4 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-gray-600">상세도</label>
                  <span className="text-[10px] text-gray-400">
                    {detailLevel <= 3 ? '간략' : detailLevel <= 7 ? '보통' : '상세'} (~{detailLevel}개)
                  </span>
                </div>
                <div className="flex gap-1">
                  {[{ label: '간략', val: 3 }, { label: '보통', val: 6 }, { label: '상세', val: 12 }].map(p => (
                    <button key={p.val} onClick={() => setDetailLevel(p.val)}
                      className={`flex-1 text-[10px] py-0.5 rounded border transition-colors ${detailLevel === p.val ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]' : 'border-gray-200 text-gray-500 hover:border-[#5E6AD2]/50'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <input type="range" min={1} max={20} step={1} value={detailLevel}
                  onChange={e => setDetailLevel(Number(e.target.value))}
                  className="w-full accent-[#5E6AD2] h-1.5" />
              </div>
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
                  placeholder="AI가 더 정확하게 케이스를 생성할 수 있도록 추가 요건이나 제약 조건을 입력해 주세요."
                  value={additionalInfo}
                  onChange={e => setAdditionalInfo(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 mt-auto flex-shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleClose}>취소</Button>
                <Button size="sm" className="h-7 text-xs" disabled={selectedIds.size === 0} disabledReason="시나리오를 선택하세요" onClick={handleGenerate}>
                  AI 케이스 생성 →
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
            {/* 왼쪽: 시나리오별 그룹핑된 케이스 목록 */}
            <div className="flex-1 border-r flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto border-b min-h-0">
                {grouped.map(([scenarioId, group]) => (
                  <div key={scenarioId}>
                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b sticky top-0 z-10">
                      <span className="text-xs font-medium">
                        <span className="text-[#5E6AD2] font-mono">{group.code}</span>
                        <span className="text-gray-600 ml-1.5">{group.title.length > 25 ? group.title.slice(0, 25) + '...' : group.title}</span>
                        <span className="text-[10px] text-gray-400 ml-1">({group.items.length}개)</span>
                      </span>
                      <button onClick={() => toggleGroupAll(scenarioId)} className="text-[10px] text-gray-500 hover:text-[#5E6AD2]">
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
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] px-1 rounded flex-shrink-0 ${PRIORITY_BADGE[item.priority ?? 'medium']}`}>
                                {PRIORITY_LABEL[item.priority ?? 'medium']}
                              </span>
                              <p className="text-xs font-medium text-gray-800 truncate">{item.title}</p>
                            </div>
                            {item.expected && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">기대: {item.expected}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 오른쪽: 선택 통계 + 버튼 */}
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
