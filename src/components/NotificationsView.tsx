import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Clock,
  Flame,
  UserCheck,
  Eye,
  ArrowRight,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { NotificationType, WorkOrder, AppNotification } from '../types';

interface NotificationsViewProps {
  onOpenJobDetail: (job: WorkOrder) => void;
  onOpenJobByOt?: (ot: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onOpenJobDetail,
  onOpenJobByOt,
}) => {
  const {
    currentUser,
    userNotifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotification,
    clearAllNotifications,
    workOrders,
  } = useApp();

  const [missingJobNotice, setMissingJobNotice] = useState<string | null>(null);

  if (!currentUser) return null;

  if (currentUser.role === 'solo_lectura') {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-500">
        El rol de sólo lectura no dispone de panel de notificaciones operativas.
      </div>
    );
  }

  // Handle clicking a notification: mark as read and open the corresponding job details modal
  const handleNotificationClick = (notif: AppNotification) => {
    // 1. Mark as read
    markNotificationAsRead(notif.id);

    // 2. Find target work order by ID or OT
    let targetJob: WorkOrder | undefined;
    if (notif.workOrderId) {
      targetJob = workOrders.find((w) => w.id === notif.workOrderId);
    }
    if (!targetJob && notif.ot) {
      targetJob = workOrders.find(
        (w) => w.ot.toLowerCase() === notif.ot?.toLowerCase()
      );
    }

    // 3. Open job details if found
    if (targetJob) {
      setMissingJobNotice(null);
      onOpenJobDetail(targetJob);
    } else {
      if (notif.ot && onOpenJobByOt) {
        onOpenJobByOt(notif.ot);
      } else {
        setMissingJobNotice(
          notif.ot
            ? `La orden de trabajo ${notif.ot} ya no está disponible o ha sido eliminada.`
            : 'Esta notificación no está vinculada a ningún trabajo activo.'
        );
        setTimeout(() => setMissingJobNotice(null), 4500);
      }
    }
  };

  const getNotifIcon = (type: NotificationType) => {
    switch (type) {
      case 'urgent_marked':
        return (
          <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0">
            <Flame className="w-5 h-5" />
          </div>
        );
      case 'alert_change':
        return (
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case 'new_assignment':
        return (
          <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
        );
      case 'status_change':
        return (
          <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
            <Bell className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Centro de Notificaciones</span>
            {unreadNotificationsCount > 0 && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500 text-white">
                {unreadNotificationsCount} sin leer
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentUser.role === 'administrador'
              ? 'Avisos en tiempo real sobre cambios de estado y alertas reportadas por los operarios.'
              : 'Avisos sobre trabajos asignados, estados, alertas e incidencias urgentes.'}
          </p>
          <p className="text-[11px] text-indigo-600 font-semibold mt-1 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Haz clic en cualquier aviso para acceder de inmediato a los detalles del trabajo correspondiente.
          </p>
        </div>

        {userNotifications.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={markAllNotificationsAsRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>Marcar todas como leídas</span>
            </button>
            <button
              onClick={clearAllNotifications}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-100 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Limpiar</span>
            </button>
          </div>
        )}
      </div>

      {/* Missing job feedback notification */}
      {missingJobNotice && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{missingJobNotice}</span>
          </div>
          <button
            onClick={() => setMissingJobNotice(null)}
            className="text-amber-600 hover:text-amber-800 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* List of notifications */}
      {userNotifications.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Bandeja de notificaciones vacía</h3>
          <p className="text-xs text-slate-400 mt-1">
            Recibirás avisos automáticos cuando haya cambios en los partes de trabajo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {userNotifications.map((notif) => {
            const hasJob = workOrders.some(
              (w) =>
                (notif.workOrderId && w.id === notif.workOrderId) ||
                (notif.ot && w.ot.toLowerCase() === notif.ot.toLowerCase())
            );

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNotificationClick(notif);
                  }
                }}
                className={`group p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-indigo-400 hover:shadow-md ${
                  notif.read
                    ? 'bg-white border-slate-200/80 hover:bg-slate-50/60'
                    : 'bg-indigo-50/50 border-indigo-200/90 shadow-2xs ring-1 ring-indigo-200/60 hover:bg-indigo-50/80'
                }`}
                title="Haz clic para ver los detalles del trabajo"
              >
                <div className="flex items-start gap-3.5 overflow-hidden flex-1">
                  {getNotifIcon(notif.type)}

                  <div className="space-y-1 overflow-hidden flex-1">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm ${
                          notif.read ? 'font-semibold text-slate-800' : 'font-bold text-slate-900'
                        } group-hover:text-indigo-600 transition-colors`}
                      >
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                      <span>
                        {new Date(notif.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {new Date(notif.createdAt).toLocaleDateString()}
                      </span>

                      {notif.ot && (
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-200">
                          {notif.ot}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {/* Action button to open job details */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      hasJob
                        ? 'bg-indigo-600 text-white shadow-2xs group-hover:bg-indigo-700 group-hover:shadow-xs group-hover:scale-[1.02]'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver detalles</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>

                  {/* Delete notification */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearNotification(notif.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar notificación"
                    aria-label="Eliminar notificación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
