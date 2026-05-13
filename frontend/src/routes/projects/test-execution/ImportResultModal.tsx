import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { testExecutionApi } from '@/api/test-execution.api'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'

interface ImportResultModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  phaseId: string
  onSuccess: () => void
}

interface ImportReport {
  testerName: string
  testerDept?: string
  matched: number
  unmatched: { scenarioCode: string; caseTitle: string; reason: string }[]
  invalidValues: { scenarioCode: string; caseTitle: string; value: string }[]
}

export function ImportResultModal({ open, onClose, projectId, phaseId, onSuccess }: ImportResultModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)

  const importMutation = useMutation({
    mutationFn: (f: File) => testExecutionApi.importResults(projectId, phaseId, f),
    onSuccess: (data) => {
      setReport(data)
    },
  })

  const handleUpload = () => {
    if (!file) return
    importMutation.mutate(file)
  }

  const handleConfirm = () => {
    onSuccess()
    handleClose()
  }

  const handleClose = () => {
    setFile(null)
    setReport(null)
    importMutation.reset()
    onClose()
  }

  const handleRetry = () => {
    importMutation.reset()
    setFile(null)
  }

  return (
    <Modal open={open} onClose={handleClose} title={report ? 'Import 완료' : 'Excel Import'} className="max-w-lg">
      {report ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle size={16} />
            <span className="text-sm font-medium">Import 완료</span>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">수행자</span>
              <span className="text-gray-800 font-medium">{report.testerName}{report.testerDept ? ` / ${report.testerDept}` : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">매칭 성공</span>
              <span className="text-green-600 font-medium">{report.matched}건</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">미매칭 (스킵)</span>
              <span className="text-gray-500 font-medium">{report.unmatched?.length ?? 0}건</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">잘못된 값</span>
              <span className="text-amber-600 font-medium">{report.invalidValues?.length ?? 0}건</span>
            </div>
          </div>

          {report.unmatched && report.unmatched.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-gray-600">미매칭 목록</p>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {report.unmatched.map((item, idx) => (
                  <div key={idx} className="text-[10px] text-gray-500 flex gap-2">
                    <span className="font-mono text-gray-400">{item.scenarioCode}</span>
                    <span className="truncate">{item.caseTitle}</span>
                    <span className="text-amber-500 ml-auto whitespace-nowrap">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.invalidValues && report.invalidValues.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-gray-600">잘못된 값 목록</p>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {report.invalidValues.map((item, idx) => (
                  <div key={idx} className="text-[10px] text-gray-500 flex gap-2">
                    <span className="font-mono text-gray-400">{item.scenarioCode}</span>
                    <span className="truncate">{item.caseTitle}</span>
                    <span className="text-amber-500 ml-auto whitespace-nowrap">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleConfirm}>확인</Button>
          </div>
        </div>
      ) : importMutation.isError ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">Import 실패</span>
          </div>
          <p className="text-xs text-gray-600">
            {(importMutation.error as any)?.response?.data?.message || (importMutation.error as Error)?.message || '파일 처리 중 오류가 발생했습니다.'}
          </p>
          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleRetry}>다시 시도</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-[#5E6AD2]/50 transition-colors"
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); e.target.value = '' }} />
            {file ? (
              <p className="text-sm text-gray-700 font-medium">{file.name}</p>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-500">Excel 파일을 드래그하거나 클릭하여 선택</p>
                <p className="text-[10px] text-gray-400 mt-1">.xlsx, .xls 지원</p>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!file || importMutation.isPending}
              onClick={handleUpload}
            >
              {importMutation.isPending ? '처리 중...' : '업로드 및 Import'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
