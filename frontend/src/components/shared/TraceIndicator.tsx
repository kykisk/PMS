interface TraceBadge {
  count: number
  label: string
  colorClass: string
}

interface Props {
  upper?: TraceBadge[]
  lower?: TraceBadge[]
}

export function TraceIndicator({ upper = [], lower = [] }: Props) {
  const show = [...upper, ...lower].filter(b => b.count > 0)
  if (show.length === 0) return null
  return (
    <div className="flex flex-wrap gap-0.5">
      {upper.filter(b => b.count > 0).map((b, i) => (
        <span key={i} className={`text-[9px] px-1 py-0 rounded inline-flex items-center gap-0.5 font-medium ${b.colorClass}`} title={`상위: ${b.label} ${b.count}개`}>
          ↑{b.count}{b.label}
        </span>
      ))}
      {lower.filter(b => b.count > 0).map((b, i) => (
        <span key={i} className={`text-[9px] px-1 py-0 rounded inline-flex items-center gap-0.5 font-medium ${b.colorClass}`} title={`하위: ${b.label} ${b.count}개`}>
          ↓{b.count}{b.label}
        </span>
      ))}
    </div>
  )
}
