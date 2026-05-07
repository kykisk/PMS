import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, LogOut, Globe, Search, ClipboardList, CheckSquare, X } from 'lucide-react'
import { projectApi, type CreateProjectPayload } from '@/api/project.api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function ProjectListPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', search, filterStatus],
    queryFn: () => projectApi.list({
      search: search || undefined,
      status: filterStatus || undefined,
    }),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectPayload) => projectApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowCreate(false); reset() },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-1.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#5E6AD2] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">P</span>
          </div>
          <span className="font-semibold text-sm text-gray-800">내 프로젝트</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="프로젝트 검색..."
              className="pl-7 pr-2 py-1 text-xs border rounded-md w-44 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2] transition-all duration-200"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={11} /></button>}
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs border rounded-md px-2 py-1 text-gray-600 focus:ring-1 focus:ring-[#5E6AD2]/30 focus:border-[#5E6AD2]"
          >
            <option value="">전체 상태</option>
            <option value="active">진행중</option>
            <option value="completed">완료</option>
            <option value="on_hold">보류</option>
          </select>
          <Button size="sm" className="h-[26px] text-xs px-2.5" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            {t('common.create')}
          </Button>
          <span className="text-gray-200">|</span>
          <button onClick={() => i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko')} className="text-xs text-gray-400 hover:text-gray-600">
            <Globe size={13} />
          </button>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">
            <LogOut size={13} />
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState message={search || filterStatus ? '검색 결과가 없습니다.' : '프로젝트가 없습니다. 새 프로젝트를 생성하세요.'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => {
              const statusDot: Record<string, string> = {
                active: 'bg-emerald-400', completed: 'bg-gray-400', on_hold: 'bg-amber-400', archived: 'bg-red-400',
              }
              const statusLabel: Record<string, string> = {
                active: '진행중', completed: '완료', on_hold: '보류', archived: '보관',
              }
              return (
              <div
                key={project.id}
                onClick={() => navigate('/projects/' + project.id + '/dashboard')}
                className="group bg-white rounded-xl overflow-visible cursor-pointer card-elevated relative"
              >
                <div className="bg-[#5E6AD2] px-3 py-1 flex items-center justify-between rounded-t-xl">
                  <h3 className="font-bold text-xs truncate pr-2" style={{ color: '#ffffff' }}
                    title={project.name}>
                    {project.name.length > 24 ? project.name.slice(0, 24) + '...' : project.name}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`w-1.5 h-1.5 rounded-full ${statusDot[project.status] || 'bg-gray-400'}`} />
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{statusLabel[project.status] || project.status}</span>
                  </div>
                </div>

                {project.description && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 hidden group-hover:block">
                    <div className="mx-4 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg leading-relaxed">
                      {project.description}
                    </div>
                  </div>
                )}

                <div className="p-3 space-y-2">
                  {project._count && (
                    <>
                      <div className="flex items-center gap-2">
                        <ClipboardList size={12} className="text-[#5E6AD2] flex-shrink-0" />
                        <span className="text-xs text-gray-500 w-14">요구사항</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#5E6AD2] rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (project._count.requirements || 0) * 10)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-6 text-right">{project._count.requirements || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckSquare size={12} className="text-amber-500 flex-shrink-0" />
                        <span className="text-xs text-gray-500 w-14">Task</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (project._count.tasks || 0) * 5)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-6 text-right">{project._count.tasks || 0}</span>
                      </div>
                    </>
                  )}

                  {project.startDate && (
                    <p className="text-[10px] text-gray-300 mt-1">
                      {new Date(project.startDate).toLocaleDateString('ko-KR')}
                      {project.endDate && ` ~ ${new Date(project.endDate).toLocaleDateString('ko-KR')}`}
                    </p>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); reset() }} title="프로젝트 생성">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1">
            <Label>프로젝트명 *</Label>
            <Input {...register('name')} placeholder="OO시스템 구축" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>설명</Label>
            <Input {...register('description')} placeholder="프로젝트 설명" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>시작일</Label>
              <Input type="date" {...register('startDate')} />
            </div>
            <div className="space-y-1">
              <Label>종료일</Label>
              <Input type="date" {...register('endDate')} />
            </div>
          </div>
          {createMutation.isError && <p className="text-sm text-red-500">{t('common.error')}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowCreate(false); reset() }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending} disabledReason="처리 중입니다...">
              {createMutation.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
