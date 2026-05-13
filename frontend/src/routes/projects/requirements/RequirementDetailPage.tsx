import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, Save, X, ChevronRight, Sparkles, Users, BookOpen, Database, Code2 } from 'lucide-react'
import { useState } from 'react'
import { VersionSection } from '@/components/shared/VersionSection'
import { AIGenerateModal } from '@/components/shared/AIGenerateModal'
import { useForm } from 'react-hook-form'
import { requirementApi, type RequirementPayload } from '@/api/requirement.api'
import { featureApi } from '@/api/feature.api'
import { useCaseApi, userStoryApi } from '@/api/usecase.api'
import { aiStatusApi } from '@/api/admin.api'
import { designApi } from '@/api/design.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/shared/Badge'
import AppLayout from '@/components/layout/AppLayout'

const PRIORITIES = ['high', 'medium', 'low']
const STATUSES = ['new', 'review', 'confirmed', 'changed', 'deleted']

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

export default function RequirementDetailPage() {
  const { t } = useTranslation()
  const { projectId, reqId } = useParams<{ projectId: string; reqId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [showAIFeature, setShowAIFeature] = useState(false)

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId!),
    enabled: !!projectId,
  })

  const { data: req, isLoading } = useQuery({
    queryKey: ['requirement', projectId, reqId],
    queryFn: () => requirementApi.get(projectId!, reqId!),
    enabled: !!projectId && !!reqId,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<RequirementPayload>) => requirementApi.update(projectId!, reqId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requirement', projectId, reqId] })
      qc.invalidateQueries({ queryKey: ['requirements', projectId] })
      qc.invalidateQueries({ queryKey: ['requirements-all', projectId] })
      qc.invalidateQueries({ queryKey: ['features', projectId] })
      qc.invalidateQueries({ queryKey: ['features-for-filter', projectId] })
      setEditing(false)
    },
  })

  const { data: linkedUCs = [] } = useQuery({
    queryKey: ['use-cases', projectId, req?.id],
    queryFn: () => useCaseApi.list(projectId!),
    enabled: !!projectId && !!req,
    select: (data) => data.filter((uc: any) => uc.requirementId === req?.id),
  })

  const { data: linkedUSs = [] } = useQuery({
    queryKey: ['user-stories', projectId, req?.id],
    queryFn: () => userStoryApi.list(projectId!),
    enabled: !!projectId && !!req,
    select: (data) => data.filter((us: any) => us.requirementId === req?.id),
  })

  const { data: allDbTables = [] } = useQuery({
    queryKey: ['design-db', projectId],
    queryFn: () => designApi.listDbTables(projectId!),
    enabled: !!projectId && !!req,
  })

  const { data: allApiSpecs = [] } = useQuery({
    queryKey: ['design-api', projectId],
    queryFn: () => designApi.listApiSpecs(projectId!),
    enabled: !!projectId && !!req,
  })

  const { register, handleSubmit, reset } = useForm<RequirementPayload>()

  const startEdit = () => {
    if (!req) return
    reset({
      title: req.title,
      description: req.description,
      category: req.category,
      priority: req.priority,
      status: req.status,
      note: req.note,
    })
    setEditing(true)
  }

  if (isLoading) return <AppLayout><div className="p-6 text-gray-400">{t('common.loading')}</div></AppLayout>
  if (!req) return <AppLayout><div className="p-6 text-gray-400">요구사항을 찾을 수 없습니다</div></AppLayout>

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-mono">{req.code}</p>
            <h2 className="text-xl font-bold">{req.title}</h2>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil size={14} />
              {t('common.edit')}
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit(d => updateMutation.mutate(d))}>
          <Section
            title="기본 정보"
            action={editing && (
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  <X size={14} /> {t('common.cancel')}
                </Button>
                <Button type="submit" size="sm" disabled={updateMutation.isPending} disabledReason="처리 중입니다...">
                  <Save size={14} /> {t('common.save')}
                </Button>
              </div>
            )}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">요구사항 ID</Label>
                <p className="font-mono text-sm">{req.code}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">입력경로</Label>
                <p className="text-sm">{req.source}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">분류</Label>
                {editing
                  ? <Input {...register('category')} className="h-8 text-sm" />
                  : <p className="text-sm">{req.category ?? '-'}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">우선순위</Label>
                {editing
                  ? <select className="w-full border rounded-md px-2 py-1 text-sm" {...register('priority')}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
                    </select>
                  : <Badge value={req.priority} label={t(`priority.${req.priority}`)} />}
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">상태</Label>
                {editing
                  ? <select className="w-full border rounded-md px-2 py-1 text-sm" {...register('status')}>
                      {STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                    </select>
                  : <Badge value={req.status} label={t(`status.${req.status}`)} />}
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">등록일</Label>
                <p className="text-sm">{new Date(req.createdAt).toLocaleDateString('ko-KR')}</p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">요구사항명</Label>
                {editing
                  ? <Input {...register('title')} className="h-8 text-sm" />
                  : <p className="text-sm font-medium">{req.title}</p>}
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">상세설명</Label>
                {editing
                  ? <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={3} {...register('description')} />
                  : <p className="text-sm text-gray-700 whitespace-pre-wrap">{req.description ?? '-'}</p>}
              </div>
              {(editing || req.note) && (
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">비고</Label>
                  {editing
                    ? <Input {...register('note')} className="h-8 text-sm" />
                    : <p className="text-sm text-gray-600">{req.note}</p>}
                </div>
              )}
            </div>
          </Section>
        </form>

        <Section title="연결 항목" action={
          <Button
            variant="outline" size="sm"
            onClick={() => setShowAIFeature(true)}
            disabled={!aiStatus?.configured}
            disabledReason="관리자 페이지에서 LLM을 설정하세요"
            title={!aiStatus?.configured ? 'LLM 설정이 필요합니다. 관리자 페이지에서 LLM을 활성화하세요.' : undefined}
          >
            <Sparkles size={14} />AI 기능생성
          </Button>
        }>
          <div className="space-y-4">
            {linkedUCs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Users size={12} className="text-indigo-500" /> Use Case ({linkedUCs.length})
                </p>
                <div className="space-y-1">
                  {linkedUCs.map((uc: any) => (
                    <div key={uc.id} className="flex items-center gap-2 p-2 rounded border bg-indigo-50/50 text-xs">
                      <span className="font-mono text-gray-400">{uc.code}</span>
                      <span className="text-gray-700">{uc.title}</span>
                      {uc.actor && <span className="text-gray-400">· {uc.actor}</span>}
                      <Badge value={uc.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {linkedUSs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <BookOpen size={12} className="text-pink-500" /> User Story ({linkedUSs.length})
                </p>
                <div className="space-y-1">
                  {linkedUSs.map((us: any) => (
                    <div key={us.id} className="flex items-center gap-2 p-2 rounded border bg-pink-50/50 text-xs">
                      <span className="font-mono text-gray-400">{us.code}</span>
                      <span className="text-gray-700">{us.title}</span>
                      {us.asA && <span className="text-gray-400">· As a {us.asA}</span>}
                      <Badge value={us.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">🔧 기능 리스트 ({req.features?.length ?? 0})</p>
              {req.features && req.features.length > 0 ? (
                <div className="space-y-1">
                  {req.features.map((f: any) => {
                    const fDbTables = (allDbTables as any[]).filter(d => d.featureId === f.id)
                    const fApiSpecs = (allApiSpecs as any[]).filter(a => a.featureId === f.id)
                    return (
                    <div key={f.id} className="rounded border hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${projectId}/features/${f.id}`)}>
                      <div className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-400">{f.code}</span>
                          <span className="text-sm">{f.title}</span>
                          <Badge value={f.status} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {fDbTables.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] px-1 bg-green-100 text-green-700 rounded">
                              <Database size={10} />{fDbTables.length}DB
                            </span>
                          )}
                          {fApiSpecs.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] px-1 bg-cyan-100 text-cyan-700 rounded">
                              <Code2 size={10} />{fApiSpecs.length}API
                            </span>
                          )}
                          <ChevronRight size={14} className="text-gray-300" />
                        </div>
                      </div>
                      {(fDbTables.length > 0 || fApiSpecs.length > 0) && (
                        <div className="px-3 pb-2 flex flex-wrap gap-1">
                          {fDbTables.map((d: any) => (
                            <span key={d.id} className="text-[10px] bg-green-50 border border-green-200 text-green-700 px-1.5 py-0.5 rounded font-mono">{d.name}</span>
                          ))}
                          {fApiSpecs.map((a: any) => (
                            <span key={a.id} className="text-[10px] bg-cyan-50 border border-cyan-200 text-cyan-700 px-1.5 py-0.5 rounded font-mono">{a.method} {a.path}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 cursor-pointer hover:text-blue-500" onClick={() => navigate(`/projects/${projectId}/features`)}>+ 기능 추가 (기능 목록에서 요구사항 연결)</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">🧪 테스트 시나리오</p>
              <p className="text-sm text-gray-400">연결된 테스트 시나리오가 없습니다 (Step 3에서 구현)</p>
            </div>
          </div>
        </Section>

        <Section title="버전 이력">
          <VersionSection projectId={projectId!} entityType="requirement" entityQueryKey={['requirement', projectId!, reqId!]} />
        </Section>
      </div>

      <AIGenerateModal
        open={showAIFeature}
        onClose={() => setShowAIFeature(false)}
        title="🤖 AI 기능 리스트 생성"
        projectId={projectId!}
        endpoint="ai/generate-features"
        payload={{ requirementId: reqId }}
        onConfirm={async (items) => {
          for (const item of items) {
            await featureApi.create(projectId!, { title: item.title, description: item.description, reqId: reqId, status: 'new' })
          }
          qc.invalidateQueries({ queryKey: ['requirement', projectId, reqId] })
          qc.invalidateQueries({ queryKey: ['features', projectId] })
        }}
        renderItem={(item) => (
          <div>
            <p className="font-medium text-sm">{item.title}</p>
            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
          </div>
        )}
      />
    </AppLayout>
  )
}
