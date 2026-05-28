import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, X, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { testExecutionApi, type GeneratedDefectSuggestion } from '@/api/test-execution.api'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  phaseId: string
  roundId?: string
  failCount: number
  blockedCount: number
}

const SEVERITY_LABEL: Record<string, { label: string; color: string }> = {
  critical: { label: '치명', color: 'text-red-700 bg-red-50 border-red-200' },
  major: { label: '주요', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  minor: { label: '보통', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  trivial: { label: '낮음', color: 'text-gray-600 bg-gray-50 border-gray-200' },
}
const PRIORITY_LABEL: Record<string, { label: string; color: string }> = {
  high: { label: '높음', color: 'text-red-600 bg-red-50 border-red-200' },
  medium: { label: '중간', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  low: { label: '낮음', color: 'text-gray-500 bg-gray-50 border-gray-200' },
}

export function AIDefectGenerateModal({ open, onClose, projectId, phaseId, roundId, failCount, blockedCount }: Props) {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [generated, setGenerated] = useState<GeneratedDefectSuggestion[]>([])
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  const total = failCount + blockedCount

  const generateMutation = useMutation({
    mutationFn: () => testExecutionApi.generateDefectsFromResults(projectId, {
      phaseId,
      roundId,
      additionalInfo: additionalInfo || undefined,
    }),
    onSuccess: (data) => {
      setGenerated(data.map(d => ({ ...d, selected: true })))
      setStep(2)
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => testExecutionApi.saveGeneratedDefects(
      projectId,
      generated.filter(d => d.selected),
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['defects', projectId] })
      qc.invalidateQueries({ queryKey: ['test-rounds', projectId, phaseId] })
      setStep(3)
    },
  })

  const toggleAll = (val: boolean) => setGenerated(prev => prev.map(d => ({ ...d, selected: val })))
  const selectedCount = generated.filter(d => d.selected).length

  const updateField = (idx: number, field: keyof GeneratedDefectSuggestion, value: string) => {
    setGenerated(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col">
        <div className="flex items-center gap-2 px-5 py-3 border-b">
          <Bot size={16} className="text-[#5E6AD2]" />
          <span className="text-sm font-semibold text-gray-800">AI 결함 자동 생성</span>
          <div className="ml-auto flex items-center gap-3">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex items-center gap-1 text-xs ${step >= s ? 'text-[#5E6AD2]' : 'text-gray-300'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${step >= s ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]' : 'border-gray-300'}`}>{s}</div>
                {s === 1 ? '설정' : s === 2 ? '검토' : '완료'}
                {s < 3 && <ChevronRight size={12} className="text-gray-300" />}
              </div>
            ))}
            <button onClick={onClose} className="ml-2 p-1 text-gray-400 hover:text-gray-600"><X size={15} /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">

          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700">
                  <p className="font-medium mb-1">생성 대상: Fail/Blocked 케이스 중 결함 미연결 건</p>
                  <p>Fail <span className="font-bold text-red-600">{failCount}</span>건 + Blocked <span className="font-bold text-amber-600">{blockedCount}</span>건 = <span className="font-bold">{total}</span>건을 AI가 분석하여 결함을 제안합니다.</p>
                  {roundId && <p className="mt-1 text-amber-600">※ 선택한 회차의 결과만 분석합니다.</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">추가 지시사항 (선택)</label>
                <textarea
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] resize-none"
                  placeholder="예) 보안 관련 결함은 critical로 분류해줘. UI 결함은 minor로...&#10;특별히 강조할 사항이 있으면 입력하세요."
                  value={additionalInfo}
                  onChange={e => setAdditionalInfo(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">AI가 제안한 결함 목록입니다. 수정 후 저장할 항목을 선택하세요.</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleAll(true)} className="text-[11px] text-[#5E6AD2] hover:underline">전체선택</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => toggleAll(false)} className="text-[11px] text-gray-400 hover:underline">전체해제</button>
                  <span className="text-xs font-medium text-gray-600 ml-2">{selectedCount}/{generated.length}개 선택됨</span>
                </div>
              </div>

              {generated.map((d, idx) => {
                const sev = SEVERITY_LABEL[d.severity] ?? SEVERITY_LABEL.major
                const pri = PRIORITY_LABEL[d.priority] ?? PRIORITY_LABEL.medium
                const isEditing = editingIdx === idx
                return (
                  <div key={idx} className={`border rounded-lg p-3 transition-colors ${d.selected ? 'border-[#5E6AD2]/30 bg-[#5E6AD2]/[0.02]' : 'border-gray-200 opacity-50'}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={!!d.selected}
                        onChange={e => updateField(idx, 'selected' as any, e.target.checked as any)}
                        className="mt-0.5 rounded accent-[#5E6AD2]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="font-mono text-[10px] text-[#5E6AD2]">{d.scenarioCode}</span>
                          <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{d.caseTitle}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${sev.color}`}>{sev.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${pri.color}`}>{pri.label}</span>
                          <button onClick={() => setEditingIdx(isEditing ? null : idx)} className="ml-auto text-[10px] text-gray-400 hover:text-[#5E6AD2]">
                            {isEditing ? '접기' : '편집'}
                          </button>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 mt-2">
                            <input
                              className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                              value={d.title}
                              onChange={e => updateField(idx, 'title', e.target.value)}
                              placeholder="결함 제목"
                            />
                            <textarea
                              rows={4}
                              className="w-full border rounded px-2 py-1 text-xs resize-none focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                              value={d.description}
                              onChange={e => updateField(idx, 'description', e.target.value)}
                              placeholder="결함 설명"
                            />
                            <div className="flex gap-2">
                              <select className="border rounded px-2 py-1 text-xs flex-1 focus:ring-1 focus:ring-[#5E6AD2]/30" value={d.severity} onChange={e => updateField(idx, 'severity', e.target.value)}>
                                {Object.entries(SEVERITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                              <select className="border rounded px-2 py-1 text-xs flex-1 focus:ring-1 focus:ring-[#5E6AD2]/30" value={d.priority} onChange={e => updateField(idx, 'priority', e.target.value)}>
                                {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-700 font-medium">{d.title}</p>
                        )}

                        {!isEditing && d.description && (
                          <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{d.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <CheckCircle2 size={40} className="text-green-500" />
              <p className="text-sm font-semibold text-gray-700">결함 등록 완료</p>
              <p className="text-xs text-gray-400">{selectedCount}개의 결함이 등록되고 테스트 결과에 연결되었습니다.</p>
              <Button size="sm" className="mt-3 h-7 text-xs px-4" onClick={onClose}>닫기</Button>
            </div>
          )}
        </div>

        {step !== 3 && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-xl">
            <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={onClose}>취소</Button>
            {step === 1 && (
              <Button
                size="sm"
                className="h-7 text-xs px-4 bg-[#5E6AD2] hover:bg-[#4f5bb8]"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || total === 0}
              >
                {generateMutation.isPending ? <><Loader2 size={11} className="animate-spin mr-1" />생성 중...</> : `🤖 AI 결함 생성 (${total}건)`}
              </Button>
            )}
            {step === 2 && (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => setStep(1)}>이전</Button>
                <Button
                  size="sm"
                  className="h-7 text-xs px-4 bg-[#5E6AD2] hover:bg-[#4f5bb8]"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || selectedCount === 0}
                >
                  {saveMutation.isPending ? <><Loader2 size={11} className="animate-spin mr-1" />저장 중...</> : `저장 (${selectedCount}개)`}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
