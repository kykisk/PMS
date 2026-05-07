import { useState, useMemo } from 'react'
import { Gantt, ViewMode } from 'gantt-task-react'
import type { Task as GanttTask } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'

interface Props {
  projectId: string
  tasks: any[]
  projectStartDate?: string
  onDateChange?: (task: any, start: Date, end: Date) => void
  onProgressChange?: (task: any, progress: number) => void
  onSelect?: (taskId: string) => void
  onDoubleClick?: (taskId: string) => void
}

const COLORS = ['#5E6AD2', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#DB2777']

function convertToGanttTasks(tasks: any[], projectStartDate?: string): GanttTask[] {
  const grouped: Record<string, { feature: any; tasks: any[] }> = {}
  tasks.forEach(t => {
    const key = t.feature?.id || '__none__'
    if (!grouped[key]) grouped[key] = { feature: t.feature, tasks: [] }
    grouped[key].tasks.push(t)
  })

  const defaultStart = projectStartDate ? new Date(projectStartDate) : new Date()
  const defaultEnd = new Date(defaultStart.getTime() + 86400000)

  const ganttTasks: GanttTask[] = []
  let colorIdx = 0

  Object.entries(grouped).forEach(([key, group]) => {
    const color = COLORS[colorIdx % COLORS.length]
    colorIdx++

    const allGroupTasks = group.tasks.map((t: any) => ({
      start: t.startDate ? new Date(t.startDate) : defaultStart,
      end: t.endDate ? new Date(t.endDate) : defaultEnd,
    }))
    const minStart = new Date(Math.min(...allGroupTasks.map(t => t.start.getTime())))
    const maxEnd = new Date(Math.max(...allGroupTasks.map(t => t.end.getTime())))

    ganttTasks.push({
      start: minStart,
      end: maxEnd,
      name: group.feature ? `${group.feature.code} - ${group.feature.title}` : '미연결',
      id: `feature-${key}`,
      type: 'project',
      progress: group.tasks.reduce((sum: number, t: any) => sum + (t.progress || 0), 0) / group.tasks.length,
      hideChildren: false,
      styles: { backgroundColor: color, progressColor: color + '80' },
    })

    group.tasks.forEach((t: any) => {
      const start = t.startDate ? new Date(t.startDate) : defaultStart
      const end = t.endDate ? new Date(t.endDate) : defaultEnd
      ganttTasks.push({
        start,
        end,
        name: t.title,
        id: t.id,
        type: 'task',
        progress: t.progress || 0,
        project: `feature-${key}`,
        styles: { backgroundColor: color, progressColor: color + '60', backgroundSelectedColor: color },
      })
    })
  })

  return ganttTasks
}

export function GanttView({ projectId: _projectId, tasks, projectStartDate, onDateChange, onProgressChange, onSelect, onDoubleClick }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day)

  const ganttTasks = useMemo(() => convertToGanttTasks(tasks, projectStartDate), [tasks, projectStartDate])

  if (ganttTasks.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-xs">Task가 없습니다</div>
  }

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
      </div>
      <div className="border rounded-lg overflow-hidden bg-white">
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
          onClick={onSelect ? (task) => {
            if (task.type === 'task') onSelect(task.id)
          } : undefined}
        />
      </div>
    </div>
  )
}
