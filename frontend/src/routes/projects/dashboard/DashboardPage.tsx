import { type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '@/api/project.api'
import AppLayout from '@/components/layout/AppLayout'
import {
  ClipboardList, Layers, CheckSquare, TestTube2,
  AlertTriangle, ShieldAlert, Activity,
} from 'lucide-react'

function StatCard({ title, items, accent, icon }: {
  title: string
  items: { label: string; count: number; color: string }[]
  accent: 'blue' | 'purple' | 'amber' | 'green'
  icon: ReactNode
}) {
  const total = items.reduce((s, i) => s + i.count, 0)
  const border = {
    blue: 'border-l-blue-500',
    purple: 'border-l-purple-500',
    amber: 'border-l-amber-500',
    green: 'border-l-green-500',
  }[accent]
  const iconStyle = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
  }[accent]

  return (
    <div className={`bg-white rounded-lg border border-l-4 ${border} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconStyle}`}>
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
      </div>
      <p className="text-2xl font-bold mb-3">총 {total}건</p>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-gray-500 flex-1">{item.label}</span>
            <span className="text-xs font-medium">{item.count}건</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressCard({ avgProgress, total, completed, inProgress, onHold, issueCount, riskCount }: {
  avgProgress: number; total: number; completed: number
  inProgress: number; onHold: number; issueCount: number; riskCount: number
}) {
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (avgProgress / 100) * circ

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-sm font-semibold text-gray-600 mb-4">전체 진척율</h3>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex items-center justify-center md:w-1/3">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={r} stroke="#e5e7eb" strokeWidth="8" fill="none" />
              <circle
                cx="60" cy="60" r={r} stroke="#3b82f6" strokeWidth="8" fill="none"
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-800">{avgProgress}%</span>
            </div>
          </div>
        </div>
        <div className="md:w-2/3 grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">전체 Task</p>
            <p className="text-xl font-bold">{total}<span className="text-sm text-gray-400 ml-1">건</span></p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 mb-1">완료</p>
            <p className="text-xl font-bold text-green-700">{completed}<span className="text-sm text-green-400 ml-1">건</span></p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600 mb-1">진행중</p>
            <p className="text-xl font-bold text-blue-700">{inProgress}<span className="text-sm text-blue-400 ml-1">건</span></p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-xs text-amber-600 mb-1">보류</p>
            <p className="text-xl font-bold text-amber-700">{onHold}<span className="text-sm text-amber-400 ml-1">건</span></p>
          </div>
          {(issueCount > 0 || riskCount > 0) && (
            <div className="col-span-2 flex gap-2 flex-wrap">
              {issueCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  <AlertTriangle size={14} />
                  미결 이슈 {issueCount}건
                </div>
              )}
              {riskCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-md text-sm text-orange-700">
                  <ShieldAlert size={14} />
                  미결 리스크 {riskCount}건
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RecentActivity({ dashboard }: { dashboard: Record<string, unknown> }) {
  const activities: { label: string; status: string }[] = []

  if (dashboard?.tasks) {
    for (const t of dashboard.tasks as { status: string; _count: number }[]) {
      if (t.status === 'completed' && t._count > 0)
        activities.push({ label: `Task ${t._count}건 완료`, status: 'completed' })
      if ((t.status === 'in_progress' || t.status === 'active') && t._count > 0)
        activities.push({ label: `Task ${t._count}건 진행중`, status: 'in_progress' })
      if (t.status === 'on_hold' && t._count > 0)
        activities.push({ label: `Task ${t._count}건 보류`, status: 'on_hold' })
    }
  }

  if (dashboard?.requirements) {
    const total = (dashboard.requirements as { _count: number }[]).reduce((s, r) => s + r._count, 0)
    if (total > 0) activities.push({ label: `요구사항 ${total}건 등록`, status: 'info' })
  }

  if (dashboard?.tests) {
    for (const t of dashboard.tests as { status: string; _count: number }[]) {
      if (t.status === 'pass' && t._count > 0)
        activities.push({ label: `테스트 ${t._count}건 통과`, status: 'pass' })
      if (t.status === 'fail' && t._count > 0)
        activities.push({ label: `테스트 ${t._count}건 실패`, status: 'fail' })
    }
  }

  const items = activities.slice(0, 5)
  const dot: Record<string, string> = {
    completed: 'bg-green-500',
    in_progress: 'bg-blue-500',
    on_hold: 'bg-amber-500',
    info: 'bg-gray-400',
    pass: 'bg-green-500',
    fail: 'bg-red-500',
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-600">최근 활동</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">아직 활동이 없습니다</p>
      ) : (
        <div>
          {items.map((a, i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              <div className="flex flex-col items-center pt-1.5">
                <div className={`w-2 h-2 rounded-full ${dot[a.status] || 'bg-gray-400'}`} />
                {i < items.length - 1 && <div className="w-px flex-1 min-h-3 bg-gray-200 mt-1" />}
              </div>
              <p className="text-sm text-gray-700">{a.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const statusColors: Record<string, string> = {
  new: '#9ca3af', review: '#f59e0b', confirmed: '#10b981',
  changed: '#3b82f6', deleted: '#ef4444',
  pending: '#9ca3af', in_progress: '#3b82f6', active: '#3b82f6', completed: '#10b981', on_hold: '#f59e0b',
  draft: '#9ca3af', pass: '#10b981', fail: '#ef4444',
}

const statusLabels: Record<string, string> = {
  new: '신규', review: '검토중', confirmed: '확정', changed: '변경', deleted: '삭제',
  pending: '대기', in_progress: '진행중', active: '진행중', completed: '완료', on_hold: '보류',
  draft: '초안', pass: 'Pass', fail: 'Fail',
}

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => projectApi.dashboard(projectId!),
    enabled: !!projectId,
  })

  if (isLoading) return <AppLayout><div className="p-6 text-gray-400">로딩중...</div></AppLayout>

  const toItems = (arr: { status: string; _count: number }[]) =>
    arr.map(r => ({ label: statusLabels[r.status] || r.status, count: r._count, color: statusColors[r.status] || '#9ca3af' }))

  const openIssues = (dashboard?.issues ?? []).filter((i: any) => i.status === 'open')
  const issueCount = openIssues.filter((i: any) => i.type === 'issue').reduce((s: number, i: any) => s + i._count, 0)
  const riskCount = openIssues.filter((i: any) => i.type === 'risk').reduce((s: number, i: any) => s + i._count, 0)

  const taskStats = (dashboard?.tasks ?? []) as { status: string; _count: number }[]
  const inProgress = taskStats
    .filter(t => t.status === 'in_progress' || t.status === 'active')
    .reduce((s, t) => s + t._count, 0)
  const onHold = taskStats
    .filter(t => t.status === 'on_hold')
    .reduce((s, t) => s + t._count, 0)

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{project?.name}</h2>
            {project?.description && <p className="text-gray-500 mt-1">{project.description}</p>}
            {project?.startDate && (
              <p className="text-sm text-gray-400 mt-1">
                {new Date(project.startDate).toLocaleDateString('ko-KR')}
                {project.endDate && ` ~ ${new Date(project.endDate).toLocaleDateString('ko-KR')}`}
              </p>
            )}
          </div>
          {(issueCount > 0 || riskCount > 0) && (
            <div className="flex gap-3">
              {issueCount > 0 && (
                <button onClick={() => navigate(`/projects/${projectId}/tasks`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 hover:bg-red-100">
                  ⚠️ 미결 이슈 {issueCount}건
                </button>
              )}
              {riskCount > 0 && (
                <button onClick={() => navigate(`/projects/${projectId}/tasks`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-md text-sm text-orange-700 hover:bg-orange-100">
                  🔴 미결 리스크 {riskCount}건
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {dashboard?.requirements && (
            <StatCard title="요구사항" items={toItems(dashboard.requirements)} accent="blue" icon={<ClipboardList size={16} />} />
          )}
          {dashboard?.features && (
            <StatCard title="기능 리스트" items={toItems(dashboard.features)} accent="purple" icon={<Layers size={16} />} />
          )}
          {dashboard?.tasks && (
            <StatCard title="Task" items={toItems(dashboard.tasks)} accent="amber" icon={<CheckSquare size={16} />} />
          )}
          {dashboard?.tests && (
            <StatCard title="테스트" items={toItems(dashboard.tests)} accent="green" icon={<TestTube2 size={16} />} />
          )}
        </div>

        {dashboard?.taskProgress && (
          <div className="mb-6">
            <ProgressCard
              avgProgress={dashboard.taskProgress.avgProgress}
              total={dashboard.taskProgress.total}
              completed={dashboard.taskProgress.completed}
              inProgress={inProgress}
              onHold={onHold}
              issueCount={issueCount}
              riskCount={riskCount}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RecentActivity dashboard={dashboard as Record<string, unknown>} />
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">프로젝트 멤버</h3>
            <div className="flex gap-2 flex-wrap">
              {project?.members?.map(m => (
                <div key={m.user.id} className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1">
                  <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-medium text-blue-700">
                    {m.user.name[0]}
                  </div>
                  <span className="text-sm">{m.user.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
