import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import { testExecutionApi } from '@/api/test-execution.api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import AppLayout from '@/components/layout/AppLayout'

const STATUS_LABEL: Record<string, string> = {
  planned: '계획됨', in_progress: '진행중', completed: '완료', closed: '종료',
}
const STATUS_BADGE: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-100 text-blue-700 font-semibold',
  completed: 'bg-green-100 text-green-700 font-semibold',
  closed: 'bg-slate-200 text-slate-600',
}

const STATUS_BORDER: Record<string, string> = {
  planned: 'border-l-gray-300',
  in_progress: 'border-l-blue-500',
  completed: 'border-l-green-500',
  closed: 'border-l-slate-400',
}

export default function TestExecutionPage() {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '' })

  const { data: phases = [], isLoading } = useQuery({
    queryKey: ['test-phases', projectId],
    queryFn: () => testExecutionApi.listPhases(projectId!),
    enabled: !!projectId,
  })

  const createMutation = useMutation({
    mutationFn: () => testExecutionApi.createPhase(projectId!, {
      title: form.title,
      description: form.description || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-phases', projectId] })
      setShowCreate(false)
      setForm({ title: '', description: '', startDate: '', endDate: '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => testExecutionApi.updatePhase(projectId!, editTarget.id, {
      title: form.title,
      description: form.description || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-phases', projectId] })
      setEditTarget(null)
      setForm({ title: '', description: '', startDate: '', endDate: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => testExecutionApi.deletePhase(projectId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['test-phases', projectId] }),
  })

  const openEdit = (phase: any) => {
    setEditTarget(phase)
    setForm({
      title: phase.title,
      description: phase.description ?? '',
      startDate: phase.startDate ? phase.startDate.slice(0, 10) : '',
      endDate: phase.endDate ? phase.endDate.slice(0, 10) : '',
    })
  }

  const hasOutdated = phases.some(p => p.outdated)
  const isAdmin = user?.role === 'ADMIN'

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-800">{t('nav.testExecution')}</h2>
          {isAdmin && (
            <Button size="sm" className="h-7 text-xs px-2" onClick={() => setShowCreate(true)}>
              <Plus size={12} />프로젝트 회차 생성
            </Button>
          )}
        </div>

        {hasOutdated && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <span className="text-xs text-amber-700">일부 프로젝트 회차의 시나리오가 변경되었습니다.</span>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-lg border p-6">
            <TableSkeleton rows={4} cols={3} />
          </div>
        ) : phases.length === 0 ? (
          <div className="bg-white rounded-lg border">
            <EmptyState message="프로젝트 회차가 없습니다. 새로 생성해보세요." />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {phases.map(phase => {
              const totalPass = phase.latestRound?.passCount ?? 0
              const totalCases = phase.latestRound?.totalCases ?? 0
              const passRate = totalCases > 0 ? Math.round((totalPass / totalCases) * 100) : 0
              return (
                <div
                  key={phase.id}
                  className={`bg-white border border-l-4 ${STATUS_BORDER[phase.status] || 'border-l-gray-300'} rounded-lg p-4 hover:shadow-sm cursor-pointer transition-all duration-200`}
                  onClick={() => navigate(`/projects/${projectId}/test-execution/${phase.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-[#5E6AD2]">{phase.code}</span>
                      {phase.outdated && (
                        <span className="text-amber-500 text-xs" title="시나리오 변경됨">⚠️</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[phase.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[phase.status] || phase.status}
                      </span>
                      {isAdmin && (
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(phase) }}
                            className="p-1 text-gray-400 hover:text-[#5E6AD2] transition-colors"
                            title="수정"
                          ><Pencil size={13} /></button>
                      )}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              if (confirm(`"${phase.title}" 회차를 삭제하시겠습니까?\n수행 기록도 모두 삭제됩니다.`)) {
                                deleteMutation.mutate(phase.id)
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="삭제"
                          ><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <h3 className="text-xs font-medium text-gray-800 mb-2 truncate">{phase.title}</h3>
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>수행 회차: {phase.roundCount ?? 0}회</span>
                    {phase.status === 'completed' && totalCases > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#5E6AD2] rounded-full" style={{ width: `${passRate}%` }} />
                        </div>
                        <span className="text-[#5E6AD2] font-medium">{passRate}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="프로젝트 회차 생성" className="max-w-lg">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>제목 *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="1차 통합 테스트" />
          </div>
          <div className="space-y-1">
            <Label>설명</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={2}
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>시작일</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>종료일</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button disabled={!form.title || createMutation.isPending}
              disabledReason={!form.title ? '제목을 입력하세요' : '처리 중입니다...'}
              onClick={() => createMutation.mutate()}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editTarget} onClose={() => { setEditTarget(null); setForm({ title: '', description: '', startDate: '', endDate: '' }) }} title="프로젝트 회차 수정" className="max-w-lg">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>제목 *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>설명</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={2}
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>시작일</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>종료일</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setEditTarget(null); setForm({ title: '', description: '', startDate: '', endDate: '' }) }}>{t('common.cancel')}</Button>
            <Button disabled={!form.title || updateMutation.isPending}
              disabledReason={!form.title ? '제목을 입력하세요' : '처리 중입니다...'}
              onClick={() => updateMutation.mutate()}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
