import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Gantt, ViewMode } from 'gantt-task-react'
import type { Task as GanttTask } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'

interface Props {
  projectId: string
  tasks: any[]
  dependencies?: { id: string; fromTaskId: string; toTaskId: string; type: string }[]
  projectStartDate?: string
  onDateChange?: (task: any, start: Date, end: Date) => void
  onProgressChange?: (task: any, progress: number) => void
  onSelect?: (taskId: string) => void
  onDoubleClick?: (taskId: string) => void
}

const TASK_STYLE = {
  backgroundColor: '#5E6AD2',
  backgroundSelectedColor: '#4f5bb8',
  progressColor: '#4f5bb8',
}

function buildGroupStyle(collapsed: boolean) {
  return {
    backgroundColor: collapsed ? '#374151' : '#1a1a2e',
    backgroundSelectedColor: '#16213e',
    progressColor: '#0f3460',
  }
}

function convertToGanttTasks(
  tasks: any[],
  projectStartDate?: string,
  dependencies?: { fromTaskId: string; toTaskId: string; type: string }[],
  collapsedGroups?: Set<string>,
): GanttTask[] {
  const grouped: Record<string, { feature: any; tasks: any[] }> = {}
  tasks.forEach(t => {
    const key = t.feature?.id || '__none__'
    if (!grouped[key]) grouped[key] = { feature: t.feature, tasks: [] }
    grouped[key].tasks.push(t)
  })

  const defaultStart = projectStartDate ? new Date(projectStartDate) : new Date()
  const defaultEnd = new Date(defaultStart.getTime() + 86400000)

  const ganttTasks: GanttTask[] = []

  Object.entries(grouped).forEach(([key, group]) => {
    const groupId = `feature-${key}`
    const collapsed = collapsedGroups?.has(groupId) ?? false

    const allGroupTasks = group.tasks.map((t: any) => ({
      start: t.startDate ? new Date(t.startDate) : defaultStart,
      end: t.endDate ? new Date(t.endDate) : defaultEnd,
    }))
    const minStart = new Date(Math.min(...allGroupTasks.map(t => t.start.getTime())))
    const maxEnd = new Date(Math.max(...allGroupTasks.map(t => t.end.getTime())))

    const baseName = group.feature
      ? `${group.feature.code} - ${group.feature.title}`
      : '미연결'

    ganttTasks.push({
      start: minStart,
      end: maxEnd,
      name: `${collapsed ? '▶' : '▼'} ${baseName}`,
      id: groupId,
      type: 'project',
      progress: group.tasks.reduce((sum: number, t: any) => sum + (t.progress || 0), 0) / group.tasks.length,
      hideChildren: false,
      styles: buildGroupStyle(collapsed),
    })

    if (!collapsed) {
      group.tasks.forEach((t: any) => {
        const start = t.startDate ? new Date(t.startDate) : defaultStart
        const end = t.endDate ? new Date(t.endDate) : defaultEnd
        const taskDeps = (dependencies ?? [])
          .filter(d => d.toTaskId === t.id)
          .map(d => d.fromTaskId)
        ganttTasks.push({
          start,
          end,
          name: t.title,
          id: t.id,
          type: 'task',
          progress: t.progress || 0,
          project: groupId,
          dependencies: taskDeps.length > 0 ? taskDeps : undefined,
          styles: TASK_STYLE,
        })
      })
    }
  })

  return ganttTasks
}

export function GanttView({ projectId: _projectId, tasks, dependencies, projectStartDate, onDateChange, onProgressChange, onSelect, onDoubleClick }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const ganttContainerRef = useRef<HTMLDivElement>(null)
  const [ganttHeight, setGanttHeight] = useState(500)

  useEffect(() => {
    const update = () => setGanttHeight(Math.max(300, window.innerHeight - 280))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.handleGroup') || target.closest('[class*="_KxSXS"]') || target.closest('[class*="_1KJ6x"]') || target.closest('button')) return
    const container = ganttContainerRef.current
    if (!container) return

    const ganttVContainer = container.querySelector('[class*="_CZjuD"]') as HTMLElement
    const scrollBar = container.querySelector('[class*="_2k9Ys"]') as HTMLElement
    if (!ganttVContainer) return

    e.preventDefault()
    const startX = e.clientX
    const startScrollLeft = ganttVContainer.scrollLeft
    container.style.cursor = 'grabbing'
    container.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const newScroll = startScrollLeft - dx
      ganttVContainer.scrollLeft = newScroll
      if (scrollBar) scrollBar.scrollLeft = newScroll
    }
    const onUp = () => {
      container.style.cursor = ''
      container.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const ganttTasks = useMemo(
    () => convertToGanttTasks(tasks, projectStartDate, dependencies, collapsedGroups),
    [tasks, projectStartDate, dependencies, collapsedGroups],
  )

  if (ganttTasks.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-xs">Task가 없습니다</div>
  }

  const allGroupIds = ganttTasks.filter(t => t.type === 'project').map(t => t.id)
  const allCollapsed = allGroupIds.every(id => collapsedGroups.has(id))

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-500">뷰:</span>
        {[
          { mode: ViewMode.Day, label: '일' },
          { mode: ViewMode.Week, label: '주' },
          { mode: ViewMode.Month, label: '월' },
        ].map(v => (
          <button
            key={v.label}
            onClick={() => setViewMode(v.mode)}
            className={`px-2 py-0.5 text-xs rounded border transition-colors ${viewMode === v.mode ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]' : 'border-gray-200 text-gray-600 hover:border-[#5E6AD2]/30'}`}
          >
            {v.label}
          </button>
        ))}
        <div className="ml-2 h-4 border-l border-gray-200" />
        <button
          onClick={() => {
            if (allCollapsed) setCollapsedGroups(new Set())
            else setCollapsedGroups(new Set(allGroupIds))
          }}
          className="px-2 py-0.5 text-xs rounded border border-gray-200 text-gray-500 hover:border-[#5E6AD2]/30 transition-colors"
        >
          {allCollapsed ? '전체 펼치기' : '전체 접기'}
        </button>
      </div>
      <div
        ref={ganttContainerRef}
        className="border rounded-lg overflow-hidden bg-white cursor-grab"
        onMouseDown={handleMouseDown}
      >
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          locale="ko"
          listCellWidth=""
          columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 65}
          barCornerRadius={4}
          barFill={60}
          fontSize="12"
          headerHeight={50}
          rowHeight={36}
          ganttHeight={ganttHeight}
          todayColor="rgba(94, 106, 210, 0.08)"
          onDateChange={onDateChange ? (task) => {
            if (task.type === 'task') onDateChange(task, task.start, task.end)
          } : undefined}
          onProgressChange={onProgressChange ? (task) => {
            if (task.type === 'task') onProgressChange(task, task.progress)
          } : undefined}
          onDoubleClick={onDoubleClick ? (task) => {
            if (task.type === 'task') onDoubleClick(task.id)
          } : undefined}
          onClick={(task) => {
            if (task.type === 'project') {
              toggleGroup(task.id)
            } else if (task.type === 'task' && onSelect) {
              onSelect(task.id)
            }
          }}
        />
      </div>
    </div>
  )
}
