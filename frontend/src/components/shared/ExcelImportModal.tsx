import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'
import apiClient from '@/api/client'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  queryKey: string[]
}

export function ExcelImportModal({ open, onClose, projectId, queryKey }: Props) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const importMutation = useMutation({
    mutationFn: async (f: File) => {
      const form = new FormData()
      form.append('file', f)
      const res = await apiClient.post(`/projects/${projectId}/requirements/import/excel`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (data) => {
      setResult(data)
      qc.invalidateQueries({ queryKey })
    },
  })

  const downloadTemplate = async () => {
    const store = JSON.parse(localStorage.getItem('pms-auth') || '{}')
    const token = store?.state?.accessToken ?? ''
    const res = await fetch(`/api/v1/projects/${projectId}/requirements/template/excel`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'requirements-template.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleClose = () => {
    setFile(null)
    setResult(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="엑셀 Import">
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
          <Download size={14} />
          엑셀 템플릿 다운로드
        </Button>

        {!result ? (
          <>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">
                {file ? file.name : '파일을 선택하거나 여기에 드롭하세요 (.xlsx)'}
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>취소</Button>
              <Button
                disabled={!file || importMutation.isPending}
                disabledReason={!file ? "파일을 선택하세요" : "처리 중입니다..."}
                onClick={() => file && importMutation.mutate(file)}
              >
                {importMutation.isPending ? '처리중...' : 'Import'}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle size={18} />
              <span className="font-medium">{result.created}건 생성 완료</span>
            </div>
            {result.skipped > 0 && (
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle size={18} />
                <span>{result.skipped}건 건너뜀</span>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded p-3 text-sm text-red-600 space-y-1">
                {result.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <Button className="w-full" onClick={handleClose}>확인</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
