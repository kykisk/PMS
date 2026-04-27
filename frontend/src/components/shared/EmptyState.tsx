import { Inbox } from 'lucide-react'

interface Props { message?: string; action?: React.ReactNode }

export function EmptyState({ message = '데이터가 없습니다', action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <Inbox size={48} strokeWidth={1} />
      <p className="mt-3 text-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
