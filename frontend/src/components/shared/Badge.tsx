import { cn } from '@/lib/utils'

const variants: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  '신규': 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  '검토중': 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  '확정': 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  '진행중': 'bg-blue-100 text-blue-700',
  '진행': 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  '완료': 'bg-green-100 text-green-700',
  on_hold: 'bg-red-100 text-red-700',
  '보류': 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-600',
  '대기': 'bg-gray-100 text-gray-600',
  draft: 'bg-gray-100 text-gray-600',
  '초안': 'bg-gray-100 text-gray-600',
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-700',
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
  changed: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
  active: 'bg-green-100 text-green-700',
}

function resolveVariant(value: string, label?: string): string {
  if (variants[value]) return variants[value]
  if (label && variants[label]) return variants[label]
  const lower = value.toLowerCase()
  if (variants[lower]) return variants[lower]
  return 'bg-gray-100 text-gray-600'
}

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', resolveVariant(value, label))}>
      {label ?? value}
    </span>
  )
}
