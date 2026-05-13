import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, Save, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { testApi, type Defect } from '@/api/test.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AppLayout from '@/components/layout/AppLayout'

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
const SEVERITY_LABEL: Record<string, string> = { critical: '치명적', major: '주요', minor: '경미', trivial: '사소' }
const PRIORITY_LABEL: Record<string, string> = { high: '높음', medium: '중간', low: '낮음' }

const VALID_TRANSITIONS: Record<string, { status: string; label: string; color: string }[]> = {
  open: [
    { status: 'assigned', label: '할당', color: 'bg-orange-100 text-orange-700' },
    { status: 'closed', label: '종료(무효)', color: 'bg-gray-100 text-gray-600' },
  ],
  assigned: [
    { status: 'in_progress', label: '처리 시작', color: 'bg-blue-100 text-blue-700' },
    { status: 'open', label: '반려', color: 'bg-red-100 text-red-600' },
  ],
  in_progress: [
    { status: 'resolved', label: '해결 완료', color: 'bg-purple-100 text-purple-700' },
  ],
  resolved: [
    { status: 'verified', label: '검증 완료', color: 'bg-indigo-100 text-indigo-700' },
    { status: 'reopened', label: '재오픈', color: 'bg-red-100 text-red-600' },
  ],
  verified: [
    { status: 'closed', label: '최종 종료', color: 'bg-green-100 text-green-700' },
    { status: 'reopened', label: '재오픈', color: 'bg-red-100 text-red-600' },
  ],
  closed: [
    { status: 'reopened', label: '재오픈', color: 'bg-red-100 text-red-600' },
  ],
  reopened: [
    { status: 'assigned', label: '재할당', color: 'bg-orange-100 text-orange-700' },
    { status: 'in_progress', label: '처리 시작', color: 'bg-blue-100 text-blue-700' },
  ],
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden mb-4">
      <div className="px-5 py-3 bg-gray-50 border-b flex justify-between items-center">
        <h3 className="font-semibold text-sm text-gray-700">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

interface EditForm {
  title: string
  description: string
  severity: string
  priority: string
}

export default function DefectDetailPage() {
  const { t } = useTranslation()
  const { projectId, defectId } = useParams<{ projectId: string; defectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [resolutionInput, setResolutionInput] = useState('')
  const [showResolution, setShowResolution] = useState(false)
  const [pendingTransition, setPendingTransition] = useState('')

  const { data: defect, isLoading } = useQuery({
    queryKey: ['defect', projectId, defectId],
    queryFn: () => testApi.getDefect(projectId!, defectId!),
    enabled: !!projectId && !!defectId,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Defect>) => testApi.updateDefect(projectId!, defectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['defect', projectId, defectId] })
      qc.invalidateQueries({ queryKey: ['defects', projectId] })
      setEditing(false)
    },
  })

  const transitionMutation = useMutation({
    mutationFn: (data: Partial<Defect>) => testApi.updateDefect(projectId!, defectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['defect', projectId, defectId] })
      qc.invalidateQueries({ queryKey: ['defects', projectId] })
      setShowResolution(false)
      setResolutionInput('')
      setPendingTransition('')
    },
  })

  const { register, handleSubmit, reset } = useForm<EditForm>()

  const startEdit = () => {
    if (!defect) return
    reset({
      title: defect.title,
      description: defect.description ?? '',
      severity: defect.severity,
      priority: defect.priority,
    })
    setEditing(true)
  }

  const handleSave = (data: EditForm) => {
    updateMutation.mutate(data)
  }

  const handleTransition = (targetStatus: string) => {
    if (targetStatus === 'resolved') {
      setPendingTransition(targetStatus)
      setShowResolution(true)
      return
    }
    transitionMutation.mutate({ status: targetStatus })
  }

  const confirmResolution = () => {
    transitionMutation.mutate({ status: pendingTransition, resolution: resolutionInput })
  }

  if (isLoading) return <AppLayout><div className="p-6 text-gray-400">{t('common.loading')}</div></AppLayout>
  if (!defect) return <AppLayout><div className="p-6 text-gray-400">결함을 찾을 수 없습니다</div></AppLayout>

  const transitions = VALID_TRANSITIONS[defect.status] ?? []

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(`/projects/${projectId}/defects`)} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-mono">{defect.code}</p>
            <h2 className="text-xl font-bold">{defect.title}</h2>
          </div>
          {!editing && <Button variant="outline" size="sm" onClick={startEdit}><Pencil size={14} />{t('common.edit')}</Button>}
        </div>

        <form onSubmit={handleSubmit(handleSave)}>
          <Section title="기본 정보" action={editing ? (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}><X size={14} />{t('common.cancel')}</Button>
              <Button type="submit" size="sm" disabled={updateMutation.isPending} disabledReason="처리 중입니다..."><Save size={14} />{t('common.save')}</Button>
            </div>
          ) : undefined}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">코드</Label>
                <p className="font-mono text-sm">{defect.code}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">상태</Label>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[defect.status] || 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[defect.status] || defect.status}
                </span>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">제목</Label>
                {editing ? <Input {...register('title')} className="h-8 text-sm" /> : <p className="font-medium">{defect.title}</p>}
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">설명</Label>
                {editing
                  ? <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={3} {...register('description')} />
                  : <p className="text-sm text-gray-700 whitespace-pre-wrap">{defect.description ?? '-'}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">심각도</Label>
                {editing
                  ? <select className="w-full border rounded-md px-2 py-1 text-sm" {...register('severity')}>
                      {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
                    </select>
                  : <span className="text-sm">{SEVERITY_LABEL[defect.severity] || defect.severity}</span>}
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">우선순위</Label>
                {editing
                  ? <select className="w-full border rounded-md px-2 py-1 text-sm" {...register('priority')}>
                      {PRIORITIES.map(s => <option key={s} value={s}>{PRIORITY_LABEL[s]}</option>)}
                    </select>
                  : <span className="text-sm">{PRIORITY_LABEL[defect.priority] || defect.priority}</span>}
              </div>
              {defect.resolution && (
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">해결 내용</Label>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-green-50 rounded p-2 border border-green-100">{defect.resolution}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">등록일</Label>
                <p className="text-sm text-gray-600">{new Date(defect.createdAt).toLocaleDateString('ko-KR')}</p>
              </div>
              {defect.resolvedAt && (
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">해결일</Label>
                  <p className="text-sm text-gray-600">{new Date(defect.resolvedAt).toLocaleDateString('ko-KR')}</p>
                </div>
              )}
            </div>
          </Section>
        </form>

        <Section title="상태 전이">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">현재 상태:</span>
              <span className={`px-3 py-1 rounded text-sm font-bold ${STATUS_BADGE[defect.status] || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABEL[defect.status] || defect.status}
              </span>
            </div>

            {transitions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {transitions.map(tr => (
                  <button
                    key={tr.status}
                    onClick={() => handleTransition(tr.status)}
                    disabled={transitionMutation.isPending}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${tr.color}`}
                  >
                    → {tr.label}
                  </button>
                ))}
              </div>
            )}

            {showResolution && (
              <div className="border rounded-lg p-3 bg-purple-50/50 space-y-2">
                <p className="text-xs text-purple-700 font-medium">해결 내용을 입력해주세요</p>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm resize-none"
                  rows={3}
                  placeholder="수정한 내용 또는 해결 방법..."
                  value={resolutionInput}
                  onChange={e => setResolutionInput(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setShowResolution(false); setPendingTransition('') }}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" onClick={confirmResolution} disabled={transitionMutation.isPending} disabledReason="처리 중입니다...">
                    해결 완료
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {defect.executionId && (
          <Section title="연결된 테스트 실행">
            <div className="p-2 bg-gray-50 rounded border text-xs">
              <span className="text-gray-400">연결된 테스트 실행</span>
              <p className="mt-1">케이스: {defect.execution?.testCase?.title ?? '-'}</p>
            </div>
          </Section>
        )}
      </div>
    </AppLayout>
  )
}
