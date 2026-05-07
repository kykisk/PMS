import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/stores/auth.store'
import { ClipboardList, BarChart3, FileDown } from 'lucide-react'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      setTokens(data)
      const me = await authApi.me()
      setUser(me)
      navigate('/projects')
    },
  })

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-left">
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white flex-col justify-center px-12 py-16 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -left-12 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-1/3 right-0 w-48 h-48 rounded-full bg-blue-300/20 blur-2xl" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 rounded-full text-sm mb-8">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            프로젝트 관리 플랫폼
          </div>
          <h1 className="text-4xl font-bold mb-3 tracking-tight">PMS</h1>
          <p className="text-xl text-blue-100 mb-10 leading-relaxed">프로젝트 관리 시스템</p>
          <ul className="space-y-5">
            <li className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                <ClipboardList size={18} />
              </div>
              <div>
                <p className="font-medium text-sm">요구사항 추적</p>
                <p className="text-xs text-blue-200 mt-0.5">요구사항부터 테스트까지 전체 추적 관리</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                <BarChart3 size={18} />
              </div>
              <div>
                <p className="font-medium text-sm">실시간 대시보드</p>
                <p className="text-xs text-blue-200 mt-0.5">진척율과 이슈를 한눈에 파악</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                <FileDown size={18} />
              </div>
              <div>
                <p className="font-medium text-sm">산출물 내보내기</p>
                <p className="text-xs text-blue-200 mt-0.5">Excel, PDF 산출물 자동 생성</p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('auth.loginTitle')}</h1>
              <p className="text-sm text-gray-500 mt-1">계정에 로그인하세요</p>
            </div>
            <button
              onClick={() => i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko')}
              className="text-sm text-gray-500 border px-2 py-1 rounded hover:bg-gray-50"
            >
              {i18n.language === 'ko' ? 'EN' : '한국어'}
            </button>
          </div>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>
            {mutation.isError && (
              <p className="text-sm text-red-500">{t('common.error')}</p>
            )}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.loading') : t('auth.login')}
            </Button>
          </form>

          <p className="text-sm text-center text-gray-500">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-blue-600 hover:underline">
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
