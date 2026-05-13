import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { projectApi } from '@/api/project.api'
import { authApi } from '@/api/auth.api'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ClipboardList, Layers, CheckSquare,
  TestTube2, GitMerge, PenTool, GitPullRequest, Settings, LogOut, Globe, Info, Pencil, Lock, ChevronLeft, Check, Bot, Trash2, Users, BookOpen, PanelLeftClose, PanelLeftOpen, Settings2, Bug, ClipboardCheck,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { key: 'settings', icon: Settings2, path: 'settings' },
  { key: 'dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { key: 'userStories', icon: BookOpen, path: 'user-stories' },
  { key: 'useCases', icon: Users, path: 'use-cases' },
  { key: 'requirements', icon: ClipboardList, path: 'requirements' },
  { key: 'features', icon: Layers, path: 'features' },
  { key: 'design', icon: PenTool, path: 'design' },
  { key: 'tasks', icon: CheckSquare, path: 'tasks' },
  { key: 'tests', icon: TestTube2, path: 'tests' },
  { key: 'testExecution', icon: ClipboardCheck, path: 'test-execution' },
  { key: 'defects', icon: Bug, path: 'defects' },
  { key: 'changeRequests', icon: GitPullRequest, path: 'change-requests' },
  { key: 'traceability', icon: GitMerge, path: 'traceability' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation()
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, setUser } = useAuthStore()
  const [showDesc, setShowDesc] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileView, setProfileView] = useState<'menu' | 'edit' | 'password' | 'llm'>('menu')
  const [profileForm, setProfileForm] = useState({ name: '', nameEn: '', email: '', phone: '', department: '', position: '' })
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [llmForm, setLlmForm] = useState({ provider: 'openai', model: 'gpt-4o', apiKey: '' })
  const qc = useQueryClient()

  const profileMutation = useMutation({
    mutationFn: (data: typeof profileForm) => authApi.updateProfile(data),
    onSuccess: (updated) => {
      setUser(updated as any)
      setProfileView('menu')
      qc.invalidateQueries({ queryKey: ['auth-me'] })
    },
  })

  const pwMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => authApi.changePassword(data),
    onSuccess: () => { setPwSuccess(true); setPwError('') },
    onError: () => setPwError('현재 비밀번호가 일치하지 않습니다'),
  })

  const PERSONAL_PROVIDER_MODELS: Record<string, string[]> = {
    openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3-mini'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022'],
    gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    bedrock: ['us.anthropic.claude-sonnet-4-20250514-v1:0', 'us.anthropic.claude-opus-4-20250514-v1:0', 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'],
  }

  const { data: personalLLMs = [] } = useQuery<any[]>({
    queryKey: ['personal-llms'],
    queryFn: authApi.listPersonalLLMs,
    enabled: profileView === 'llm',
  })

  const createLLMMutation = useMutation({
    mutationFn: (data: { provider: string; model: string; apiKey: string; region?: string }) => authApi.createPersonalLLM(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['personal-llms'] }); setLlmForm({ provider: 'openai', model: 'gpt-4o', apiKey: '' }) },
  })

  const deleteLLMMutation = useMutation({
    mutationFn: (id: string) => authApi.deletePersonalLLM(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-llms'] }),
  })

  const openEdit = () => {
    setProfileForm({
      name: user?.name || '', nameEn: (user as any)?.nameEn || '',
      email: user?.email || '', phone: (user as any)?.phone || '',
      department: (user as any)?.department || '', position: (user as any)?.position || '',
    })
    setProfileView('edit')
  }

  const openPw = () => {
    setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
    setPwError(''); setPwSuccess(false)
    setProfileView('password')
  }

  const closeProfile = () => { setShowProfile(false); setProfileView('menu') }

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const handleLogout = () => { logout(); navigate('/login') }

  const currentNav = navItems.find(n => location.pathname.includes(`/${n.path}`))

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b border-black/[0.08] flex items-center gap-3 px-3 py-2 flex-shrink-0 sticky top-0 z-20 h-[44px]">
        <Link to="/projects" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity flex-shrink-0">
          <div className="w-6 h-6 rounded bg-[#5E6AD2] flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <span className="font-bold text-sm text-[#5E6AD2]">PMS</span>
        </Link>

        {projectId && project && (
          <>
            <span className="text-gray-200 text-sm">/</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="font-semibold text-sm text-gray-800 truncate max-w-[180px]">{project.name}</h2>
              {project.description && (
                <div className="relative flex-shrink-0">
                  <button onClick={() => setShowDesc(v => !v)} className="text-gray-400 hover:text-[#5E6AD2] transition-colors">
                    <Info size={12} />
                  </button>
                  {showDesc && (
                    <div className="absolute left-0 top-full mt-1 z-50 w-64 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg leading-relaxed">
                      {project.description}
                      <button onClick={() => setShowDesc(false)} className="block mt-1 text-white/50 hover:text-white text-[10px]">닫기</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {currentNav && (
              <>
                <span className="text-gray-200 text-xs flex-shrink-0">/</span>
                <span className="text-xs text-[#5E6AD2] font-medium flex-shrink-0">{t(`nav.${currentNav.key}`)}</span>
              </>
            )}
          </>
        )}

        {project?.startDate && (
          <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">
            {new Date(project.startDate).toLocaleDateString('ko-KR')}
            {project.endDate && ` ~ ${new Date(project.endDate).toLocaleDateString('ko-KR')}`}
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className={cn('bg-white border-r border-black/[0.08] flex flex-col transition-all duration-200 flex-shrink-0', sidebarOpen ? 'w-52' : 'w-12')}>
          {projectId && (
            <nav className="flex-1 p-1.5 space-y-0.5 overflow-y-auto pt-2">
              {navItems.map(({ key, icon: Icon, path }) => {
                const href = `/projects/${projectId}/${path}`
                const active = location.pathname.startsWith(href)
                return (
                  <Link
                    key={key}
                    to={href}
                    title={!sidebarOpen ? t(`nav.${key}`) : undefined}
                    className={cn(
                      'flex items-center rounded-md transition-colors',
                      sidebarOpen ? 'gap-2 px-3 py-2 text-sm' : 'justify-center px-0 py-2',
                      active
                        ? 'bg-[#5E6AD2]/10 text-[#5E6AD2] font-medium'
                        : 'text-gray-600 hover:bg-[#5E6AD2]/5',
                    )}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    {sidebarOpen && <span className="truncate text-xs">{t(`nav.${key}`)}</span>}
                  </Link>
                )
              })}
            </nav>
          )}

          {!projectId && <div className="flex-1" />}

          <button
            onClick={() => setSidebarOpen(v => !v)}
            className={cn(
              'flex items-center border-t py-2 text-gray-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/5 transition-colors w-full',
              sidebarOpen ? 'gap-2 px-3' : 'justify-center px-0'
            )}
          >
            {sidebarOpen ? (
              <><PanelLeftClose size={14} /><span className="text-xs">메뉴 접기</span></>
            ) : (
              <PanelLeftOpen size={14} />
            )}
          </button>

          <div className="border-t">
            <div className="relative">
              <button
                onClick={() => { showProfile ? closeProfile() : setShowProfile(true) }}
                className={cn('flex items-center hover:bg-[#5E6AD2]/5 transition-colors w-full', sidebarOpen ? 'gap-2 px-3 py-2.5' : 'justify-center px-0 py-2.5')}
                title={!sidebarOpen ? (user?.name || 'Profile') : undefined}
              >
                <div className="w-7 h-7 rounded-full bg-[#5E6AD2]/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#5E6AD2]">{user?.name?.[0] || 'U'}</span>
                </div>
                {sidebarOpen && (
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{user?.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
                </div>
                )}
            </button>

            {showProfile && (
              <div className={`absolute bottom-full mb-1 bg-white border rounded-lg shadow-lg z-50 ${sidebarOpen ? "left-2 right-2" : "left-0 w-64"}`}>

                {profileView === 'menu' && (
                  <div className="p-3">
                    <div className="flex items-center gap-3 pb-3 border-b mb-2">
                      <div className="w-10 h-10 rounded-full bg-[#5E6AD2]/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-[#5E6AD2]">{user?.name?.[0] || 'U'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800 truncate">{user?.name}</p>
                        {(user as any)?.nameEn && <p className="text-[10px] text-gray-400 truncate">{(user as any).nameEn}</p>}
                        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5E6AD2]/10 text-[#5E6AD2] font-medium self-start">{user?.role}</span>
                    </div>
                    {(user as any)?.department && <p className="text-[10px] text-gray-400 mb-1">{(user as any).department} · {(user as any).position}</p>}
                    {(user as any)?.phone && <p className="text-[10px] text-gray-400 mb-2">{(user as any).phone}</p>}
                    <div className="space-y-0.5">
                      <button onClick={openEdit} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 w-full text-left">
                        <Pencil size={12} />내 정보 수정
                      </button>
                      <button onClick={openPw} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 w-full text-left">
                        <Lock size={12} />비밀번호 변경
                      </button>
                      <button onClick={() => setProfileView('llm')} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 w-full text-left">
                        <Bot size={12} />내 AI 설정
                      </button>
                      {user?.role === 'ADMIN' && (
                        <Link to="/admin" onClick={closeProfile} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 w-full">
                          <Settings size={12} />관리자 설정
                        </Link>
                      )}
                      <button onClick={() => { i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko'); closeProfile() }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 w-full text-left">
                        <Globe size={12} />{i18n.language === 'ko' ? 'English' : '한국어'}
                      </button>
                      <div className="border-t my-1" />
                      <button onClick={handleLogout} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-red-500 hover:bg-red-50 w-full text-left">
                        <LogOut size={12} />로그아웃
                      </button>
                    </div>
                  </div>
                )}

                {profileView === 'edit' && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <button onClick={() => setProfileView('menu')} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={14} /></button>
                      <span className="text-xs font-bold text-gray-800">내 정보 수정</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">이름 (한글) *</label>
                        <input className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                          value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">이름 (영문)</label>
                        <input className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                          value={profileForm.nameEn} onChange={e => setProfileForm(f => ({ ...f, nameEn: e.target.value }))} placeholder="Hong Gildong" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">이메일</label>
                        <input className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                          value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">연락처</label>
                        <input className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                          value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-1234-5678" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500 mb-0.5 block">부서</label>
                          <input className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                            value={profileForm.department} onChange={e => setProfileForm(f => ({ ...f, department: e.target.value }))} placeholder="개발팀" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 mb-0.5 block">직책</label>
                          <input className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                            value={profileForm.position} onChange={e => setProfileForm(f => ({ ...f, position: e.target.value }))} placeholder="PM" />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setProfileView('menu')} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">취소</button>
                      <button
                        onClick={() => profileForm.name && profileMutation.mutate(profileForm)}
                        disabled={!profileForm.name || profileMutation.isPending}
                        className="flex items-center gap-1 px-2 py-1 bg-[#5E6AD2] text-white text-xs rounded hover:bg-[#6872D9] disabled:opacity-50"
                      >
                        <Check size={11} />{profileMutation.isPending ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                )}

                {profileView === 'password' && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <button onClick={() => setProfileView('menu')} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={14} /></button>
                      <span className="text-xs font-bold text-gray-800">비밀번호 변경</span>
                    </div>
                    {pwSuccess ? (
                      <div className="text-center py-4">
                        <Check size={20} className="mx-auto mb-1 text-green-500" />
                        <p className="text-xs text-green-600">비밀번호가 변경되었습니다</p>
                        <button onClick={() => setProfileView('menu')} className="mt-2 text-xs text-[#5E6AD2] hover:underline">확인</button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">현재 비밀번호</label>
                            <input type="password" className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                              value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">새 비밀번호</label>
                            <input type="password" className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                              value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">새 비밀번호 확인</label>
                            <input type="password" className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                              value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
                          </div>
                        </div>
                        {pwError && <p className="text-[10px] text-red-500 mt-1">{pwError}</p>}
                        {pwForm.newPassword && pwForm.confirm && pwForm.newPassword !== pwForm.confirm && (
                          <p className="text-[10px] text-red-500 mt-1">비밀번호가 일치하지 않습니다</p>
                        )}
                        <div className="flex justify-end gap-2 mt-3">
                          <button onClick={() => setProfileView('menu')} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">취소</button>
                          <button
                            onClick={() => {
                              if (pwForm.newPassword !== pwForm.confirm) { setPwError('비밀번호가 일치하지 않습니다'); return }
                              pwMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
                            }}
                            disabled={!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirm || pwMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 bg-[#5E6AD2] text-white text-xs rounded hover:bg-[#6872D9] disabled:opacity-50"
                          >
                            <Lock size={11} />{pwMutation.isPending ? '변경 중...' : '변경'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {profileView === 'llm' && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <button onClick={() => setProfileView('menu')} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={14} /></button>
                      <span className="text-xs font-bold text-gray-800">내 AI 설정</span>
                    </div>
                    {personalLLMs.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {personalLLMs.map((llm: any) => (
                          <div key={llm.id} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-xs">
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-gray-700">{llm.provider}</span>
                              <span className="text-gray-400 mx-1">·</span>
                              <span className="text-gray-500 truncate">{llm.model}</span>
                            </div>
                            <button
                              onClick={() => deleteLLMMutation.mutate(llm.id)}
                              className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t pt-2">
                      <p className="text-[10px] text-gray-500 mb-2">개인 LLM 추가</p>
                      <div className="space-y-1.5">
                        <div>
                          <label className="text-[10px] text-gray-500 mb-0.5 block">프로바이더</label>
                          <select
                            className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                            value={llmForm.provider}
                            onChange={e => setLlmForm(f => ({ ...f, provider: e.target.value, model: PERSONAL_PROVIDER_MODELS[e.target.value]?.[0] ?? '' }))}
                          >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="gemini">Gemini</option>
                            <option value="bedrock">Bedrock</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 mb-0.5 block">모델 <span className="text-gray-400">(선택 또는 직접 입력)</span></label>
                          <select
                            className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                            value={(PERSONAL_PROVIDER_MODELS[llmForm.provider] ?? []).includes(llmForm.model) ? llmForm.model : '__custom'}
                            onChange={e => setLlmForm(f => ({ ...f, model: e.target.value === '__custom' ? '' : e.target.value }))}
                          >
                            {(PERSONAL_PROVIDER_MODELS[llmForm.provider] ?? []).map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                            <option value="__custom">직접 입력...</option>
                          </select>
                          {!(PERSONAL_PROVIDER_MODELS[llmForm.provider] ?? []).includes(llmForm.model) && (
                            <input className="w-full border rounded px-2 py-1 text-xs mt-1 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                              placeholder="모델 ID 직접 입력" value={llmForm.model}
                              onChange={e => setLlmForm(f => ({ ...f, model: e.target.value }))} />
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 mb-0.5 block">API Key</label>
                          <input
                            type="password"
                            className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                            value={llmForm.apiKey}
                            onChange={e => setLlmForm(f => ({ ...f, apiKey: e.target.value }))}
                            placeholder="sk-..."
                          />
                        </div>
                      </div>
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => llmForm.apiKey && createLLMMutation.mutate(llmForm)}
                          disabled={!llmForm.apiKey || createLLMMutation.isPending}
                          className="flex items-center gap-1 px-2 py-1 bg-[#5E6AD2] text-white text-xs rounded hover:bg-[#6872D9] disabled:opacity-50"
                        >
                          <Check size={11} />{createLLMMutation.isPending ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </aside>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
