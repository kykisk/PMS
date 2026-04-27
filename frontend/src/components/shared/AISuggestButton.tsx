import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import apiClient from '@/api/client'

interface Props {
  projectId: string
  context: string
  type: string
  onResult: (text: string) => void
  disabled?: boolean
  label?: string
}

export function AISuggestButton({ projectId, context, type, onResult, disabled, label = 'AI 제안' }: Props) {
  const [loading, setLoading] = useState(false)

  const handleSuggest = async () => {
    if (!context.trim()) return
    setLoading(true)
    try {
      const res = await apiClient.post(`/projects/${projectId}/ai/suggest`, { context, type })
      if (res.data) onResult(res.data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSuggest}
      disabled={disabled || loading || !context.trim()}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      title={!context.trim() ? '내용을 먼저 입력하세요' : undefined}
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
      {loading ? '생성중...' : label}
    </button>
  )
}
