import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Logo } from './Logo';
import {
  Menu,
  Bell,
  ChevronDown,
  PlusCircle,
  LogOut,
  Flame,
  AlertTriangle,
  Clock,
  UserCheck,
  CheckCheck,
  Eye,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { WorkOrder, AppNotification, NotificationType } from '../types';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  onOpenNewJobModal?: () => void;
  onOpenJobDetail?: (job: WorkOrder) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  onOpenNewJobModal,
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
        return <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
      case 'status_change':
        return <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 transition-shadow">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
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
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Plataforma de Operaciones
                </span>
                {currentCompany && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[11px] font-bold">
                    CÓD: {currentCompany.code}
                  </span>
                )}
              </div>
              <h1 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>Gestión de Partes de Trabajo</span>
                {currentCompany && (
                  <span className="text-xs font-medium text-slate-500">· {currentCompany.name}</span>
                )}
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Firebase en tiempo real
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Right: Quick Role Switcher, Notifications, and Action */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Create Job button for Administrator */}
          {currentUser.role === 'administrador' && onOpenNewJobModal && (
            <button
              onClick={onOpenNewJobModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-xs cursor-pointer"
              title="Añadir nuevo trabajo"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Trabajo</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          )}

          {/* Notifications bell button with dropdown */}
          {currentUser.role !== 'solo_lectura' && (
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
                  notificationsOpen
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Notificaciones"
                aria-label="Notificaciones"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">
                        Notificaciones
                      </span>
                      {unreadNotificationsCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                          {unreadNotificationsCount} nuevas
                        </span>
                      )}
                    </div>
                    {userNotifications.length > 0 && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Leídas</span>
                      </button>
                    )}
                  </div>

                  {/* List of recent notifications */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {userNotifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400">
                        <Bell className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No tienes notificaciones pendientes</p>
                      </div>
                    ) : (
                      userNotifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleDropdownNotificationClick(notif)}
                          className={`p-3 text-left transition-colors cursor-pointer flex items-start gap-3 hover:bg-slate-50 ${
                            !notif.read ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <div className="p-1.5 rounded-lg bg-white border border-slate-100 shadow-2xs mt-0.5">
                            {getNotifIconSmall(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`text-xs truncate ${
                                  notif.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'
                                }`}
                              >
                                {notif.title}
                              </p>
                              {!notif.read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                              {notif.message}
                            </p>
                            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                              <span>
                                {new Date(notif.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {notif.ot && (
                                <span className="font-mono font-bold text-indigo-600 bg-white px-1.5 py-0.2 rounded border border-indigo-100">
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
                  <div className="pt-2 px-3 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setNotificationsOpen(false);
                        setCurrentNav('notificaciones');
                      }}
                      className="w-full py-1.5 px-3 rounded-xl text-center text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Ver todas las notificaciones</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/80 text-slate-700 text-xs sm:text-sm font-medium transition-all cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="font-semibold text-slate-800 hidden md:inline">
                {currentUser.name}
              </span>
              <span className="text-slate-500 text-xs capitalize hidden sm:inline">
                ({currentUser.role.replace('_', ' ')})
              </span>
              <span className="text-xs sm:hidden font-semibold">
                {currentUser.role === 'administrador'
                  ? 'Admin'
                  : currentUser.role === 'operario'
                  ? 'Operario'
                  : 'Lectura'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown with user details and logout */}
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3.5 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800">
                      {currentUser.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {currentUser.role === 'administrador'
                        ? currentUser.email
                        : `Clave: ${currentUser.accessKey}`}
                    </p>
                    {currentCompany && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 truncate max-w-[120px]">{currentCompany.name}</span>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                          {currentCompany.code}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
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
