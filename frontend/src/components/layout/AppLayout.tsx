import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ClipboardList, Layers, CheckSquare,
  TestTube2, GitMerge, Settings, LogOut, Globe,
} from 'lucide-react'

const navItems = [
  { key: 'dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { key: 'requirements', icon: ClipboardList, path: 'requirements' },
  { key: 'features', icon: Layers, path: 'features' },
  { key: 'tasks', icon: CheckSquare, path: 'tasks' },
  { key: 'tests', icon: TestTube2, path: 'tests' },
  { key: 'traceability', icon: GitMerge, path: 'traceability' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation()
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen bg-gray-50">
       <aside className="w-56 bg-white border-r flex flex-col">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <span className="font-semibold text-sm text-gray-800">PMS</span>
        </div>

        {projectId && (
          <nav className="flex-1 p-2 space-y-1">
            {navItems.map(({ key, icon: Icon, path }) => {
              const href = `/projects/${projectId}/${path}`
              const active = location.pathname.startsWith(href)
              return (
                <Link
                  key={key}
                  to={href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100',
                  )}
                >
                  <Icon size={16} />
                  {t(`nav.${key}`)}
                </Link>
              )
            })}
          </nav>
        )}

        {!projectId && <div className="flex-1" />}

        <div className="p-3 border-t space-y-1">
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100"
            >
              <Settings size={16} />
              {t('nav.admin')}
            </Link>
          )}
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko')}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100 w-full"
          >
            <Globe size={16} />
            {i18n.language === 'ko' ? 'English' : '한국어'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100 w-full"
          >
            <LogOut size={16} />
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
