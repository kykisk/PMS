import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, ChevronRight, ChevronDown, CheckCircle, XCircle, Clock, Trash2, Pencil, Save, X, Sparkles } from 'lucide-react'
import { useState, useMemo, Fragment } from 'react'
import { testApi } from '@/api/test.api'
import apiClient from '@/api/client'
import { aiStatusApi } from '@/api/admin.api'
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

function CaseExecutionHistory({ projectId, caseId }: { projectId: string; caseId: string }) {
  const { data: executions = [] } = useQuery({
    queryKey: ['case-executions', caseId],
    queryFn: () => testApi.getCaseExecutions(projectId, caseId),
  })
  if (executions.length === 0) return <p className="text-xs text-gray-400 text-center py-2">실행 이력 없음</p>
  return (
    <div className="divide-y">
      {executions.map(e => (
        <div key={e.id} className="flex items-center gap-3 px-3 py-1.5 text-xs bg-gray-50/50">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${e.result === 'pass' ? 'bg-green-100 text-green-700' : e.result === 'fail' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
            {e.result}
          </span>
          <span className="text-gray-500 font-mono">{e.cycle?.code ?? '-'}</span>
          <span className="text-gray-600 flex-1">{e.actual ?? '-'}</span>
          <span className="text-gray-400">{e.executedAt ? new Date(e.executedAt).toLocaleDateString('ko-KR') : '-'}</span>
        </div>
      ))}
    </div>
  )
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
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', type: 'integration', description: '', testData: '' })
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [expandedCase, setExpandedCase] = useState<string | null>(null)
  const [createDefect, setCreateDefect] = useState(false)
  const [defectTitle, setDefectTitle] = useState('')
  const [defectSeverity, setDefectSeverity] = useState('major')

  const [showAICase, setShowAICase] = useState(false)
  const [aiCaseModel, setAiCaseModel] = useState('')
  const [aiCaseAdditionalInfo, setAiCaseAdditionalInfo] = useState('')
  const [aiCaseResults, setAiCaseResults] = useState<any[]>([])
  const [aiCaseStep, setAiCaseStep] = useState<'select' | 'generating' | 'preview'>('select')
  const [aiCaseShowTemplate, setAiCaseShowTemplate] = useState(false)

  const { data: scenario, isLoading } = useQuery({
    queryKey: ['scenario', projectId, scenarioId],
    queryFn: () => testApi.getScenario(projectId!, scenarioId!),
    enabled: !!projectId && !!scenarioId,
  })

  const { data: cycles = [] } = useQuery({
    queryKey: ['test-cycles', projectId],
    queryFn: () => testApi.listCycles(projectId!),
    enabled: !!projectId,
  })

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => aiStatusApi.check(projectId!),
    enabled: !!projectId,
  })

  const { data: cycleExecutions = [] } = useQuery({
    queryKey: ['cycle-executions', projectId, selectedCycleId],
    queryFn: () => testApi.getCycleExecutions(projectId!, selectedCycleId),
    enabled: !!selectedCycleId,
  })

  const executionMap = useMemo(() =>
    Object.fromEntries(cycleExecutions.map(e => [e.testCaseId, e])),
    [cycleExecutions]
  )

  const addCaseMutation = useMutation({
    mutationFn: () => testApi.createCase(projectId!, scenarioId!, {
      ...caseForm,
      steps: caseForm.steps ? caseForm.steps.split('\n').filter(Boolean) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenario', projectId, scenarioId] })
      qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
      setShowAddCase(false); setCaseForm({ title: '', type: 'integration', testData: '', expected: '', steps: '' })
    },
  })

  const executeMutation = useMutation({
    mutationFn: async (cId: string) => {
      if (selectedCycleId) {
        return testApi.createExecution(projectId!, selectedCycleId, {
          testCaseId: cId,
          result: execForm.result,
          actual: execForm.actual,
        })
      }
      return testApi.executeCase(projectId!, cId, execForm.result, execForm.actual)
    },
    onSuccess: async (executionResult) => {
      if (createDefect && defectTitle && executionResult && 'id' in executionResult) {
        await testApi.createDefect(projectId!, {
          title: defectTitle,
          severity: defectSeverity,
          executionId: executionResult.id,
        })
        qc.invalidateQueries({ queryKey: ['defects', projectId] })
      }
      qc.invalidateQueries({ queryKey: ['scenario', projectId, scenarioId] })
      qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
      qc.invalidateQueries({ queryKey: ['cycle-executions', projectId, selectedCycleId] })
      setShowExecute(null)
      setCreateDefect(false)
      setDefectTitle('')
      setDefectSeverity('major')
    },
  })

  const removeCaseMutation = useMutation({
    mutationFn: (cId: string) => testApi.removeCase(projectId!, cId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenario', projectId, scenarioId] })
      qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => testApi.updateScenario(projectId!, scenarioId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenario', projectId, scenarioId] })
      qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
      setEditing(false)
    },
  })

  const generateCasesMutation = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/ai/generate-test-cases`, {
      scenarioId: scenarioId,
      modelId: aiCaseModel || undefined,
      additionalInfo: aiCaseAdditionalInfo || undefined,
    }).then(r => r.data),
    onSuccess: (data: any[]) => {
      setAiCaseResults(data.map(item => ({ ...item, _selected: true })))
      setAiCaseStep('preview')
    },
  })

  const saveAICasesMutation = useMutation({
    mutationFn: async () => {
      const selected = aiCaseResults.filter(r => r._selected)
      for (const item of selected) {
        await testApi.createCase(projectId!, scenarioId!, {
          title: item.title,
          priority: item.priority ?? 'medium',
          steps: item.steps,
          testData: item.testData,
          expected: item.expected,
        })
      }
      return selected.length
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenario', projectId, scenarioId] })
      qc.invalidateQueries({ queryKey: ['scenarios', projectId] })
      setShowAICase(false)
      setAiCaseStep('select')
      setAiCaseResults([])
      setAiCaseAdditionalInfo('')
      setAiCaseModel('')
    },
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

        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-gray-50 rounded-lg border">
          <span className="text-xs text-gray-500 flex-shrink-0">실행 회차</span>
          <select
            className="border rounded px-2 h-7 text-xs flex-1 max-w-xs"
            value={selectedCycleId}
            onChange={e => setSelectedCycleId(e.target.value)}
          >
            <option value="">회차 선택...</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.code} - {c.title}</option>)}
          </select>
          {selectedCycleId && <span className="text-[10px] text-gray-400">선택된 회차의 실행 결과가 표시됩니다</span>}
        </div>

        <Section title="기본 정보" action={
          editing ? (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X size={14} />취소</Button>
              <Button size="sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(editForm)}><Save size={14} />저장</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => { setEditForm({ title: s.title, type: s.type, description: s.description ?? '', testData: s.testData ?? '' }); setEditing(true) }}><Pencil size={14} />수정</Button>
          )
        }>
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-xs text-gray-500 mb-1 block">코드</Label><p className="font-mono text-sm">{s.code}</p></div>
            <div><Label className="text-xs text-gray-500 mb-1 block">유형</Label>
              {editing ? (
                <select className="w-full border rounded-md px-3 py-1.5 text-sm h-8" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="integration">통합</option>
                  <option value="unit">단위</option>
                </select>
              ) : (
                <span className={`px-2 py-0.5 rounded text-xs ${s.type === 'unit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {s.type === 'unit' ? '단위' : '통합'}
                </span>
              )}
            </div>
            <div className="col-span-2"><Label className="text-xs text-gray-500 mb-1 block">제목</Label>
              {editing ? (
                <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-sm" />
              ) : (
                <p className="text-sm">{s.title}</p>
              )}
            </div>
            <div className="col-span-2"><Label className="text-xs text-gray-500 mb-1 block">테스트 데이터</Label>
              {editing ? (
                <Input value={editForm.testData} onChange={e => setEditForm(f => ({ ...f, testData: e.target.value }))} className="h-8 text-sm" placeholder="테스트 데이터" />
              ) : (
                <p className="text-sm">{s.testData || '-'}</p>
              )}
            </div>
            <div className="col-span-2"><Label className="text-xs text-gray-500 mb-1 block">설명</Label>
              {editing ? (
                <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="h-8 text-sm" placeholder="설명" />
              ) : (
                <p className="text-sm text-gray-700">{s.description || '-'}</p>
              )}
            </div>
          </div>
        </Section>

        <Section title={`테스트 케이스 (${s.testCases?.length ?? 0})`} action={
          <div className="flex gap-2">
            {aiStatus?.configured && (
              <Button variant="outline" size="sm" className="text-[#5E6AD2] border-[#5E6AD2]/30 hover:bg-[#5E6AD2]/5"
                onClick={() => { setAiCaseStep('select'); setAiCaseResults([]); setShowAICase(true) }}>
                <Sparkles size={14} />AI 케이스 생성
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowAddCase(true)}><Plus size={14} />케이스 추가</Button>
          </div>
        }>
          {(!s.testCases || s.testCases.length === 0) ? (
            <p className="text-sm text-gray-400">테스트 케이스가 없습니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-8"></th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">케이스명</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-16">유형</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">결과</th>
                <th className="w-24 px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {s.testCases.map((tc: any) => (
                  <Fragment key={tc.id}>
                    <tr className="border-t">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setExpandedCase(expandedCase === tc.id ? null : tc.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {expandedCase === tc.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-2">{tc.title}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${tc.type === 'unit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{tc.type === 'unit' ? '단위' : '통합'}</span></td>
                      <td className="px-3 py-2">
                        {selectedCycleId
                          ? (executionMap[tc.id]
                              ? <ResultBadge result={executionMap[tc.id].result} />
                              : <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">미수행</span>)
                          : <ResultBadge result={tc.result} />
                        }
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { setExecForm({ result: 'pass', actual: '' }); setCreateDefect(false); setDefectTitle(''); setDefectSeverity('major'); setShowExecute(tc.id) }} className="text-xs px-2 py-0.5 border rounded text-gray-600 hover:bg-gray-50">수행</button>
                          <button onClick={() => { if (confirm('삭제?')) removeCaseMutation.mutate(tc.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                    {expandedCase === tc.id && (
                      <tr className="border-t bg-gray-50/30">
                        <td colSpan={5} className="px-3 py-0">
                          <CaseExecutionHistory projectId={projectId!} caseId={tc.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
          <VersionSection projectId={projectId!} entityType="testScenario" entityQueryKey={['scenario', projectId!, scenarioId!]} />
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
          {execForm.result === 'fail' && (
            <div className="mt-2 border-t pt-2 space-y-1.5">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={createDefect} onChange={e => setCreateDefect(e.target.checked)} />
                결함 즉시 등록
              </label>
              {createDefect && (
                <>
                  <input
                    className="w-full border rounded px-2 py-1 text-xs"
                    placeholder="결함 제목"
                    value={defectTitle}
                    onChange={e => setDefectTitle(e.target.value)}
                  />
                  <select className="w-full border rounded px-2 h-7 text-xs" value={defectSeverity} onChange={e => setDefectSeverity(e.target.value)}>
                    <option value="critical">치명적(Critical)</option>
                    <option value="major">주요(Major)</option>
                    <option value="minor">경미(Minor)</option>
                    <option value="trivial">사소(Trivial)</option>
                  </select>
                </>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowExecute(null)}>{t('common.cancel')}</Button>
            <Button disabled={executeMutation.isPending} disabledReason="처리 중입니다..." onClick={() => showExecute && executeMutation.mutate(showExecute)}>기록</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showAICase} onClose={() => { setShowAICase(false); setAiCaseStep('select'); setAiCaseResults([]) }} title="AI 테스트 케이스 생성" className="max-w-lg">
        <div className="flex flex-col max-h-[calc(85vh-8rem)]">
          {aiCaseStep === 'select' && (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pt-2">
                <div className="px-3 py-2 bg-gray-50 rounded-md border text-xs text-gray-600">
                  <p className="font-medium mb-0.5">대상 시나리오</p>
                  <p className="text-[#5E6AD2]">{s.code} - {s.title}</p>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  AI가 시나리오를 분석하여 정상 케이스, 예외 케이스, 경계값 케이스, 에러 케이스를 자동으로 도출합니다.
                </p>
                {aiStatus?.models && aiStatus.models.length > 0 && (
                  <select className="border rounded-md px-2 h-7 text-xs w-full text-gray-600"
                    value={aiCaseModel} onChange={e => setAiCaseModel(e.target.value)}>
                    <option value="">AI 모델 자동 선택</option>
                    {aiStatus.models.map((m: any) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                )}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-gray-600">추가 정보 <span className="text-gray-400 font-normal">(선택)</span></label>
                    <div className="relative">
                      <button type="button" onClick={() => setAiCaseShowTemplate(p => !p)} className="text-[10px] text-[#5E6AD2] hover:underline">📋 템플릿</button>
                      {aiCaseShowTemplate && (
                        <div className="absolute right-0 top-5 z-10 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[180px]">
                          {[
                            { label: '테스트 환경', value: '테스트 환경: \n사전 조건: \n제외 케이스: ' },
                            { label: '보안 관점', value: '보안 체크 포인트: \n권한 검증: \n입력값 검증: ' },
                          ].map(t => (
                            <button key={t.label} onClick={() => { setAiCaseAdditionalInfo(t.value); setAiCaseShowTemplate(false) }}
                              className="block w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50">{t.label}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <textarea
                    className="w-full border rounded-md px-2 py-1.5 text-xs text-gray-700 resize-none placeholder:text-gray-300"
                    rows={3}
                    placeholder="테스트 환경, 제외할 케이스, 특별히 중요한 케이스 등을 입력하면 AI가 더 정확하게 생성합니다."
                    value={aiCaseAdditionalInfo}
                    onChange={e => setAiCaseAdditionalInfo(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-shrink-0 border-t border-gray-100 pt-3 mt-2 flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAICase(false)}>취소</Button>
                <Button size="sm" className="h-7 text-xs"
                  disabled={generateCasesMutation.isPending}
                  onClick={() => { setAiCaseStep('generating'); generateCasesMutation.mutate() }}>
                  분석 시작
                </Button>
              </div>
            </>
          )}

          {aiCaseStep === 'generating' && (
            <div className="py-8 text-center space-y-3">
              <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                <div className="w-4 h-4 border-2 border-[#5E6AD2] border-t-transparent rounded-full animate-spin" />
                AI가 케이스를 생성하고 있습니다...
              </div>
              {generateCasesMutation.isError && (
                <div className="text-sm text-red-600">
                  오류가 발생했습니다.
                  <Button variant="outline" size="sm" className="ml-2 h-7 text-xs" onClick={() => generateCasesMutation.mutate()}>재시도</Button>
                </div>
              )}
            </div>
          )}

          {aiCaseStep === 'preview' && (
            <>
              <div className="flex items-center justify-between pt-2 pb-2 flex-shrink-0">
                <p className="text-xs text-gray-600">{aiCaseResults.length}개 생성됨 · {aiCaseResults.filter(r => r._selected).length}개 선택</p>
                <button
                  onClick={() => {
                    const allSelected = aiCaseResults.every(r => r._selected)
                    setAiCaseResults(prev => prev.map(item => ({ ...item, _selected: !allSelected })))
                  }}
                  className="text-[11px] text-[#5E6AD2] hover:underline"
                >
                  {aiCaseResults.every(r => r._selected) ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto border rounded-md divide-y">
                {aiCaseResults.map((item, idx) => (
                  <div key={idx} onClick={() => setAiCaseResults(prev => prev.map((r, i) => i === idx ? { ...r, _selected: !r._selected } : r))}
                    className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors ${item._selected ? 'bg-blue-50/40' : 'opacity-50'}`}>
                    <input type="checkbox" checked={item._selected} onChange={() => {}} className="mt-0.5 flex-shrink-0 w-3.5 h-3.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.priority === 'high' && <span className="text-[9px] px-1 rounded bg-red-100 text-red-700 font-medium flex-shrink-0">높음</span>}
                        {item.priority === 'medium' && <span className="text-[9px] px-1 rounded bg-yellow-100 text-yellow-700 font-medium flex-shrink-0">보통</span>}
                        {item.priority === 'low' && <span className="text-[9px] px-1 rounded bg-gray-100 text-gray-500 font-medium flex-shrink-0">낮음</span>}
                        <p className="text-xs font-medium text-gray-800">{item.title}</p>
                      </div>
                      {item.expected && <p className="text-[11px] text-gray-500 mt-0.5">기대결과: {item.expected}</p>}
                      {item.testData && <p className="text-[11px] text-gray-400 mt-0.5">입력: {item.testData}</p>}
                      {item.steps && Array.isArray(item.steps) && item.steps.length > 0 && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.steps.length}개 수행 단계</p>
                      )}
                    </div>
                  </div>
                ))}
                {aiCaseResults.length === 0 && <div className="py-6 text-center text-xs text-gray-400">생성된 케이스가 없습니다</div>}
              </div>
              <div className="flex-shrink-0 border-t border-gray-100 pt-3 mt-2 flex justify-between items-center">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setAiCaseStep('select'); setAiCaseResults([]) }}>이전</Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAICase(false)}>취소</Button>
                  <Button size="sm" className="h-7 text-xs"
                    disabled={aiCaseResults.filter(r => r._selected).length === 0 || saveAICasesMutation.isPending}
                    disabledReason={saveAICasesMutation.isPending ? '저장 중...' : '케이스를 선택하세요'}
                    onClick={() => saveAICasesMutation.mutate()}>
                    {saveAICasesMutation.isPending ? '저장 중...' : `${aiCaseResults.filter(r => r._selected).length}개 저장`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </AppLayout>
  )
}
