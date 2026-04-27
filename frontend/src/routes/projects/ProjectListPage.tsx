import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, LogOut, Globe } from 'lucide-react'
import { projectApi, type CreateProjectPayload } from '@/api/project.api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/shared/Modal'
import { Badge } from '@/components/shared/Badge'
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
  const { user, logout } = useAuthStore()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.list,
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
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600">PMS</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <Globe size={14} />
            {i18n.language === 'ko' ? 'EN' : '한국어'}
          </button>
          <span className="text-sm text-gray-600">{user?.name}</span>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <LogOut size={14} />
            {t('auth.logout')}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">내 프로젝트</h2>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            {t('common.create')}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState message="프로젝트가 없습니다. 새 프로젝트를 생성하세요." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => navigate('/projects/' + project.id + '/requirements')}
                className="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold truncate">{project.name}</h3>
                  <Badge value={project.status} />
                </div>
                {project.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{project.description}</p>
                )}
                {project._count && (
                  <div className="flex gap-3 text-xs text-gray-400">
                    <span>요구사항 {project._count.requirements}</span>
                    <span>Task {project._count.tasks}</span>
                  </div>
                )}
              </div>
            ))}
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
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
