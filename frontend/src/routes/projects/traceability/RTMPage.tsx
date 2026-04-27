import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle, XCircle, Clock, Download } from 'lucide-react'
import { traceApi } from '@/api/test.api'
import { exportApi } from '@/api/export.api'
import { Button } from '@/components/ui/button'
import AppLayout from '@/components/layout/AppLayout'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'

function ResultIcon({ result }: { result?: string }) {
  if (result === 'pass') return <CheckCircle size={14} className="text-green-500" />
  if (result === 'fail') return <XCircle size={14} className="text-red-500" />
  if (result === 'no_cases') return <AlertTriangle size={14} className="text-yellow-500" />
  return <Clock size={14} className="text-gray-400" />
}

function CoverageBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444' }} />
      </div>
      <span className="text-xs font-medium w-10 text-right">{value}%</span>
    </div>
  )
}

export default function RTMPage() {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const { data: matrix = [], isLoading: matrixLoading } = useQuery({
    queryKey: ['rtm-matrix', projectId],
    queryFn: () => traceApi.matrix(projectId!),
    enabled: !!projectId,
  })

  const { data: coverage } = useQuery({
    queryKey: ['rtm-coverage', projectId],
    queryFn: () => traceApi.coverage(projectId!),
    enabled: !!projectId,
  })

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{t('nav.traceability')} (RTM)</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportApi.rtm(projectId!)}><Download size={16} />RTM Excel</Button>
            <Button variant="outline" onClick={() => exportApi.rtmPdf(projectId!)}><Download size={16} />RTM PDF</Button>
          </div>
        </div>

        {coverage && (
          <div className="bg-white rounded-lg border p-5 mb-6">
            <h3 className="font-semibold text-sm text-gray-700 mb-4">커버리지 요약</h3>
            <div className="space-y-3">
              <CoverageBar label="요구사항 → 기능" value={coverage.requirements?.coverage ?? 0} />
              <CoverageBar label="기능 → Task" value={coverage.features?.taskCoverage ?? 0} />
              <CoverageBar label="기능 → 테스트" value={coverage.features?.testCoverage ?? 0} />
              <CoverageBar label="테스트 Pass율" value={coverage.testCases?.passRate ?? 0} />
            </div>
            <div className="flex gap-6 mt-4 pt-4 border-t text-xs text-gray-500">
              <span>요구사항 {coverage.requirements?.total ?? 0}건</span>
              <span>기능 {coverage.features?.total ?? 0}건</span>
              <span>Task {coverage.tasks?.total ?? 0}건</span>
              <span>테스트 시나리오 {coverage.testScenarios?.total ?? 0}건</span>
              <span>테스트 케이스 {coverage.testCases?.total ?? 0}건 (Pass {coverage.testCases?.passed ?? 0}건)</span>
            </div>
          </div>
        )}

        {matrixLoading ? (
          <div className="bg-white rounded-lg border p-6">
            <TableSkeleton rows={6} cols={5} />
          </div>
        ) : (matrix as any[]).length === 0 ? (
          <div className="bg-white rounded-lg border">
            <EmptyState message="요구사항이 없습니다. 요구사항을 먼저 등록해주세요." />
          </div>
        ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">요구사항</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">기능</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">Task</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">테스트 시나리오</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-16">결과</th>
                </tr>
              </thead>
              <tbody>
                {(matrix as any[]).flatMap((row: any, ri: number) => {
                    const allFeatures = row.features ?? []
                    const directScenarios = row.directScenarios ?? []

                    if (allFeatures.length === 0 && directScenarios.length === 0) {
                      return [(
                        <tr key={`req-${ri}`} className="border-b bg-yellow-50">
                          <td className="px-4 py-3">
                            <button className="text-left hover:text-blue-600" onClick={() => navigate(`/projects/${projectId}/requirements/${row.requirement.id}`)}>
                              <p className="font-mono text-xs text-gray-400">{row.requirement.code}</p>
                              <p className="text-sm font-medium">{row.requirement.title}</p>
                            </button>
                          </td>
                          <td className="px-4 py-3"><span className="text-yellow-600 text-xs flex items-center gap-1"><AlertTriangle size={12} />갭</span></td>
                          <td className="px-4 py-3"><span className="text-yellow-600 text-xs flex items-center gap-1"><AlertTriangle size={12} />갭</span></td>
                          <td className="px-4 py-3"><span className="text-yellow-600 text-xs flex items-center gap-1"><AlertTriangle size={12} />갭</span></td>
                          <td className="px-4 py-3">-</td>
                        </tr>
                      )]
                    }

                    return allFeatures.flatMap((feat: any, fi: number) => {
                      const featureTasks = feat.tasks ?? []
                      const featureScenarios = feat.testScenarios ?? []
                      const maxRows = Math.max(featureTasks.length, featureScenarios.length, 1)

                      return Array.from({ length: maxRows }, (_, idx) => {
                        const task = featureTasks[idx]
                        const scenario = featureScenarios[idx]
                        return (
                          <tr key={`${ri}-${fi}-${idx}`} className="border-b hover:bg-gray-50">
                            {fi === 0 && idx === 0 && (
                              <td className="px-4 py-3 align-top" rowSpan={allFeatures.reduce((s: number, f: any) => s + Math.max(f.tasks?.length ?? 0, f.testScenarios?.length ?? 0, 1), 0)}>
                                <button className="text-left hover:text-blue-600" onClick={() => navigate(`/projects/${projectId}/requirements/${row.requirement.id}`)}>
                                  <p className="font-mono text-xs text-gray-400">{row.requirement.code}</p>
                                  <p className="text-sm font-medium">{row.requirement.title}</p>
                                </button>
                              </td>
                            )}
                            {idx === 0 && (
                              <td className="px-4 py-3 align-top" rowSpan={maxRows}>
                                <button className="text-left hover:text-blue-600" onClick={() => navigate(`/projects/${projectId}/features/${feat.id}`)}>
                                  <p className="font-mono text-xs text-gray-400">{feat.code}</p>
                                  <p className="text-sm">{feat.title}</p>
                                </button>
                              </td>
                            )}
                            <td className="px-4 py-3">
                              {task
                                ? <button className="text-left hover:text-blue-600" onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}>
                                    <p className="font-mono text-xs text-gray-400">{task.code}</p>
                                    <p className="text-sm">{task.title}</p>
                                    <div className="mt-1 bg-gray-200 rounded-full h-1.5 w-20">
                                      <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${task.progress}%` }} />
                                    </div>
                                  </button>
                                : <span className="text-yellow-600 text-xs flex items-center gap-1"><AlertTriangle size={12} />갭</span>}
                            </td>
                            <td className="px-4 py-3">
                              {scenario
                                ? <button className="text-left hover:text-blue-600" onClick={() => navigate(`/projects/${projectId}/tests/${scenario.id}`)}>
                                    <p className="font-mono text-xs text-gray-400">{scenario.code}</p>
                                    <p className="text-sm">{scenario.title}</p>
                                  </button>
                                : <span className="text-yellow-600 text-xs flex items-center gap-1"><AlertTriangle size={12} />갭</span>}
                            </td>
                            <td className="px-4 py-3">
                              {scenario ? <ResultIcon result={scenario.result} /> : <span className="text-gray-300">-</span>}
                            </td>
                          </tr>
                        )
                      })
                    })
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
        )}

        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><AlertTriangle size={12} className="text-yellow-500" />갭 (미연결)</span>
          <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-500" />Pass</span>
          <span className="flex items-center gap-1"><XCircle size={12} className="text-red-500" />Fail</span>
          <span className="flex items-center gap-1"><Clock size={12} className="text-gray-400" />미수행</span>
        </div>
      </div>
    </AppLayout>
  )
}
