import { useState, Fragment } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, FileUp, Download } from 'lucide-react'
import { useCaseApi } from '@/api/usecase.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { Badge } from '@/components/shared/Badge'
import AppLayout from '@/components/layout/AppLayout'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { TraceIndicator } from '@/components/shared/TraceIndicator'
import { ExcelImportModal } from '@/components/shared/ExcelImportModal'
import { exportApi } from '@/api/export.api'

const PRIORITIES = ['high', 'medium', 'low']
const STATUSES = ['new', 'review', 'confirmed', 'changed', 'deleted']

export default function UseCasePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', actor: '', description: '', precondition: '', mainFlow: '', postcondition: '', priority: 'medium', status: 'new' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showImport, setShowImport] = useState(false)

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAll = () => {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map((i: any) => i.id)))
  }

  const { data: useCases = [], isLoading } = useQuery({
    queryKey: ['use-cases', projectId],
    queryFn: () => useCaseApi.list(projectId!),
    enabled: !!projectId,
  })

  const filtered = useCases.filter((uc: any) =>
    !search || uc.title?.toLowerCase().includes(search.toLowerCase()) || uc.actor?.toLowerCase().includes(search.toLowerCase())
  )

  const createMutation = useMutation({
    mutationFn: (data: any) => editTarget ? useCaseApi.update(projectId!, editTarget.id, data) : useCaseApi.create(projectId!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['use-cases', projectId] }); closeModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => useCaseApi.delete(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['use-cases', projectId] }),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => useCaseApi.delete(projectId!, id)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['use-cases', projectId] })
      setSelected(new Set())
    },
  })

  const openCreate = () => {
    setEditTarget(null)
    setForm({ title: '', actor: '', description: '', precondition: '', mainFlow: '', postcondition: '', priority: 'medium', status: 'new' })
    setShowModal(true)
  }

  const openEdit = (uc: any) => {
    setEditTarget(uc)
    setForm({
      title: uc.title ?? '', actor: uc.actor ?? '', description: uc.description ?? '',
      precondition: uc.precondition ?? '',
      mainFlow: Array.isArray(uc.mainFlow) ? uc.mainFlow.join('\n') : (uc.mainFlow ?? ''),
      postcondition: uc.postcondition ?? '', priority: uc.priority ?? 'medium', status: uc.status ?? 'new',
    })
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditTarget(null) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return
    const payload = {
      ...form,
      mainFlow: form.mainFlow.split('\n').filter(l => l.trim()),
    }
    createMutation.mutate(payload)
  }

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-800">Use Case</h2>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => exportApi.useCases(projectId!)}>
              <Download size={12} />엑셀 다운로드
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowImport(true)}>
              <FileUp size={12} />엑셀 Import
            </Button>
            <Button size="sm" className="h-7 text-xs px-2" onClick={openCreate}>
              <Plus size={12} />생성
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input className="pl-7 h-7 text-xs" placeholder="검색..." value={search} onChange={e => { setSearch(e.target.value); setSelected(new Set()) }} />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md mb-2">
            <span className="text-xs text-red-600 font-medium">{selected.size}개 선택됨</span>
            <button
              onClick={() => { if (confirm(`선택한 ${selected.size}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate([...selected]) }}
              className="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
            >선택 삭제</button>
            <button
              onClick={() => { if (confirm(`전체 ${filtered.length}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate(filtered.map((i: any) => i.id)) }}
              className="text-xs px-2 py-0.5 border border-red-400 text-red-600 rounded hover:bg-red-50"
            >전체 삭제</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">취소</button>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-lg border p-6"><TableSkeleton rows={5} cols={6} /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border"><EmptyState message="Use Case가 없습니다. 새로 생성해보세요." /></div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-2 py-1.5">
                    <input type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleAll}
                      className="w-3.5 h-3.5"
                    />
                  </th>
                  <th className="w-8 px-2 py-1.5"></th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">코드</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">제목</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-28">Actor</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-32">연결 요구사항</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">우선순위</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">상태</th>
                  <th className="w-20 px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((uc: any) => (
                  <Fragment key={uc.id}>
                    <tr
                      className="border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                      onClick={() => setExpandedId(expandedId === uc.id ? null : uc.id)}
                    >
                      <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={selected.has(uc.id)}
                          onChange={() => toggleSelect(uc.id)}
                          className="w-3.5 h-3.5"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-gray-400">
                        {expandedId === uc.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{uc.code ?? '-'}</td>
                      <td className="px-3 py-1.5 font-medium text-xs">
                        <span className="truncate block max-w-[200px]" title={uc.title}>{uc.title?.length > 25 ? uc.title.slice(0, 25) + '...' : uc.title}</span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">{uc.actor ?? '-'}</td>
                      <td className="px-3 py-1.5 text-xs">
                        <TraceIndicator
                          lower={[
                            { count: uc.requirement ? 1 : 0, label: 'REQ', colorClass: 'bg-blue-100 text-blue-600' },
                          ]}
                        />
                        {uc.requirement && (
                          <div className="text-[10px] text-[#5E6AD2] truncate max-w-[90px]" title={uc.requirement.title}>
                            {uc.requirement.code}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5"><Badge value={uc.priority} label={uc.priority} /></td>
                      <td className="px-3 py-1.5"><Badge value={uc.status} label={uc.status} /></td>
                      <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(uc)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                          <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(uc.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === uc.id && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={9} className="px-6 py-3">
                          <div className="space-y-2 text-xs">
                            {uc.requirement && (
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-500">연결 요구사항</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[11px] font-medium border border-blue-200">
                                  <span className="font-mono">{uc.requirement.code}</span>
                                  <span className="text-blue-600">{uc.requirement.title.length > 20 ? uc.requirement.title.slice(0, 20) + '...' : uc.requirement.title}</span>
                                </span>
                              </div>
                            )}
                            {uc.description && <div><span className="font-medium text-gray-600">설명:</span> <span className="text-gray-500">{uc.description}</span></div>}
                            {uc.precondition && <div><span className="font-medium text-gray-600">사전조건:</span> <span className="text-gray-500">{uc.precondition}</span></div>}
                            {uc.mainFlow && Array.isArray(uc.mainFlow) && uc.mainFlow.length > 0 && (
                              <div>
                                <span className="font-medium text-gray-600">메인 흐름:</span>
                                <ol className="list-decimal list-inside mt-1 text-gray-500 space-y-0.5">
                                  {uc.mainFlow.map((step: string, idx: number) => <li key={idx}>{step}</li>)}
                                </ol>
                              </div>
                            )}
                            {uc.postcondition && <div><span className="font-medium text-gray-600">사후조건:</span> <span className="text-gray-500">{uc.postcondition}</span></div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={closeModal} title={editTarget ? 'Use Case 수정' : 'Use Case 생성'} className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>제목 *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="로그인 Use Case" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Actor</Label>
              <Input value={form.actor} onChange={e => setForm(f => ({ ...f, actor: e.target.value }))} placeholder="사용자" />
            </div>
            <div className="space-y-1">
              <Label>우선순위</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>상태</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>설명</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Use Case 설명" />
          </div>
          <div className="space-y-1">
            <Label>사전조건</Label>
            <Input value={form.precondition} onChange={e => setForm(f => ({ ...f, precondition: e.target.value }))} placeholder="사용자가 로그인 페이지에 접속한 상태" />
          </div>
          <div className="space-y-1">
            <Label>메인 흐름 (한 줄에 하나씩)</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={4} value={form.mainFlow} onChange={e => setForm(f => ({ ...f, mainFlow: e.target.value }))} placeholder="이메일을 입력한다&#10;비밀번호를 입력한다&#10;로그인 버튼을 클릭한다" />
          </div>
          <div className="space-y-1">
            <Label>사후조건</Label>
            <Input value={form.postcondition} onChange={e => setForm(f => ({ ...f, postcondition: e.target.value }))} placeholder="메인 대시보드로 이동" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>취소</Button>
            <Button type="submit" disabled={createMutation.isPending} disabledReason="처리 중입니다...">저장</Button>
          </div>
        </form>
      </Modal>

      <ExcelImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        projectId={projectId!}
        queryKey={['use-cases', projectId ?? '']}
        endpoint="use-cases/import/excel"
        templateEndpoint="use-cases/template/excel"
      />
    </AppLayout>
  )
}


