import { useState, useEffect, useRef, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2, Download, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Sparkles } from 'lucide-react'
import { testApi } from '@/api/test.api'
import { requirementApi } from '@/api/requirement.api'
import { exportApi } from '@/api/export.api'
import { aiStatusApi } from '@/api/admin.api'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import AppLayout from '@/components/layout/AppLayout'
import { TraceIndicator } from '@/components/shared/TraceIndicator'
import { FeatureScenarioUpdateModal } from '@/components/shared/FeatureScenarioUpdateModal'
import { MultiScenarioGenerateModal } from '@/components/shared/MultiScenarioGenerateModal'

const STATUSES = ['draft', 'ready', 'in_progress', 'completed']
const STATUS_LABELS: Record<string, string> = { draft: '초안', ready: '준비', in_progress: '진행중', completed: '완료' }

const TYPE_BADGE: Record<string, string> = {
  functional: 'bg-blue-100 text-blue-700',
  performance: 'bg-green-100 text-green-700',
  security: 'bg-red-100 text-red-700',
  usability: 'bg-purple-100 text-purple-700',
  compatibility: 'bg-orange-100 text-orange-700',
}
const TYPE_LABEL: Record<string, string> = {
  functional: '기능', performance: '성능', security: '보안', usability: '사용성', compatibility: '호환성',
}


export default function TestListPage() {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterTestType, setFilterTestType] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', testData: '', reqId: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [allExpanded, setAllExpanded] = useState(true)
  const [updateTarget, setUpdateTarget] = useState<{ id: string; code: string; title: string } | null>(null)
  const [showMultiGen, setShowMultiGen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [panelEditing, setPanelEditing] = useState(false)
  const [panelEditForm, setPanelEditForm] = useState<any>({})
  const [panelWidthPct, setPanelWidthPct] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const panelContainerRef = useRef<HTMLDivElement>(null)

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAllSelect = () => {
    setSelected(prev => prev.size === scenarios.length ? new Set() : new Set(scenarios.map(i => i.id)))
  }
  const toggleGroupSelect = (ids: string[]) => {
    setSelected(prev => {
      const allSelected = ids.every(id => prev.has(id))
      const next = new Set(prev)
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  const { data: result, isLoading } = useQuery({
    queryKey: ['scenarios', projectId, search, filterTestType],
    queryFn: () => testApi.listScenarios(projectId!, { search: search || undefined, testType: filterTestType || undefined, limit: 2000 }),
    enabled: !!projectId,
  })
  const scenarios = result?.data ?? []
  const { data: aiStatus } = useQuery({ queryKey: ['ai-status', projectId], queryFn: () => aiStatusApi.check(projectId!), enabled: !!projectId })
  const { data: reqResult = undefined } = useQuery({ queryKey: ['requirements', projectId], queryFn: () => requirementApi.list(projectId!, { limit: 500 }), enabled: !!projectId, staleTime: 5 * 60 * 1000 })
  const requirements = reqResult?.data ?? []

  const { data: selectedItem } = useQuery({
    queryKey: ['scenario', projectId, selectedItemId],
    queryFn: () => testApi.getScenario(projectId!, selectedItemId!),
    enabled: !!selectedItemId && !!projectId,
  })

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedItemId(null); setPanelEditing(false); setPanelWidthPct(50) }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      if (!panelContainerRef.current) return
      const rect = panelContainerRef.current.getBoundingClientRect()
      const newPct = ((rect.right - e.clientX) / rect.width) * 100
      setPanelWidthPct(Math.max(20, Math.min(95, newPct)))
    }
    const handleMouseUp = () => setIsDragging(false)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const createMutation = useMutation({
    mutationFn: () => testApi.createScenario(projectId!, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scenarios', projectId] }); setShowCreate(false); setForm({ title: '', description: '', testData: '', reqId: '' }) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => testApi.removeScenario(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios', projectId] }),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => testApi.removeScenario(projectId!, id)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
      setSelected(new Set())
    },
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await Promise.all(ids.map(id => testApi.updateScenario(projectId!, id, { status })))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
      setSelected(new Set())
    },
  })

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-gray-800">{t('nav.tests')}</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => exportApi.testPlan(projectId!)}><Download size={12} />계획서 Excel</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => exportApi.testPlanPdf(projectId!)}><Download size={12} />계획서 PDF</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => exportApi.testResultPivot(projectId!)}><Download size={12} />결과서 Excel</Button>
            {aiStatus?.configured && (
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setShowMultiGen(true)}>
                <Sparkles size={12} />AI 시나리오 생성
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs px-2" onClick={() => setShowCreate(true)}><Plus size={12} />{t('common.create')}</Button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input className="pl-7 h-7 text-xs" placeholder={t('common.search')} value={search} onChange={e => { setSearch(e.target.value); setSelected(new Set()) }} />
              </div>
              <select className="border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]" value={filterTestType} onChange={e => { setFilterTestType(e.target.value); setSelected(new Set()) }}>
                <option value="">유형 전체</option>
                <option value="functional">기능</option>
                <option value="performance">성능</option>
                <option value="security">보안</option>
                <option value="usability">사용성</option>
                <option value="compatibility">호환성</option>
              </select>
            </div>

            {selected.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg mb-2">
                <span className="text-xs text-blue-700 font-medium">{selected.size}개 선택됨</span>
                <select className="h-7 text-xs border rounded px-2" defaultValue="" onChange={e => {
                  const status = e.target.value
                  if (!status) return
                  if (confirm(`선택한 ${selected.size}개를 "${STATUS_LABELS[status]}"으로 변경하시겠습니까?`)) {
                    bulkStatusMutation.mutate({ ids: [...selected], status })
                  }
                  e.target.value = ''
                }}>
                  <option value="">상태변경...</option>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                <button
                  onClick={() => { if (confirm(`선택한 ${selected.size}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate([...selected]) }}
                  className="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
                >선택 삭제</button>
                <button
                  onClick={() => { if (confirm(`전체 ${scenarios.length}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate(scenarios.map(i => i.id)) }}
                  className="text-xs px-2 py-0.5 border border-red-400 text-red-600 rounded hover:bg-red-50"
                >전체 삭제</button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">취소</button>
              </div>
            )}

            {isLoading ? (
              <div className="bg-white rounded-lg border p-6">
                <TableSkeleton rows={5} cols={6} />
              </div>
            ) : scenarios.length === 0 ? (
              <div className="bg-white rounded-lg border">
                <EmptyState message="테스트 시나리오가 없습니다. 새로 생성해보세요." />
              </div>
            ) : (() => {
              const grouped: Record<string, { label: string; code: string; scenarios: typeof scenarios }> = {}
              scenarios.forEach(s => {
                const req = (s as any).requirement || (s as any).feature?.requirement || null
                const key = req?.id || '__none__'
                const label = req ? req.title : '미연결'
                const code = req?.code ?? ''
                if (!grouped[key]) grouped[key] = { label, code, scenarios: [] }
                grouped[key].scenarios.push(s)
              })
              const groups = Object.entries(grouped).sort(([a, ga], [b, gb]) => {
            if (a === '__none__') return 1
            if (b === '__none__') return -1
            return ga.code.localeCompare(gb.code)
          })
              const isExpanded = (key: string) => expandedGroups[key] ?? allExpanded
              const toggleGroup = (key: string) => setExpandedGroups(prev => ({ ...prev, [key]: !(prev[key] ?? allExpanded) }))
              const toggleExpandAll = () => { setAllExpanded(v => !v); setExpandedGroups({}) }
              const groupLabel = '요구사항'

              return (
              <div ref={panelContainerRef} className="relative" style={{ userSelect: isDragging ? 'none' : 'auto' }}>
              <div className="w-full">
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b">
                  <span className="text-[11px] text-gray-500 font-medium">{groups.length}개 {groupLabel} · {scenarios.length}개 시나리오</span>
                  <button onClick={toggleExpandAll} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#5E6AD2]">
                    {allExpanded ? <><ChevronsDownUp size={12} />전체 접기</> : <><ChevronsUpDown size={12} />전체 펼치기</>}
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="w-8 px-2 py-1.5">
                        <input type="checkbox"
                          checked={scenarios.length > 0 && selected.size === scenarios.length}
                          onChange={toggleAllSelect}
                          className="w-3.5 h-3.5"
                        />
                      </th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">코드</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">시나리오명</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-16">유형</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-16">케이스</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">결과</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">연결</th>
                      <th className="w-20 px-3 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(([key, group]) => (
                      <Fragment key={key}>
                         <tr className="bg-gray-50/50 border-b cursor-pointer hover:bg-gray-100/50" onClick={() => toggleGroup(key)}>
                           <td className="px-2 py-1.5 w-8" onClick={e => e.stopPropagation()}>
                             <input type="checkbox"
                               className="w-3.5 h-3.5"
                               checked={group.scenarios.length > 0 && group.scenarios.every(s => selected.has(s.id))}
                               ref={el => { if (el) el.indeterminate = group.scenarios.some(s => selected.has(s.id)) && !group.scenarios.every(s => selected.has(s.id)) }}
                               onChange={() => toggleGroupSelect(group.scenarios.map(s => s.id))}
                             />
                           </td>
                           <td colSpan={7} className="px-3 py-1.5">
                             <div className="flex items-center gap-2">
                               {isExpanded(key) ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                               {group.code && <span className="font-mono text-[10px] text-gray-400">{group.code}</span>}
                               <span className="text-xs font-medium text-[#5E6AD2]">
                                 {group.label.length > 40 ? group.label.slice(0, 40) + '...' : group.label}
                               </span>
                                <span className="text-[10px] text-gray-400">({group.scenarios.length})</span>
                              </div>
                           </td>
                         </tr>
                        {isExpanded(key) && group.scenarios.map(s => {
                          const cases = s.testCases ?? []
                          const passed = cases.filter((c: any) => c.result === 'pass').length
                          const failed = cases.filter((c: any) => c.result === 'fail').length
                          return (
                            <tr key={s.id} className={`border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${selectedItemId === s.id ? 'bg-[#5E6AD2]/5' : ''}`} onClick={() => setSelectedItemId(prev => prev === s.id ? null : s.id)}>
                              <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                                <input type="checkbox"
                                  checked={selected.has(s.id)}
                                  onChange={() => toggleSelect(s.id)}
                                  className="w-3.5 h-3.5"
                                />
                              </td>
                              <td className="px-3 py-1.5 pl-8 font-mono text-xs text-gray-500">{s.code}</td>
                              <td className="px-3 py-1.5 font-medium">
                                <span className="truncate block max-w-[200px]" title={s.title}>{s.title.length > 20 ? s.title.slice(0, 20) + '...' : s.title}{(s as any).outdated && <span title={(s as any).outdatedReason || '상위 변경됨'} className="text-amber-500 ml-1 text-[10px]">⚠️</span>}</span>
                              </td>
                              <td className="px-3 py-1.5 text-xs">
                                <span className={`px-2 py-0.5 rounded ${TYPE_BADGE[(s as any).testType] || 'bg-gray-100 text-gray-600'}`}>
                                  {TYPE_LABEL[(s as any).testType] || (s as any).testType || '-'}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-gray-500">{s._count?.testCases ?? 0}</td>
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-2 text-xs">
                                  {cases.length > 0 ? <>
                                    <span className="text-green-600">{passed}✅</span>
                                    <span className="text-red-600">{failed}❌</span>
                                    <span className="text-gray-400">{cases.length - passed - failed}⬜</span>
                                  </> : <span className="text-gray-400">-</span>}
                                </div>
                              </td>
                              <td className="px-3 py-1.5">
                                <TraceIndicator
                                  upper={[
                                    { count: s.feature ? 1 : 0, label: '기능', colorClass: 'bg-purple-100 text-purple-600' },
                                  ]}
                                  lower={[
                                    { count: s._count?.testCases ?? s.testCases?.length ?? 0, label: 'TC', colorClass: 'bg-green-100 text-green-700' },
                                  ]}
                                />
                              </td>
                              <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                                <div className="flex gap-1">
                                  <button onClick={() => { if (confirm('삭제?')) deleteMutation.mutate(s.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>

              {selectedItemId && selectedItem && (
                <div
                  className="fixed right-0 top-0 bottom-0 z-50 bg-white border-l border-gray-200 shadow-2xl flex flex-col overflow-y-auto"
                  style={{ width: `${panelWidthPct}%`, minHeight: '400px' }}
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 hover:bg-[#5E6AD2]/30 transition-colors ${isDragging ? 'bg-[#5E6AD2]/40' : ''}`}
                    onMouseDown={e => { e.preventDefault(); setIsDragging(true) }}
                  />
                  <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50 flex-shrink-0">
                    <span className="text-xs font-bold text-gray-800">시나리오 상세</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPanelWidthPct(50)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${Math.round(panelWidthPct) === 50 ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                          title="절반"
                        >½</button>
                        <button
                          onClick={() => setPanelWidthPct(75)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${Math.round(panelWidthPct) === 75 ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                          title="3/4"
                        >¾</button>
                        <button
                          onClick={() => setPanelWidthPct(95)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${panelWidthPct >= 90 ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                          title="전체"
                        >⊡</button>
                      </div>
                      {!panelEditing ? (
                        <button onClick={() => { setPanelEditForm({ title: selectedItem.title, description: (selectedItem as any).description ?? '', status: (selectedItem as any).status ?? 'draft' }); setPanelEditing(true) }}
                          className="text-xs px-2 py-0.5 rounded border border-[#5E6AD2] text-[#5E6AD2] hover:bg-[#5E6AD2]/5">편집</button>
                      ) : (
                        <>
                          <button onClick={async () => {
                            await testApi.updateScenario(projectId!, selectedItemId!, panelEditForm)
                            qc.invalidateQueries({ queryKey: ['scenario', projectId, selectedItemId] })
                            qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
                            setPanelEditing(false)
                          }} className="text-xs px-2 py-0.5 rounded bg-[#5E6AD2] text-white hover:bg-[#4f5bb8]">저장</button>
                          <button onClick={() => setPanelEditing(false)} className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500">취소</button>
                        </>
                      )}
                      <button onClick={() => { setSelectedItemId(null); setPanelEditing(false); setPanelWidthPct(50) }} className="text-gray-400 hover:text-gray-600 ml-1">✕</button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 text-xs flex-1">
                    <div>
                      <span className="text-gray-400 block mb-0.5">코드</span>
                      <p className="font-mono text-[#5E6AD2]">{selectedItem.code}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">제목</span>
                      {panelEditing
                        ? <input className="w-full border rounded px-2 py-1 text-xs" value={panelEditForm.title} onChange={e => setPanelEditForm((f: any) => ({ ...f, title: e.target.value }))} />
                        : <p className="font-medium text-gray-800">{selectedItem.title}</p>}
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">설명</span>
                      {panelEditing
                        ? <textarea className="w-full border rounded px-2 py-1 text-xs resize-none" rows={3} value={panelEditForm.description} onChange={e => setPanelEditForm((f: any) => ({ ...f, description: e.target.value }))} />
                        : <p className="text-gray-600 whitespace-pre-wrap">{(selectedItem as any).description || '-'}</p>}
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">테스트 유형</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${TYPE_BADGE[(selectedItem as any).testType] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABEL[(selectedItem as any).testType] || (selectedItem as any).testType || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">상태</span>
                      {panelEditing
                        ? <select className="w-full border rounded px-2 py-1 text-xs" value={panelEditForm.status} onChange={e => setPanelEditForm((f: any) => ({ ...f, status: e.target.value }))}>
                            <option value="draft">초안</option><option value="ready">준비</option><option value="in_progress">진행중</option><option value="completed">완료</option>
                          </select>
                        : <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${(selectedItem as any).status === 'completed' ? 'bg-green-100 text-green-700' : (selectedItem as any).status === 'ready' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>{STATUS_LABELS[(selectedItem as any).status] || (selectedItem as any).status}</span>}
                    </div>

                    {((selectedItem as any).requirement || (selectedItem as any).feature?.requirement) && (
                      <div className="border-t pt-2">
                        <span className="text-gray-500 font-medium block mb-1">연결 요구사항</span>
                        <div className="flex items-center gap-2 text-[11px] py-0.5">
                          <span className="font-mono text-gray-400">{((selectedItem as any).requirement || (selectedItem as any).feature?.requirement)?.code}</span>
                          <span className="text-gray-600 truncate">{((selectedItem as any).requirement || (selectedItem as any).feature?.requirement)?.title}</span>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-2">
                      <span className="text-gray-500 font-medium block mb-1">케이스 수</span>
                      <p className="text-gray-700">{selectedItem._count?.testCases ?? 0}건</p>
                    </div>
                  </div>

                  <div className="px-4 pb-3 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/projects/${projectId}/tests/${selectedItemId}`)}
                      className="w-full text-center text-xs py-1.5 border border-[#5E6AD2] text-[#5E6AD2] rounded hover:bg-[#5E6AD2]/5 transition-colors"
                    >
                      상세 페이지로 이동
                    </button>
                  </div>
                </div>
              )}
              </div>
              )
            })()}
        <div className="py-3 text-center text-[11px] text-gray-400">
          {scenarios.length > 0 ? `총 ${scenarios.length}개` : ''}
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="테스트 시나리오 생성" className="max-w-lg">
        <div className="space-y-3">
          <div className="space-y-1"><Label>시나리오명 *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="정상 로그인 시나리오" /></div>
          <div className="space-y-1">
            <Label>테스트 데이터</Label>
            <Input value={form.testData} onChange={e => setForm(f => ({ ...f, testData: e.target.value }))} placeholder="선택 입력" />
          </div>
          <div className="space-y-1">
            <Label>연결 요구사항</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.reqId} onChange={e => setForm(f => ({ ...f, reqId: e.target.value }))}>
              <option value="">선택 안 함</option>
              {requirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.title}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>설명</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button disabled={!form.title || createMutation.isPending} disabledReason={!form.title ? "필수 항목을 입력하세요" : "처리 중입니다..."} onClick={() => createMutation.mutate()}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>

      {updateTarget && (
        <FeatureScenarioUpdateModal
          open={!!updateTarget}
          onClose={() => setUpdateTarget(null)}
          projectId={projectId!}
          feature={updateTarget}
        />
      )}
      <MultiScenarioGenerateModal open={showMultiGen} onClose={() => setShowMultiGen(false)} projectId={projectId!} />
    </AppLayout>
  )
}
