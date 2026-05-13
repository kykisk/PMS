import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, Save, X, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { taskApi, type TaskPayload, type IssuePayload } from '@/api/task.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { VersionSection } from '@/components/shared/VersionSection'
import { AncestorTags } from '@/components/shared/AncestorTags'
import { OutdatedBanner } from '@/components/shared/OutdatedBanner'
import AppLayout from '@/components/layout/AppLayout'

const STATUSES = ['pending', 'in_progress', 'completed', 'on_hold']
const STATUS_LABELS: Record<string, string> = { pending: '대기', in_progress: '진행중', completed: '완료', on_hold: '보류' }
const SEVERITY_LABELS: Record<string, string> = { low: '낮음', medium: '중간', high: '높음', critical: '긴급' }

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

function ProgressSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min="0" max="100" value={value} onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-gray-200" />
      <span className="text-sm font-medium w-10 text-right">{value}%</span>
    </div>
  )
}

export default function TaskDetailPage() {
  const { t } = useTranslation()
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showIssue, setShowIssue] = useState(false)

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', projectId, taskId],
    queryFn: () => taskApi.get(projectId!, taskId!),
    enabled: !!projectId && !!taskId,
    onSuccess: (d: any) => setProgress(d.progress),
  } as any)

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TaskPayload>) => taskApi.update(projectId!, taskId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', projectId, taskId] })
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      setEditing(false)
    },
  })

  const addIssueMutation = useMutation({
    mutationFn: (data: IssuePayload) => taskApi.addIssue(projectId!, taskId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', projectId, taskId] })
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      setShowIssue(false); resetIssue()
    },
  })

  const removeIssueMutation = useMutation({
    mutationFn: (issueId: string) => taskApi.removeIssue(projectId!, taskId!, issueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', projectId, taskId] })
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })

  const { register, handleSubmit, reset } = useForm<Partial<TaskPayload>>()
  const { register: registerIssue, handleSubmit: handleIssueSubmit, reset: resetIssue } = useForm<IssuePayload>({
    defaultValues: { type: 'issue', severity: 'medium', status: 'open' },
  })

  const startEdit = () => {
    if (!task) return
    reset({
      title: t2.title, description: t2.description,
      assigneeId: t2.assigneeId,
      startDate: t2.startDate?.slice(0, 10),
      endDate: t2.endDate?.slice(0, 10),
      status: t2.status,
    })
    setProgress(t2.progress)
    setEditing(true)
  }

  const handleSave = (data: Partial<TaskPayload>) => {
    updateMutation.mutate({ ...data, progress })
  }

  if (isLoading) return <AppLayout><div className="p-6 text-gray-400">{t('common.loading')}</div></AppLayout>
  if (!task) return <AppLayout><div className="p-6 text-gray-400">Task를 찾을 수 없습니다</div></AppLayout>
  const t2 = task as any

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl">
        <OutdatedBanner outdated={t2.outdated} outdatedReason={t2.outdatedReason} entityType="task" entityId={taskId!} queryKeys={[['task', projectId!, taskId!], ['tasks', projectId!]]} />
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-mono">{t2.code}</p>
            <h2 className="text-xl font-bold">{t2.title}</h2>
            <div className="mt-1">
              <AncestorTags tags={[
                (task as any).feature?.requirement ? { code: (task as any).feature.requirement.code, title: (task as any).feature.requirement.title, type: 'requirement' as const, id: (task as any).feature.requirement.id } : null,
                (task as any).feature ? { code: (task as any).feature.code, title: (task as any).feature.title, type: 'feature' as const, id: (task as any).feature.id } : null,
              ]} />
            </div>
          </div>
          {!editing && <Button variant="outline" size="sm" onClick={startEdit}><Pencil size={14} />{t('common.edit')}</Button>}
        </div>

        <form onSubmit={handleSubmit(handleSave)}>
          <Section title="기본 정보" action={editing && (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}><X size={14} />{t('common.cancel')}</Button>
              <Button type="submit" size="sm" disabled={updateMutation.isPending} disabledReason="처리 중입니다..."><Save size={14} />{t('common.save')}</Button>
            </div>
          )}>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs text-gray-500 mb-1 block">Task ID</Label><p className="font-mono text-sm">{t2.code}</p></div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">상태</Label>
                {editing
                  ? <select className="w-full border rounded-md px-2 py-1 text-sm" {...register('status')}>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  : <span className={`px-2 py-0.5 rounded text-xs font-medium ${t2.status === 'completed' ? 'bg-green-100 text-green-700' : t2.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[t2.status] || t2.status}
                    </span>}
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">진척율</Label>
                {editing
                  ? <ProgressSlider value={progress} onChange={setProgress} />
                  : <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${t2.progress}%` }} />
                      </div>
                      <span className="text-sm font-medium">{t2.progress}%</span>
                    </div>}
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">시작일</Label>
                {editing ? <Input type="date" {...register('startDate')} className="h-8 text-sm" /> : <p className="text-sm">{t2.startDate ? new Date(t2.startDate).toLocaleDateString('ko-KR') : '-'}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">종료일</Label>
                {editing ? <Input type="date" {...register('endDate')} className="h-8 text-sm" /> : <p className="text-sm">{t2.endDate ? new Date(t2.endDate).toLocaleDateString('ko-KR') : '-'}</p>}
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">Task명</Label>
                {editing ? <Input {...register('title')} className="h-8 text-sm" /> : <p className="font-medium">{t2.title}</p>}
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">설명</Label>
                {editing
                  ? <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={3} {...register('description')} />
                  : <p className="text-sm text-gray-700 whitespace-pre-wrap">{t2.description ?? '-'}</p>}
              </div>
            </div>
          </Section>
        </form>

        <Section title="연결 항목">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">📋 원본 요구사항</p>
              {(task as any).feature?.requirement
                ? <div className="flex items-center justify-between p-2 rounded border hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${projectId}/requirements/${(task as any).feature.requirement.id}`)}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{(task as any).feature.requirement.code}</span>
                      <span className="text-sm">{(task as any).feature.requirement.title}</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                : <p className="text-sm text-gray-400">-</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">🔧 상위 기능</p>
              {(task as any).feature
                ? <div className="flex items-center justify-between p-2 rounded border hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${projectId}/features/${(task as any).feature.id}`)}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{(task as any).feature.code}</span>
                      <span className="text-sm">{(task as any).feature.title}</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                : <p className="text-sm text-gray-400">-</p>}
            </div>
          </div>
        </Section>

        <Section title="이슈 / 리스크" action={
          <Button variant="outline" size="sm" onClick={() => setShowIssue(true)}><Plus size={14} />추가</Button>
        }>
          {(!(task as any).issues || (task as any).issues.length === 0)
            ? <p className="text-sm text-gray-400">이슈/리스크가 없습니다</p>
            : <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-16">유형</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">제목</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">심각도</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">상태</th>
                    <th className="w-10 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(task as any).issues.map((issue: any) => (
                    <tr key={issue.id} className="border-t">
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${issue.type === 'issue' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {issue.type === 'issue' ? '이슈' : '리스크'}
                        </span>
                      </td>
                      <td className="px-3 py-2">{issue.title}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{SEVERITY_LABELS[issue.severity] || issue.severity}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{issue.status}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => { if (confirm('삭제?')) removeIssueMutation.mutate(issue.id) }} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </Section>

        <Section title="버전 이력">
          <VersionSection projectId={projectId!} entityType="task" entityQueryKey={['task', projectId!, taskId!]} />
        </Section>
      </div>

      <Modal open={showIssue} onClose={() => { setShowIssue(false); resetIssue() }} title="이슈/리스크 추가">
        <form onSubmit={handleIssueSubmit(d => addIssueMutation.mutate(d))} className="space-y-3">
          <div className="space-y-1">
            <Label>유형 *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" {...registerIssue('type')}>
              <option value="issue">이슈</option>
              <option value="risk">리스크</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>제목 *</Label>
            <Input {...registerIssue('title')} placeholder="API 성능 저하" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>심각도</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" {...registerIssue('severity')}>
                {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>상태</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" {...registerIssue('status')}>
                <option value="open">Open</option>
                <option value="in_progress">진행중</option>
                <option value="resolved">해결됨</option>
                <option value="closed">종료</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>설명</Label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={2} {...registerIssue('description')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setShowIssue(false); resetIssue() }}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={addIssueMutation.isPending} disabledReason="처리 중입니다...">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
