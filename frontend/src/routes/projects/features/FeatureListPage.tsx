import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { featureApi, type FeaturePayload } from '@/api/feature.api'
import { requirementApi } from '@/api/requirement.api'
import { aiStatusApi } from '@/api/admin.api'
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

  const { data: reqResult } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: () => requirementApi.list(projectId!),
    enabled: !!projectId,
  })
  const requirements = reqResult?.data ?? []

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
    setShowCreate(true)
  }

  const onSubmit = (data: FormData) => {
    if (editTarget) updateMutation.mutate({ id: editTarget, data })
    else createMutation.mutate(data)
  }

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{t('nav.features')}</h2>
          <Button onClick={() => { setEditTarget(null); reset({ status: 'new' }); setShowCreate(true) }}>
            <Plus size={16} />
            {t('common.create')}
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <Input className="pl-8" placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border rounded-md px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">상태 전체</option>
            {STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg border p-6">
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : features.length === 0 ? (
          <div className="bg-white rounded-lg border">
            <EmptyState message="기능이 없습니다. 새로 생성해보세요." />
          </div>
        ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">코드</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">기능명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">연결 요구사항</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">Task 수</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">상태</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {features.map(f => (
                  <tr key={f.id} className="border-b hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/projects/${projectId}/features/${f.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{f.code}</td>
                    <td className="px-4 py-3 font-medium">{f.title}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{f.requirement?.code ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{f.tasks?.length ?? 0}</td>
                    <td className="px-4 py-3"><Badge value={f.status} label={t(`status.${f.status}`)} /></td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(f)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                        <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(f.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        )}
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
            <select className="w-full border rounded-md px-3 py-2 text-sm" {...register('reqId')}>
              <option value="">선택 안 함</option>
              {requirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.title}</option>)}
            </select>
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
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{t('common.save')}</Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
