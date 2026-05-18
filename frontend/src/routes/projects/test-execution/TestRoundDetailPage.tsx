import { useState, useEffect, useMemo, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronDown, ChevronRight, Save } from 'lucide-react'
import { testExecutionApi } from '@/api/test-execution.api'
import { testApi } from '@/api/test.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/shared/Modal'
import { TableSkeleton } from '@/components/shared/Skeleton'
import AppLayout from '@/components/layout/AppLayout'

interface ResultState {
  scenarioCode: string
  caseTitle: string
  caseIndex: number
  result: string
  actual: string
  stepResults: any
}

const RESULT_BG: Record<string, string> = {
  pass: 'bg-green-50',
  fail: 'bg-red-50',
  blocked: 'bg-yellow-50',
  na: 'bg-gray-50',
}

export default function TestRoundDetailPage() {
  const { projectId, phaseId, roundId } = useParams<{ projectId: string; phaseId: string; roundId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [results, setResults] = useState<Record<string, ResultState>>({})
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [defectTarget, setDefectTarget] = useState<{ scenarioCode: string; caseTitle: string } | null>(null)
  const [defectTitle, setDefectTitle] = useState('')
  const [defectSeverity, setDefectSeverity] = useState('major')

  const { data: round, isLoading: roundLoading } = useQuery({
    queryKey: ['test-round', projectId, phaseId, roundId],
    queryFn: () => testExecutionApi.getRound(projectId!, phaseId!, roundId!),
    enabled: !!projectId && !!phaseId && !!roundId,
  })

  const { data: phase, isLoading: phaseLoading } = useQuery({
    queryKey: ['test-phase', projectId, phaseId],
    queryFn: () => testExecutionApi.getPhase(projectId!, phaseId!),
    enabled: !!projectId && !!phaseId,
  })

  const { data: existingResults = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['test-results', roundId],
    queryFn: () => testExecutionApi.getResults(projectId!, roundId!),
    enabled: !!projectId && !!roundId,
  })

  useEffect(() => {
    if (!phase) return
    const snapshot = (phase as any).snapshotData
    if (!snapshot?.scenarios) return

    const map: Record<string, ResultState> = {}
    snapshot.scenarios.forEach((sc: any) => {
      (sc.cases || []).forEach((tc: any) => {
        const key = `${sc.code}::${tc.index}`
        map[key] = {
          scenarioCode: sc.code,
          caseTitle: tc.title,
          caseIndex: tc.index,
          result: '',
          actual: '',
          stepResults: null,
        }
      })
    })
    existingResults.forEach(r => {
      const key = `${r.scenarioCode}::${r.caseIndex}`
      if (map[key]) {
        map[key] = {
          ...map[key],
          result: r.result || '',
          actual: r.actual || '',
          stepResults: r.stepResults || null,
        }
      }
    })
    setResults(map)
  }, [phase, existingResults])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = Object.values(results).map(r => ({
        scenarioCode: r.scenarioCode,
        caseTitle: r.caseTitle,
        caseIndex: r.caseIndex,
        result: r.result || undefined,
        actual: r.actual || undefined,
        stepResults: r.stepResults || undefined,
      }))
      return testExecutionApi.saveResults(projectId!, roundId!, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-round', projectId, phaseId, roundId] })
      qc.invalidateQueries({ queryKey: ['test-rounds', projectId, phaseId] })
      qc.invalidateQueries({ queryKey: ['test-results', roundId] })
    },
  })

  const grouped = useMemo(() => {
    const groups: Record<string, { scenarioCode: string; cases: ResultState[] }> = {}
    Object.values(results).forEach(r => {
      if (!groups[r.scenarioCode]) {
        groups[r.scenarioCode] = { scenarioCode: r.scenarioCode, cases: [] }
      }
      groups[r.scenarioCode].cases.push(r)
    })
    Object.values(groups).forEach(g => g.cases.sort((a, b) => a.caseIndex - b.caseIndex))
    return Object.values(groups).sort((a, b) => a.scenarioCode.localeCompare(b.scenarioCode))
  }, [results])

  const totalCases = Object.keys(results).length
  const filledCases = Object.values(results).filter(r => r.result).length
  const progressPercent = totalCases > 0 ? Math.round((filledCases / totalCases) * 100) : 0

  const updateResult = (key: string, field: keyof ResultState, value: string) => {
    setResults(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const toggleStep = (key: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleCreateDefect = async () => {
    if (!defectTarget) return
    const title = defectTitle || `[${defectTarget.scenarioCode}] ${defectTarget.caseTitle} - 실패`
    await testApi.createDefect(projectId!, { title, severity: defectSeverity })
    setDefectTarget(null)
    setDefectTitle('')
    setDefectSeverity('major')
  }

  if (roundLoading || resultsLoading || phaseLoading) {
    return (
      <AppLayout>
        <div className="p-4"><TableSkeleton rows={8} cols={5} /></div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => navigate(`/projects/${projectId}/test-execution/${phaseId}`)} className="p-1 text-gray-400 hover:text-gray-600">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-sm font-bold text-gray-800">
            #{round?.roundNumber} 수행 회차
          </h2>
          <span className="text-xs text-gray-500">
            {round?.testerName}{round?.testerDept ? ` (${round.testerDept})` : ''}
          </span>
          {round?.executedAt && (
            <span className="text-xs text-gray-400">
              · {new Date(round.executedAt).toLocaleDateString('ko-KR')}
            </span>
          )}
          <div className="flex-1" />
          <Button size="sm" className="h-7 text-xs px-3" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save size={12} />{saveMutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#5E6AD2] rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="text-xs text-gray-500">{filledCases}/{totalCases} ({progressPercent}%)</span>
        </div>

        {grouped.length === 0 ? (
          <div className="bg-white rounded-lg border p-6 text-center text-xs text-gray-400">
            결과 데이터가 없습니다. 스냅샷이 생성되어야 케이스를 확인할 수 있습니다.
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-10">#</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">케이스명</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-28">결과</th>
                  <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-40">비고</th>
                  <th className="w-10 px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(group => (
                  <Fragment key={group.scenarioCode}>
                    <tr className="bg-gray-50/80 border-b">
                      <td colSpan={5} className="px-3 py-1.5">
                        <span className="font-mono text-[10px] text-[#5E6AD2] mr-2">{group.scenarioCode}</span>
                        <span className="text-xs font-medium text-gray-700">
                          {group.cases[0]?.caseTitle?.split(' - ')[0] || group.scenarioCode}
                        </span>
                      </td>
                    </tr>
                    {group.cases.map(c => {
                      const key = `${c.scenarioCode}::${c.caseIndex}`
                      const hasSteps = c.stepResults && Object.keys(c.stepResults).length > 0
                      return (
                        <Fragment key={key}>
                          <tr className={`border-b transition-colors ${RESULT_BG[c.result] || ''}`}>
                            <td className="px-3 py-1.5 text-xs text-gray-400">{c.caseIndex}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-700">{c.caseTitle}</td>
                            <td className="px-3 py-1.5">
                              <select
                                className="border rounded px-2 py-1 text-xs w-full focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                                value={c.result}
                                onChange={e => updateResult(key, 'result', e.target.value)}
                              >
                                <option value="">미수행</option>
                                <option value="pass">Pass ✓</option>
                                <option value="fail">Fail ✗</option>
                                <option value="blocked">Blocked ◇</option>
                                <option value="na">N/A –</option>
                              </select>
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1">
                                <input
                                  className="border rounded px-2 py-1 text-xs flex-1 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                                  placeholder="비고"
                                  value={c.actual}
                                  onChange={e => updateResult(key, 'actual', e.target.value)}
                                />
                                {c.result === 'fail' && (
                                  <button
                                    onClick={() => setDefectTarget({ scenarioCode: c.scenarioCode, caseTitle: c.caseTitle })}
                                    className="text-xs text-red-500 hover:underline ml-1 whitespace-nowrap"
                                  >
                                    결함 등록
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-1.5">
                              {hasSteps && (
                                <button onClick={() => toggleStep(key)} className="p-0.5 text-gray-400 hover:text-gray-600">
                                  {expandedSteps.has(key) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </button>
                              )}
                            </td>
                          </tr>
                          {hasSteps && expandedSteps.has(key) && (
                            <tr className="border-b bg-gray-50/50">
                              <td></td>
                              <td colSpan={4} className="px-3 py-2">
                                <div className="space-y-1">
                                  {Object.entries(c.stepResults).map(([stepIdx, stepVal]: [string, any]) => (
                                    <div key={stepIdx} className="flex items-center gap-2 text-[10px]">
                                      <span className="text-gray-400 w-12">Step {stepIdx}</span>
                                      <span className={`px-1.5 py-0.5 rounded ${stepVal === 'pass' ? 'bg-green-100 text-green-700' : stepVal === 'fail' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {stepVal || '-'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {defectTarget && (
        <Modal open={!!defectTarget} onClose={() => setDefectTarget(null)} title="결함 등록">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">제목</label>
              <Input className="h-7 text-xs mt-1" value={defectTitle} onChange={e => setDefectTitle(e.target.value)}
                placeholder={`[${defectTarget.scenarioCode}] ${defectTarget.caseTitle} - 실패`} />
            </div>
            <div>
              <label className="text-xs text-gray-500">심각도</label>
              <select className="w-full border rounded px-2 h-7 text-xs mt-1" value={defectSeverity} onChange={e => setDefectSeverity(e.target.value)}>
                <option value="critical">치명적</option>
                <option value="major">주요</option>
                <option value="minor">경미</option>
                <option value="trivial">사소</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDefectTarget(null)}>취소</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreateDefect}>등록</Button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  )
}
