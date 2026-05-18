import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, AlertTriangle, Download, Upload, Trash2, RefreshCw } from 'lucide-react'
import { testExecutionApi, type TestPhase } from '@/api/test-execution.api'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { ImportResultModal } from './ImportResultModal'
import AppLayout from '@/components/layout/AppLayout'

const STATUS_LABEL: Record<string, string> = {
  planned: '계획됨', in_progress: '진행중', completed: '완료', closed: '종료',
}

export default function TestPhaseDetailPage() {
  const { projectId, phaseId } = useParams<{ projectId: string; phaseId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'rounds' | 'dashboard'>('rounds')
  const [showImportModal, setShowImportModal] = useState(false)

  const { data: phase, isLoading } = useQuery({
    queryKey: ['test-phase', projectId, phaseId],
    queryFn: () => testExecutionApi.getPhase(projectId!, phaseId!),
    enabled: !!projectId && !!phaseId,
  })

  const { data: rounds = [], isLoading: roundsLoading } = useQuery({
    queryKey: ['test-rounds', projectId, phaseId],
    queryFn: () => testExecutionApi.listRounds(projectId!, phaseId!),
    enabled: !!projectId && !!phaseId,
  })

  const { data: dashboard } = useQuery({
    queryKey: ['test-dashboard', projectId, phaseId],
    queryFn: () => testExecutionApi.getDashboard(projectId!, phaseId!),
    enabled: !!projectId && !!phaseId && tab === 'dashboard',
  })

  const updatePhaseMutation = useMutation({
    mutationFn: (data: Partial<TestPhase>) => testExecutionApi.updatePhase(projectId!, phaseId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-phase', projectId, phaseId] })
      qc.invalidateQueries({ queryKey: ['test-phases', projectId] })
    },
  })

  const refreshMutation = useMutation({
    mutationFn: () => testExecutionApi.refreshSnapshot(projectId!, phaseId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-phase', projectId, phaseId] })
      qc.invalidateQueries({ queryKey: ['test-phases', projectId] })
    },
  })

  const deleteRoundMutation = useMutation({
    mutationFn: (roundId: string) => testExecutionApi.deleteRound(projectId!, phaseId!, roundId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-rounds', projectId, phaseId] })
      qc.invalidateQueries({ queryKey: ['test-phase', projectId, phaseId] })
    },
  })

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4"><TableSkeleton rows={5} cols={4} /></div>
      </AppLayout>
    )
  }

  if (!phase) {
    return (
      <AppLayout>
        <div className="p-4"><EmptyState message="프로젝트 회차를 찾을 수 없습니다." /></div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => navigate(`/projects/${projectId}/test-execution`)} className="p-1 text-gray-400 hover:text-gray-600">
            <ChevronLeft size={16} />
          </button>
          <span className="font-mono text-xs text-[#5E6AD2]">{phase.code}</span>
          <h2 className="text-sm font-bold text-gray-800">{phase.title}</h2>
          {phase.outdated && (
            <span className="text-amber-500 text-xs flex items-center gap-1">
              <AlertTriangle size={12} />변경됨
            </span>
          )}
          <select
            className="ml-auto border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
            value={phase.status}
            onChange={e => updatePhaseMutation.mutate({ status: e.target.value })}
          >
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          <span>스냅샷: {phase.snapshotAt ? new Date(phase.snapshotAt).toLocaleString('ko-KR') : '없음'} 기준</span>
          {phase.outdated && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw size={10} className={refreshMutation.isPending ? 'animate-spin' : ''} />
              스냅샷 갱신
            </Button>
          )}
        </div>

        <div className="inline-flex border border-gray-200 rounded-md overflow-hidden text-xs h-7 mb-3">
          <button
            className={`px-3 flex items-center transition-colors ${tab === 'rounds' ? 'bg-[#5E6AD2] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setTab('rounds')}
          >수행 현황</button>
          <button
            className={`px-3 flex items-center border-l border-gray-200 transition-colors ${tab === 'dashboard' ? 'bg-[#5E6AD2] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setTab('dashboard')}
          >대시보드</button>
        </div>

        {tab === 'rounds' && (
          <>
            <div className="flex gap-2 mb-3">
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => testExecutionApi.exportTemplate(projectId!, phaseId!)}>
                <Download size={12} />Template 다운로드
              </Button>
              <Button size="sm" className="h-7 text-xs px-2" onClick={() => setShowImportModal(true)}>
                <Upload size={12} />결과 Import
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => testExecutionApi.exportResult(projectId!, phaseId!)}>
                <Download size={12} />결과서 Export
              </Button>
            </div>

            {roundsLoading ? (
              <div className="bg-white rounded-lg border p-6">
                <TableSkeleton rows={4} cols={8} />
              </div>
            ) : rounds.length === 0 ? (
              <div className="bg-white rounded-lg border p-8 text-center">
                <p className="text-xs text-gray-400 mb-2">수행 결과가 없습니다.</p>
                <p className="text-[11px] text-gray-300">Template을 다운받아 작성 후 Import하세요.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-16">회차</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">수행자</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">부서</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-24">수행일</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-40">결과</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-32">Pass율</th>
                      <th className="w-12 px-3 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map(round => {
                      const total = round.totalCases || 1
                      const passRate = Math.round((round.passCount / total) * 100)
                      return (
                        <tr
                          key={round.id}
                          className="border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                          onClick={() => navigate(`/projects/${projectId}/test-execution/${phaseId}/${round.id}`)}
                        >
                          <td className="px-3 py-1.5 text-xs font-medium text-[#5E6AD2]">#{round.roundNumber}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-700">{round.testerName}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-500">{round.testerDept || '-'}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-500">
                            {round.executedAt ? new Date(round.executedAt).toLocaleDateString('ko-KR') : '-'}
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="text-green-600">P:{round.passCount}</span>
                              <span className="text-red-600">F:{round.failCount}</span>
                              <span className="text-amber-600">B:{round.blockedCount}</span>
                              <span className="text-gray-400">N:{round.naCount}</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#5E6AD2] rounded-full" style={{ width: `${passRate}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-500 w-8 text-right">{passRate}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => { if (confirm('이 회차를 삭제하시겠습니까?')) deleteRoundMutation.mutate(round.id) }}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 mb-1">전체 케이스</p>
                <p className="text-lg font-bold text-gray-800">{dashboard?.totalCases ?? 0}</p>
              </div>
              <div className="bg-white border rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 mb-1">완료율</p>
                <p className="text-lg font-bold text-[#5E6AD2]">{dashboard?.completionRate ?? 0}%</p>
              </div>
              <div className="bg-white border rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 mb-1">Pass</p>
                <p className="text-lg font-bold text-green-600">{dashboard?.totalPass ?? 0}</p>
              </div>
              <div className="bg-white border rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 mb-1">Fail</p>
                <p className="text-lg font-bold text-red-600">{dashboard?.totalFail ?? 0}</p>
              </div>
            </div>

            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-700 mb-3">회차별 Pass율</h3>
              <div className="space-y-2">
                {rounds.map(round => {
                  const total = round.totalCases || 1
                  const passRate = Math.round((round.passCount / total) * 100)
                  return (
                    <div key={round.id} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16">#{round.roundNumber}</span>
                      <span className="text-xs text-gray-400 w-20 truncate">{round.testerName}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#5E6AD2] rounded-full transition-all" style={{ width: `${passRate}%` }} />
                      </div>
                      <span className="text-xs text-gray-600 w-10 text-right">{passRate}%</span>
                    </div>
                  )
                })}
                {rounds.length === 0 && <p className="text-xs text-gray-400">수행 회차가 없습니다.</p>}
              </div>
            </div>

            {dashboard?.topFailCases && dashboard.topFailCases.length > 0 && (
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-xs font-bold text-gray-700 mb-3">Fail 다발 케이스 Top 10</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">시나리오</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px]">케이스</th>
                      <th className="text-left px-3 py-1.5 font-medium text-gray-500 text-[11px] w-20">Fail 횟수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.topFailCases.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="px-3 py-1.5 text-xs text-gray-600">{item.scenarioCode}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-700">{item.caseTitle}</td>
                        <td className="px-3 py-1.5 text-xs font-medium text-red-600">{item.failCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <ImportResultModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={projectId!}
        phaseId={phaseId!}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['test-rounds', projectId, phaseId] })
          qc.invalidateQueries({ queryKey: ['test-phase', projectId, phaseId] })
        }}
      />
    </AppLayout>
  )
}
