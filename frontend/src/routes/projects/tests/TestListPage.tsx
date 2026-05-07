import { useState, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2, Download, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { testApi } from '@/api/test.api'
import { requirementApi } from '@/api/requirement.api'
import { featureApi } from '@/api/feature.api'
import { exportApi } from '@/api/export.api'
import { Pagination } from '@/components/shared/Pagination'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import AppLayout from '@/components/layout/AppLayout'
import { TraceIndicator } from '@/components/shared/TraceIndicator'


export default function TestListPage() {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', type: 'integration', testData: '', reqId: '', featureId: '' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [allExpanded, setAllExpanded] = useState(true)

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAllSelect = () => {
    setSelected(prev => prev.size === scenarios.length ? new Set() : new Set(scenarios.map(i => i.id)))
  }

  const { data: result = undefined, isLoading } = useQuery({
    queryKey: ['scenarios', projectId, search, filterType, page],
    queryFn: () => testApi.listScenarios(projectId!, { search: search || undefined, type: filterType || undefined, page }),
    enabled: !!projectId,
  })
  const scenarios = result?.data ?? []
  const { data: reqResult = undefined } = useQuery({ queryKey: ['requirements', projectId], queryFn: () => requirementApi.list(projectId!), enabled: !!projectId })
  const requirements = reqResult?.data ?? []
  const { data: featureResult = undefined } = useQuery({ queryKey: ['features', projectId], queryFn: () => featureApi.list(projectId!), enabled: !!projectId })
  const features = featureResult?.data ?? []

  const createMutation = useMutation({
    mutationFn: () => testApi.createScenario(projectId!, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scenarios', projectId] }); setShowCreate(false); setForm({ title: '', description: '', type: 'integration', testData: '', reqId: '', featureId: '' }) },
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

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-800">{t('nav.tests')}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => exportApi.testPlan(projectId!)}><Download size={12} />계획서 Excel</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => exportApi.testPlanPdf(projectId!)}><Download size={12} />계획서 PDF</Button>
            <Button size="sm" className="h-7 text-xs px-2" onClick={() => setShowCreate(true)}><Plus size={12} />{t('common.create')}</Button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input className="pl-7 h-7 text-xs" placeholder={t('common.search')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()) }} />
          </div>
          <select className="border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); setSelected(new Set()) }}>
            <option value="">유형 전체</option>
            <option value="unit">단위</option>
            <option value="integration">통합</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md mb-2">
            <span className="text-xs text-red-600 font-medium">{selected.size}개 선택됨</span>
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
          const grouped: Record<string, { req: { id: string; code: string; title: string } | null; scenarios: typeof scenarios }> = {}
          scenarios.forEach(s => {
            const req = (s as any).requirement || (s as any).feature?.requirement || null
            const key = req?.id || '__none__'
            if (!grouped[key]) grouped[key] = { req, scenarios: [] }
            grouped[key].scenarios.push(s)
          })
          const groups = Object.entries(grouped).sort(([a], [b]) => a === '__none__' ? 1 : b === '__none__' ? -1 : 0)
          const isExpanded = (key: string) => expandedGroups[key] ?? allExpanded
          const toggleGroup = (key: string) => setExpandedGroups(prev => ({ ...prev, [key]: !(prev[key] ?? allExpanded) }))
          const toggleExpandAll = () => { setAllExpanded(v => !v); setExpandedGroups({}) }

          return (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b">
              <span className="text-[11px] text-gray-500 font-medium">{groups.length}개 요구사항 · {scenarios.length}개 시나리오</span>
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
                      <td colSpan={8} className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          {isExpanded(key) ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                          <span className="text-xs font-medium text-[#5E6AD2]">
                            {group.req ? `${group.req.code} - ${group.req.title.length > 35 ? group.req.title.slice(0, 35) + '...' : group.req.title}` : '미연결'}
                          </span>
                          <span className="text-[10px] text-gray-400">({group.scenarios.length})</span>
                        </div>
                      </td>
                    </tr>
                    {isExpanded(key) && group.scenarios.map(s => {
                      const cases = s.testCases ?? []
                      const passed = cases.filter(c => c.result === 'pass').length
                      const failed = cases.filter(c => c.result === 'fail').length
                      return (
                        <tr key={s.id} className="border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200" onClick={() => navigate(`/projects/${projectId}/tests/${s.id}`)}>
                          <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                            <input type="checkbox"
                              checked={selected.has(s.id)}
                              onChange={() => toggleSelect(s.id)}
                              className="w-3.5 h-3.5"
                            />
                          </td>
                          <td className="px-3 py-1.5 pl-8 font-mono text-xs text-gray-500">{s.code}</td>
                          <td className="px-3 py-1.5 font-medium">
                            <span className="truncate block max-w-[200px]" title={s.title}>{s.title.length > 20 ? s.title.slice(0, 20) + '...' : s.title}</span>
                          </td>
                          <td className="px-3 py-1.5 text-xs">
                            <span className={`px-2 py-0.5 rounded ${s.type === 'unit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {s.type === 'unit' ? '단위' : '통합'}
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
          )
        })()}
        <Pagination page={page} totalPages={result?.totalPages ?? 1} total={result?.total ?? 0} limit={50} onChange={setPage} />
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="테스트 시나리오 생성" className="max-w-lg">
        <div className="space-y-3">
          <div className="space-y-1"><Label>시나리오명 *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="정상 로그인 시나리오" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>유형</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="integration">통합</option>
                <option value="unit">단위</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>테스트 데이터</Label>
              <Input value={form.testData} onChange={e => setForm(f => ({ ...f, testData: e.target.value }))} placeholder="선택 입력" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>연결 요구사항</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.reqId} onChange={e => setForm(f => ({ ...f, reqId: e.target.value }))}>
              <option value="">선택 안 함</option>
              {requirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.title}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>연결 기능</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.featureId} onChange={e => setForm(f => ({ ...f, featureId: e.target.value }))}>
              <option value="">선택 안 함</option>
              {features.map(f => <option key={f.id} value={f.id}>{f.code} - {f.title}</option>)}
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
    </AppLayout>
  )
}
