import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Network, Globe, Settings, LogOut, Flame, Activity } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import clsx from 'clsx'

const nav = [
  { to: '/dashboard', icon: Activity, label: 'Dashboard' },
  { to: '/tunnels', icon: Network, label: 'Tunnels' },
  { to: '/zones', icon: Globe, label: 'Zones' },
  { to: '/settings', icon: Settings, label: 'Config' },
]

export default function Layout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — visível apenas em md+ */}
      <aside className="hidden md:flex w-56 bg-gray-900 border-r border-gray-800 flex-col shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
          <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">flared</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-orange-500/10 text-orange-400 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label === 'Config' ? 'Configurações' : label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar — visível apenas em mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center">
              <Flame className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-bold">flared</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Conteúdo — pb-16 para não ficar atrás do bottom nav no mobile */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Bottom nav — visível apenas em mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-40">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition-colors',
                  isActive ? 'text-orange-400' : 'text-gray-500'
                )
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
