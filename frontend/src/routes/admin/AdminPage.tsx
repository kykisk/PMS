import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Trash2, Check, Eye, EyeOff, Shield, Bot, FileDown } from 'lucide-react'
import { adminApi, PROVIDER_MODELS, type LLMConfig, type ExportTemplate, type ExportTemplateColumn } from '@/api/admin.api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI (GPT)', anthropic: 'Anthropic (Claude)',
  gemini: 'Google (Gemini)', bedrock: 'AWS Bedrock',
}

const DEFAULT_TEMPLATES = {
  parseSpec: '요구사항 기술서 분석 프롬프트 (비워두면 기본값 사용)',
  parseMarkdown: '마크다운 분석 프롬프트 (비워두면 기본값 사용)',
  generateFeatures: '기능 생성 프롬프트 (비워두면 기본값 사용)',
  generateTasks: 'Task 생성 프롬프트 (비워두면 기본값 사용)',
  generateTestScenarios: '테스트 시나리오 생성 프롬프트 (비워두면 기본값 사용)',
}

export default function AdminPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'llm' | 'users' | 'templates' | 'llm-access'>('llm')
  const [showAddLLM, setShowAddLLM] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [editLLM, setEditLLM] = useState<string | null>(null)
  const [llmForm, setLlmForm] = useState({ provider: 'openai', model: 'gpt-4.1', apiKey: '', secretKey: '', region: '', isActive: false })
  const [promptTemplates, setPromptTemplates] = useState<Record<string, string>>({})

  const { data: llmConfigs = [] } = useQuery({ queryKey: ['admin-llm'], queryFn: adminApi.listLLM })
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.listUsers })
  const { data: exportTemplates = [] } = useQuery({ queryKey: ['admin-templates'], queryFn: adminApi.listTemplates })
  const { data: llmAccessGrants = [] } = useQuery<any[]>({ queryKey: ['admin-llm-access'], queryFn: adminApi.listLLMAccess })

  const [localTemplates, setLocalTemplates] = useState<Record<string, ExportTemplate>>({})

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; columns?: ExportTemplateColumn[] } }) =>
      adminApi.updateTemplate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates'] }),
  })

  const createLLMMutation = useMutation({
    mutationFn: () => {
      const { secretKey: _, ...rest } = llmForm
      return adminApi.createLLM({ ...rest, apiKey: getApiKeyValue(), promptTemplates: promptTemplates })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-llm'] }); setShowAddLLM(false); resetForm() },
  })

  const updateLLMMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateLLM(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-llm'] }); setShowAddLLM(false); setEditLLM(null); resetForm() },
  })

  const deleteLLMMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteLLM(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-llm'] }),
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const grantAccessMutation = useMutation({
    mutationFn: ({ userId, llmConfigId }: { userId: string; llmConfigId: string }) => adminApi.grantLLMAccess(userId, llmConfigId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-llm-access'] }),
  })

  const revokeAccessMutation = useMutation({
    mutationFn: ({ userId, llmConfigId }: { userId: string; llmConfigId: string }) => adminApi.revokeLLMAccess(userId, llmConfigId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-llm-access'] }),
  })

  const hasAccess = (userId: string, llmConfigId: string) =>
    llmAccessGrants.some((g: any) => g.userId === userId && g.llmConfigId === llmConfigId)

  const resetForm = () => {
    setLlmForm({ provider: 'openai', model: 'gpt-4.1', apiKey: '', secretKey: '', region: '', isActive: false })
    setPromptTemplates({})
  }

  const openEdit = (cfg: LLMConfig) => {
    setEditLLM(cfg.id)
    setLlmForm({ provider: cfg.provider, model: cfg.model, apiKey: '', secretKey: '', region: cfg.region ?? '', isActive: cfg.isActive })
    setPromptTemplates((cfg.promptTemplates as Record<string, string>) ?? {})
    setShowAddLLM(true)
  }

  const getApiKeyValue = () => {
    if (llmForm.provider === 'bedrock') return `${llmForm.apiKey}:${llmForm.secretKey}`
    return llmForm.apiKey
  }

  const handleSaveLLM = () => {
    const apiKey = getApiKeyValue()
    if (editLLM) {
      const data: any = { provider: llmForm.provider, model: llmForm.model, region: llmForm.region, isActive: llmForm.isActive, promptTemplates: promptTemplates }
      if (apiKey) data.apiKey = apiKey
      updateLLMMutation.mutate({ id: editLLM, data })
    } else {
      createLLMMutation.mutate()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/projects')} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
        <h1 className="font-bold text-lg">관리자 페이지</h1>
        <span className="text-sm text-gray-500 ml-2">({user?.name})</span>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('llm')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'llm' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
          >
            <Bot size={16} /> LLM 설정
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
          >
            <Shield size={16} /> 사용자 관리
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'templates' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
          >
            <FileDown size={16} /> 산출물 템플릿
          </button>
          <button
            onClick={() => setActiveTab('llm-access')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'llm-access' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
          >
            <Shield size={16} /> LLM 권한
          </button>
        </div>

        {activeTab === 'llm' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-semibold">LLM 프로바이더 설정</h2>
                <p className="text-sm text-gray-500 mt-0.5">활성화된 프로바이더가 AI 기능에 사용됩니다. 하나만 활성화 가능.</p>
              </div>
              <Button onClick={() => { resetForm(); setEditLLM(null); setShowAddLLM(true) }}>
                <Plus size={16} /> 프로바이더 추가
              </Button>
            </div>

            <div className="space-y-3">
              {llmConfigs.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
                  ⚠️ LLM 설정이 없습니다. AI 기능을 사용하려면 프로바이더를 추가하고 활성화하세요.
                </div>
              )}
              {llmConfigs.map(cfg => (
                <div key={cfg.id} className={`bg-white rounded-lg border p-4 flex items-center justify-between ${cfg.isActive ? 'border-blue-300 bg-blue-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${cfg.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="font-medium">{PROVIDER_LABELS[cfg.provider] || cfg.provider}</p>
                      <p className="text-sm text-gray-500">{cfg.model}</p>
                      {cfg.region && <p className="text-xs text-gray-400">리전: {cfg.region}</p>}
                    </div>
                    {cfg.isActive && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1"><Check size={11} />활성</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => updateLLMMutation.mutate({ id: cfg.id, data: { isActive: !cfg.isActive } })}
                    >
                      {cfg.isActive ? '비활성화' : '활성화'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(cfg)}>수정</Button>
                    <button onClick={() => { if (confirm('삭제?')) deleteLLMMutation.mutate(cfg.id) }} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-white rounded-lg border p-5">
              <h3 className="font-semibold mb-1">프롬프트 템플릿 안내</h3>
              <p className="text-sm text-gray-500 mb-3">각 AI 기능의 프롬프트를 커스터마이징할 수 있습니다. LLM 설정 수정에서 편집하세요.</p>
              <div className="space-y-1">
                {Object.entries(DEFAULT_TEMPLATES).map(([key, desc]) => (
                  <div key={key} className="flex gap-2 text-sm">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 flex-shrink-0">{key}</span>
                    <span className="text-gray-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h2 className="font-semibold mb-4">사용자 목록</h2>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">이메일</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">역할</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">가입일</th>
                    <th className="w-20 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          className="border rounded px-2 py-1 text-xs"
                          value={u.role}
                          onChange={e => updateUserMutation.mutate({ id: u.id, data: { role: e.target.value } })}
                          disabled={u.id === user?.id}
                        >
                          <option value="USER">일반</option>
                          <option value="ADMIN">관리자</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
                      <td className="px-4 py-3">
                        {u.id !== user?.id && (
                          <button onClick={() => { if (confirm('삭제?')) adminApi.deleteUser(u.id).then(() => qc.invalidateQueries({ queryKey: ['admin-users'] })) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'llm-access' && (
          <div>
            <div className="mb-4">
              <h2 className="font-semibold">LLM 접근 권한 관리</h2>
              <p className="text-sm text-gray-500 mt-0.5">사용자별로 사용 가능한 LLM을 설정합니다.</p>
            </div>
            {llmConfigs.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
                ⚠️ LLM 설정이 없습니다. 먼저 LLM 프로바이더를 추가하세요.
              </div>
            ) : (
              <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">사용자</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">이메일</th>
                      {llmConfigs.map(cfg => (
                        <th key={cfg.id} className="text-center px-3 py-3 font-medium text-gray-600 whitespace-nowrap">
                          <div className="text-xs">{PROVIDER_LABELS[cfg.provider] || cfg.provider}</div>
                          <div className="text-[10px] text-gray-400 font-normal">{cfg.model}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        {llmConfigs.map(cfg => (
                          <td key={cfg.id} className="text-center px-3 py-3">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              checked={hasAccess(u.id, cfg.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  grantAccessMutation.mutate({ userId: u.id, llmConfigId: cfg.id })
                                } else {
                                  revokeAccessMutation.mutate({ userId: u.id, llmConfigId: cfg.id })
                                }
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">산출물 템플릿 설정</h2>
              <p className="text-sm text-gray-500 mt-0.5">각 산출물의 제목과 컬럼 표시/레이블을 커스터마이징합니다.</p>
            </div>

            {exportTemplates.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
                ⚠️ 템플릿 데이터가 없습니다. DB 마이그레이션 후 seed를 실행하세요.
              </div>
            )}

            {exportTemplates.map(tmpl => {
              const local = localTemplates[tmpl.id] ?? tmpl
              const setLocal = (next: ExportTemplate) => setLocalTemplates(p => ({ ...p, [tmpl.id]: next }))
              const TYPE_LABELS: Record<string, string> = { requirements: '요구사항 정의서', wbs: 'WBS', rtm: 'RTM', 'test-plan': '테스트 계획서' }
              return (
                <div key={tmpl.id} className="bg-white rounded-lg border p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono">{TYPE_LABELS[tmpl.type] ?? tmpl.type}</span>
                    <Button size="sm" disabled={updateTemplateMutation.isPending} disabledReason="처리 중입니다..." onClick={() => updateTemplateMutation.mutate({ id: tmpl.id, data: { title: local.title, columns: local.columns } })}>
                      저장
                    </Button>
                  </div>
                  <div className="mb-4">
                    <Label className="text-xs text-gray-500 mb-1 block">산출물 제목</Label>
                    <Input value={local.title} onChange={e => setLocal({ ...local, title: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-2 block">컬럼 설정</Label>
                    <div className="space-y-1.5">
                      {local.columns.map((col, i) => (
                        <div key={col.key} className="flex items-center gap-3">
                          <input type="checkbox" checked={col.visible}
                            onChange={e => setLocal({ ...local, columns: local.columns.map((c, ci) => ci === i ? { ...c, visible: e.target.checked } : c) })}
                            className="w-4 h-4"
                          />
                          <span className="font-mono text-xs text-gray-400 w-32 flex-shrink-0">{col.key}</span>
                          <Input
                            value={col.label}
                            onChange={e => setLocal({ ...local, columns: local.columns.map((c, ci) => ci === i ? { ...c, label: e.target.value } : c) })}
                            className="h-7 text-xs flex-1"
                          />
                          <span className="text-xs text-gray-400 w-8">{col.visible ? '표시' : '숨김'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
                )}

      <Modal open={showAddLLM} onClose={() => { setShowAddLLM(false); setEditLLM(null) }} title={editLLM ? 'LLM 설정 수정' : 'LLM 프로바이더 추가'} className="max-w-lg">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label>프로바이더</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={llmForm.provider}
              onChange={e => setLlmForm(f => ({ ...f, provider: e.target.value, model: PROVIDER_MODELS[e.target.value]?.[0] ?? '' }))}>
              {Object.entries(PROVIDER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>모델 <span className="text-xs text-gray-400">(목록 선택 또는 직접 입력)</span></Label>
            <div className="flex gap-1">
              <select className="flex-1 border rounded-md px-3 py-2 text-sm"
                value={(PROVIDER_MODELS[llmForm.provider] ?? []).includes(llmForm.model) ? llmForm.model : '__custom'}
                onChange={e => setLlmForm(f => ({ ...f, model: e.target.value === '__custom' ? '' : e.target.value }))}>
                {(PROVIDER_MODELS[llmForm.provider] ?? []).map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__custom">직접 입력...</option>
              </select>
            </div>
            {!(PROVIDER_MODELS[llmForm.provider] ?? []).includes(llmForm.model) && (
              <Input className="mt-1" placeholder="모델 ID를 직접 입력 (예: gpt-4.1-nano)" value={llmForm.model}
                onChange={e => setLlmForm(f => ({ ...f, model: e.target.value }))} />
            )}
          </div>
          {llmForm.provider === 'bedrock' ? (
            <>
              <div className="space-y-1">
                <Label>AWS Access Key ID {editLLM && <span className="text-xs text-gray-400">(변경 시만 입력)</span>}</Label>
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={llmForm.apiKey}
                  onChange={e => setLlmForm(f => ({ ...f, apiKey: e.target.value }))}
                  placeholder={editLLM ? '변경하지 않으면 비워두세요' : 'AKIA...'}
                />
              </div>
              <div className="space-y-1">
                <Label>AWS Secret Access Key</Label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={llmForm.secretKey}
                    onChange={e => setLlmForm(f => ({ ...f, secretKey: e.target.value }))}
                    placeholder={editLLM ? '변경하지 않으면 비워두세요' : 'wJalr...'}
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>AWS 리전</Label>
                <Input value={llmForm.region} onChange={e => setLlmForm(f => ({ ...f, region: e.target.value }))} placeholder="us-east-1" />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <Label>API Key {editLLM && <span className="text-xs text-gray-400">(변경 시만 입력)</span>}</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={llmForm.apiKey}
                  onChange={e => setLlmForm(f => ({ ...f, apiKey: e.target.value }))}
                  placeholder={editLLM ? '변경하지 않으면 비워두세요' : 'sk-...'}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={llmForm.isActive} onChange={e => setLlmForm(f => ({ ...f, isActive: e.target.checked }))} />
            <Label htmlFor="isActive">이 설정을 활성화 (AI 기능에 사용)</Label>
          </div>

          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowTemplates(v => !v)}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              {showTemplates ? '▼' : '▶'} 프롬프트 템플릿 커스터마이징 (선택)
            </button>
            {showTemplates && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-gray-500">비워두면 기본 프롬프트 사용. 도메인에 맞게 수정하세요.</p>
                {Object.keys(DEFAULT_TEMPLATES).map(key => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs font-mono text-gray-600">{key}</Label>
                    <textarea
                      className="w-full border rounded-md px-3 py-2 text-xs font-mono resize-none"
                      rows={3}
                      placeholder={`기본값: ${DEFAULT_TEMPLATES[key as keyof typeof DEFAULT_TEMPLATES]}`}
                      value={promptTemplates[key] ?? ''}
                      onChange={e => setPromptTemplates(t => ({ ...t, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowAddLLM(false); setEditLLM(null) }}>{t('common.cancel')}</Button>
            <Button disabled={(!getApiKeyValue() && !editLLM) || createLLMMutation.isPending || updateLLMMutation.isPending} disabledReason={!getApiKeyValue() && !editLLM ? (llmForm.provider === 'bedrock' ? "Access Key와 Secret Key를 입력하세요" : "API Key를 입력하세요") : "처리 중입니다..."} onClick={handleSaveLLM}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
