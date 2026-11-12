import React from 'react';
import { useApp } from '../context/AppContext';
import { NavigationItemKey, UserRole } from '../types';
import { Logo } from './Logo';
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Tag,
  Users,
  Bell,
  LogOut,
  X,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  Eye,
  FileText,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const {
    currentUser,
    currentCompany,
    currentNav,
    setCurrentNav,
    logout,
    unreadNotificationsCount,
  } = useApp();

  if (!currentUser) return null;

  // Define full menu items in the EXACT order specified in PDF:
  // 1. Panel de control
  // 2. Trabajos
  // 3. Departamentos
  // 4. Estados
  // 5. Usuarios
  // 6. Notificaciones
  // 7. Cerrar sesión
  interface MenuItem {
    key: NavigationItemKey;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    roles: UserRole[];
  }

  const allMenuItems: MenuItem[] = [
    {
      key: 'panel_de_control',
      label: 'Panel de control',
      icon: LayoutDashboard,
      roles: ['administrador', 'operario', 'administrativo', 'solo_lectura'],
    },
    {
      key: 'trabajos',
      label: 'Trabajos',
      icon: ClipboardList,
      roles: ['administrador', 'operario', 'administrativo', 'solo_lectura'],
    },
    {
      key: 'departamentos',
      label: 'Departamentos',
      icon: Building2,
      roles: ['administrador'], // Hidden for operario & solo_lectura
    },
    {
      key: 'estados',
      label: 'Estados',
      icon: Tag,
      roles: ['administrador'], // Hidden for operario & solo_lectura
    },
    {
      key: 'usuarios',
      label: 'Usuarios',
      icon: Users,
      roles: ['administrador'], // Hidden for operario & solo_lectura
    },
    {
      key: 'notificaciones',
      label: 'Notificaciones',
      icon: Bell,
      badge: unreadNotificationsCount,
      roles: ['administrador', 'operario', 'administrativo'],
    },
    {
      key: 'cerrar_sesion',
      label: 'Cerrar sesión',
      icon: LogOut,
      roles: ['administrador', 'operario', 'administrativo', 'solo_lectura'],
    },
  ];

  // Filter items visible for current user role
  const visibleMenuItems = allMenuItems.filter((item) =>
    item.roles.includes(currentUser.role)
  );

  const handleSelectNav = (key: NavigationItemKey) => {
    if (key === 'cerrar_sesion') {
      logout();
    } else {
      setCurrentNav(key);
    }
    onCloseMobile();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'administrador':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-oterio-700 bg-oterio-50 border border-oterio-200/70 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3 text-oterio-600" /> Administrador
          </span>
        );
      case 'administrativo':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-graphite-800 bg-graphite-100 border border-graphite-300/70 px-2 py-0.5 rounded-full">
            <FileText className="w-3 h-3 text-graphite-700" /> Administrativo
          </span>
        );
      case 'operario':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
            <Wrench className="w-3 h-3 text-emerald-600" /> Operario
          </span>
        );
      case 'solo_lectura':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
            <Eye className="w-3 h-3 text-amber-600" /> Sólo lectura
          </span>
        );
      default:
        return null;
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-graphite-200 text-graphite-700">
      {/* Brand Header: crisp white surface matching the Oterio logo */}
      <div className="px-5 py-4 bg-white border-b border-graphite-200/80 flex items-center justify-between">
        <Logo size="md" />
        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-graphite-400 hover:text-graphite-700 hover:bg-graphite-100 transition-colors cursor-pointer"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User profile brief card & Company indicator */}
      <div className="px-4 py-3.5 mx-3 my-3 bg-graphite-50 rounded-xl border border-graphite-200/80 space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-oterio-600 to-graphite-900 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col overflow-hidden min-w-0">
            <span className="text-sm font-semibold text-graphite-900 truncate">
              {currentUser.name}
            </span>
            {currentUser.role === 'administrador' ? (
              <span className="text-xs text-graphite-500 font-mono truncate mb-1">
                {currentCompany?.cif ? `CIF: ${currentCompany.cif}` : 'Administrador'}
              </span>
            ) : (
              <span className="text-[11px] font-mono text-oterio-600 font-bold truncate mb-1">
                Clave: {currentUser.accessKey}
              </span>
            )}
            <div>{getRoleBadge(currentUser.role)}</div>
          </div>
        </div>

        {currentCompany && (
          <div className="pt-2 border-t border-graphite-200/70 flex items-center justify-between text-[11px]">
            <span className="text-graphite-500 truncate max-w-[110px]" title={currentCompany.name}>
              {currentCompany.name}
            </span>
            <span className="font-mono font-bold text-oterio-700 bg-oterio-50 px-2 py-0.5 rounded border border-oterio-200/80">
              {currentCompany.code}
            </span>
          </div>
        )}
      </div>

      {/* Menu items strictly according to PDF order */}
      <div className="px-3 py-2 flex-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-bold tracking-wider text-graphite-400 uppercase">
          Menú de Navegación
        </p>
        <nav className="space-y-1">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isLogout = item.key === 'cerrar_sesion';
            const isActive = currentNav === item.key && !isLogout;

            return (
              <button
                key={item.key}
                onClick={() => handleSelectNav(item.key)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-oterio-600 text-white shadow-sm shadow-oterio-200 font-semibold'
                    : isLogout
                    ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                    : 'text-graphite-700 hover:bg-graphite-100 hover:text-graphite-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? 'text-white'
                        : isLogout
                        ? 'text-rose-500'
                        : 'text-graphite-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold tabular-nums ${
                      isActive
                        ? 'bg-white text-oterio-700'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Administrator Danger Option (Reset / Delete Company) */}
      {currentUser.role === 'administrador' && (
        <div className="px-3 pb-2">
          <button
            onClick={() => handleSelectNav('resetear_empresa')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentNav === 'resetear_empresa'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>Resetear / Borrar Empresa</span>
          </button>
        </div>
      )}

      {/* Footer Info */}
      <div className="p-4 border-t border-graphite-200/80 text-[11px] text-graphite-500 flex items-center justify-between">
        <span className="font-semibold text-graphite-700">Oterio · Gestión del Trabajo</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer backdrop and panel */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-graphite-950/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
