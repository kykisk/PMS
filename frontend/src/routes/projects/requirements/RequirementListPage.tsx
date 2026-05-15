import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, FileUp, Sparkles, RefreshCw, Download, ChevronDown } from 'lucide-react'
import { requirementApi, type RequirementPayload } from '@/api/requirement.api'
import { useCaseApi, userStoryApi } from '@/api/usecase.api'
import { exportApi } from '@/api/export.api'
import { aiStatusApi } from '@/api/admin.api'
import { designApi } from '@/api/design.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { Badge } from '@/components/shared/Badge'
import AppLayout from '@/components/layout/AppLayout'
import { ExcelImportModal } from '@/components/shared/ExcelImportModal'
import { SpecImportModal } from '@/components/shared/SpecImportModal'
import { MarkdownImportModal } from '@/components/shared/MarkdownImportModal'
import { Pagination } from '@/components/shared/Pagination'
import { AISuggestButton } from '@/components/shared/AISuggestButton'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { TraceIndicator } from '@/components/shared/TraceIndicator'


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
const STATUS_LABELS: Record<string, string> = { new: '신규', review: '검토중', confirmed: '확정', changed: '변경', deleted: '삭제' }

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
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null)
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
  const toggleAll = () => {
    setSelected(prev => prev.size === requirements.length ? new Set() : new Set(requirements.map(i => i.id)))
  }

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

  const { data: selectedReq } = useQuery({
    queryKey: ['requirement', projectId, selectedReqId],
    queryFn: () => requirementApi.get(projectId!, selectedReqId!),
    enabled: !!selectedReqId && !!projectId,
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedReqId(null); setPanelEditing(false); setPanelWidthPct(50) }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
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

  const { data: allUCs = [] } = useQuery({
    queryKey: ['use-cases', projectId],
    queryFn: () => useCaseApi.list(projectId!),
    enabled: !!projectId,
  })
  const { data: allUSs = [] } = useQuery({
    queryKey: ['user-stories', projectId],
    queryFn: () => userStoryApi.list(projectId!),
    enabled: !!projectId,
  })
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

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await Promise.all(ids.map(id => requirementApi.update(projectId!, id, { status })))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requirements', projectId] })
      qc.invalidateQueries({ queryKey: ['requirements-all', projectId] })
      qc.invalidateQueries({ queryKey: ['features', projectId] })
      qc.invalidateQueries({ queryKey: ['features-for-filter', projectId] })
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
      setSelected(new Set())
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => requirementApi.remove(projectId!, id)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requirements', projectId] })
      setSelected(new Set())
    },
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
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-800">{t('nav.requirements')}</h2>
          <div className="flex gap-2">
            <div className="relative group">
              <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                <Download size={12} />
                내보내기
                <ChevronDown size={12} />
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
              <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                <FileUp size={12} />
                가져오기
                <ChevronDown size={12} />
              </Button>
              <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-52 bg-white border rounded-lg shadow-lg z-20 py-1">
                <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 w-full text-left">
                  <FileUp size={12} />
                  엑셀 파일 Import
                </button>
                <div className="border-t my-1" />
                <button onClick={() => setShowSpecImport(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 w-full text-left">
                  <Sparkles size={12} />
                  기술서(엑셀) AI 분석
                </button>
                <button onClick={() => setShowSpecUpdate(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 w-full text-left">
                  <RefreshCw size={12} />
                  기술서 변경점 비교 (diff)
                </button>
              </div>
            </div>
            <Button size="sm" className="h-7 text-xs px-2" onClick={() => { setEditTarget(null); reset({ priority: 'medium', status: 'new' }); setShowCreate(true) }}>
              <Plus size={12} />
              {t('common.create')}
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-7 h-7 text-xs"
              placeholder={t('common.search')}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()) }}
            />
          </div>
          <select
            className="border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); setSelected(new Set()) }}
          >
            <option value="">상태 전체</option>
            {STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
          <select
            className="border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
            value={filterPriority}
            onChange={e => { setFilterPriority(e.target.value); setPage(1); setSelected(new Set()) }}
          >
            <option value="">우선순위 전체</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
          </select>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md mb-2 flex-wrap">
            <span className="text-xs text-blue-700 font-medium">{selected.size}개 선택됨</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">상태변경:</span>
              <select
                className="h-6 text-xs border rounded px-1.5 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                defaultValue=""
                onChange={e => {
                  if (!e.target.value) return
                  const status = e.target.value
                  if (confirm(`선택한 ${selected.size}개를 "${STATUS_LABELS[status]}"으로 변경하시겠습니까?`)) {
                    bulkStatusMutation.mutate({ ids: [...selected], status })
                  }
                  e.target.value = ''
                }}
              >
                <option value="">선택...</option>
                <option value="new">신규</option>
                <option value="review">검토중</option>
                <option value="confirmed">확정</option>
                <option value="changed">변경</option>
                <option value="deleted">삭제</option>
              </select>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { if (confirm(`선택한 ${selected.size}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate([...selected]) }}
                className="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
              >선택 삭제</button>
            </div>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">취소</button>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-lg border p-6">
            <TableSkeleton rows={5} cols={7} />
          </div>
        ) : requirements.length === 0 ? (
          <div className="bg-white rounded-lg border">
            <EmptyState message="요구사항이 없습니다. 새로 생성해보세요." />
          </div>
        ) : (
        <div ref={panelContainerRef} className="relative" style={{ userSelect: isDragging ? 'none' : 'auto' }}>
          <div className="w-full">
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="w-8 px-2 py-1.5">
                      <input type="checkbox"
                        checked={requirements.length > 0 && selected.size === requirements.length}
                        onChange={toggleAll}
                        className="w-3.5 h-3.5"
                      />
                    </th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">ID</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">분류</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">요구사항명</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">우선순위</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">상태</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">입력경로</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">연결</th>
                    <th className="w-20 px-3 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map(req => (
                      <tr
                        key={req.id}
                        className={`border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${selectedReqId === req.id ? 'bg-[#5E6AD2]/5' : ''}`}
                        onClick={() => setSelectedReqId(prev => prev === req.id ? null : req.id)}
                      >
                        <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox"
                            checked={selected.has(req.id)}
                            onChange={() => toggleSelect(req.id)}
                            className="w-3.5 h-3.5"
                          />
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{req.code}</td>
                        <td className="px-3 py-1.5 text-gray-600"><span className="truncate block max-w-[100px]" title={req.category ?? ''}>{(req.category ?? '-').length > 8 ? (req.category ?? '').slice(0, 8) + '...' : req.category ?? '-'}</span></td>
                        <td className="px-3 py-1.5 font-medium"><span className="truncate block max-w-[200px]" title={req.title}>{req.title.length > 20 ? req.title.slice(0, 20) + '...' : req.title}</span></td>
                        <td className="px-3 py-1.5"><Badge value={req.priority} label={t(`priority.${req.priority}`)} /></td>
                        <td className="px-3 py-1.5"><Badge value={req.status} label={t(`status.${req.status}`)} /></td>
                        <td className="px-3 py-1.5 text-xs text-gray-400">{req.source}</td>
                        <td className="px-3 py-1.5">
                          <TraceIndicator
                            upper={[
                              { count: (allUCs as any[]).filter(u => u.requirementId === req.id).length, label: 'UC', colorClass: 'bg-indigo-100 text-indigo-600' },
                              { count: (allUSs as any[]).filter(u => u.requirementId === req.id).length, label: 'US', colorClass: 'bg-pink-100 text-pink-600' },
                            ]}
                            lower={[
                              { count: (req as any).features?.length ?? 0, label: '기능', colorClass: 'bg-purple-100 text-purple-600' },
                              { count: (() => {
                                const fIds = ((req as any).features ?? []).map((f: any) => f.id)
                                return (allDbTables as any[]).filter(d => fIds.includes(d.featureId)).length
                              })(), label: 'DB', colorClass: 'bg-green-100 text-green-700' },
                              { count: (() => {
                                const fIds = ((req as any).features ?? []).map((f: any) => f.id)
                                return (allApiSpecs as any[]).filter(a => fIds.includes(a.featureId)).length
                              })(), label: 'API', colorClass: 'bg-cyan-100 text-cyan-700' },
                            ]}
                          />
                        </td>
                        <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
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
          </div>

          {selectedReqId && selectedReq && (
            <div
              className="fixed right-0 top-0 bottom-0 z-50 bg-white border-l border-gray-200 shadow-2xl flex flex-col overflow-y-auto"
              style={{ width: `${panelWidthPct}%`, minHeight: '400px' }}
            >
              <div
                className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 hover:bg-[#5E6AD2]/30 transition-colors ${isDragging ? 'bg-[#5E6AD2]/40' : ''}`}
                onMouseDown={e => { e.preventDefault(); setIsDragging(true) }}
              />
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50 flex-shrink-0">
                <span className="text-xs font-bold text-gray-800">요구사항 상세</span>
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
                    <button onClick={() => { setPanelEditForm({ title: selectedReq.title, description: selectedReq.description ?? '', category: selectedReq.category ?? '', priority: selectedReq.priority ?? 'medium', status: selectedReq.status }); setPanelEditing(true) }}
                      className="text-xs px-2 py-0.5 rounded border border-[#5E6AD2] text-[#5E6AD2] hover:bg-[#5E6AD2]/5">편집</button>
                  ) : (
                    <>
                      <button onClick={async () => {
                        await requirementApi.update(projectId!, selectedReqId!, panelEditForm)
                        qc.invalidateQueries({ queryKey: ['requirement', projectId, selectedReqId] })
                        qc.invalidateQueries({ queryKey: ['requirements', projectId] })
                        setPanelEditing(false)
                      }} className="text-xs px-2 py-0.5 rounded bg-[#5E6AD2] text-white hover:bg-[#4f5bb8]">저장</button>
                      <button onClick={() => setPanelEditing(false)} className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500">취소</button>
                    </>
                  )}
                  <button onClick={() => { setSelectedReqId(null); setPanelEditing(false); setPanelWidthPct(50) }} className="text-gray-400 hover:text-gray-600 ml-1">✕</button>
                </div>
              </div>

              <div className="p-4 space-y-3 text-xs flex-1">
                <div>
                  <span className="text-gray-400 block mb-0.5">코드</span>
                  <p className="font-mono text-[#5E6AD2]">{selectedReq.code}</p>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">제목</span>
                  {panelEditing
                    ? <input className="w-full border rounded px-2 py-1 text-xs" value={panelEditForm.title} onChange={e => setPanelEditForm((f: any) => ({ ...f, title: e.target.value }))} />
                    : <p className="font-medium text-gray-800">{selectedReq.title}</p>}
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">설명</span>
                  {panelEditing
                    ? <textarea className="w-full border rounded px-2 py-1 text-xs resize-none" rows={3} value={panelEditForm.description} onChange={e => setPanelEditForm((f: any) => ({ ...f, description: e.target.value }))} />
                    : <p className="text-gray-600 whitespace-pre-wrap">{selectedReq.description || '-'}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-gray-400 block mb-0.5">분류</span>
                    {panelEditing
                      ? <input className="w-full border rounded px-2 py-1 text-xs" value={panelEditForm.category} onChange={e => setPanelEditForm((f: any) => ({ ...f, category: e.target.value }))} />
                      : <p className="text-gray-700">{selectedReq.category || '-'}</p>}
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">우선순위</span>
                    {panelEditing
                      ? <select className="w-full border rounded px-2 py-1 text-xs" value={panelEditForm.priority} onChange={e => setPanelEditForm((f: any) => ({ ...f, priority: e.target.value }))}>
                          <option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option>
                        </select>
                      : <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${selectedReq.priority === 'high' ? 'bg-red-100 text-red-700' : selectedReq.priority === 'low' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>{selectedReq.priority === 'high' ? '높음' : selectedReq.priority === 'low' ? '낮음' : '보통'}</span>}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">상태</span>
                  {panelEditing
                    ? <select className="w-full border rounded px-2 py-1 text-xs" value={panelEditForm.status} onChange={e => setPanelEditForm((f: any) => ({ ...f, status: e.target.value }))}>
                        <option value="new">신규</option><option value="review">검토중</option><option value="confirmed">확정</option><option value="changed">변경</option><option value="deleted">삭제</option>
                      </select>
                    : <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${selectedReq.status === 'confirmed' ? 'bg-green-100 text-green-700' : selectedReq.status === 'new' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>{selectedReq.status}</span>}
                </div>

                {selectedReq.features && selectedReq.features.length > 0 && (
                  <div className="border-t pt-2">
                    <span className="text-gray-500 font-medium block mb-1">연결 기능 ({selectedReq.features.length})</span>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {selectedReq.features.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-2 text-[11px] py-0.5">
                          <span className="font-mono text-gray-400">{f.code}</span>
                          <span className="text-gray-600 truncate">{f.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedReq as any).testScenarios && (selectedReq as any).testScenarios.length > 0 && (
                  <div className="border-t pt-2">
                    <span className="text-gray-500 font-medium block mb-1">테스트 시나리오 ({(selectedReq as any).testScenarios.length})</span>
                    <div className="space-y-1 max-h-[100px] overflow-y-auto">
                      {(selectedReq as any).testScenarios.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-2 text-[11px] py-0.5">
                          <span className="font-mono text-gray-400">{s.code}</span>
                          <span className="text-gray-600 truncate">{s.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 pb-3 flex-shrink-0">
                <button
                  onClick={() => navigate(`/projects/${projectId}/requirements/${selectedReqId}`)}
                  className="w-full text-center text-xs py-1.5 border border-[#5E6AD2] text-[#5E6AD2] rounded hover:bg-[#5E6AD2]/5 transition-colors"
                >
                  상세 페이지로 이동
                </button>
              </div>
            </div>
          )}
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
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} disabledReason="처리 중입니다...">
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

      <MarkdownImportModal
        open={showMarkdown}
        onClose={() => setShowMarkdown(false)}
        projectId={projectId!}
        queryKey={['requirements', projectId ?? '']}
      />
    </AppLayout>
  )
}
