import { useState, useMemo, Fragment, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, AlertTriangle, Download, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Sparkles } from 'lucide-react'
import { taskApi, type TaskPayload } from '@/api/task.api'
import { featureApi } from '@/api/feature.api'
import { projectApi } from '@/api/project.api'
import { exportApi } from '@/api/export.api'
import { aiStatusApi } from '@/api/admin.api'
import { AISuggestButton } from '@/components/shared/AISuggestButton'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'

import AppLayout from '@/components/layout/AppLayout'
import { TraceIndicator } from '@/components/shared/TraceIndicator'
import { GanttView } from '@/components/shared/GanttView'
import { FeatureTaskUpdateModal } from '@/components/shared/FeatureTaskUpdateModal'
import { MultiTaskGenerateModal } from '@/components/shared/MultiTaskGenerateModal'

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [allExpanded, setAllExpanded] = useState(true)
  const [viewTab, setViewTab] = useState<'list' | 'gantt'>('list')
  const [ganttSelectedTask, setGanttSelectedTask] = useState<any>(null)
  const [ganttEditing, setGanttEditing] = useState(false)
  const [ganttEditForm, setGanttEditForm] = useState<any>({})
  const [depTargetId, setDepTargetId] = useState('')
  const [depType, setDepType] = useState('FS')
  const [updateTarget, setUpdateTarget] = useState<{ id: string; code: string; title: string; status: string } | null>(null)
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
    setSelected(prev => prev.size === tasks.length ? new Set() : new Set(tasks.map(i => i.id)))
  }
  const toggleGroupSelect = (ids: string[]) => {
    setSelected(prev => {
      const allSelected = ids.every(id => prev.has(id))
      const next = new Set(prev)
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId!),
    enabled: !!projectId,
  })

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['tasks', projectId, search, filterStatus],
    queryFn: ({ pageParam }) => taskApi.list(projectId!, { search: search || undefined, status: filterStatus || undefined, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (last: any) => last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: !!projectId,
  })
  const tasks = useMemo(() => infiniteData?.pages.flatMap((p: any) => p.data) ?? [], [infiniteData])

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
    }, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const { data: featureResult } = useQuery({
    queryKey: ['features', projectId],
    queryFn: () => featureApi.list(projectId!),
    enabled: !!projectId,
  })
  const features = featureResult?.data ?? []

  const { data: allTasksResult } = useQuery({
    queryKey: ['tasks-all', projectId],
    queryFn: () => taskApi.list(projectId!, { limit: 500 }),
    enabled: !!projectId && viewTab === 'gantt',
  })
  const allTasks = useMemo(() => allTasksResult?.data ?? [], [allTasksResult])

  const { data: selectedItem } = useQuery({
    queryKey: ['task', projectId, selectedItemId],
    queryFn: () => taskApi.get(projectId!, selectedItemId!),
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

  const { data: dependencies = [] } = useQuery({
    queryKey: ['task-deps', projectId],
    queryFn: () => taskApi.listDependencies(projectId!),
    enabled: !!projectId && viewTab === 'gantt',
  })

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId && viewTab === 'gantt',
  })

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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => taskApi.remove(projectId!, id)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      setSelected(new Set())
    },
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await Promise.all(ids.map(id => taskApi.update(projectId!, id, { status })))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      setSelected(new Set())
    },
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
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-800">{t('nav.tasks')}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => exportApi.wbs(projectId!)}><Download size={12} />WBS Excel</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => exportApi.wbsPdf(projectId!)}><Download size={12} />WBS PDF</Button>
            {aiStatus?.configured && (
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setShowMultiGen(true)}>
                <Sparkles size={12} />AI Task 생성
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs px-2" onClick={() => { setEditTarget(null); reset({ status: 'pending', progress: 0 }); setShowCreate(true) }}>
              <Plus size={12} />{t('common.create')}
            </Button>
          </div>
        </div>

        <div className="flex border-b mb-3">
          <button onClick={() => setViewTab('list')} className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${viewTab === 'list' ? 'border-[#5E6AD2] text-[#5E6AD2]' : 'border-transparent text-gray-500'}`}>목록</button>
          <button onClick={() => setViewTab('gantt')} className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${viewTab === 'gantt' ? 'border-[#5E6AD2] text-[#5E6AD2]' : 'border-transparent text-gray-500'}`}>간트</button>
        </div>

        {viewTab === 'list' && (<>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input className="pl-7 h-7 text-xs" placeholder={t('common.search')} value={search} onChange={e => { setSearch(e.target.value); setSelected(new Set()) }} />
          </div>
          <select className="border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setSelected(new Set()) }}>
            <option value="">상태 전체</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
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
              onClick={() => { if (confirm(`전체 ${tasks.length}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate(tasks.map(i => i.id)) }}
              className="text-xs px-2 py-0.5 border border-red-400 text-red-600 rounded hover:bg-red-50"
            >전체 삭제</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">취소</button>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-lg border p-6">
            <TableSkeleton rows={5} cols={8} />
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-lg border">
            <EmptyState message="Task가 없습니다. 새로 생성해보세요." />
          </div>
        ) : (() => {
          const grouped: Record<string, { feature: { id: string; code: string; title: string } | null; tasks: typeof tasks }> = {}
          tasks.forEach(t => {
            const key = t.feature?.id || '__none__'
            if (!grouped[key]) grouped[key] = { feature: t.feature ? { id: t.feature.id, code: t.feature.code, title: t.feature.title } : null, tasks: [] }
            grouped[key].tasks.push(t)
          })
          const groups = Object.entries(grouped).sort(([a], [b]) => a === '__none__' ? 1 : b === '__none__' ? -1 : 0)
          const isExpanded = (key: string) => expandedGroups[key] ?? allExpanded
          const toggleGroup = (key: string) => setExpandedGroups(prev => ({ ...prev, [key]: !(prev[key] ?? allExpanded) }))
          const toggleExpandAll = () => { setAllExpanded(v => !v); setExpandedGroups({}) }

          return (
          <div ref={panelContainerRef} className="relative" style={{ userSelect: isDragging ? 'none' : 'auto' }}>
          <div className="w-full">
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b">
              <span className="text-[11px] text-gray-500 font-medium">{groups.length}개 기능 · {tasks.length}개 Task</span>
              <button onClick={toggleExpandAll} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#5E6AD2]">
                {allExpanded ? <><ChevronsDownUp size={12} />전체 접기</> : <><ChevronsUpDown size={12} />전체 펼치기</>}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-2 py-1.5">
                    <input type="checkbox"
                      checked={tasks.length > 0 && selected.size === tasks.length}
                      onChange={toggleAllSelect}
                      className="w-3.5 h-3.5"
                    />
                  </th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">ID</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">Task명</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-36">진척율</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">일정</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">상태</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-12">⚠️</th>
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
                           checked={group.tasks.length > 0 && group.tasks.every((t: any) => selected.has(t.id))}
                           ref={el => { if (el) el.indeterminate = group.tasks.some((t: any) => selected.has(t.id)) && !group.tasks.every((t: any) => selected.has(t.id)) }}
                           onChange={() => toggleGroupSelect(group.tasks.map((t: any) => t.id))}
                         />
                       </td>
                       <td colSpan={8} className="px-3 py-1.5">
                         <div className="flex items-center gap-2 flex-wrap">
                           {isExpanded(key) ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                           <span className="text-xs font-medium text-[#5E6AD2]">
                             {group.feature ? `${group.feature.code} - ${group.feature.title.length > 30 ? group.feature.title.slice(0, 30) + '...' : group.feature.title}` : '미연결'}
                           </span>
                           {group.feature && (group.feature as any).requirement && (
                             <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-medium border border-blue-200">
                               <span className="font-mono opacity-70">{(group.feature as any).requirement.code}</span>
                               <span>{(group.feature as any).requirement.title.length > 18 ? (group.feature as any).requirement.title.slice(0, 18) + '...' : (group.feature as any).requirement.title}</span>
                             </span>
                           )}
                           <span className="text-[10px] text-gray-400">({group.tasks.length})</span>
                           {group.tasks.some((t: any) => t.outdated) && (
                             <span className="text-amber-500 text-[11px] font-medium">⚠️ 상위 변경됨</span>
                           )}
                           {group.feature && group.tasks.some((t: any) => t.outdated) && (
                             <button
                               onClick={e => { e.stopPropagation(); setUpdateTarget({ id: group.feature!.id, code: group.feature!.code, title: group.feature!.title, status: (group.feature as any).status ?? '' }) }}
                               className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[#5E6AD2] text-white rounded hover:bg-[#4f5bb8] transition-colors"
                             >
                               <Sparkles size={10} />AI 업데이트
                             </button>
                           )}
                         </div>
                       </td>
                    </tr>
                    {isExpanded(key) && group.tasks.map(task => (
                      <tr key={task.id} className={`border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${selectedItemId === task.id ? 'bg-[#5E6AD2]/5' : ''}`} onClick={() => setSelectedItemId(prev => prev === task.id ? null : task.id)}>
                        <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox"
                            checked={selected.has(task.id)}
                            onChange={() => toggleSelect(task.id)}
                            className="w-3.5 h-3.5"
                          />
                        </td>
                        <td className="px-3 py-1.5 pl-8 font-mono text-xs text-gray-500">{task.code}</td>
                        <td className="px-3 py-1.5 font-medium">
                          <span className="truncate block max-w-[200px]" title={task.title}>{task.title.length > 20 ? task.title.slice(0, 20) + '...' : task.title}{task.outdated && <span title={task.outdatedReason || '상위 변경됨'} className="text-amber-500 ml-1 text-[10px]">⚠️</span>}</span>
                        </td>
                        <td className="px-3 py-1.5"><ProgressBar value={task.progress} /></td>
                        <td className="px-3 py-1.5 text-xs text-gray-400">
                          {task.startDate ? new Date(task.startDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '-'}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${task.status === 'completed' ? 'bg-green-100 text-green-700' : task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : task.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[task.status] || task.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          {(task._count?.issues ?? 0) > 0 && (
                            <div className="flex items-center gap-1 text-yellow-600">
                              <AlertTriangle size={13} />
                              <span className="text-xs">{task._count!.issues}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <TraceIndicator
                            upper={[
                              { count: task.feature ? 1 : 0, label: '기능', colorClass: 'bg-purple-100 text-purple-600' },
                            ]}
                          />
                        </td>
                        <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(task)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                            <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(task.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
                <span className="text-xs font-bold text-gray-800">Task 상세</span>
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
                    <button onClick={() => { setPanelEditForm({ title: selectedItem.title, description: selectedItem.description ?? '', status: selectedItem.status, progress: selectedItem.progress ?? 0, startDate: selectedItem.startDate ? selectedItem.startDate.slice(0, 10) : '', endDate: selectedItem.endDate ? selectedItem.endDate.slice(0, 10) : '' }); setPanelEditing(true) }}
                      className="text-xs px-2 py-0.5 rounded border border-[#5E6AD2] text-[#5E6AD2] hover:bg-[#5E6AD2]/5">편집</button>
                  ) : (
                    <>
                      <button onClick={async () => {
                        await taskApi.update(projectId!, selectedItemId!, {
                          title: panelEditForm.title,
                          description: panelEditForm.description || undefined,
                          status: panelEditForm.status,
                          progress: Number(panelEditForm.progress),
                          startDate: panelEditForm.startDate ? new Date(panelEditForm.startDate).toISOString() : undefined,
                          endDate: panelEditForm.endDate ? new Date(panelEditForm.endDate).toISOString() : undefined,
                        })
                        qc.invalidateQueries({ queryKey: ['task', projectId, selectedItemId] })
                        qc.invalidateQueries({ queryKey: ['tasks', projectId] })
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
                    : <p className="text-gray-600 whitespace-pre-wrap">{selectedItem.description || '-'}</p>}
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">상태</span>
                  {panelEditing
                    ? <select className="w-full border rounded px-2 py-1 text-xs" value={panelEditForm.status} onChange={e => setPanelEditForm((f: any) => ({ ...f, status: e.target.value }))}>
                        <option value="pending">대기</option><option value="in_progress">진행중</option><option value="completed">완료</option><option value="on_hold">보류</option>
                      </select>
                    : <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${selectedItem.status === 'completed' ? 'bg-green-100 text-green-700' : selectedItem.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : selectedItem.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{STATUS_LABELS[selectedItem.status] || selectedItem.status}</span>}
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">진척율</span>
                  {panelEditing ? (
                    <div className="flex items-center gap-2">
                      <input type="range" min={0} max={100} step={5} className="flex-1 accent-[#5E6AD2]" value={panelEditForm.progress} onChange={e => setPanelEditForm((f: any) => ({ ...f, progress: Number(e.target.value) }))} />
                      <span className="w-8 text-right font-medium text-gray-700">{panelEditForm.progress}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#5E6AD2] rounded-full" style={{ width: `${selectedItem.progress || 0}%` }} />
                      </div>
                      <span className="text-gray-700 font-medium">{selectedItem.progress || 0}%</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-400 block mb-0.5">시작일</span>
                    {panelEditing
                      ? <input type="date" className="w-full border rounded px-2 py-1 text-xs" value={panelEditForm.startDate} onChange={e => setPanelEditForm((f: any) => ({ ...f, startDate: e.target.value }))} />
                      : <p className="text-gray-700">{selectedItem.startDate ? new Date(selectedItem.startDate).toLocaleDateString('ko-KR') : '-'}</p>}
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">종료일</span>
                    {panelEditing
                      ? <input type="date" className="w-full border rounded px-2 py-1 text-xs" value={panelEditForm.endDate} onChange={e => setPanelEditForm((f: any) => ({ ...f, endDate: e.target.value }))} />
                      : <p className="text-gray-700">{selectedItem.endDate ? new Date(selectedItem.endDate).toLocaleDateString('ko-KR') : '-'}</p>}
                  </div>
                </div>

                {(selectedItem as any).feature && (
                  <div className="border-t pt-2">
                    <span className="text-gray-500 font-medium block mb-1">연결 기능</span>
                    <div className="flex items-center gap-2 text-[11px] py-0.5">
                      <span className="font-mono text-gray-400">{(selectedItem as any).feature.code}</span>
                      <span className="text-gray-600 truncate">{(selectedItem as any).feature.title}</span>
                    </div>
                  </div>
                )}

                {(selectedItem as any)._count?.issues > 0 && (
                  <div className="border-t pt-2">
                    <span className="text-gray-500 font-medium block mb-1">이슈 ({(selectedItem as any)._count.issues}건)</span>
                  </div>
                )}
              </div>

              <div className="px-4 pb-3 flex-shrink-0">
                <button
                  onClick={() => navigate(`/projects/${projectId}/tasks/${selectedItemId}`)}
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
        <div ref={sentinelRef} className="py-3 text-center text-[11px] text-gray-400">
          {isFetchingNextPage ? '로딩 중...' : hasNextPage ? '' : tasks.length > 0 ? `총 ${tasks.length}개` : ''}
        </div>
        </>)}

        {viewTab === 'gantt' && (
          <div className="flex gap-3">
            <div className={ganttSelectedTask ? 'flex-1 min-w-0' : 'w-full'}>
              <GanttView
                projectId={projectId!}
                tasks={allTasks}
                dependencies={dependencies}
                projectStartDate={project?.startDate}
                onDateChange={async (task, start, end) => {
                  await taskApi.update(projectId!, task.id, { startDate: start.toISOString(), endDate: end.toISOString() })
                  qc.invalidateQueries({ queryKey: ['tasks', projectId] })
                  qc.invalidateQueries({ queryKey: ['tasks-all', projectId] })
                }}
                onProgressChange={async (task, progress) => {
                  await taskApi.update(projectId!, task.id, { progress: Math.round(progress) })
                  qc.invalidateQueries({ queryKey: ['tasks', projectId] })
                  qc.invalidateQueries({ queryKey: ['tasks-all', projectId] })
                }}
                 onSelect={(taskId) => {
                   setGanttSelectedTask(allTasks.find(t => t.id === taskId) || null)
                   setGanttEditing(false)
                   setDepTargetId('')
                   setDepType('FS')
                 }}
                onDoubleClick={(taskId) => navigate(`/projects/${projectId}/tasks/${taskId}`)}
              />
            </div>
            {ganttSelectedTask && (
              <div className="w-72 flex-shrink-0 bg-white border rounded-lg overflow-y-auto max-h-[70vh] shadow-lg flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 flex-shrink-0">
                  <span className="text-xs font-bold text-gray-800">Task 상세</span>
                  <div className="flex items-center gap-1.5">
                    {!ganttEditing ? (
                      <button
                        onClick={() => {
                          setGanttEditForm({
                            title: ganttSelectedTask.title,
                            description: ganttSelectedTask.description ?? '',
                            status: ganttSelectedTask.status,
                            progress: ganttSelectedTask.progress ?? 0,
                            startDate: ganttSelectedTask.startDate ? ganttSelectedTask.startDate.slice(0, 10) : '',
                            endDate: ganttSelectedTask.endDate ? ganttSelectedTask.endDate.slice(0, 10) : '',
                          })
                          setGanttEditing(true)
                        }}
                        className="text-xs px-2 py-0.5 rounded border border-[#5E6AD2] text-[#5E6AD2] hover:bg-[#5E6AD2]/5 transition-colors"
                      >편집</button>
                    ) : (
                      <>
                        <button
                          onClick={async () => {
                            await taskApi.update(projectId!, ganttSelectedTask.id, {
                              title: ganttEditForm.title,
                              description: ganttEditForm.description || undefined,
                              status: ganttEditForm.status,
                              progress: Number(ganttEditForm.progress),
                              startDate: ganttEditForm.startDate ? new Date(ganttEditForm.startDate).toISOString() : undefined,
                              endDate: ganttEditForm.endDate ? new Date(ganttEditForm.endDate).toISOString() : undefined,
                            })
                            qc.invalidateQueries({ queryKey: ['tasks', projectId] })
                            qc.invalidateQueries({ queryKey: ['tasks-all', projectId] })
                            setGanttSelectedTask((prev: any) => ({ ...prev, ...ganttEditForm }))
                            setGanttEditing(false)
                          }}
                          className="text-xs px-2 py-0.5 rounded bg-[#5E6AD2] text-white hover:bg-[#4f5bb8] transition-colors"
                        >저장</button>
                        <button onClick={() => setGanttEditing(false)} className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50">취소</button>
                      </>
                    )}
                    <button onClick={() => { setGanttSelectedTask(null); setGanttEditing(false) }} className="text-gray-400 hover:text-gray-600 ml-1">✕</button>
                  </div>
                </div>

                <div className="p-3 space-y-3 text-xs flex-1">
                  <div>
                    <span className="text-gray-400 block mb-0.5">코드</span>
                    <p className="font-mono text-gray-700">{ganttSelectedTask.code}</p>
                  </div>

                  <div>
                    <span className="text-gray-400 block mb-0.5">Task명</span>
                    {ganttEditing
                      ? <input className="w-full border rounded px-2 py-1 text-xs" value={ganttEditForm.title} onChange={e => setGanttEditForm((f: any) => ({ ...f, title: e.target.value }))} />
                      : <p className="font-medium text-gray-800">{ganttSelectedTask.title}</p>}
                  </div>

                  <div>
                    <span className="text-gray-400 block mb-0.5">설명</span>
                    {ganttEditing
                      ? <textarea className="w-full border rounded px-2 py-1 text-xs resize-none" rows={3} value={ganttEditForm.description} onChange={e => setGanttEditForm((f: any) => ({ ...f, description: e.target.value }))} />
                      : ganttSelectedTask.description
                        ? <p className="text-gray-600 whitespace-pre-wrap">{ganttSelectedTask.description}</p>
                        : <p className="text-gray-300">-</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-400 block mb-0.5">시작일</span>
                      {ganttEditing
                        ? <input type="date" className="w-full border rounded px-2 py-1 text-xs" value={ganttEditForm.startDate} onChange={e => setGanttEditForm((f: any) => ({ ...f, startDate: e.target.value }))} />
                        : <p className="text-gray-700">{ganttSelectedTask.startDate ? new Date(ganttSelectedTask.startDate).toLocaleDateString('ko-KR') : '-'}</p>}
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">종료일</span>
                      {ganttEditing
                        ? <input type="date" className="w-full border rounded px-2 py-1 text-xs" value={ganttEditForm.endDate} onChange={e => setGanttEditForm((f: any) => ({ ...f, endDate: e.target.value }))} />
                        : <p className="text-gray-700">{ganttSelectedTask.endDate ? new Date(ganttSelectedTask.endDate).toLocaleDateString('ko-KR') : '-'}</p>}
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-400 block mb-0.5">진척율</span>
                    {ganttEditing ? (
                      <div className="flex items-center gap-2">
                        <input type="range" min={0} max={100} step={5} className="flex-1 accent-[#5E6AD2]" value={ganttEditForm.progress} onChange={e => setGanttEditForm((f: any) => ({ ...f, progress: Number(e.target.value) }))} />
                        <span className="w-8 text-right font-medium text-gray-700">{ganttEditForm.progress}%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#5E6AD2] rounded-full" style={{ width: `${ganttSelectedTask.progress || 0}%` }} />
                        </div>
                        <span className="text-gray-700 font-medium">{ganttSelectedTask.progress || 0}%</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-gray-400 block mb-0.5">상태</span>
                    {ganttEditing
                      ? <select className="w-full border rounded px-2 py-1 text-xs" value={ganttEditForm.status} onChange={e => setGanttEditForm((f: any) => ({ ...f, status: e.target.value }))}>
                          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                      : <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ganttSelectedTask.status === 'completed' ? 'bg-green-100 text-green-700' : ganttSelectedTask.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : ganttSelectedTask.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[ganttSelectedTask.status] || ganttSelectedTask.status}
                        </span>}
                  </div>

                  {ganttSelectedTask.feature && (
                    <div>
                      <span className="text-gray-400 block mb-0.5">연결 기능</span>
                      <p className="text-[#5E6AD2]">{ganttSelectedTask.feature.code} - {ganttSelectedTask.feature.title}</p>
                    </div>
                  )}

                  <div className="border-t pt-2">
                    <span className="text-gray-500 font-medium block mb-1.5">의존성</span>
                    {(dependencies as any[])
                      .filter(d => d.fromTaskId === ganttSelectedTask.id || d.toTaskId === ganttSelectedTask.id)
                      .map((d: any) => {
                        const isFrom = d.fromTaskId === ganttSelectedTask.id
                        const other = isFrom ? d.toTask : d.fromTask
                        return (
                          <div key={d.id} className="flex items-center justify-between py-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${isFrom ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                {d.type}
                              </span>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">{isFrom ? '→' : '←'}</span>
                              <span className="text-[10px] text-gray-600 truncate">{other?.code} {other?.title}</span>
                            </div>
                            <button onClick={() => taskApi.removeDependency(projectId!, d.id).then(() => qc.invalidateQueries({ queryKey: ['task-deps', projectId] }))} className="text-gray-300 hover:text-red-500 flex-shrink-0 ml-1 text-xs">✕</button>
                          </div>
                        )
                      })
                    }
                    {!ganttEditing && (
                      <div className="mt-2 space-y-1.5 pt-1.5 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400">선행 Task 추가</p>
                        <select
                          className="w-full border rounded px-2 py-1 text-[10px] text-gray-600"
                          value={depTargetId}
                          onChange={e => setDepTargetId(e.target.value)}
                        >
                          <option value="">선행 Task 선택...</option>
                          {allTasks
                            .filter((t: any) => t.id !== ganttSelectedTask.id)
                            .map((t: any) => (
                              <option key={t.id} value={t.id}>{t.code} - {t.title.slice(0, 20)}</option>
                            ))}
                        </select>
                        <div className="flex gap-1">
                          {['FS', 'FF', 'SS', 'SF'].map(type => (
                            <button
                              key={type}
                              onClick={() => setDepType(type)}
                              className={`flex-1 text-[10px] py-1 rounded border font-medium transition-colors ${depType === type ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]' : 'border-gray-200 text-gray-500 hover:border-[#5E6AD2] hover:text-[#5E6AD2]'}`}
                            >{type}</button>
                          ))}
                        </div>
                        <button
                          disabled={!depTargetId}
                          onClick={() => {
                            if (!depTargetId) return
                            taskApi.createDependency(projectId!, depTargetId, ganttSelectedTask.id, depType)
                              .then(() => {
                                qc.invalidateQueries({ queryKey: ['task-deps', projectId] })
                                setDepTargetId('')
                              })
                              .catch(() => alert('이미 존재하는 의존성이거나 오류가 발생했습니다.'))
                          }}
                          className="w-full text-[10px] py-1 rounded bg-[#5E6AD2] text-white hover:bg-[#4f5bb8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          + 의존성 추가
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-3 pb-3 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/projects/${projectId}/tasks/${ganttSelectedTask.id}`)}
                    className="w-full text-center text-xs py-1.5 border border-[#5E6AD2] text-[#5E6AD2] rounded hover:bg-[#5E6AD2]/5 transition-colors"
                  >
                    상세 페이지로 이동
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} disabledReason="처리 중입니다...">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>
      {updateTarget && (
        <FeatureTaskUpdateModal
          open={!!updateTarget}
          onClose={() => setUpdateTarget(null)}
          projectId={projectId!}
          feature={updateTarget}
        />
      )}
      <MultiTaskGenerateModal open={showMultiGen} onClose={() => setShowMultiGen(false)} projectId={projectId!} />
    </AppLayout>
  )
}
