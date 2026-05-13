import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, Save, X, ChevronRight, Sparkles, Database, Code2, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { featureApi, type FeaturePayload } from '@/api/feature.api'
import { requirementApi } from '@/api/requirement.api'
import { taskApi } from '@/api/task.api'
import { aiStatusApi } from '@/api/admin.api'
import { designApi } from '@/api/design.api'
import { AIGenerateModal } from '@/components/shared/AIGenerateModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/shared/Badge'
import { AncestorTags } from '@/components/shared/AncestorTags'
import { VersionSection } from '@/components/shared/VersionSection'
import { ScreenDesignSection } from '@/components/shared/ScreenDesignSection'
import { OutdatedBanner } from '@/components/shared/OutdatedBanner'
import AppLayout from '@/components/layout/AppLayout'

const STATUSES = ['new', 'review', 'confirmed', 'changed']

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

export default function FeatureDetailPage() {
  const { t } = useTranslation()
  const { projectId, featureId } = useParams<{ projectId: string; featureId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [showAITask, setShowAITask] = useState(false)
  const [showAITest, setShowAITest] = useState(false)

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId!),
    enabled: !!projectId,
  })

  const { data: feature, isLoading } = useQuery({
    queryKey: ['feature', projectId, featureId],
    queryFn: () => featureApi.get(projectId!, featureId!),
    enabled: !!projectId && !!featureId,
  })

  const { data: requirementsResult } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: () => requirementApi.list(projectId!),
    enabled: !!projectId,
  })
  const requirements = requirementsResult?.data ?? []

  const { data: dbTables = [] } = useQuery({
    queryKey: ['design-db', projectId, featureId],
    queryFn: () => designApi.listDbTables(projectId!),
    enabled: !!projectId && !!featureId,
    select: (data: any[]) => data.filter(d => d.featureId === featureId),
  })

  const { data: apiSpecs = [] } = useQuery({
    queryKey: ['design-api', projectId, featureId],
    queryFn: () => designApi.listApiSpecs(projectId!),
    enabled: !!projectId && !!featureId,
    select: (data: any[]) => data.filter(a => a.featureId === featureId),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<FeaturePayload>) => featureApi.update(projectId!, featureId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature', projectId, featureId] })
      qc.invalidateQueries({ queryKey: ['features', projectId] })
      qc.invalidateQueries({ queryKey: ['features-confirmed', projectId] })
      setEditing(false)
    },
  })

  const { register, handleSubmit, reset } = useForm<FeaturePayload>()

  const startEdit = () => {
    if (!feature) return
    reset({ title: feature.title, description: feature.description, reqId: feature.reqId, status: feature.status })
    setEditing(true)
  }

  if (isLoading) return <AppLayout><div className="p-6 text-gray-400">{t('common.loading')}</div></AppLayout>
  if (!feature) return <AppLayout><div className="p-6 text-gray-400">기능을 찾을 수 없습니다</div></AppLayout>

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl">
        <OutdatedBanner outdated={feature.outdated} outdatedReason={feature.outdatedReason} entityType="feature" entityId={featureId!} queryKeys={[['feature', projectId!, featureId!], ['features', projectId!]]} />
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-mono">{feature.code}</p>
            <h2 className="text-xl font-bold">{feature.title}</h2>
          </div>
          {!editing && <Button variant="outline" size="sm" onClick={startEdit}><Pencil size={14} />{t('common.edit')}</Button>}
        </div>

        <form onSubmit={handleSubmit(d => updateMutation.mutate(d))}>
          <Section title="기본 정보" action={editing && (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}><X size={14} />{t('common.cancel')}</Button>
              <Button type="submit" size="sm" disabled={updateMutation.isPending} disabledReason="처리 중입니다..."><Save size={14} />{t('common.save')}</Button>
            </div>
          )}>
            {feature.requirement && (
              <div className="mb-4">
                <AncestorTags tags={[
                  { code: feature.requirement.code, title: feature.requirement.title, type: 'requirement', id: feature.requirement.id }
                ]} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs text-gray-500 mb-1 block">코드</Label><p className="font-mono text-sm">{feature.code}</p></div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">상태</Label>
                {editing
                  ? <select className="w-full border rounded-md px-2 py-1 text-sm" {...register('status')}>
                      {STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                    </select>
                  : <Badge value={feature.status} label={t(`status.${feature.status}`)} />}
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">연결 요구사항</Label>
                {editing
                  ? <select className="w-full border rounded-md px-2 py-1 text-sm" {...register('reqId')}>
                      <option value="">선택 안 함</option>
                      {requirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.title}</option>)}
                    </select>
                  : feature.requirement
                    ? <button onClick={() => navigate(`/projects/${projectId}/requirements/${feature.requirement!.id}`)} className="text-sm text-blue-600 hover:underline">{feature.requirement.code} - {feature.requirement.title}</button>
                    : <p className="text-sm text-gray-400">-</p>}
              </div>
              <div><Label className="text-xs text-gray-500 mb-1 block">등록일</Label><p className="text-sm">{new Date(feature.createdAt).toLocaleDateString('ko-KR')}</p></div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">기능명</Label>
                {editing ? <Input {...register('title')} className="h-8 text-sm" /> : <p className="font-medium">{feature.title}</p>}
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">설명</Label>
                {editing
                  ? <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={3} {...register('description')} />
                  : <p className="text-sm text-gray-700 whitespace-pre-wrap">{feature.description ?? '-'}</p>}
              </div>
            </div>
          </Section>
        </form>

        <Section title="화면설계서">
          <ScreenDesignSection projectId={projectId!} featureId={featureId!} />
        </Section>

        <Section title="연결 항목" action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAITask(true)} disabled={!aiStatus?.configured} disabledReason="관리자 페이지에서 LLM을 설정하세요" title={!aiStatus?.configured ? 'LLM 설정이 필요합니다' : undefined}><Sparkles size={14} />AI Task생성</Button>
            <Button variant="outline" size="sm" onClick={() => setShowAITest(true)} disabled={!aiStatus?.configured} disabledReason="관리자 페이지에서 LLM을 설정하세요" title={!aiStatus?.configured ? 'LLM 설정이 필요합니다' : undefined}><Sparkles size={14} />AI 테스트생성</Button>
          </div>
        }>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">📋 상위 요구사항</p>
              {feature.requirement
                ? <div className="flex items-center justify-between p-2 rounded border hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${projectId}/requirements/${feature.requirement!.id}`)}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{feature.requirement.code}</span>
                      <span className="text-sm">{feature.requirement.title}</span>
                      <Badge value={feature.requirement.status} />
                    </div>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                : <p className="text-sm text-gray-400">연결된 요구사항이 없습니다</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">📌 Task ({feature.tasks?.length ?? 0})</p>
              {feature.tasks && feature.tasks.length > 0
                ? feature.tasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-2 rounded border mb-1 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">{task.code}</span>
                        <span className="text-sm">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{task.progress}%</span>
                        <ChevronRight size={14} className="text-gray-300" />
                      </div>
                    </div>
                  ))
                : <p className="text-sm text-gray-400">연결된 Task가 없습니다</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">🧪 테스트 시나리오 ({feature.testScenarios?.length ?? 0})</p>
              {feature.testScenarios && feature.testScenarios.length > 0
                ? feature.testScenarios.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded border mb-1 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${projectId}/tests/${s.id}`)}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">{s.code}</span>
                        <span className="text-sm">{s.title}</span>
                      </div>
                      <ChevronRight size={14} className="text-gray-300" />
                    </div>
                  ))
                : <p className="text-sm text-gray-400">연결된 테스트 시나리오가 없습니다</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <Database size={12} className="text-green-600" /> DB 설계 ({(dbTables as any[]).length})
                </p>
                <button onClick={() => navigate(`/projects/${projectId}/design`)} className="text-[10px] text-[#5E6AD2] hover:underline flex items-center gap-0.5">
                  설계 페이지 <ExternalLink size={10} />
                </button>
              </div>
              {(dbTables as any[]).length > 0 ? (
                <div className="space-y-1">
                  {(dbTables as any[]).map((d: any) => (
                    <div key={d.id} className="p-2 rounded border bg-green-50/50 text-xs">
                      <span className="font-mono font-medium text-green-800">{d.name}</span>
                      {d.description && <span className="text-gray-500 ml-2">{d.description}</span>}
                      {Array.isArray(d.columns) && d.columns.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(d.columns as any[]).slice(0, 5).map((c: any, i: number) => (
                            <span key={i} className="text-[10px] bg-white border border-green-200 text-green-700 px-1 rounded font-mono">
                              {c.name}: {c.type}{c.primaryKey ? ' PK' : ''}
                            </span>
                          ))}
                          {(d.columns as any[]).length > 5 && <span className="text-[10px] text-gray-400">+{(d.columns as any[]).length - 5}개</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">연결된 DB 테이블이 없습니다 <button onClick={() => navigate(`/projects/${projectId}/design`)} className="text-[#5E6AD2] hover:underline">설계 페이지에서 추가</button></p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <Code2 size={12} className="text-cyan-600" /> API 명세 ({(apiSpecs as any[]).length})
                </p>
              </div>
              {(apiSpecs as any[]).length > 0 ? (
                <div className="space-y-1">
                  {(apiSpecs as any[]).map((a: any) => (
                    <div key={a.id} className="p-2 rounded border bg-cyan-50/50 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge value={a.method} />
                        <span className="font-mono text-cyan-800">{a.path}</span>
                      </div>
                      {a.summary && <p className="text-gray-500 mt-0.5">{a.summary}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">연결된 API 명세가 없습니다</p>
              )}
            </div>
          </div>
        </Section>

        <Section title="버전 이력">
          <VersionSection projectId={projectId!} entityType="feature" entityQueryKey={['feature', projectId!, featureId!]} />
        </Section>
      </div>

      <AIGenerateModal
        open={showAITask}
        onClose={() => setShowAITask(false)}
        title="🤖 AI Task 자동 분해"
        projectId={projectId!}
        endpoint="ai/generate-tasks"
        payload={{ featureId }}
        onConfirm={async (items) => {
          for (const item of items) {
            await taskApi.create(projectId!, { title: item.title, description: item.description, featureId: featureId!, status: 'pending', progress: 0 })
          }
          qc.invalidateQueries({ queryKey: ['feature', projectId, featureId] })
          qc.invalidateQueries({ queryKey: ['tasks', projectId] })
        }}
      />

      <AIGenerateModal
        open={showAITest}
        onClose={() => setShowAITest(false)}
        title="🤖 AI 테스트 시나리오 생성"
        projectId={projectId!}
        endpoint="ai/generate-test-scenarios"
        payload={{ featureId }}
         onConfirm={async (items) => {
           const { testApi } = await import('@/api/test.api')
           for (const item of items) {
             if (!item.title) continue
             await testApi.createScenario(projectId!, {
               title: String(item.title),
               description: item.description ? String(item.description) : undefined,
               type: item.type ? String(item.type) : 'integration',
               testType: item.testType ? String(item.testType) : 'functional',
               testData: item.testData ? (typeof item.testData === 'string' ? item.testData : JSON.stringify(item.testData)) : undefined,
               featureId: featureId!,
             })
           }
          qc.invalidateQueries({ queryKey: ['feature', projectId, featureId] })
          qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
        }}
        renderItem={(item) => (
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{item.title}</p>
              <span className={`px-1.5 py-0.5 rounded text-xs ${item.type === 'unit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {item.type === 'unit' ? '단위' : '통합'}
              </span>
            </div>
            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
          </div>
        )}
      />
    </AppLayout>
  )
}
