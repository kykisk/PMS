import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Search } from 'lucide-react'
import { testApi, type Defect } from '@/api/test.api'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import AppLayout from '@/components/layout/AppLayout'

const STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'verified', 'closed', 'reopened']
const SEVERITIES = ['critical', 'major', 'minor', 'trivial']
const PRIORITIES = ['high', 'medium', 'low']

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-red-50 text-red-600',
  assigned: 'bg-orange-50 text-orange-600',
  in_progress: 'bg-blue-50 text-blue-600',
  resolved: 'bg-purple-50 text-purple-600',
  verified: 'bg-indigo-50 text-indigo-600',
  closed: 'bg-green-50 text-green-600',
  reopened: 'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  open: '오픈', assigned: '할당됨', in_progress: '처리중',
  resolved: '해결됨', verified: '검증됨', closed: '종료', reopened: '재오픈',
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 font-bold',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-yellow-100 text-yellow-700',
  trivial: 'bg-gray-100 text-gray-500',
}
const SEVERITY_LABEL: Record<string, string> = { critical: '치명적', major: '주요', minor: '경미', trivial: '사소' }

const PRIORITY_LABEL: Record<string, string> = { high: '높음', medium: '중간', low: '낮음' }

const SUMMARY_BADGES: { key: string; label: string; cls: string }[] = [
  { key: 'open', label: '오픈', cls: 'bg-red-100 text-red-700' },
  { key: 'in_progress', label: '처리중', cls: 'bg-blue-100 text-blue-700' },
  { key: 'resolved', label: '해결됨', cls: 'bg-purple-100 text-purple-700' },
  { key: 'closed', label: '종료', cls: 'bg-green-100 text-green-700' },
]

interface CreateForm {
  title: string
  description: string
  severity: string
  priority: string
}

export default function DefectListPage() {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: result, isLoading } = useQuery({
    queryKey: ['defects', projectId, filterStatus, filterSeverity, filterPriority, search],
    queryFn: () => testApi.listDefects(projectId!, {
      status: filterStatus || undefined,
      severity: filterSeverity || undefined,
      priority: filterPriority || undefined,
      search: search || undefined,
      limit: 200,
    }),
    enabled: !!projectId,
  })
  const defects: Defect[] = useMemo(() => result?.data ?? [], [result])

  const statusCounts = useMemo(() =>
    defects.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc }, {} as Record<string, number>),
    [defects]
  )

  const createMutation = useMutation({
    mutationFn: (data: Partial<Defect>) => testApi.createDefect(projectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['defects', projectId] })
      setShowCreate(false)
      reset()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => testApi.removeDefect(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defects', projectId] }),
  })

  const { register, handleSubmit, reset } = useForm<CreateForm>({
    defaultValues: { severity: 'major', priority: 'medium' },
  })

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = () => setSelected(prev => prev.size === defects.length ? new Set() : new Set(defects.map(d => d.id)))

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate(data)
  }

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-800">{t('nav.defects')}</h2>
          <Button size="sm" className="h-7 text-xs px-2" onClick={() => { reset({ severity: 'major', priority: 'medium' }); setShowCreate(true) }}>
            <Plus size={12} />결함 등록
          </Button>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          {SUMMARY_BADGES.map(b => (
            <span key={b.key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${b.cls}`}>
              {b.label} <span className="font-bold">{statusCounts[b.key] || 0}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
            전체 <span className="font-bold">{defects.length}</span>
          </span>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input className="pl-7 h-7 text-xs" placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">상태 전체</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select className="border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
            <option value="">심각도 전체</option>
            {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
          </select>
          <select className="border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">우선순위 전체</option>
            {PRIORITIES.map(s => <option key={s} value={s}>{PRIORITY_LABEL[s]}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg border p-6">
            <TableSkeleton rows={5} cols={8} />
          </div>
        ) : defects.length === 0 ? (
          <div className="bg-white rounded-lg border">
            <EmptyState message="결함이 없습니다. 새로 등록해보세요." />
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-2 py-1.5">
                    <input type="checkbox" checked={defects.length > 0 && selected.size === defects.length} onChange={toggleAll} className="w-3.5 h-3.5" />
                  </th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">코드</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">제목</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">심각도</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">우선순위</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">상태</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">담당자</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">등록일</th>
                  <th className="w-12 px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {defects.map(defect => (
                  <tr
                    key={defect.id}
                    className="border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                    onClick={() => navigate(`/projects/${projectId}/defects/${defect.id}`)}
                  >
                    <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(defect.id)} onChange={() => toggleSelect(defect.id)} className="w-3.5 h-3.5" />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{defect.code}</td>
                    <td className="px-3 py-1.5 font-medium">
                      <span className="truncate block max-w-[240px]" title={defect.title}>
                        {defect.title.length > 30 ? defect.title.slice(0, 30) + '...' : defect.title}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs ${SEVERITY_BADGE[defect.severity] || 'bg-gray-100 text-gray-500'}`}>
                        {SEVERITY_LABEL[defect.severity] || defect.severity}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="text-xs text-gray-600">{PRIORITY_LABEL[defect.priority] || defect.priority}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[defect.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[defect.status] || defect.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">{defect.assigneeId ? defect.assigneeId.slice(0, 6) : '-'}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-400">
                      {new Date(defect.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                    </td>
                    <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(defect.id) }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <span className="text-xs">✕</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 text-[11px] text-gray-400 border-t bg-gray-50">
              총 {defects.length}개
            </div>
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); reset() }} title="결함 등록" className="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>제목 *</Label>
            <Input {...register('title', { required: true })} placeholder="로그인 시 500 에러 발생" />
          </div>
          <div className="space-y-1">
            <Label>설명</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={3} {...register('description')} placeholder="재현 절차 및 기대 결과..." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>심각도</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" {...register('severity')}>
                {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>우선순위</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" {...register('priority')}>
                {PRIORITIES.map(s => <option key={s} value={s}>{PRIORITY_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowCreate(false); reset() }}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={createMutation.isPending} disabledReason="처리 중입니다...">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
