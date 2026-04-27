import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2, Download } from 'lucide-react'
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

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{t('nav.tests')}</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportApi.testPlan(projectId!)}><Download size={16} />계획서 Excel</Button>
            <Button variant="outline" onClick={() => exportApi.testPlanPdf(projectId!)}><Download size={16} />계획서 PDF</Button>
            <Button onClick={() => setShowCreate(true)}><Plus size={16} />{t('common.create')}</Button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <Input className="pl-8" placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border rounded-md px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">유형 전체</option>
            <option value="unit">단위</option>
            <option value="integration">통합</option>
          </select>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg border p-6">
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : scenarios.length === 0 ? (
          <div className="bg-white rounded-lg border">
            <EmptyState message="테스트 시나리오가 없습니다. 새로 생성해보세요." />
          </div>
        ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">코드</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">시나리오명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-16">유형</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-16">케이스</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">결과</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map(s => {
                  const cases = s.testCases ?? []
                  const passed = cases.filter(c => c.result === 'pass').length
                  const failed = cases.filter(c => c.result === 'fail').length
                  return (
                    <tr key={s.id} className="border-b hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/projects/${projectId}/tests/${s.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.code}</td>
                      <td className="px-4 py-3 font-medium">{s.title}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded ${s.type === 'unit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {s.type === 'unit' ? '단위' : '통합'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s._count?.testCases ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs">
                          {cases.length > 0 ? <>
                            <span className="text-green-600">{passed}✅</span>
                            <span className="text-red-600">{failed}❌</span>
                            <span className="text-gray-400">{cases.length - passed - failed}⬜</span>
                          </> : <span className="text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button onClick={() => { if (confirm('삭제?')) deleteMutation.mutate(s.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
        )}
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
            <Button disabled={!form.title || createMutation.isPending} onClick={() => createMutation.mutate()}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
