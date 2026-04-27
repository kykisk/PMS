interface Props {
  page: number
  totalPages: number
  total: number
  limit: number
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, total, limit, onChange }: Props) {
  if (totalPages <= 1) return null

  const pages: number[] = []
  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
  const end = Math.min(totalPages, start + 4)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>총 {total}건</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(1)} disabled={page === 1}
          className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">«</button>
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">‹</button>
        {pages.map(p => (
          <button key={p} onClick={() => onChange(p)}
            className={`px-2.5 py-1 rounded border ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-100'}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">›</button>
        <button onClick={() => onChange(totalPages)} disabled={page === totalPages}
          className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">»</button>
      </div>
      <span>{limit}개씩</span>
    </div>
  )
}
