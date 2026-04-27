import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, AlertTriangle, Download } from 'lucide-react'
import { taskApi, type TaskPayload } from '@/api/task.api'
import { featureApi } from '@/api/feature.api'
import { exportApi } from '@/api/export.api'
import { aiStatusApi } from '@/api/admin.api'
import { Pagination } from '@/components/shared/Pagination'
import { AISuggestButton } from '@/components/shared/AISuggestButton'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'

import AppLayout from '@/components/layout/AppLayout'

const schema = z.object({
  title: z.string().min(1),
  featureId: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STATUSES = ['pending', 'in_progress', 'completed', 'on_hold']
const STATUS_LABELS: Record<string, string> = { pending: '대기', in_progress: '진행중', completed: '완료', on_hold: '보류' }

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{value}%</span>
    </div>
  )
}

export default function TaskListPage() {
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
    queryKey: ['tasks', projectId, search, filterStatus, page],
    queryFn: () => taskApi.list(projectId!, { search: search || undefined, status: filterStatus || undefined, page }),
    enabled: !!projectId,
  })
  const tasks = result?.data ?? []

  const { data: featureResult } = useQuery({
    queryKey: ['features', projectId],
    queryFn: () => featureApi.list(projectId!),
    enabled: !!projectId,
  })
  const features = featureResult?.data ?? []

  const createMutation = useMutation({
    mutationFn: (data: TaskPayload) => taskApi.create(projectId!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); setShowCreate(false); reset() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaskPayload> }) => taskApi.update(projectId!, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); setEditTarget(null); reset() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => taskApi.remove(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'pending', progress: 0 },
  })

  const openEdit = (task: any) => {
    setEditTarget(task.id)
    setValue('title', task.title)
    setValue('featureId', task.featureId)
    setValue('description', task.description ?? '')
    setValue('assigneeId', task.assigneeId ?? '')
    setValue('progress', task.progress)
    setValue('startDate', task.startDate ? task.startDate.slice(0, 10) : '')
    setValue('endDate', task.endDate ? task.endDate.slice(0, 10) : '')
    setValue('status', task.status)
    setShowCreate(true)
  }

  const onSubmit = (data: FormData) => {
    if (editTarget) updateMutation.mutate({ id: editTarget, data })
    else createMutation.mutate(data as TaskPayload)
  }

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{t('nav.tasks')}</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportApi.wbs(projectId!)}><Download size={16} />WBS Excel</Button>
            <Button variant="outline" onClick={() => exportApi.wbsPdf(projectId!)}><Download size={16} />WBS PDF</Button>
            <Button onClick={() => { setEditTarget(null); reset({ status: 'pending', progress: 0 }); setShowCreate(true) }}>
              <Plus size={16} />{t('common.create')}
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <Input className="pl-8" placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border rounded-md px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">상태 전체</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg border p-6">
            <TableSkeleton rows={5} cols={8} />
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-lg border">
            <EmptyState message="Task가 없습니다. 새로 생성해보세요." />
          </div>
        ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">기능</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Task명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">진척율</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">일정</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">상태</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-12">⚠️</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                  <tr key={task.id} className="border-b hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{task.code}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[7rem]">{task.feature?.code}</td>
                    <td className="px-4 py-3 font-medium">{task.title}</td>
                    <td className="px-4 py-3"><ProgressBar value={task.progress} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {task.startDate ? new Date(task.startDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${task.status === 'completed' ? 'bg-green-100 text-green-700' : task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : task.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[task.status] || task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(task._count?.issues ?? 0) > 0 && (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <AlertTriangle size={13} />
                          <span className="text-xs">{task._count!.issues}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(task)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                        <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(task.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
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

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setEditTarget(null); reset() }} title={editTarget ? 'Task 수정' : 'Task 생성'} className="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Task명 *</Label>
              <AISuggestButton projectId={projectId!} context={watch('title') || ''} type="개발 Task명" disabled={!aiStatus?.configured} onResult={text => setValue('title', text)} />
            </div>
            <Input {...register('title')} placeholder="회원가입 UI 개발" />
          </div>
          <div className="space-y-1">
            <Label>기능 *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" {...register('featureId')}>
              <option value="">기능 선택</option>
              {features.map(f => <option key={f.id} value={f.id}>{f.code} - {f.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>상태</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" {...register('status')}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>진척율 (%)</Label>
              <Input type="number" min="0" max="100" {...register('progress', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>시작일</Label><Input type="date" {...register('startDate')} /></div>
            <div className="space-y-1"><Label>종료일</Label><Input type="date" {...register('endDate')} /></div>
          </div>
          <div className="space-y-1">
            <Label>설명</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={2} {...register('description')} />
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
