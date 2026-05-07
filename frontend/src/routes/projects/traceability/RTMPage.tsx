import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle, XCircle, Clock, Download, Users, BookOpen, Layers, Database, Code2, CheckSquare, TestTube2, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
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

function StatusBadge({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-600',
    approved: 'bg-blue-100 text-blue-700',
    active: 'bg-emerald-100 text-emerald-700',
    done: 'bg-green-100 text-green-700',
    in_progress: 'bg-amber-100 text-amber-700',
  }
  if (!status) return null
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

const ALL_TYPES = [
  { key: 'requirements', label: '요구사항', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'features', label: '기능', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'tasks', label: 'Task', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'tests', label: '테스트', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'useCases', label: 'Use Case', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { key: 'userStories', label: 'User Story', color: 'bg-pink-100 text-pink-700 border-pink-200' },
]

const TYPE_DOT: Record<string, string> = {
  requirements: 'bg-blue-400',
  features: 'bg-purple-400',
  tasks: 'bg-amber-400',
  tests: 'bg-green-400',
  useCases: 'bg-indigo-400',
  userStories: 'bg-pink-400',
}

const TYPE_COL_BG: Record<string, string> = {
  requirements: 'bg-blue-50/60',
  features: 'bg-purple-50/60',
  tasks: 'bg-amber-50/60',
  tests: 'bg-green-50/60',
  useCases: 'bg-indigo-50/60',
  userStories: 'bg-pink-50/60',
}

function getItemsFromMatrix(matrix: any[], type: string): any[] {
  const seen = new Set<string>()
  const items: any[] = []
  const addItem = (item: any) => {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      items.push(item)
    }
  }

  if (type === 'requirements') {
    matrix.forEach(r => addItem({ id: r.requirement.id, code: r.requirement.code, title: r.requirement.title, type: 'requirements' }))
  } else if (type === 'features') {
    matrix.forEach(r => r.features.forEach((f: any) => addItem({ id: f.id, code: f.code, title: f.title, type: 'features', _reqId: r.requirement.id })))
  } else if (type === 'tasks') {
    matrix.forEach(r => r.features.forEach((f: any) => (f.tasks ?? []).forEach((t: any) => addItem({ id: t.id, code: t.code, title: t.title, type: 'tasks', _featureId: f.id, _reqId: r.requirement.id }))))
  } else if (type === 'tests') {
    matrix.forEach(r => {
      r.features.forEach((f: any) => (f.testScenarios ?? []).forEach((s: any) => addItem({ id: s.id, code: s.code, title: s.title, type: 'tests', _featureId: f.id, _reqId: r.requirement.id })))
      ;(r.directScenarios ?? []).forEach((s: any) => addItem({ id: s.id, code: s.code, title: s.title, type: 'tests', _reqId: r.requirement.id }))
    })
  } else if (type === 'useCases') {
    matrix.forEach(r => (r.useCases ?? []).forEach((uc: any) => addItem({ id: uc.id, code: uc.code, title: uc.title, type: 'useCases', _reqId: r.requirement.id })))
  } else if (type === 'userStories') {
    matrix.forEach(r => (r.userStories ?? []).forEach((us: any) => addItem({ id: us.id, code: us.code, title: us.title, type: 'userStories', _reqId: r.requirement.id })))
  }
  return items
}

function isConnected(base: any, target: any): boolean {
  if (base.type === 'requirements' && target.type === 'features') return target._reqId === base.id
  if (base.type === 'requirements' && target.type === 'tasks') return target._reqId === base.id
  if (base.type === 'requirements' && target.type === 'tests') return target._reqId === base.id
  if (base.type === 'requirements' && target.type === 'useCases') return target._reqId === base.id
  if (base.type === 'requirements' && target.type === 'userStories') return target._reqId === base.id
  if (base.type === 'features' && target.type === 'tasks') return target._featureId === base.id
  if (base.type === 'features' && target.type === 'tests') return target._featureId === base.id
  if (base.type === 'features' && target.type === 'requirements') return base._reqId === target.id
  if (base.type === 'tasks' && target.type === 'features') return base._featureId === target.id
  if (base.type === 'tasks' && target.type === 'requirements') return base._reqId === target.id
  if (base.type === 'tests' && target.type === 'features') return base._featureId === target.id
  if (base.type === 'tests' && target.type === 'requirements') return base._reqId === target.id
  if (base.type === 'useCases' && target.type === 'requirements') return base._reqId === target.id
  if (base.type === 'userStories' && target.type === 'requirements') return base._reqId === target.id
  return false
}

export default function RTMPage() {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'tree' | 'matrix'>('tree')
  const [baseType, setBaseType] = useState<string>('requirements')
  const [targetTypes, setTargetTypes] = useState<string[]>(['features', 'tasks'])

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

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (expandedRows.size === (matrix as any[]).length) {
      setExpandedRows(new Set())
    } else {
      setExpandedRows(new Set((matrix as any[]).map((r: any) => r.requirement.id)))
    }
  }

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

        <div className="flex border-b mb-4">
          <button onClick={() => setActiveTab('tree')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tree' ? 'border-[#5E6AD2] text-[#5E6AD2]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            추적성 트리
          </button>
          <button onClick={() => setActiveTab('matrix')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'matrix' ? 'border-[#5E6AD2] text-[#5E6AD2]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            매트릭스 테이블
          </button>
        </div>

        {activeTab === 'tree' && (<>
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
              <span>Use Case {coverage.useCases?.total ?? 0}건</span>
              <span>User Story {coverage.userStories?.total ?? 0}건</span>
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
          <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">총 {(matrix as any[]).length}개 요구사항</span>
            <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs gap-1">
              {expandedRows.size === (matrix as any[]).length
                ? <><ChevronsDownUp size={14} />전체 접기</>
                : <><ChevronsUpDown size={14} />전체 펼치기</>}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-8"></th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">코드</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">항목</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">유형</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상태/결과</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">세부</th>
                </tr>
              </thead>
              <tbody>
                {(matrix as any[]).map((row: any) => {
                  const req = row.requirement
                  const isExpanded = expandedRows.has(req.id)
                  const ucCount = row.useCases?.length ?? 0
                  const usCount = row.userStories?.length ?? 0
                  const fCount = row.features?.length ?? 0
                  const dsCount = row.directScenarios?.length ?? 0

                  return (
                    <tbody key={req.id}>
                      <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(req.id)}>
                        <td className="px-4 py-3">
                          {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{req.code}</td>
                        <td className="px-4 py-3 font-medium">
                          <button className="text-left hover:text-blue-600" onClick={(e) => { e.stopPropagation(); navigate(`/projects/${projectId}/requirements/${req.id}`) }}>
                            {req.title}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">요구사항</td>
                        <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {ucCount > 0 && <span className="mr-2">UC:{ucCount}</span>}
                          {usCount > 0 && <span className="mr-2">US:{usCount}</span>}
                          {fCount > 0 && <span className="mr-2">기능:{fCount}</span>}
                          {dsCount > 0 && <span>직접테스트:{dsCount}</span>}
                          {ucCount === 0 && usCount === 0 && fCount === 0 && dsCount === 0 && <span className="text-yellow-600 flex items-center gap-1"><AlertTriangle size={12} />갭</span>}
                        </td>
                      </tr>
                      {isExpanded && (
                        <>
                          {(row.useCases ?? []).map((uc: any) => (
                            <tr key={`uc-${uc.id}`} className="border-b bg-indigo-50/30">
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 pl-6 font-mono text-xs text-gray-500">{uc.code}</td>
                              <td className="px-4 py-2 pl-6">
                                <span className="flex items-center gap-1.5 text-sm">
                                  <Users size={13} className="text-indigo-500 flex-shrink-0" />
                                  {uc.title}
                                </span>
                                {uc.actor && <span className="text-[11px] text-gray-400 ml-5">Actor: {uc.actor}</span>}
                              </td>
                              <td className="px-4 py-2 text-xs text-indigo-600">Use Case</td>
                              <td className="px-4 py-2"><StatusBadge status={uc.status} /></td>
                              <td className="px-4 py-2"></td>
                            </tr>
                          ))}
                          {(row.userStories ?? []).map((us: any) => (
                            <tr key={`us-${us.id}`} className="border-b bg-pink-50/30">
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 pl-6 font-mono text-xs text-gray-500">{us.code}</td>
                              <td className="px-4 py-2 pl-6">
                                <span className="flex items-center gap-1.5 text-sm">
                                  <BookOpen size={13} className="text-pink-500 flex-shrink-0" />
                                  {us.title}
                                </span>
                                {us.asA && <span className="text-[11px] text-gray-400 ml-5">As a {us.asA}, I want to {us.iWantTo}</span>}
                              </td>
                              <td className="px-4 py-2 text-xs text-pink-600">User Story</td>
                              <td className="px-4 py-2"><StatusBadge status={us.status} /></td>
                              <td className="px-4 py-2"></td>
                            </tr>
                          ))}
                          {(row.features ?? []).map((feat: any) => (
                            <tbody key={`feat-${feat.id}`}>
                              <tr className="border-b bg-purple-50/30">
                                <td className="px-4 py-2"></td>
                                <td className="px-4 py-2 pl-6 font-mono text-xs text-gray-500">{feat.code}</td>
                                <td className="px-4 py-2 pl-6">
                                  <button className="flex items-center gap-1.5 text-sm text-left hover:text-blue-600" onClick={() => navigate(`/projects/${projectId}/features/${feat.id}`)}>
                                    <Layers size={13} className="text-purple-500 flex-shrink-0" />
                                    {feat.title}
                                  </button>
                                </td>
                                <td className="px-4 py-2 text-xs text-purple-600">기능</td>
                                <td className="px-4 py-2"><StatusBadge status={feat.status} /></td>
                                <td className="px-4 py-2 text-xs text-gray-400">
                                  {feat.dbTables?.length > 0 && <span className="mr-2">DB:{feat.dbTables.length}</span>}
                                  {feat.apiSpecs?.length > 0 && <span className="mr-2">API:{feat.apiSpecs.length}</span>}
                                  {feat.tasks?.length > 0 && <span className="mr-2">Task:{feat.tasks.length}</span>}
                                  {feat.testScenarios?.length > 0 && <span>테스트:{feat.testScenarios.length}</span>}
                                </td>
                              </tr>
                              {(feat.dbTables ?? []).map((db: any) => (
                                <tr key={`db-${db.id}`} className="border-b bg-green-50/30">
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5 pl-12"></td>
                                  <td className="px-4 py-1.5 pl-12">
                                    <span className="flex items-center gap-1.5 text-xs">
                                      <Database size={12} className="text-green-600 flex-shrink-0" />
                                      {db.name}
                                    </span>
                                    {db.description && <span className="text-[11px] text-gray-400 ml-5">{db.description}</span>}
                                  </td>
                                  <td className="px-4 py-1.5 text-xs text-green-600">DB Table</td>
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5"></td>
                                </tr>
                              ))}
                              {(feat.apiSpecs ?? []).map((api: any) => (
                                <tr key={`api-${api.id}`} className="border-b bg-cyan-50/30">
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5 pl-12"></td>
                                  <td className="px-4 py-1.5 pl-12">
                                    <span className="flex items-center gap-1.5 text-xs">
                                      <Code2 size={12} className="text-cyan-600 flex-shrink-0" />
                                      <span className="font-mono font-medium">{api.method}</span> {api.path}
                                    </span>
                                    {api.summary && <span className="text-[11px] text-gray-400 ml-5">{api.summary}</span>}
                                  </td>
                                  <td className="px-4 py-1.5 text-xs text-cyan-600">API Spec</td>
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5"></td>
                                </tr>
                              ))}
                              {(feat.tasks ?? []).map((task: any) => (
                                <tr key={`task-${task.id}`} className="border-b bg-amber-50/30">
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5 pl-12 font-mono text-xs text-gray-500">{task.code}</td>
                                  <td className="px-4 py-1.5 pl-12">
                                    <button className="flex items-center gap-1.5 text-xs text-left hover:text-blue-600" onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}>
                                      <CheckSquare size={12} className="text-amber-600 flex-shrink-0" />
                                      {task.title}
                                      {task.progress != null && <span className="text-gray-400 ml-1">({task.progress}%)</span>}
                                    </button>
                                  </td>
                                  <td className="px-4 py-1.5 text-xs text-amber-600">Task</td>
                                  <td className="px-4 py-1.5"><StatusBadge status={task.status} /></td>
                                  <td className="px-4 py-1.5">
                                    <div className="bg-gray-200 rounded-full h-1.5 w-16">
                                      <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${task.progress ?? 0}%` }} />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {(feat.testScenarios ?? []).map((ts: any) => (
                                <tr key={`ts-${ts.id}`} className="border-b bg-emerald-50/30">
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5 pl-12 font-mono text-xs text-gray-500">{ts.code}</td>
                                  <td className="px-4 py-1.5 pl-12">
                                    <button className="flex items-center gap-1.5 text-xs text-left hover:text-blue-600" onClick={() => navigate(`/projects/${projectId}/tests/${ts.id}`)}>
                                      <TestTube2 size={12} className="text-emerald-600 flex-shrink-0" />
                                      {ts.title}
                                    </button>
                                  </td>
                                  <td className="px-4 py-1.5 text-xs text-emerald-600">테스트</td>
                                  <td className="px-4 py-1.5"><ResultIcon result={ts.result} /></td>
                                  <td className="px-4 py-1.5"></td>
                                </tr>
                              ))}
                            </tbody>
                          ))}
                          {(row.directScenarios ?? []).map((ds: any) => (
                            <tr key={`ds-${ds.id}`} className="border-b bg-emerald-50/30">
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 pl-6 font-mono text-xs text-gray-500">{ds.code}</td>
                              <td className="px-4 py-2 pl-6">
                                <button className="flex items-center gap-1.5 text-sm text-left hover:text-blue-600" onClick={() => navigate(`/projects/${projectId}/tests/${ds.id}`)}>
                                  <TestTube2 size={13} className="text-emerald-600 flex-shrink-0" />
                                  {ds.title}
                                </button>
                              </td>
                              <td className="px-4 py-2 text-xs text-emerald-600">직접 테스트</td>
                              <td className="px-4 py-2"><ResultIcon result={ds.result} /></td>
                              <td className="px-4 py-2"></td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  )
                })}
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
        </>)}

        {activeTab === 'matrix' && (
          <div className="bg-white rounded-lg border p-5">
            <div className="flex flex-wrap gap-6 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">기준 항목</label>
                <select
                  value={baseType}
                  onChange={e => { setBaseType(e.target.value); setTargetTypes(prev => prev.filter(t => t !== e.target.value)) }}
                  className="border rounded px-3 py-1.5 text-sm bg-white"
                >
                  {ALL_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">추적 항목</label>
                <div className="flex flex-wrap gap-3">
                  {ALL_TYPES.filter(t => t.key !== baseType).map(t => (
                    <label key={t.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetTypes.includes(t.key)}
                        onChange={e => {
                          if (e.target.checked) setTargetTypes(prev => [...prev, t.key])
                          else setTargetTypes(prev => prev.filter(x => x !== t.key))
                        }}
                        className="rounded border-gray-300"
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {(() => {
              const baseItems = getItemsFromMatrix(matrix as any[], baseType)
              const allTargetItems = targetTypes.flatMap(type => getItemsFromMatrix(matrix as any[], type))

              if (baseItems.length === 0) {
                return <p className="text-sm text-gray-400 py-8 text-center">기준 항목 데이터가 없습니다.</p>
              }

              const totalCols = allTargetItems.length + 1
              const compact = totalCols > 20
              const veryCompact = totalCols > 40
              const colW = veryCompact ? 24 : compact ? 32 : 44
              const rowLabelW = veryCompact ? 100 : compact ? 120 : 150
              const fontSize = veryCompact ? 8 : compact ? 9 : 10
              const dotSize = veryCompact ? 6 : compact ? 8 : 10

              return (
                <>
                  <div className="overflow-auto max-h-[600px] border rounded">
                    <table className="border-collapse w-full" style={{ tableLayout: 'fixed', fontSize }}>
                      <thead>
                        <tr>
                          <th className="sticky left-0 top-0 z-20 bg-gray-50 border font-medium text-gray-600 px-1 py-1" style={{ width: rowLabelW, minWidth: rowLabelW, fontSize }}>항목</th>
                          {allTargetItems.map(item => (
                            <th key={item.id}
                              className={`sticky top-0 z-10 border text-center ${TYPE_COL_BG[item.type] || 'bg-gray-50'}`}
                              style={{ width: colW, minWidth: colW, maxWidth: colW, padding: '2px 1px' }}
                              title={`${item.code} - ${item.title}`}
                            >
                              <div className="flex flex-col items-center gap-0.5">
                                <div className={`rounded-full flex-shrink-0 ${TYPE_DOT[item.type] || 'bg-gray-400'}`} style={{ width: dotSize, height: dotSize }} />
                                {!veryCompact && (
                                  <div className="[writing-mode:vertical-lr] truncate" style={{ maxHeight: compact ? 36 : 50, fontSize }}>
                                    <span className="font-mono text-gray-600">{item.code}</span>
                                  </div>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {baseItems.map(base => (
                          <tr key={base.id} className="hover:bg-gray-50/50">
                            <td className="sticky left-0 z-10 bg-white border px-1 py-0.5" style={{ minWidth: rowLabelW, width: rowLabelW }}>
                              <span className="font-mono text-gray-500" style={{ fontSize }}>{base.code}</span>
                              {!veryCompact && <span className="ml-1 text-gray-700" style={{ fontSize }}>{base.title.slice(0, compact ? 10 : 15)}{base.title.length > (compact ? 10 : 15) ? '...' : ''}</span>}
                            </td>
                            {allTargetItems.map(target => (
                              <td key={target.id} className={`border text-center ${isConnected(base, target) ? TYPE_COL_BG[target.type] || '' : ''}`} style={{ padding: '2px 1px' }}>
                                {isConnected(base, target) ? (
                                  <span className={`font-bold ${veryCompact ? 'text-xs' : compact ? 'text-sm' : 'text-base'} ${
                                    target.type === 'requirements' ? 'text-blue-500' :
                                    target.type === 'features' ? 'text-purple-500' :
                                    target.type === 'tasks' ? 'text-amber-500' :
                                    target.type === 'tests' ? 'text-green-500' :
                                    target.type === 'useCases' ? 'text-indigo-500' :
                                    target.type === 'userStories' ? 'text-pink-500' : 'text-green-600'
                                  }`}>●</span>
                                ) : null}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex items-center flex-wrap gap-3 text-[11px] text-gray-500">
                   <span>● = 연결됨</span>
                   {ALL_TYPES.filter(t => targetTypes.includes(t.key)).map(t => (
                     <span key={t.key} className="flex items-center gap-1">
                       <span className={`w-2 h-2 rounded-full inline-block ${TYPE_DOT[t.key]}`} />
                       {t.label}
                     </span>
                   ))}
                 </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
