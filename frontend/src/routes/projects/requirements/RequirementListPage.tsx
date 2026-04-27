import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, FileUp, Sparkles, RefreshCw, Download, ChevronDown } from 'lucide-react'
import { requirementApi, type RequirementPayload } from '@/api/requirement.api'
import { exportApi } from '@/api/export.api'
import { aiStatusApi } from '@/api/admin.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { Badge } from '@/components/shared/Badge'
import AppLayout from '@/components/layout/AppLayout'
import { ExcelImportModal } from '@/components/shared/ExcelImportModal'
import { SpecImportModal } from '@/components/shared/SpecImportModal'
import { Pagination } from '@/components/shared/Pagination'
import { AISuggestButton } from '@/components/shared/AISuggestButton'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'


const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  note: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const PRIORITIES = ['high', 'medium', 'low']
const STATUSES = ['new', 'review', 'confirmed', 'changed', 'deleted']

export default function RequirementListPage() {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showSpecImport, setShowSpecImport] = useState(false)
  const [showSpecUpdate, setShowSpecUpdate] = useState(false)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId!),
    enabled: !!projectId,
  })

  const { data: result, isLoading } = useQuery({
    queryKey: ['requirements', projectId, search, filterStatus, filterPriority, page],
    queryFn: () => requirementApi.list(projectId!, {
      search: search || undefined,
      status: filterStatus || undefined,
      priority: filterPriority || undefined,
      page,
    }),
    enabled: !!projectId,
  })
  const requirements = result?.data ?? []

  const createMutation = useMutation({
    mutationFn: (data: RequirementPayload) => requirementApi.create(projectId!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requirements', projectId] }); setShowCreate(false); reset() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RequirementPayload> }) =>
      requirementApi.update(projectId!, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requirements', projectId] }); setEditTarget(null); reset() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => requirementApi.remove(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requirements', projectId] }),
  })

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'medium', status: 'new' },
  })

  const openEdit = (req: any) => {
    setEditTarget(req.id)
    setValue('title', req.title)
    setValue('description', req.description ?? '')
    setValue('category', req.category ?? '')
    setValue('priority', req.priority)
    setValue('status', req.status)
    setValue('note', req.note ?? '')
  }

  const onSubmit = (data: FormData) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget, data })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{t('nav.requirements')}</h2>
          <div className="flex gap-2">
            <div className="relative group">
              <Button variant="outline">
                <Download size={16} />
                내보내기
                <ChevronDown size={14} />
              </Button>
              <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-40 bg-white border rounded-lg shadow-lg z-20 py-1">
                <button onClick={() => exportApi.requirements(projectId!)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                  <Download size={14} />
                  Excel
                </button>
                <button onClick={() => exportApi.requirementsPdf(projectId!)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                  <Download size={14} />
                  PDF
                </button>
              </div>
            </div>
            <div className="relative group">
              <Button variant="outline">
                <FileUp size={16} />
                가져오기
                <ChevronDown size={14} />
              </Button>
              <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-20 py-1">
                <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                  <FileUp size={14} />
                  엑셀 Import
                </button>
                <button onClick={() => setShowSpecImport(true)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                  <Sparkles size={14} />
                  AI 기술서 Import
                </button>
                <button onClick={() => setShowSpecUpdate(true)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                  <RefreshCw size={14} />
                  AI 업데이트
                </button>
              </div>
            </div>
            <Button onClick={() => { setEditTarget(null); reset({ priority: 'medium', status: 'new' }); setShowCreate(true) }}>
              <Plus size={16} />
              {t('common.create')}
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <Input
              className="pl-8"
              placeholder={t('common.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">상태 전체</option>
            {STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
          >
            <option value="">우선순위 전체</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg border p-6">
            <TableSkeleton rows={5} cols={7} />
          </div>
        ) : requirements.length === 0 ? (
          <div className="bg-white rounded-lg border">
            <EmptyState message="요구사항이 없습니다. 새로 생성해보세요." />
          </div>
        ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">분류</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">요구사항명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">우선순위</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">상태</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">입력경로</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {requirements.map(req => (
                  <tr
                    key={req.id}
                    className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/projects/${projectId}/requirements/${req.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{req.code}</td>
                    <td className="px-4 py-3 text-gray-600">{req.category ?? '-'}</td>
                    <td className="px-4 py-3 font-medium">{req.title}</td>
                    <td className="px-4 py-3"><Badge value={req.priority} label={t(`priority.${req.priority}`)} /></td>
                    <td className="px-4 py-3"><Badge value={req.status} label={t(`status.${req.status}`)} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{req.source}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { openEdit(req); setShowCreate(true) }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(req.id) }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        )}
        <Pagination
          page={page}
          totalPages={result?.totalPages ?? 1}
          total={result?.total ?? 0}
          limit={50}
          onChange={p => setPage(p)}
        />
      </div>

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditTarget(null); reset() }}
        title={editTarget ? '요구사항 수정' : '요구사항 생성'}
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>요구사항명 *</Label>
              <AISuggestButton
                projectId={projectId!}
                context={watch('title') || ''}
                type="요구사항명"
                disabled={!aiStatus?.configured}
                onResult={text => setValue('title', text)}
              />
            </div>
            <Input {...register('title')} placeholder="SSO 로그인" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>분류</Label>
              <Input {...register('category')} placeholder="인증" />
            </div>
            <div className="space-y-1">
              <Label>우선순위</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" {...register('priority')}>
                {PRIORITIES.map(p => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>상태</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" {...register('status')}>
              {STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>상세설명</Label>
              <AISuggestButton
                projectId={projectId!}
                context={`요구사항명: ${watch('title') || ''}\n분류: ${watch('category') || ''}`}
                type="요구사항 상세설명"
                disabled={!aiStatus?.configured}
                label="AI 설명 생성"
                onResult={text => setValue('description', text)}
              />
            </div>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm resize-none"
              rows={3}
              {...register('description')}
              placeholder="요구사항 상세 내용"
            />
          </div>
          <div className="space-y-1">
            <Label>비고</Label>
            <Input {...register('note')} placeholder="참고사항" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setEditTarget(null); reset() }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <ExcelImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        projectId={projectId!}
        queryKey={['requirements', projectId ?? '']}
      />

      <SpecImportModal
        open={showSpecImport}
        onClose={() => setShowSpecImport(false)}
        projectId={projectId!}
        queryKey={['requirements', projectId ?? '']}
        mode="initial"
      />

      <SpecImportModal
        open={showSpecUpdate}
        onClose={() => setShowSpecUpdate(false)}
        projectId={projectId!}
        queryKey={['requirements', projectId ?? '']}
        mode="update"
      />
    </AppLayout>
  )
}
