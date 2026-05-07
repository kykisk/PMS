import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Check } from 'lucide-react'
import { Modal } from './Modal'
import { requirementApi } from '@/api/requirement.api'
import { Badge } from './Badge'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  onSelect: (req: { id: string; code: string; title: string }) => void
  selected?: string
}

export function RequirementPickerModal({ open, onClose, projectId, onSelect, selected }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: result } = useQuery({
    queryKey: ['requirements-picker', projectId, search, page],
    queryFn: () => requirementApi.list(projectId, { search: search || undefined, page, limit: 10 }),
    enabled: open && !!projectId,
  })

  const requirements = result?.data ?? []
  const totalPages = result?.totalPages ?? 1

  const handleSelect = (req: any) => {
    onSelect({ id: req.id, code: req.code, title: req.title })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="요구사항 선택" className="max-w-lg">
      <div className="space-y-3">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="코드 또는 제목으로 검색..."
            className="w-full pl-8 pr-8 py-1.5 text-xs border rounded-md focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium text-gray-500 w-20">코드</th>
                <th className="text-left px-3 py-1.5 font-medium text-gray-500">요구사항명</th>
                <th className="text-left px-3 py-1.5 font-medium text-gray-500 w-16">우선순위</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {requirements.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-6 text-gray-400">결과가 없습니다</td></tr>
              ) : requirements.map((req: any) => (
                <tr
                  key={req.id}
                  onClick={() => handleSelect(req)}
                  className={`border-b cursor-pointer transition-colors duration-150 ${selected === req.id ? 'bg-[#5E6AD2]/5' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-3 py-1.5 font-mono text-gray-500">{req.code}</td>
                  <td className="px-3 py-1.5 text-gray-800">
                    <span className="truncate block max-w-[250px]" title={req.title}>
                      {req.title.length > 30 ? req.title.slice(0, 30) + '...' : req.title}
                    </span>
                  </td>
                  <td className="px-3 py-1.5"><Badge value={req.priority} /></td>
                  <td className="px-3 py-1.5">
                    {selected === req.id && <Check size={12} className="text-[#5E6AD2]" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{result?.total}건 중 {page}/{totalPages} 페이지</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-2 py-0.5 border rounded disabled:opacity-40 hover:bg-gray-50">이전</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-0.5 border rounded disabled:opacity-40 hover:bg-gray-50">다음</button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-1">
          <button onClick={() => { onSelect({ id: '', code: '', title: '' }); onClose() }} className="text-xs text-gray-400 hover:text-gray-600">
            선택 해제
          </button>
          <button onClick={onClose} className="px-3 py-1 text-xs border rounded hover:bg-gray-50">
            닫기
          </button>
        </div>
      </div>
    </Modal>
  )
}
