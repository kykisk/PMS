import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { projectApi } from '@/api/project.api'
import { useParams } from 'react-router-dom'

interface Props {
  outdated: boolean
  outdatedReason?: string | null
  entityType: string
  entityId: string
  queryKeys: string[][]
}

export function OutdatedBanner({ outdated, outdatedReason, entityType, entityId, queryKeys }: Props) {
  const { projectId } = useParams<{ projectId: string }>()
  const qc = useQueryClient()

  const clearMutation = useMutation({
    mutationFn: () => projectApi.clearOutdated(projectId!, entityType, entityId),
    onSuccess: () => queryKeys.forEach(qk => qc.invalidateQueries({ queryKey: qk })),
  })

  if (!outdated) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg mb-3">
      <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-amber-700">상위 항목이 변경되었습니다</p>
        {outdatedReason && <p className="text-[11px] text-amber-600 mt-0.5">{outdatedReason}</p>}
      </div>
      <button
        onClick={() => clearMutation.mutate()}
        disabled={clearMutation.isPending}
        className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors flex-shrink-0"
      >
        <CheckCircle size={11} />확인 완료
      </button>
    </div>
  )
}
