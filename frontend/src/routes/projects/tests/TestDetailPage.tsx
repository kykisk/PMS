import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, ChevronRight, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { testApi } from '@/api/test.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { VersionSection } from '@/components/shared/VersionSection'
import AppLayout from '@/components/layout/AppLayout'

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

function ResultBadge({ result }: { result?: string }) {
  if (result === 'pass') return <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={13} />Pass</span>
  if (result === 'fail') return <span className="flex items-center gap-1 text-red-600 text-xs"><XCircle size={13} />Fail</span>
  return <span className="flex items-center gap-1 text-gray-400 text-xs"><Clock size={13} />미수행</span>
}

export default function TestDetailPage() {
  const { t } = useTranslation()
  const { projectId, scenarioId } = useParams<{ projectId: string; scenarioId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showAddCase, setShowAddCase] = useState(false)
  const [showExecute, setShowExecute] = useState<string | null>(null)
  const [caseForm, setCaseForm] = useState({ title: '', type: 'integration', testData: '', expected: '', steps: '' })
  const [execForm, setExecForm] = useState({ result: 'pass', actual: '' })

  const { data: scenario, isLoading } = useQuery({
    queryKey: ['scenario', projectId, scenarioId],
    queryFn: () => testApi.getScenario(projectId!, scenarioId!),
    enabled: !!projectId && !!scenarioId,
  })

  const addCaseMutation = useMutation({
    mutationFn: () => testApi.createCase(projectId!, scenarioId!, {
      ...caseForm,
      steps: caseForm.steps ? caseForm.steps.split('\n').filter(Boolean) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scenario', projectId, scenarioId] }); setShowAddCase(false); setCaseForm({ title: '', type: 'integration', testData: '', expected: '', steps: '' }) },
  })

  const executeMutation = useMutation({
    mutationFn: (cId: string) => testApi.executeCase(projectId!, cId, execForm.result, execForm.actual),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scenario', projectId, scenarioId] }); setShowExecute(null) },
  })

  const removeCaseMutation = useMutation({
    mutationFn: (cId: string) => testApi.removeCase(projectId!, cId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenario', projectId, scenarioId] }),
  })

  if (isLoading) return <AppLayout><div className="p-6 text-gray-400">{t('common.loading')}</div></AppLayout>
  if (!scenario) return <AppLayout><div className="p-6 text-gray-400">시나리오를 찾을 수 없습니다</div></AppLayout>

  const s = scenario as any

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-mono">{s.code}</p>
            <h2 className="text-xl font-bold">{s.title}</h2>
          </div>
        </div>

        <Section title="기본 정보">
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-xs text-gray-500 mb-1 block">코드</Label><p className="font-mono text-sm">{s.code}</p></div>
            <div><Label className="text-xs text-gray-500 mb-1 block">유형</Label>
              <span className={`px-2 py-0.5 rounded text-xs ${s.type === 'unit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {s.type === 'unit' ? '단위' : '통합'}
              </span>
            </div>
            {s.testData && <div className="col-span-2"><Label className="text-xs text-gray-500 mb-1 block">테스트 데이터</Label><p className="text-sm">{s.testData}</p></div>}
            {s.description && <div className="col-span-2"><Label className="text-xs text-gray-500 mb-1 block">설명</Label><p className="text-sm text-gray-700">{s.description}</p></div>}
          </div>
        </Section>

        <Section title={`테스트 케이스 (${s.testCases?.length ?? 0})`} action={
          <Button variant="outline" size="sm" onClick={() => setShowAddCase(true)}><Plus size={14} />케이스 추가</Button>
        }>
          {(!s.testCases || s.testCases.length === 0) ? (
            <p className="text-sm text-gray-400">테스트 케이스가 없습니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">케이스명</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-16">유형</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">결과</th>
                <th className="w-24 px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {s.testCases.map((tc: any) => (
                  <tr key={tc.id} className="border-t">
                    <td className="px-3 py-2">{tc.title}</td>
                    <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${tc.type === 'unit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{tc.type === 'unit' ? '단위' : '통합'}</span></td>
                    <td className="px-3 py-2"><ResultBadge result={tc.result} /></td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => { setExecForm({ result: 'pass', actual: '' }); setShowExecute(tc.id) }} className="text-xs px-2 py-0.5 border rounded text-gray-600 hover:bg-gray-50">수행</button>
                        <button onClick={() => { if (confirm('삭제?')) removeCaseMutation.mutate(tc.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="연결 항목">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">📋 원본 요구사항</p>
              {s.feature?.requirement
                ? <div className="flex items-center justify-between p-2 rounded border hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${projectId}/requirements/${s.feature.requirement.id}`)}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{s.feature.requirement.code}</span>
                      <span className="text-sm">{s.feature.requirement.title}</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                : <p className="text-sm text-gray-400">-</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">🔧 연결 기능</p>
              {s.feature
                ? <div className="flex items-center justify-between p-2 rounded border hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${projectId}/features/${s.feature.id}`)}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{s.feature.code}</span>
                      <span className="text-sm">{s.feature.title}</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                : <p className="text-sm text-gray-400">-</p>}
            </div>
          </div>
        </Section>

        <Section title="버전 이력">
          <VersionSection projectId={projectId!} entityType="testScenario" />
        </Section>
      </div>

      <Modal open={showAddCase} onClose={() => setShowAddCase(false)} title="테스트 케이스 추가" className="max-w-lg">
        <div className="space-y-3">
          <div className="space-y-1"><Label>케이스명 *</Label><Input value={caseForm.title} onChange={e => setCaseForm(f => ({ ...f, title: e.target.value }))} placeholder="유효한 이메일/비밀번호로 로그인 성공" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>유형</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={caseForm.type} onChange={e => setCaseForm(f => ({ ...f, type: e.target.value }))}>
                <option value="integration">통합</option>
                <option value="unit">단위</option>
              </select>
            </div>
            <div className="space-y-1"><Label>테스트 데이터</Label><Input value={caseForm.testData} onChange={e => setCaseForm(f => ({ ...f, testData: e.target.value }))} placeholder="선택 입력" /></div>
          </div>
          <div className="space-y-1"><Label>수행 절차 (줄 구분)</Label><textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={3} value={caseForm.steps} onChange={e => setCaseForm(f => ({ ...f, steps: e.target.value }))} placeholder={"1. 로그인 화면 이동\n2. 이메일 입력\n3. 비밀번호 입력\n4. 로그인 버튼 클릭"} /></div>
          <div className="space-y-1"><Label>예상 결과</Label><Input value={caseForm.expected} onChange={e => setCaseForm(f => ({ ...f, expected: e.target.value }))} placeholder="로그인 성공 후 대시보드 이동" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddCase(false)}>{t('common.cancel')}</Button>
            <Button disabled={!caseForm.title || addCaseMutation.isPending} disabledReason={!caseForm.title ? "필수 항목을 입력하세요" : "처리 중입니다..."} onClick={() => addCaseMutation.mutate()}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showExecute} onClose={() => setShowExecute(null)} title="테스트 결과 기록">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>판정 *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={execForm.result} onChange={e => setExecForm(f => ({ ...f, result: e.target.value }))}>
              <option value="pass">Pass ✅</option>
              <option value="fail">Fail ❌</option>
            </select>
          </div>
          <div className="space-y-1"><Label>실제 결과</Label><textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none" rows={3} value={execForm.actual} onChange={e => setExecForm(f => ({ ...f, actual: e.target.value }))} placeholder="실제 수행 결과 입력" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowExecute(null)}>{t('common.cancel')}</Button>
            <Button disabled={executeMutation.isPending} disabledReason="처리 중입니다..." onClick={() => showExecute && executeMutation.mutate(showExecute)}>기록</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
