import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { testExecutionApi } from '@/api/test-execution.api'

interface Props {
  projectId: string
  value: string
  onChange: (name: string, dept: string) => void
  placeholder?: string
}

export function TesterAutocomplete({ projectId, value, onChange, placeholder }: Props) {
  const [inputVal, setInputVal] = useState(value)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: testers = [] } = useQuery({
    queryKey: ['testers', projectId],
    queryFn: () => testExecutionApi.getTesters(projectId),
    enabled: !!projectId,
  })

  useEffect(() => {
    setInputVal(value)
  }, [value])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = testers.filter(t =>
    t.testerName.toLowerCase().includes(inputVal.toLowerCase())
  )

  const handleInput = (val: string) => {
    setInputVal(val)
    onChange(val, '')
    setOpen(true)
  }

  const handleSelect = (name: string, dept: string) => {
    setInputVal(name)
    onChange(name, dept || '')
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="w-full border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
        value={inputVal}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
          {filtered.map((t, idx) => (
            <button
              key={idx}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#5E6AD2]/5 transition-colors"
              onClick={() => handleSelect(t.testerName, t.testerDept || '')}
            >
              {t.testerName}
              {t.testerDept && <span className="text-gray-400 ml-1">({t.testerDept})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
