import { useState, Fragment } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, FileUp, Download } from 'lucide-react'
import { userStoryApi } from '@/api/usecase.api'
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

export default function UserStoryPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [form, setForm] = useState({ title: '', asA: '', iWantTo: '', soThat: '', acceptanceCriteria: '', priority: 'medium', status: 'new', storyPoints: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  const { data: userStories = [], isLoading } = useQuery({
    queryKey: ['user-stories', projectId],
    queryFn: () => userStoryApi.list(projectId!),
    enabled: !!projectId,
  })

  const filtered = userStories.filter((us: any) =>
    !search || us.title?.toLowerCase().includes(search.toLowerCase()) || us.asA?.toLowerCase().includes(search.toLowerCase()) || us.iWantTo?.toLowerCase().includes(search.toLowerCase())
  )

  const createMutation = useMutation({
    mutationFn: (data: any) => editTarget ? userStoryApi.update(projectId!, editTarget.id, data) : userStoryApi.create(projectId!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user-stories', projectId] }); closeModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userStoryApi.delete(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-stories', projectId] }),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => userStoryApi.delete(projectId!, id)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-stories', projectId] })
      setSelected(new Set())
    },
  })

  const openCreate = () => {
    setEditTarget(null)
    setForm({ title: '', asA: '', iWantTo: '', soThat: '', acceptanceCriteria: '', priority: 'medium', status: 'new', storyPoints: '' })
    setShowModal(true)
  }

  const openEdit = (us: any) => {
    setEditTarget(us)
    setForm({
      title: us.title ?? '', asA: us.asA ?? '', iWantTo: us.iWantTo ?? '', soThat: us.soThat ?? '',
      acceptanceCriteria: Array.isArray(us.acceptanceCriteria) ? us.acceptanceCriteria.join('\n') : (us.acceptanceCriteria ?? ''),
      priority: us.priority ?? 'medium', status: us.status ?? 'new', storyPoints: us.storyPoints?.toString() ?? '',
    })
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditTarget(null) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return
    const payload = {
      ...form,
      acceptanceCriteria: form.acceptanceCriteria.split('\n').filter(l => l.trim()),
      storyPoints: form.storyPoints ? Number(form.storyPoints) : undefined,
    }
    createMutation.mutate(payload)
  }

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-800">User Story</h2>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => exportApi.userStories(projectId!)}>
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
          <div className="bg-white rounded-lg border p-6"><TableSkeleton rows={5} cols={7} /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border"><EmptyState message="User Story가 없습니다. 새로 생성해보세요." /></div>
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
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">As a...</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">I want to...</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-32">연결 요구사항</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-16">포인트</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">우선순위</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">상태</th>
                  <th className="w-20 px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((us: any) => (
                  <Fragment key={us.id}>
                    <tr
                      className="border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                      onClick={() => setExpandedId(expandedId === us.id ? null : us.id)}
                    >
                      <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={selected.has(us.id)}
                          onChange={() => toggleSelect(us.id)}
                          className="w-3.5 h-3.5"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-gray-400">
                        {expandedId === us.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{us.code ?? '-'}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">
                        <span className="truncate block max-w-[120px]" title={us.asA}>{us.asA?.length > 15 ? us.asA.slice(0, 15) + '...' : (us.asA ?? '-')}</span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-700">
                        <span className="truncate block max-w-[160px]" title={us.iWantTo}>{us.iWantTo?.length > 20 ? us.iWantTo.slice(0, 20) + '...' : (us.iWantTo ?? '-')}</span>
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        <TraceIndicator
                          lower={[
                            { count: us.requirement ? 1 : 0, label: 'REQ', colorClass: 'bg-blue-100 text-blue-600' },
                          ]}
                        />
                        {us.requirement && (
                          <div className="text-[10px] text-[#5E6AD2] truncate max-w-[90px]" title={us.requirement.title}>
                            {us.requirement.code}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{us.storyPoints ?? '-'}</td>
                      <td className="px-3 py-1.5"><Badge value={us.priority} label={us.priority} /></td>
                      <td className="px-3 py-1.5"><Badge value={us.status} label={us.status} /></td>
                      <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(us)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                          <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(us.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === us.id && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={10} className="px-6 py-3">
                          <div className="space-y-2 text-xs">
                            {us.requirement && (
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-500">연결 요구사항</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[11px] font-medium border border-blue-200">
                                  <span className="font-mono">{us.requirement.code}</span>
                                  <span className="text-blue-600">{us.requirement.title.length > 20 ? us.requirement.title.slice(0, 20) + '...' : us.requirement.title}</span>
                                </span>
                              </div>
                            )}
                            {us.soThat && <div><span className="font-medium text-gray-600">So that:</span> <span className="text-gray-500">{us.soThat}</span></div>}
                            {us.acceptanceCriteria && Array.isArray(us.acceptanceCriteria) && us.acceptanceCriteria.length > 0 && (
                              <div>
                                <span className="font-medium text-gray-600">인수 조건:</span>
                                <ul className="list-disc list-inside mt-1 text-gray-500 space-y-0.5">
                                  {us.acceptanceCriteria.map((ac: string, idx: number) => <li key={idx}>{ac}</li>)}
                                </ul>
                              </div>
                            )}
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

      <Modal open={showModal} onClose={closeModal} title={editTarget ? 'User Story 수정' : 'User Story 생성'} className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>제목 *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="스토리 제목" />
          </div>
          <div className="space-y-1">
            <Label>역할 (As a...)</Label>
            <Input value={form.asA} onChange={e => setForm(f => ({ ...f, asA: e.target.value }))} placeholder="일반 사용자" />
          </div>
          <div className="space-y-1">
            <Label>원하는 것 (I want to...)</Label>
            <Input value={form.iWantTo} onChange={e => setForm(f => ({ ...f, iWantTo: e.target.value }))} placeholder="이메일로 로그인할 수 있기를" />
          </div>
          <div className="space-y-1">
            <Label>목적 (So that...)</Label>
            <Input value={form.soThat} onChange={e => setForm(f => ({ ...f, soThat: e.target.value }))} placeholder="서비스를 이용할 수 있다" />
          </div>
          <div className="space-y-1">
            <Label>인수 조건 (한 줄에 하나씩)</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={3} value={form.acceptanceCriteria} onChange={e => setForm(f => ({ ...f, acceptanceCriteria: e.target.value }))} placeholder="이메일 형식 검증&#10;비밀번호 8자 이상&#10;로그인 성공 시 대시보드 이동" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>우선순위</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>상태</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>스토리 포인트</Label>
              <Input type="number" value={form.storyPoints} onChange={e => setForm(f => ({ ...f, storyPoints: e.target.value }))} placeholder="5" />
            </div>
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
        queryKey={['user-stories', projectId ?? '']}
        endpoint="user-stories/import/excel"
        templateEndpoint="user-stories/template/excel"
      />
    </AppLayout>
  )
}
