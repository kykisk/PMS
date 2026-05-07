import { useState, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { featureApi, type FeaturePayload } from '@/api/feature.api'
import { RequirementPickerModal } from '@/components/shared/RequirementPickerModal'
import { aiStatusApi } from '@/api/admin.api'
import { designApi } from '@/api/design.api'
import { Pagination } from '@/components/shared/Pagination'
import { AISuggestButton } from '@/components/shared/AISuggestButton'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { Badge } from '@/components/shared/Badge'
import AppLayout from '@/components/layout/AppLayout'
import { TraceIndicator } from '@/components/shared/TraceIndicator'

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  reqId: z.string().optional(),
  status: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STATUSES = ['new', 'review', 'confirmed', 'changed']

export default function FeatureListPage() {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [showReqPicker, setShowReqPicker] = useState(false)
  const [selectedReq, setSelectedReq] = useState<{ id: string; code: string; title: string } | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [allExpanded, setAllExpanded] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAllSelect = () => {
    setSelected(prev => prev.size === features.length ? new Set() : new Set(features.map(i => i.id)))
  }

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId!),
    enabled: !!projectId,
  })

  const { data: result, isLoading } = useQuery({
    queryKey: ['features', projectId, search, filterStatus, page],
    queryFn: () => featureApi.list(projectId!, { search: search || undefined, status: filterStatus || undefined, page }),
    enabled: !!projectId,
  })
  const features = result?.data ?? []

  const { data: allDbTables = [] } = useQuery({
    queryKey: ['design-db', projectId],
    queryFn: () => designApi.listDbTables(projectId!),
    enabled: !!projectId,
  })
  const { data: allApiSpecs = [] } = useQuery({
    queryKey: ['design-api', projectId],
    queryFn: () => designApi.listApiSpecs(projectId!),
    enabled: !!projectId,
  })

  const createMutation = useMutation({
    mutationFn: (data: FeaturePayload) => featureApi.create(projectId!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['features', projectId] }); setShowCreate(false); reset() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FeaturePayload> }) => featureApi.update(projectId!, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['features', projectId] }); setEditTarget(null); reset() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => featureApi.remove(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['features', projectId] }),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => featureApi.remove(projectId!, id)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['features', projectId] })
      setSelected(new Set())
    },
  })

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'new' },
  })

  const openEdit = (f: any) => {
    setEditTarget(f.id)
    setValue('title', f.title)
    setValue('description', f.description ?? '')
    setValue('reqId', f.reqId ?? '')
    setValue('status', f.status)
    setSelectedReq(f.requirement ? { id: f.requirement.id, code: f.requirement.code, title: f.requirement.title } : null)
    setShowCreate(true)
  }

  const onSubmit = (data: FormData) => {
    if (editTarget) updateMutation.mutate({ id: editTarget, data })
    else createMutation.mutate(data)
  }

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-800">{t('nav.features')}</h2>
          <Button size="sm" className="h-7 text-xs px-2" onClick={() => { setEditTarget(null); reset({ status: 'new' }); setShowCreate(true) }}>
            <Plus size={12} />
            {t('common.create')}
          </Button>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input className="pl-7 h-7 text-xs" placeholder={t('common.search')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()) }} />
          </div>
          <select className="border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); setSelected(new Set()) }}>
            <option value="">상태 전체</option>
            {STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
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
              onClick={() => { if (confirm(`전체 ${features.length}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate(features.map(i => i.id)) }}
              className="text-xs px-2 py-0.5 border border-red-400 text-red-600 rounded hover:bg-red-50"
            >전체 삭제</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">취소</button>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-lg border p-6">
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : features.length === 0 ? (
          <div className="bg-white rounded-lg border">
            <EmptyState message="기능이 없습니다. 새로 생성해보세요." />
          </div>
        ) : (() => {
          const grouped: Record<string, { req: { code: string; title: string } | null; features: typeof features }> = {}
          features.forEach(f => {
            const key = f.requirement?.id || '__none__'
            if (!grouped[key]) grouped[key] = { req: f.requirement ? { code: f.requirement.code, title: f.requirement.title } : null, features: [] }
            grouped[key].features.push(f)
          })
          const groups = Object.entries(grouped).sort(([a], [b]) => a === '__none__' ? 1 : b === '__none__' ? -1 : 0)

          const toggleGroup = (key: string) => setExpandedGroups(prev => ({ ...prev, [key]: !(prev[key] ?? allExpanded) }))
          const toggleAll = () => {
            const next = !allExpanded
            setAllExpanded(next)
            setExpandedGroups({})
          }
          const isExpanded = (key: string) => expandedGroups[key] ?? allExpanded

          return (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b">
              <span className="text-[11px] text-gray-500 font-medium">{groups.length}개 그룹 · {features.length}개 기능</span>
              <button onClick={toggleAll} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#5E6AD2]">
                {allExpanded ? <><ChevronsDownUp size={12} />전체 접기</> : <><ChevronsUpDown size={12} />전체 펼치기</>}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-2 py-1.5">
                    <input type="checkbox"
                      checked={features.length > 0 && selected.size === features.length}
                      onChange={toggleAllSelect}
                      className="w-3.5 h-3.5"
                    />
                  </th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">코드</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">기능명</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">Task</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">상태</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">연결</th>
                  <th className="w-16 px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([key, group]) => (
                  <Fragment key={key}>
                    <tr className="bg-gray-50/50 border-b cursor-pointer hover:bg-gray-100/50" onClick={() => toggleGroup(key)}>
                      <td colSpan={7} className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          {isExpanded(key) ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                          <span className="text-xs font-medium text-[#5E6AD2]">
                            {group.req ? `${group.req.code} - ${group.req.title.length > 30 ? group.req.title.slice(0, 30) + '...' : group.req.title}` : '미연결'}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-1">({group.features.length})</span>
                        </div>
                      </td>
                    </tr>
                    {isExpanded(key) && group.features.map(f => (
                      <tr key={f.id} className="border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200" onClick={() => navigate(`/projects/${projectId}/features/${f.id}`)}>
                        <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox"
                            checked={selected.has(f.id)}
                            onChange={() => toggleSelect(f.id)}
                            className="w-3.5 h-3.5"
                          />
                        </td>
                        <td className="px-3 py-1.5 pl-8 font-mono text-xs text-gray-500">{f.code}</td>
                        <td className="px-3 py-1.5 font-medium">
                          <span className="truncate block max-w-[200px]" title={f.title}>{f.title.length > 25 ? f.title.slice(0, 25) + '...' : f.title}</span>
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 text-xs">{f.tasks?.length ?? 0}</td>
                        <td className="px-3 py-1.5"><Badge value={f.status} label={t(`status.${f.status}`)} /></td>
                        <td className="px-3 py-1.5">
                          <TraceIndicator
                            upper={[
                              { count: f.requirement ? 1 : 0, label: 'REQ', colorClass: 'bg-blue-100 text-blue-600' },
                            ]}
                            lower={[
                              { count: f.tasks?.length ?? 0, label: 'Task', colorClass: 'bg-amber-100 text-amber-700' },
                              { count: (allDbTables as any[]).filter(d => d.featureId === f.id).length, label: 'DB', colorClass: 'bg-green-100 text-green-700' },
                              { count: (allApiSpecs as any[]).filter(a => a.featureId === f.id).length, label: 'API', colorClass: 'bg-cyan-100 text-cyan-700' },
                            ]}
                          />
                        </td>
                        <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(f)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={12} /></button>
                            <button onClick={() => { if (confirm('삭제?')) deleteMutation.mutate(f.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          )
        })()}
        <Pagination page={page} totalPages={result?.totalPages ?? 1} total={result?.total ?? 0} limit={50} onChange={setPage} />
      </div>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setEditTarget(null); reset() }} title={editTarget ? '기능 수정' : '기능 생성'} className="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>기능명 *</Label>
              <AISuggestButton projectId={projectId!} context={watch('title') || ''} type="기능명" disabled={!aiStatus?.configured} onResult={text => setValue('title', text)} />
            </div>
            <Input {...register('title')} placeholder="회원가입 폼 화면" />
          </div>
          <div className="space-y-1">
            <Label>연결 요구사항</Label>
            <div
              className="w-full border rounded-md px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 flex items-center justify-between"
              onClick={() => setShowReqPicker(true)}
            >
              {selectedReq?.id ? (
                <span className="text-gray-800 truncate">{selectedReq.code} - {selectedReq.title.length > 25 ? selectedReq.title.slice(0, 25) + '...' : selectedReq.title}</span>
              ) : (
                <span className="text-gray-400">클릭하여 요구사항 선택...</span>
              )}
              <Search size={12} className="text-gray-400 flex-shrink-0" />
            </div>
            <input type="hidden" {...register('reqId')} />
          </div>
          <div className="space-y-1">
            <Label>상태</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" {...register('status')}>
              {STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>설명</Label>
              <AISuggestButton projectId={projectId!} context={`기능명: ${watch('title') || ''}`} type="기능 상세설명" disabled={!aiStatus?.configured} label="AI 설명 생성" onResult={text => setValue('description', text)} />
            </div>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={3} {...register('description')} placeholder="기능 상세 설명" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setEditTarget(null); reset() }}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} disabledReason="처리 중입니다...">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <RequirementPickerModal
        open={showReqPicker}
        onClose={() => setShowReqPicker(false)}
        projectId={projectId!}
        selected={selectedReq?.id}
        onSelect={(req) => {
          setSelectedReq(req.id ? req : null)
          setValue('reqId', req.id || '')
        }}
      />
    </AppLayout>
  )
}
