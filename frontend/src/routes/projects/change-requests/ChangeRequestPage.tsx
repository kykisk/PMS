import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Search, AlertTriangle } from 'lucide-react'
import { crApi } from '@/api/change-request.api'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/shared/Modal'
import { Badge } from '@/components/shared/Badge'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import AppLayout from '@/components/layout/AppLayout'

const STATUS_MAP: Record<string, string> = { draft: '초안', review: '검토중', approved: '승인', rejected: '반려', implemented: '적용완료' }
const STATUSES = ['draft', 'review', 'approved', 'rejected', 'implemented']
const PRIORITIES = ['high', 'medium', 'low']
const PRIORITY_LABEL: Record<string, string> = { high: '높음', medium: '중간', low: '낮음' }

export default function ChangeRequestPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [showImpact, setShowImpact] = useState(false)
  const [impactData, setImpactData] = useState<any>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', reason: '', priority: 'medium', requirementIds: '' })
  const [editTarget, setEditTarget] = useState<any>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAll = () => {
    setSelected(prev => prev.size === crList.length ? new Set() : new Set(crList.map((i: any) => i.id)))
  }

  const { data: crList = [], isLoading } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: () => crApi.list(projectId!),
    enabled: !!projectId,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => crApi.create(projectId!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['change-requests', projectId] }); setShowCreate(false); resetForm() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => crApi.update(projectId!, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['change-requests', projectId] }); setEditTarget(null); resetForm() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crApi.delete(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['change-requests', projectId] }),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => crApi.delete(projectId!, id)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-requests', projectId] })
      setSelected(new Set())
    },
  })

  const resetForm = () => setForm({ title: '', description: '', reason: '', priority: 'medium', requirementIds: '' })

  const handleImpact = async (id: string) => {
    if (!projectId) return
    setImpactLoading(true)
    setShowImpact(true)
    try {
      const data = await crApi.analyzeImpact(projectId, id)
      setImpactData(data)
    } catch {
      setImpactData(null)
    } finally {
      setImpactLoading(false)
    }
  }

  const handleSubmit = () => {
    const payload = {
      title: form.title,
      description: form.description || undefined,
      reason: form.reason || undefined,
      priority: form.priority,
      requirementIds: form.requirementIds ? form.requirementIds.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    }
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-sm font-bold text-gray-800">변경요청 (CR)</h1>
          <Button size="sm" onClick={() => setShowCreate(true)} className="h-7 text-xs gap-1">
            <Plus size={12} />등록
          </Button>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md mb-2">
            <span className="text-xs text-red-600 font-medium">{selected.size}개 선택됨</span>
            <button
              onClick={() => { if (confirm(`선택한 ${selected.size}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate([...selected]) }}
              className="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
            >선택 삭제</button>
            <button
              onClick={() => { if (confirm(`전체 ${crList.length}개를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate(crList.map((i: any) => i.id)) }}
              className="text-xs px-2 py-0.5 border border-red-400 text-red-600 rounded hover:bg-red-50"
            >전체 삭제</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">취소</button>
          </div>
        )}

        {isLoading ? <TableSkeleton /> : crList.length === 0 ? <EmptyState message="변경요청이 없습니다" /> : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-2 py-1.5">
                    <input type="checkbox"
                      checked={crList.length > 0 && selected.size === crList.length}
                      onChange={toggleAll}
                      className="w-3.5 h-3.5"
                    />
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">코드</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">제목</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">우선순위</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">상태</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">등록일</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {crList.map((cr: any) => (
                  <tr key={cr.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox"
                        checked={selected.has(cr.id)}
                        onChange={() => toggleSelect(cr.id)}
                        className="w-3.5 h-3.5"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono font-medium text-[#5E6AD2]">{cr.code}</td>
                    <td className="px-3 py-2 truncate max-w-[200px]">{cr.title}</td>
                    <td className="px-3 py-2 text-center"><Badge value={cr.priority || 'medium'} label={PRIORITY_LABEL[cr.priority] || '중간'} /></td>
                    <td className="px-3 py-2 text-center"><Badge value={cr.status || 'draft'} label={STATUS_MAP[cr.status] || '초안'} /></td>
                    <td className="px-3 py-2 text-center text-gray-500">{cr.createdAt ? new Date(cr.createdAt).toLocaleDateString('ko-KR') : '-'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => handleImpact(cr.id)} className="text-gray-400 hover:text-amber-600 mr-2" title="영향분석"><AlertTriangle size={13} /></button>
                      <button onClick={() => { setEditTarget(cr); setForm({ title: cr.title, description: cr.description || '', reason: cr.reason || '', priority: cr.priority || 'medium', requirementIds: cr.requirements?.map((r: any) => r.requirementId).join(', ') || '' }) }} className="text-gray-400 hover:text-[#5E6AD2] mr-2"><Search size={13} /></button>
                      <button onClick={() => deleteMutation.mutate(cr.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={showCreate || !!editTarget} onClose={() => { setShowCreate(false); setEditTarget(null); resetForm() }} title={editTarget ? '변경요청 수정' : '변경요청 등록'}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">제목 *</label>
              <input className="w-full border rounded px-2 py-1.5 text-xs h-7" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="변경 사유를 간략히 입력" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">설명</label>
              <textarea className="w-full border rounded px-2 py-1.5 text-xs h-16" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">변경 사유</label>
              <textarea className="w-full border rounded px-2 py-1.5 text-xs h-12" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">우선순위</label>
                <select className="w-full border rounded px-2 py-1.5 text-xs h-7" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
              </div>
              {editTarget && (
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">상태</label>
                  <select className="w-full border rounded px-2 py-1.5 text-xs h-7" value={editTarget.status || 'draft'} onChange={e => setEditTarget((t: any) => ({ ...t, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_MAP[s]}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">연관 요구사항 ID (쉼표 구분)</label>
              <input className="w-full border rounded px-2 py-1.5 text-xs h-7" value={form.requirementIds} onChange={e => setForm(f => ({ ...f, requirementIds: e.target.value }))} placeholder="id1, id2, ..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setEditTarget(null); resetForm() }} className="h-7 text-xs">취소</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={!form.title || createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? '저장중...' : '저장'}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal open={showImpact} onClose={() => { setShowImpact(false); setImpactData(null) }} title="영향분석 결과" className="max-w-lg">
          {impactLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#5E6AD2] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : impactData ? (
            <div className="space-y-3 max-h-80 overflow-auto">
              {impactData.requirements?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 mb-1">요구사항 ({impactData.requirements.length})</h4>
                  <div className="space-y-1">
                    {impactData.requirements.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-2 px-2 py-1 bg-blue-50 rounded text-xs">
                        <span className="font-mono text-blue-700">{r.code}</span>
                        <span className="truncate">{r.title}</span>
                        {r.status && <Badge value={r.status} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {impactData.features?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 mb-1">기능 ({impactData.features.length})</h4>
                  <div className="space-y-1">
                    {impactData.features.map((f: any) => (
                      <div key={f.id} className="flex items-center gap-2 px-2 py-1 bg-green-50 rounded text-xs">
                        <span className="font-mono text-green-700">{f.code}</span>
                        <span className="truncate">{f.title}</span>
                        {f.status && <Badge value={f.status} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {impactData.tasks?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 mb-1">Task ({impactData.tasks.length})</h4>
                  <div className="space-y-1">
                    {impactData.tasks.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-2 px-2 py-1 bg-amber-50 rounded text-xs">
                        <span className="font-mono text-amber-700">{t.code}</span>
                        <span className="truncate">{t.title}</span>
                        {t.status && <Badge value={t.status} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {impactData.tests?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-700 mb-1">테스트 ({impactData.tests.length})</h4>
                  <div className="space-y-1">
                    {impactData.tests.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-2 px-2 py-1 bg-purple-50 rounded text-xs">
                        <span className="font-mono text-purple-700">{t.code}</span>
                        <span className="truncate">{t.title}</span>
                        {t.status && <Badge value={t.status} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!impactData.requirements?.length && !impactData.features?.length && !impactData.tasks?.length && !impactData.tests?.length && (
                <p className="text-xs text-gray-500 text-center py-4">영향받는 항목이 없습니다</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center py-4">데이터를 불러올 수 없습니다</p>
          )}
        </Modal>
      </div>
    </AppLayout>
  )
}
