import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Logo } from './Logo';
import {
  Menu,
  Bell,
  ChevronDown,
  LogOut,
  Flame,
  AlertTriangle,
  Clock,
  UserCheck,
  CheckCheck,
  Eye,
  ArrowRight,
  ExternalLink,
  Trash2,
  Shield,
} from 'lucide-react';
import { WorkOrder, AppNotification, NotificationType } from '../types';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  onOpenJobDetail?: (job: WorkOrder) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  onOpenJobDetail,
}) => {
  const {
    currentUser,
    currentCompany,
    userNotifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    workOrders,
    setCurrentNav,
    logout,
  } = useApp();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notificationsRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen]);

  if (!currentUser) return null;

  // Clicking a notification inside header dropdown
  const handleDropdownNotificationClick = (notif: AppNotification) => {
    markNotificationAsRead(notif.id);
    setNotificationsOpen(false);

    let targetJob: WorkOrder | undefined;
    if (notif.workOrderId) {
      targetJob = workOrders.find((w) => w.id === notif.workOrderId);
    }
    if (!targetJob && notif.ot) {
      targetJob = workOrders.find(
        (w) => w.ot.toLowerCase() === notif.ot?.toLowerCase()
      );
    }

    if (targetJob && onOpenJobDetail) {
      onOpenJobDetail(targetJob);
    } else {
      setCurrentNav('notificaciones');
    }
  };

  const getNotifIconSmall = (type: NotificationType) => {
    switch (type) {
      case 'urgent_marked':
        return <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      case 'alert_change':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'new_assignment':
        return <UserCheck className="w-3.5 h-3.5 text-oterio-600 shrink-0" />;
      case 'status_change':
        return <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-graphite-500 shrink-0" />;
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-graphite-200/80 px-4 sm:px-6 py-3 transition-shadow">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl text-graphite-700 hover:text-graphite-900 hover:bg-graphite-100 transition-colors cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo visible on top bar on mobile/tablet */}
          <div className="lg:hidden">
            <Logo size="sm" showSubtitle={false} />
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-graphite-500">
                  Plataforma de Operaciones
                </span>
              </div>
              <h1 className="text-sm font-bold text-graphite-900 flex items-center gap-2">
                <span>Gestión de Partes de Trabajo</span>
                {currentCompany && (
                  <span className="text-xs font-medium text-graphite-500">· {currentCompany.name}</span>
                )}
              </h1>
            </div>
          </div>
        </div>

        {/* Right: Quick Role Switcher & Notifications */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Notifications bell button with dropdown */}
          {currentUser.role !== 'solo_lectura' && (
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
                  notificationsOpen
                    ? 'bg-oterio-50 text-oterio-700'
                    : 'text-graphite-700 hover:text-graphite-900 hover:bg-graphite-100'
                }`}
                title="Notificaciones"
                aria-label="Notificaciones"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-oterio-600 text-[10px] font-bold text-white shadow-xs tabular-nums">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <>
                  {/* Backdrop on mobile to tap outside easily */}
                  <div
                    className="fixed inset-0 z-40 sm:hidden bg-graphite-950/20 backdrop-blur-2xs"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="fixed left-3 right-3 top-16 sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 max-w-md sm:max-w-none mx-auto sm:mx-0 bg-white rounded-2xl shadow-2xl border border-graphite-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-2.5 border-b border-graphite-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-graphite-900">
                        Notificaciones
                      </span>
                      {unreadNotificationsCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-oterio-600 text-white">
                          {unreadNotificationsCount} nuevas
                        </span>
                      )}
                    </div>
                    {userNotifications.length > 0 && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-[11px] font-semibold text-oterio-600 hover:text-oterio-800 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Leídas</span>
                      </button>
                    )}
                  </div>

                  {/* List of recent notifications */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-graphite-100">
                    {userNotifications.length === 0 ? (
                      <div className="p-6 text-center text-graphite-400">
                        <Bell className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No tienes notificaciones pendientes</p>
                      </div>
                    ) : (
                      userNotifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleDropdownNotificationClick(notif)}
                          className={`p-3 text-left transition-colors cursor-pointer flex items-start gap-3 hover:bg-graphite-50 ${
                            !notif.read ? 'bg-oterio-50/40' : ''
                          }`}
                        >
                          <div className="p-1.5 rounded-lg bg-white border border-graphite-100 shadow-2xs mt-0.5">
                            {getNotifIconSmall(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`text-xs truncate ${
                                  notif.read ? 'font-medium text-graphite-700' : 'font-bold text-graphite-900'
                                }`}
                              >
                                {notif.title}
                              </p>
                              {!notif.read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-oterio-600 shrink-0"></span>
                              )}
                            </div>
                            <p className="text-[11px] text-graphite-500 line-clamp-2 mt-0.5">
                              {notif.message}
                            </p>
                            <div className="flex items-center justify-between mt-1 text-[10px] text-graphite-400">
                              <span>
                                {new Date(notif.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {notif.ot && (
                                <span className="font-mono font-bold text-oterio-600 bg-white px-1.5 py-0.2 rounded border border-oterio-100">
                                  {notif.ot} →
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="pt-2 px-3 border-t border-graphite-100">
                    <button
                      onClick={() => {
                        setNotificationsOpen(false);
                        setCurrentNav('notificaciones');
                      }}
                      className="w-full py-1.5 px-3 rounded-xl text-center text-xs font-semibold text-oterio-600 hover:bg-oterio-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Ver todas las notificaciones</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
              )}
            </div>
          )}

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-graphite-200 hover:border-graphite-300 bg-graphite-50 text-graphite-800 text-xs sm:text-sm font-medium transition-all cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-oterio-600"></div>
              <span className="font-semibold text-graphite-900 hidden md:inline">
                {currentUser.name}
              </span>
              <span className="text-graphite-500 text-xs capitalize hidden sm:inline">
                ({currentUser.role.replace('_', ' ')})
              </span>
              <span className="text-xs sm:hidden font-semibold">
                {currentUser.role === 'administrador'
                  ? 'Admin'
                  : currentUser.role === 'administrativo'
                  ? 'Admin.'
                  : currentUser.role === 'operario'
                  ? 'Operario'
                  : 'Lectura'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-graphite-400" />
            </button>

            {/* Dropdown with user details and logout */}
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-graphite-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3.5 py-2.5 border-b border-graphite-100">
                    <p className="text-xs font-bold text-graphite-900">
                      {currentUser.name}
                    </p>
                    <p className="text-[11px] text-graphite-500 mt-0.5">
                      {currentUser.role === 'administrador'
                        ? (currentCompany?.cif ? `CIF: ${currentCompany.cif}` : 'Administrador')
                        : `Clave: ${currentUser.accessKey}`}
                    </p>
                    {currentCompany && (
                      <div className="mt-2 pt-2 border-t border-graphite-100 flex items-center text-[11px]">
                        <span className="text-graphite-500 truncate">{currentCompany.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-1 space-y-0.5">
                    {currentUser.role === 'administrador' && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          setCurrentNav('usuarios');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-graphite-700 hover:bg-graphite-100 rounded-xl transition-colors cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-oterio-600" />
                        <span>Editar perfil / Datos de empresa</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-graphite-700 hover:bg-graphite-100 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-graphite-500" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>

                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
