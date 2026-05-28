import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Search, UserPlus, Bot, RotateCcw } from 'lucide-react'
import { projectApi } from '@/api/project.api'
import { adminApi } from '@/api/admin.api'
import apiClient from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import AppLayout from '@/components/layout/AppLayout'
import { cn } from '@/lib/utils'

const ROLES = [
  { value: 'OWNER', label: '프로젝트 오너' },
  { value: 'PM', label: 'PM' },
  { value: 'DEVELOPER', label: '개발자' },
  { value: 'DESIGNER', label: '디자이너' },
  { value: 'TESTER', label: '테스터' },
  { value: 'ANALYST', label: '분석가' },
  { value: 'VIEWER', label: '뷰어' },
  { value: 'EXTERNAL', label: '외부인원' },
]

const PROJECT_TYPES = ['SI', 'SM', 'Product', 'Research', 'Internal', 'Other']
const PROJECT_STATUSES = [
  { value: 'active', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'on_hold', label: '보류' },
  { value: 'archived', label: '보관' },
]

const projectSchema = z.object({
  code: z.string().optional(),
  type: z.string().optional(),
  name: z.string().min(1, '프로젝트 명칭은 필수입니다'),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
})
type ProjectFormData = z.infer<typeof projectSchema>

const externalSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다'),
  nameEn: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  note: z.string().optional(),
})
type ExternalFormData = z.infer<typeof externalSchema>

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'ai'>('info')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showAddExternal, setShowAddExternal] = useState(false)
  const [editExternalId, setEditExternalId] = useState<string | null>(null)
  const [memberSearch, setMemberSearch] = useState('')

  const { data: settings, isLoading } = useQuery({
    queryKey: ['project-settings', projectId],
    queryFn: () => projectApi.getSettings(projectId!),
    enabled: !!projectId,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  })

  const extForm = useForm<ExternalFormData>({
    resolver: zodResolver(externalSchema),
    defaultValues: { role: 'EXTERNAL' },
  })

  const updateProjectMutation = useMutation({
    mutationFn: (data: ProjectFormData) => projectApi.update(projectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-settings', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { role: string; note?: string } }) =>
      projectApi.updateMemberRole(projectId!, userId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-settings', projectId] }),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(projectId!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-settings', projectId] }),
  })

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => projectApi.addMember(projectId!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-settings', projectId] })
      setShowAddMember(false)
      setMemberSearch('')
    },
  })

  const createExternalMutation = useMutation({
    mutationFn: (data: ExternalFormData) => projectApi.createExternalMember(projectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-settings', projectId] })
      setShowAddExternal(false)
      extForm.reset({ role: 'EXTERNAL' })
    },
  })

  const updateExternalMutation = useMutation({
    mutationFn: ({ eid, data }: { eid: string; data: ExternalFormData }) =>
      projectApi.updateExternalMember(projectId!, eid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-settings', projectId] })
      setEditExternalId(null)
      extForm.reset({ role: 'EXTERNAL' })
    },
  })

  const deleteExternalMutation = useMutation({
    mutationFn: (eid: string) => projectApi.deleteExternalMember(projectId!, eid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-settings', projectId] }),
  })

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers(),
    enabled: showAddMember,
  })

  const onProjectSubmit = (data: ProjectFormData) => {
    updateProjectMutation.mutate(data)
  }

  const onExternalSubmit = (data: ExternalFormData) => {
    if (editExternalId) {
      updateExternalMutation.mutate({ eid: editExternalId, data })
    } else {
      createExternalMutation.mutate(data)
    }
  }

  const openEditExternal = (ext: any) => {
    setEditExternalId(ext.id)
    extForm.setValue('name', ext.name)
    extForm.setValue('nameEn', ext.nameEn ?? '')
    extForm.setValue('email', ext.email ?? '')
    extForm.setValue('phone', ext.phone ?? '')
    extForm.setValue('role', ext.role ?? 'EXTERNAL')
    extForm.setValue('note', ext.note ?? '')
    setShowAddExternal(true)
  }

  useEffect(() => {
    if (settings?.project && !updateProjectMutation.isPending) {
      const p = settings.project
      reset({
        code: p.code ?? '',
        type: p.type ?? '',
        name: p.name ?? '',
        status: p.status ?? 'active',
        startDate: p.startDate ? p.startDate.slice(0, 10) : '',
        endDate: p.endDate ? p.endDate.slice(0, 10) : '',
        description: p.description ?? '',
      })
    }
  }, [settings?.project?.id])

  const members = settings?.members ?? []
  const externalMembers = settings?.externalMembers ?? []
  const existingUserIds = members.map((m: any) => m.userId || m.user?.id)
  const filteredUsers = allUsers.filter((u: any) =>
    !existingUserIds.includes(u.id) &&
    (memberSearch === '' || u.name?.includes(memberSearch) || u.email?.includes(memberSearch) || u.nameEn?.toLowerCase().includes(memberSearch.toLowerCase()))
  )

  return (
    <AppLayout>
      <div className="p-4 max-w-6xl">
        <h2 className="text-sm font-bold text-gray-800 mb-3">프로젝트 설정</h2>

        <div className="flex gap-1 mb-4 border-b">
          <button
            onClick={() => setActiveTab('info')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px',
              activeTab === 'info'
                ? 'border-[#5E6AD2] text-[#5E6AD2]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            프로젝트 정보
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px',
              activeTab === 'members'
                ? 'border-[#5E6AD2] text-[#5E6AD2]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            멤버 관리
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px',
              activeTab === 'ai'
                ? 'border-[#5E6AD2] text-[#5E6AD2]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            AI 모델 설정
          </button>
        </div>

        {isLoading && <div className="text-xs text-gray-400 py-8 text-center">로딩중...</div>}

        {!isLoading && activeTab === 'info' && (
          <form onSubmit={handleSubmit(onProjectSubmit)} className="bg-white rounded-lg border p-4 space-y-3 max-w-2xl">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">프로젝트 코드</Label>
                <Input {...register('code')} className="h-7 text-xs" placeholder="PRJ-001" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">프로젝트 유형</Label>
                <select {...register('type')} className="w-full border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]">
                  <option value="">선택</option>
                  {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">프로젝트 명칭 *</Label>
              <Input {...register('name')} className="h-7 text-xs" placeholder="프로젝트 이름" />
              {errors.name && <p className="text-[10px] text-red-500">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">상태</Label>
                <select {...register('status')} className="w-full border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]">
                  {PROJECT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">시작일</Label>
                <Input type="date" {...register('startDate')} className="h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">종료일</Label>
                <Input type="date" {...register('endDate')} className="h-7 text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">상세 내용</Label>
              <textarea
                {...register('description')}
                rows={5}
                className="w-full border rounded-md px-3 py-2 text-xs resize-none focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                placeholder="프로젝트 상세 내용"
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" className="h-7 text-xs px-3" disabled={updateProjectMutation.isPending}>
                {updateProjectMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </form>
        )}

        {!isLoading && activeTab === 'members' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
                <span className="text-xs font-bold text-gray-700">시스템 등록 멤버</span>
                <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => setShowAddMember(true)}>
                  <UserPlus size={11} />
                  멤버 추가
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50/50 border-b">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500">이름(한글)</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500">이름(영문)</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500">이메일</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500">전화번호</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500">부서</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500 w-28">역할</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500 w-24">비고</th>
                      <th className="w-16 px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-6 text-gray-400">등록된 멤버가 없습니다</td></tr>
                    )}
                    {members.map((m: any) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        onRoleChange={(role, note) => updateRoleMutation.mutate({ userId: m.userId || m.user?.id, data: { role, note } })}
                        onDelete={() => { if (confirm('이 멤버를 삭제하시겠습니까?')) removeMemberMutation.mutate(m.userId || m.user?.id) }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
                <span className="text-xs font-bold text-gray-700">외부 멤버 (미등록)</span>
                <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => { setEditExternalId(null); extForm.reset({ role: 'EXTERNAL' }); setShowAddExternal(true) }}>
                  <Plus size={11} />
                  외부 멤버 추가
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50/50 border-b">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500">이름(한글)</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500">이름(영문)</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500">이메일</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500">전화번호</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500 w-28">역할</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-500 w-24">비고</th>
                      <th className="w-16 px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {externalMembers.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-6 text-gray-400">외부 멤버가 없습니다</td></tr>
                    )}
                    {externalMembers.map((ext: any) => (
                      <tr key={ext.id} className="border-b hover:bg-gray-50">
                        <td className="px-2 py-1.5">{ext.name}</td>
                        <td className="px-2 py-1.5 text-gray-500">{ext.nameEn || '-'}</td>
                        <td className="px-2 py-1.5 text-gray-500">{ext.email || '-'}</td>
                        <td className="px-2 py-1.5 text-gray-500">{ext.phone || '-'}</td>
                        <td className="px-2 py-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
                            {ROLES.find(r => r.value === ext.role)?.label || ext.role || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-500">{ext.note || '-'}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex gap-1">
                            <button onClick={() => openEditExternal(ext)} className="p-0.5 text-gray-400 hover:text-blue-600">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteExternalMutation.mutate(ext.id) }} className="p-0.5 text-gray-400 hover:text-red-600">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!isLoading && activeTab === 'ai' && (
          <AiModelMappingTab projectId={projectId!} />
        )}
      </div>

      <Modal
        open={showAddMember}
        onClose={() => { setShowAddMember(false); setMemberSearch('') }}
        title="멤버 추가"
        className="max-w-md"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-7 h-7 text-xs"
              placeholder="이름 또는 이메일로 검색"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto border rounded-md">
            {filteredUsers.length === 0 && (
              <div className="text-center py-4 text-xs text-gray-400">검색 결과가 없습니다</div>
            )}
            {filteredUsers.map((u: any) => (
              <button
                key={u.id}
                onClick={() => addMemberMutation.mutate(u.id)}
                disabled={addMemberMutation.isPending}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-left border-b last:border-b-0"
              >
                <div className="w-6 h-6 rounded-full bg-[#5E6AD2]/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-[#5E6AD2]">{u.name?.[0]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate">{u.name} {u.nameEn && <span className="text-gray-400">({u.nameEn})</span>}</p>
                  <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                </div>
                <span className="text-[10px] text-gray-400">{u.department}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={showAddExternal}
        onClose={() => { setShowAddExternal(false); setEditExternalId(null); extForm.reset({ role: 'EXTERNAL' }) }}
        title={editExternalId ? '외부 멤버 수정' : '외부 멤버 추가'}
        className="max-w-sm"
      >
        <form onSubmit={extForm.handleSubmit(onExternalSubmit)} className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">이름 (한글) *</Label>
            <Input {...extForm.register('name')} className="h-7 text-xs" placeholder="홍길동" />
            {extForm.formState.errors.name && <p className="text-[10px] text-red-500">{extForm.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">이름 (영문)</Label>
            <Input {...extForm.register('nameEn')} className="h-7 text-xs" placeholder="Hong Gildong" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">이메일</Label>
              <Input {...extForm.register('email')} className="h-7 text-xs" placeholder="email@example.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">전화번호</Label>
              <Input {...extForm.register('phone')} className="h-7 text-xs" placeholder="010-1234-5678" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">역할</Label>
            <select {...extForm.register('role')} className="w-full border rounded-md px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">비고</Label>
            <Input {...extForm.register('note')} className="h-7 text-xs" placeholder="참고사항" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowAddExternal(false); setEditExternalId(null) }}>
              취소
            </Button>
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={createExternalMutation.isPending || updateExternalMutation.isPending}>
              저장
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}

function MemberRow({ member, onRoleChange, onDelete }: {
  member: any
  onRoleChange: (role: string, note?: string) => void
  onDelete: () => void
}) {
  const user = member.user || {}
  const [note, setNote] = useState(member.note ?? '')
  const [noteEditing, setNoteEditing] = useState(false)

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-2 py-1.5">{user.name || '-'}</td>
      <td className="px-2 py-1.5 text-gray-500">{user.nameEn || '-'}</td>
      <td className="px-2 py-1.5 text-gray-500">{user.email || '-'}</td>
      <td className="px-2 py-1.5 text-gray-500">{user.phone || '-'}</td>
      <td className="px-2 py-1.5 text-gray-500">{user.department || '-'}</td>
      <td className="px-2 py-1.5">
        <select
          value={member.role || 'VIEWER'}
          onChange={e => onRoleChange(e.target.value, note)}
          className="border rounded px-1 py-0.5 text-[11px] h-6 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
        >
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        {noteEditing ? (
          <input
            autoFocus
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={() => { setNoteEditing(false); if (note !== (member.note ?? '')) onRoleChange(member.role, note) }}
            onKeyDown={e => { if (e.key === 'Enter') { setNoteEditing(false); if (note !== (member.note ?? '')) onRoleChange(member.role, note) } }}
            className="border rounded px-1 py-0.5 text-[11px] w-full h-5 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
          />
        ) : (
          <span
            onClick={() => setNoteEditing(true)}
            className="cursor-pointer text-[11px] text-gray-500 hover:text-gray-700 block truncate max-w-[80px]"
            title={note || '클릭하여 편집'}
          >
            {note || '-'}
          </span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <button onClick={onDelete} className="p-0.5 text-gray-400 hover:text-red-600">
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  )
}

const AI_FEATURES = [
  { key: 'parse-spec', label: 'SPEC 파싱', desc: '마크다운 SPEC → 요구사항/UC/US 추출', recommend: 'Sonnet' },
  { key: 'generate-features', label: '기능리스트 생성', desc: '요구사항 → 기능리스트 분해', recommend: 'Sonnet' },
  { key: 'generate-tasks', label: 'Task 생성', desc: '기능 → Task 분해', recommend: 'Haiku' },
  { key: 'generate-test-scenarios', label: '테스트 시나리오 생성', desc: '요구사항 → 시나리오 (엣지케이스 중요)', recommend: 'Opus' },
  { key: 'generate-test-cases', label: '테스트 케이스 생성', desc: '시나리오 → 케이스 (steps/expected 상세)', recommend: 'Sonnet' },
  { key: 'classify-defect', label: '결함 분류 제안', desc: 'Fail 결과 → severity/priority 제안', recommend: 'Haiku' },
  { key: 'generate-defects', label: '결함 자동 생성', desc: '실패 결과 → 결함 보고서 작성', recommend: 'Sonnet' },
]

function AiModelMappingTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient()
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const { data: availableModels = [] } = useQuery({
    queryKey: ['ai-status', projectId],
    queryFn: () => apiClient.get(`/projects/${projectId}/ai/status`).then(r => r.data.models as { id: string; label: string }[]),
  })

  const { data: existingMappings = [] } = useQuery({
    queryKey: ['ai-model-mappings', projectId],
    queryFn: () => projectApi.getAiModelMappings(projectId),
  })

  useEffect(() => {
    if (existingMappings.length > 0) {
      const m: Record<string, string> = {}
      existingMappings.forEach((em: any) => { m[em.featureKey] = em.llmConfigId ?? em.userLlmConfigId ?? '' })
      setMappings(m)
    }
  }, [existingMappings.length])

  const saveMutation = useMutation({
    mutationFn: () => projectApi.saveAiModelMappings(
      projectId,
      AI_FEATURES.map(f => ({ featureKey: f.key, llmConfigId: mappings[f.key] || undefined })),
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-model-mappings', projectId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const resetDefaults = () => setMappings({})

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500">기능별로 사용할 AI 모델을 지정합니다. 미설정 시 개인 기본 모델 → 공용 모델 순으로 사용됩니다.</p>
        <button onClick={resetDefaults} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600">
          <RotateCcw size={11} />기본값
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-gray-500 w-48">AI 기능</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-gray-500">모델 선택</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-gray-500 w-20">추천</th>
            </tr>
          </thead>
          <tbody>
            {AI_FEATURES.map(f => (
              <tr key={f.key} className="border-b last:border-b-0 hover:bg-gray-50/50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Bot size={12} className="text-[#5E6AD2] flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-gray-700">{f.label}</p>
                      <p className="text-[10px] text-gray-400">{f.desc}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <select
                    className="w-full border rounded px-2 h-7 text-xs text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
                    value={mappings[f.key] ?? ''}
                    onChange={e => setMappings(prev => ({ ...prev, [f.key]: e.target.value }))}
                  >
                    <option value="">-- 기본 모델 사용 --</option>
                    {availableModels.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                    f.recommend === 'Opus' ? 'text-purple-700 bg-purple-50 border-purple-200' :
                    f.recommend === 'Sonnet' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                    'text-gray-600 bg-gray-50 border-gray-200'
                  )}>
                    {f.recommend}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          className="h-7 text-xs px-4 bg-[#5E6AD2] hover:bg-[#4f5bb8]"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saved ? '✓ 저장됨' : saveMutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  )
}
