import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from '@/components/ui/button'
import { AIProgressBar } from './AIProgressBar'
import apiClient from '@/api/client'
import { requirementApi } from '@/api/requirement.api'
import { useCaseApi, userStoryApi } from '@/api/usecase.api'
import { aiStatusApi } from '@/api/admin.api'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  queryKey: string[]
}

type TabType = 'requirements' | 'useCases' | 'userStories'

const TEMPLATES = [
  { label: '도메인 컨텍스트', value: '도메인: \n주요 사용자: \n핵심 비즈니스 규칙: \n참고사항: ' },
  { label: '기술/시스템 제약', value: '기술 스택: \n연동 시스템: \n성능 요건: \n보안 요건: ' },
  { label: '추출 범위 지정', value: '포함할 항목: \n제외할 항목: \n우선순위 높은 기능: ' },
]

export function MarkdownImportModal({ open, onClose, projectId, queryKey }: Props) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [content, setContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [useCases, setUseCases] = useState<any[]>([])
  const [userStories, setUserStories] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('requirements')
  const [generated, setGenerated] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCounts, setSavedCounts] = useState({ requirements: 0, useCases: 0, userStories: 0 })
  const [selectedModel, setSelectedModel] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [showTemplate, setShowTemplate] = useState(false)
  const [nochange, setNochange] = useState(false)
  const [diffMeta, setDiffMeta] = useState<{
    mode: 'first' | 'update';
    changedSections: string[];
    unchangedSections: string[];
    deletedSections: string[];
  } | null>(null)

  const { data: aiStatus } = useQuery({ queryKey: ['ai-status', projectId], queryFn: () => aiStatusApi.check(projectId), enabled: !!projectId })

  const { data: existingCounts } = useQuery({
    queryKey: ['existing-counts', projectId],
    queryFn: async () => {
      const [reqs, ucs, uss] = await Promise.all([
        requirementApi.list(projectId, { limit: 1 }),
        useCaseApi.list(projectId),
        userStoryApi.list(projectId),
      ])
      return {
        requirements: reqs?.total ?? 0,
        useCases: (ucs as any[]).length ?? 0,
        userStories: (uss as any[]).length ?? 0,
      }
    },
    enabled: open && !!projectId,
  })
  const hasExisting = existingCounts && (existingCounts.requirements + existingCounts.useCases + existingCounts.userStories) > 0

  const parseMutation = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/ai/parse-markdown`, {
      content,
      modelId: selectedModel || undefined,
      additionalInfo: additionalInfo || undefined,
    }).then(r => r.data),
    onSuccess: (data: any) => {
      const meta = data?._diffMeta
      if (meta) setDiffMeta(meta)

      if (data && !Array.isArray(data)) {
        setItems((data.requirements ?? []).map((i: any) => ({ ...i, _selected: i.action !== 'skip' })))
        setUseCases((data.useCases ?? []).map((i: any) => ({ ...i, _selected: i.action !== 'skip' })))
        setUserStories((data.userStories ?? []).map((i: any) => ({ ...i, _selected: i.action !== 'skip' })))
      } else {
        setItems(Array.isArray(data) ? data.map((i: any) => ({ ...i, _selected: i.action !== 'skip' })) : [])
        setUseCases([])
        setUserStories([])
      }

      if (meta?.mode === 'update' &&
          (data.requirements?.length ?? 0) === 0 &&
          (data.useCases?.length ?? 0) === 0 &&
          (data.userStories?.length ?? 0) === 0) {
        setNochange(true)
      } else {
        setGenerated(true)
      }
    },
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const selReqs = items.filter(i => i._selected)
      const selUCs = useCases.filter(i => i._selected)
      const selUSs = userStories.filter(i => i._selected)

      const savedReqs: { id: string; title: string }[] = []

      if (existingCounts && existingCounts.requirements > 0) {
        try {
          const existing = await requirementApi.list(projectId, { limit: 500 })
          ;(existing?.data ?? []).forEach((r: any) => savedReqs.push({ id: r.id, title: r.title }))
        } catch {}
      }

      for (const item of selReqs) {
        if (item.action === 'update' && item._existingId) {
          const saved = await requirementApi.update(projectId, item._existingId, {
            title: item.title, description: item.description,
            category: item.category, priority: item.priority ?? 'medium',
          })
          savedReqs.push({ id: saved.id, title: saved.title })
        } else if (item.action !== 'skip') {
          const saved = await requirementApi.create(projectId, {
            title: item.title, description: item.description,
            category: item.category, priority: item.priority ?? 'medium', status: 'new',
          })
          savedReqs.push({ id: saved.id, title: saved.title })
        }
      }

      const findReqId = (linkedTitle?: string) => {
        if (!linkedTitle) return undefined
        const match = savedReqs.find(r =>
          r.title.toLowerCase().includes(linkedTitle.toLowerCase().slice(0, 15)) ||
          linkedTitle.toLowerCase().includes(r.title.toLowerCase().slice(0, 15))
        )
        return match?.id
      }

      for (const item of selUCs) {
        if (item.action === 'update' && item._existingId) {
          await useCaseApi.update(projectId, item._existingId, {
            title: item.title, description: item.description, actor: item.actor,
            precondition: item.precondition, mainFlow: item.mainFlow, postcondition: item.postcondition,
          })
        } else if (item.action !== 'skip') {
          await useCaseApi.create(projectId, {
            title: item.title, actor: item.actor, description: item.description,
            precondition: item.precondition, mainFlow: item.mainFlow,
            postcondition: item.postcondition, priority: item.priority ?? 'medium', status: 'new',
            requirementId: findReqId(item.linkedRequirementTitle),
          })
        }
      }
      for (const item of selUSs) {
        if (item.action === 'update' && item._existingId) {
          await userStoryApi.update(projectId, item._existingId, {
            title: item.title, asA: item.asA, iWantTo: item.iWantTo,
            soThat: item.soThat, acceptanceCriteria: item.acceptanceCriteria,
          })
        } else if (item.action !== 'skip') {
          await userStoryApi.create(projectId, {
            title: item.title, asA: item.asA, iWantTo: item.iWantTo,
            soThat: item.soThat, acceptanceCriteria: item.acceptanceCriteria,
            priority: item.priority ?? 'medium', status: 'new', storyPoints: item.storyPoints,
            requirementId: findReqId(item.linkedRequirementTitle),
          })
        }
      }
      return { requirements: selReqs.length, useCases: selUCs.length, userStories: selUSs.length }
    },
    onSuccess: (counts) => {
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: ['use-cases', projectId] })
      qc.invalidateQueries({ queryKey: ['user-stories', projectId] })
      qc.invalidateQueries({ queryKey: ['dashboard', projectId] })
      qc.invalidateQueries({ queryKey: ['use-cases-count', projectId] })
      qc.invalidateQueries({ queryKey: ['user-stories-count', projectId] })
      setSavedCounts(counts)
      setSaved(true)
    },
  })

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => setContent(e.target?.result as string ?? '')
    reader.readAsText(file)
  }

  const handleClose = () => {
    setContent(''); setFileName(''); setItems([]); setUseCases([]); setUserStories([])
    setGenerated(false); setSaved(false); setActiveTab('requirements')
    setDiffMeta(null); setNochange(false); setAdditionalInfo(''); setShowTemplate(false)
    onClose()
  }

  const toggleReq = (i: number) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, _selected: !item._selected } : item))
  const toggleUC = (i: number) => setUseCases(prev => prev.map((item, idx) => idx === i ? { ...item, _selected: !item._selected } : item))
  const toggleUS = (i: number) => setUserStories(prev => prev.map((item, idx) => idx === i ? { ...item, _selected: !item._selected } : item))

  const totalSelected = items.filter(i => i._selected).length + useCases.filter(i => i._selected).length + userStories.filter(i => i._selected).length

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'requirements', label: '요구사항', count: items.length },
    { key: 'useCases', label: 'Use Case', count: useCases.length },
    { key: 'userStories', label: 'User Story', count: userStories.length },
  ]

  return (
    <Modal open={open} onClose={handleClose} title="📄 마크다운 AI 분석" className="max-w-2xl">
      <div className="flex flex-col max-h-[calc(85vh-8rem)]">
        {saved ? (
          <div className="text-center py-6">
            <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
            <p className="font-medium">생성 완료</p>
            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
              {savedCounts.requirements > 0 && <p>요구사항 {savedCounts.requirements}건</p>}
              {savedCounts.useCases > 0 && <p>Use Case {savedCounts.useCases}건</p>}
              {savedCounts.userStories > 0 && <p>User Story {savedCounts.userStories}건</p>}
            </div>
            <Button className="mt-4" onClick={handleClose}>확인</Button>
          </div>
        ) : nochange ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-2xl">✅</p>
            <p className="text-sm font-medium text-gray-700">변경사항이 없습니다</p>
            <p className="text-xs text-gray-400">기존 SPEC과 동일한 내용입니다</p>
            <Button variant="outline" size="sm" onClick={handleClose} className="mt-2">닫기</Button>
          </div>
        ) : !generated ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 leading-relaxed">
                <p className="font-medium mb-0.5">📌 이 기능은?</p>
                <p>SPEC.md, 요구사항 문서 등 마크다운 파일을 AI가 분석하여 <strong>요구사항 · Use Case · User Story</strong>를 자동으로 추출합니다.</p>
                <p className="mt-1 text-blue-500">추출 결과를 탭별로 확인하고 원하는 항목만 선택하여 저장하세요.</p>
              </div>
              {hasExisting && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">⚠️ 기존 데이터가 있습니다</p>
                    <p className="text-amber-600 leading-relaxed">
                      현재 프로젝트에 요구사항 {existingCounts.requirements}개, Use Case {existingCounts.useCases}개, User Story {existingCounts.userStories}개가 등록되어 있습니다.
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-amber-600">
                      <li>• AI가 기존 데이터를 참고하여 <strong>신규/수정/기존</strong>으로 분류합니다</li>
                      <li>• <strong>신규</strong>: 없는 내용 → 새로 추가</li>
                      <li>• <strong>수정</strong>: 비슷하지만 보완 필요 → 기존 항목 업데이트</li>
                      <li>• <strong>기존</strong>: 이미 있는 내용 → 기본적으로 제외 (선택 가능)</li>
                      <li>• AI가 항목을 오인식할 수 있으니 <strong>결과를 반드시 검토</strong>하세요</li>
                    </ul>
                  </div>
                </div>
              )}
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onDragOver={e => e.preventDefault()}
              >
                <FileText size={24} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">{fileName || '.md 파일을 선택하거나 드롭하세요'}</p>
              </div>
              <input ref={fileRef} type="file" accept=".md,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              {content && (
                <div className="bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap">{content.slice(0, 500)}{content.length > 500 ? '...' : ''}</pre>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 border-t border-gray-100 pt-3 mt-2 space-y-2">
              {aiStatus?.models && aiStatus.models.length > 0 && (
                <select className="border rounded px-2 h-7 text-xs w-full" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                  <option value="">자동 선택 (기본)</option>
                  {aiStatus.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              )}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-gray-600">추가 정보 <span className="text-gray-400 font-normal">(선택)</span></label>
                  <div className="relative">
                    <button type="button" onClick={() => setShowTemplate(p => !p)} className="text-[10px] text-[#5E6AD2] hover:underline flex items-center gap-0.5">📋 템플릿</button>
                    {showTemplate && (
                      <div className="absolute right-0 top-5 z-10 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[170px]">
                        {TEMPLATES.map(t => (
                          <button key={t.label} onClick={() => { setAdditionalInfo(t.value); setShowTemplate(false) }}
                            className="block w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50">{t.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <textarea
                  className="w-full border rounded-md px-2 py-1.5 text-xs text-gray-700 resize-none focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] placeholder:text-gray-300"
                  rows={2}
                  placeholder="AI가 더 정확하게 추출할 수 있도록 도메인 컨텍스트, 제약 조건 등을 입력해 주세요."
                  value={additionalInfo}
                  onChange={e => setAdditionalInfo(e.target.value)}
                />
              </div>
              <AIProgressBar isActive={parseMutation.isPending} type="parse" />
              {!parseMutation.isPending && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>취소</Button>
                <Button disabled={!content || parseMutation.isPending} disabledReason={!content ? "내용을 입력하세요" : "처리 중입니다..."} onClick={() => parseMutation.mutate()}>
                  <Sparkles size={14} />AI 분석
                </Button>
              </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex-shrink-0">
              {diffMeta && (
                <div className="flex items-center gap-2 mb-2">
                  {diffMeta.mode === 'first' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[11px] font-medium">
                      📄 최초 등록
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[11px] font-medium">
                      🔄 업데이트 모드 · {diffMeta.changedSections.length}개 섹션 분석됨
                    </span>
                  )}
                  {diffMeta.mode === 'update' && diffMeta.unchangedSections.length > 0 && (
                    <span className="text-[10px] text-gray-400">{diffMeta.unchangedSections.length}개 섹션 변경 없음 (스킵)</span>
                  )}
                  {diffMeta.mode === 'update' && diffMeta.deletedSections.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-500 rounded text-[10px]">
                      ⚠️ {diffMeta.deletedSections.length}개 섹션 삭제됨
                    </span>
                  )}
                </div>
              )}
              <div className="flex border-b">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-[#5E6AD2] text-[#5E6AD2]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
              <div className="space-y-2 pt-2">
                {activeTab === 'requirements' && items.map((item, i) => (
                  <div key={i} onClick={() => toggleReq(i)}
                    className={`flex items-start gap-3 p-2 rounded border cursor-pointer ${item._selected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 opacity-50'}`}>
                    <input type="checkbox" checked={item._selected} onChange={() => toggleReq(i)} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {item.action === 'new' && <span className="text-[9px] px-1 rounded bg-green-100 text-green-700 font-medium flex-shrink-0">신규</span>}
                        {item.action === 'update' && <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-700 font-medium flex-shrink-0">수정</span>}
                        {item.action === 'skip' && <span className="text-[9px] px-1 rounded bg-gray-100 text-gray-500 font-medium flex-shrink-0">기존</span>}
                        <p className="font-medium text-xs">{item.title}</p>
                      </div>
                      {item.category && <span className="text-[10px] text-gray-400 mr-2">{item.category}</span>}
                      {item.priority && <span className="text-[10px] bg-gray-100 px-1 rounded">{item.priority}</span>}
                      {item.description && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{item.description}</p>}
                    </div>
                  </div>
                ))}

                {activeTab === 'useCases' && useCases.map((item, i) => (
                  <div key={i} onClick={() => toggleUC(i)}
                    className={`flex items-start gap-3 p-2 rounded border cursor-pointer ${item._selected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 opacity-50'}`}>
                    <input type="checkbox" checked={item._selected} onChange={() => toggleUC(i)} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {item.action === 'new' && <span className="text-[9px] px-1 rounded bg-green-100 text-green-700 font-medium flex-shrink-0">신규</span>}
                        {item.action === 'update' && <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-700 font-medium flex-shrink-0">수정</span>}
                        {item.action === 'skip' && <span className="text-[9px] px-1 rounded bg-gray-100 text-gray-500 font-medium flex-shrink-0">기존</span>}
                        <p className="font-medium text-xs">{item.title}</p>
                      </div>
                      {item.actor && <span className="text-[10px] text-gray-400 mr-2">Actor: {item.actor}</span>}
                      {item.linkedRequirementTitle && (
                        <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">
                          → {item.linkedRequirementTitle.slice(0, 25)}{item.linkedRequirementTitle.length > 25 ? '...' : ''}
                        </span>
                      )}
                      {item.mainFlow && Array.isArray(item.mainFlow) && (
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">1. {item.mainFlow[0]}{item.mainFlow.length > 1 ? ` (+${item.mainFlow.length - 1}단계)` : ''}</p>
                      )}
                    </div>
                  </div>
                ))}

                {activeTab === 'userStories' && userStories.map((item, i) => (
                  <div key={i} onClick={() => toggleUS(i)}
                    className={`flex items-start gap-3 p-2 rounded border cursor-pointer ${item._selected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 opacity-50'}`}>
                    <input type="checkbox" checked={item._selected} onChange={() => toggleUS(i)} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {item.action === 'new' && <span className="text-[9px] px-1 rounded bg-green-100 text-green-700 font-medium flex-shrink-0">신규</span>}
                        {item.action === 'update' && <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-700 font-medium flex-shrink-0">수정</span>}
                        {item.action === 'skip' && <span className="text-[9px] px-1 rounded bg-gray-100 text-gray-500 font-medium flex-shrink-0">기존</span>}
                        <p className="font-medium text-xs">{item.title}</p>
                      </div>
                      {item.linkedRequirementTitle && (
                        <span className="text-[10px] bg-pink-100 text-pink-600 px-1 rounded mr-1">
                          → {item.linkedRequirementTitle.slice(0, 25)}{item.linkedRequirementTitle.length > 25 ? '...' : ''}
                        </span>
                      )}
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                        <span className="text-gray-400">As a</span> {item.asA} <span className="text-gray-400">I want to</span> {item.iWantTo?.slice(0, 30)}{item.iWantTo?.length > 30 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                ))}

                {activeTab === 'requirements' && items.length === 0 && <p className="text-xs text-gray-400 text-center py-4">추출된 요구사항 없음</p>}
                {activeTab === 'useCases' && useCases.length === 0 && <p className="text-xs text-gray-400 text-center py-4">추출된 Use Case 없음</p>}
                {activeTab === 'userStories' && userStories.length === 0 && <p className="text-xs text-gray-400 text-center py-4">추출된 User Story 없음</p>}
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-gray-100 pt-3 mt-2 space-y-2">
              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setGenerated(false)}>다시 분석</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>취소</Button>
                  <Button disabled={totalSelected === 0 || confirmMutation.isPending} disabledReason={totalSelected === 0 ? "항목을 선택하세요" : "처리 중입니다..."} onClick={() => confirmMutation.mutate()}>
                    {confirmMutation.isPending ? '저장 중...' : `✅ ${totalSelected}개 확정 저장`}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
