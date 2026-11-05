import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  RotateCcw,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  Building2,
  FileText,
  Users,
  Building,
  Tag,
  Bell,
  CheckCircle2,
  Loader2,
  Info,
  Check,
} from 'lucide-react';

interface ResetCompanyViewProps {
  onCancel: () => void;
}

export const ResetCompanyView: React.FC<ResetCompanyViewProps> = ({ onCancel }) => {
  const {
    currentCompany,
    currentUser,
    workOrders,
    departments,
    statuses,
    users,
    userNotifications,
    deleteCurrentCompany,
    resetCurrentCompanyData,
    setCurrentNav,
  } = useApp();

  // State for Process 1: Reset Data
  const [resetDeptsAndStatuses, setResetDeptsAndStatuses] = useState(true);
  const [removeOperarios, setRemoveOperarios] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetStepConfirm, setResetStepConfirm] = useState(false);
  const [resetSuccessNotice, setResetSuccessNotice] = useState(false);
  const [resetError, setResetError] = useState('');

  // State for Process 2: Delete Company Permanently
  const [deleteConfirmCode, setDeleteConfirmCode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (!currentUser || currentUser.role !== 'administrador' || !currentCompany) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center max-w-xl mx-auto mt-12 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Acceso Restringido</h2>
        <p className="text-sm text-slate-500 mt-2">
          Solo el usuario con rol de Administrador puede gestionar el reseteo o borrado de la empresa.
        </p>
        <button
          onClick={onCancel}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Panel
        </button>
      </div>
    );
  }

  // Check code match for destructive delete
  const isDeleteCodeMatched =
    deleteConfirmCode.trim().toUpperCase() === currentCompany.code.trim().toUpperCase();

  // Handle Process 1: Reset Data
  const handleExecuteReset = async () => {
    setIsResetting(true);
    setResetError('');
    try {
      const res = await resetCurrentCompanyData({
        resetDeptsAndStatuses,
        removeOperarios,
      });
      if (!res.success) {
        setResetError(res.error || 'Ocurrió un error al resetear los datos.');
        setIsResetting(false);
      } else {
        setIsResetting(false);
        setResetSuccessNotice(true);
        setTimeout(() => {
          setCurrentNav('panel_de_control');
        }, 1800);
      }
    } catch (err: any) {
      setResetError(err.message || 'Error inesperado durante el reseteo.');
      setIsResetting(false);
    }
  };

  // Handle Process 2: Delete Company Permanently
  const handleExecuteDeleteCompany = async () => {
    if (!isDeleteCodeMatched || isDeleting) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await deleteCurrentCompany();
      if (!res.success) {
        setDeleteError(res.error || 'Ocurrió un error al eliminar la empresa.');
        setIsDeleting(false);
      }
      // On success, AppContext clears currentUser and App.tsx automatically switches to LoginView
    } catch (err: any) {
      setDeleteError(err.message || 'Error inesperado al eliminar los datos.');
      setIsDeleting(false);
    }
  };

  const operariosCount = users.filter((u) => u.role !== 'administrador').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Cancel Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Panel de Control</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-rose-600 shrink-0" />
            <span>Gestión Crítica: Resetear o Borrar Empresa</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Desde esta pantalla puedes dar continuidad a cualquiera de los dos procesos según tus necesidades, o cancelar para regresar.
          </p>
        </div>

        <button
          onClick={onCancel}
          type="button"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Cancelar y no hacer nada</span>
        </button>
      </div>

      {/* Company Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs text-indigo-300 shrink-0 border border-white/10">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Empresa activa
                </span>
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-white/15 text-white">
                  Código: {currentCompany.code}
                </span>
              </div>
              <h2 className="text-xl font-bold mt-1 text-white">{currentCompany.name}</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Administrador en sesión: <span className="font-semibold text-white">{currentUser.name}</span> (CIF: {currentCompany.cif || '-'})
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/5 p-3.5 rounded-2xl border border-white/10">
            <div className="text-center px-2">
              <span className="text-xs text-slate-400 block font-medium">Partes OT</span>
              <span className="text-lg font-bold text-white">{workOrders.length}</span>
            </div>
            <div className="text-center px-2 border-l border-white/10">
              <span className="text-xs text-slate-400 block font-medium">Departamentos</span>
              <span className="text-lg font-bold text-white">{departments.length}</span>
            </div>
            <div className="text-center px-2 border-l border-white/10">
              <span className="text-xs text-slate-400 block font-medium">Estados</span>
              <span className="text-lg font-bold text-white">{statuses.length}</span>
            </div>
            <div className="text-center px-2 border-l border-white/10">
              <span className="text-xs text-slate-400 block font-medium">Operarios</span>
              <span className="text-lg font-bold text-white">{operariosCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification after Reset */}
      {resetSuccessNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold">¡Los datos de la empresa han sido reseteados con éxito!</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Todos los partes de trabajo y registros temporales se han limpiado. Redirigiendo al Panel de Control...
            </p>
          </div>
        </div>
      )}

      {/* The Two Processes: Grid with Process 1 and Process 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* =========================================================================
            PROCESO 1: RESETEAR DATOS OPERATIVOS (Puesta a cero)
           ========================================================================= */}
        <div className="bg-white rounded-3xl border border-amber-200/90 shadow-sm p-6 sm:p-7 flex flex-col justify-between h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

          <div>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Proceso 1 · Puesta a Cero
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Resetear y Limpiar Datos Operativos
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Ideal si deseas <strong>iniciar un nuevo ciclo o año operativo</strong> sin borrar tu empresa ni tener que volver a registrarte.
            </p>

            {/* What is deleted */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                ¿Qué se elimina al resetear?
              </p>
              <ul className="space-y-1.5 text-slate-600 pl-5 list-disc marker:text-amber-500">
                <li>
                  <strong>Todos los {workOrders.length} partes de trabajo</strong> (OTs) y sus PDFs adjuntos.
                </li>
                <li>
                  Todas las alertas activas, notas de trabajo y notificaciones.
                </li>
                <li>
                  <strong>Se conserva la empresa</strong> ({currentCompany.name} · {currentCompany.code}) y tu acceso de administrador.
                </li>
              </ul>
            </div>

            {/* Options */}
            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={resetDeptsAndStatuses}
                  onChange={(e) => setResetDeptsAndStatuses(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block">
                    Restablecer departamentos y estados de fábrica
                  </span>
                  <span className="text-slate-500">
                    Crea los departamentos y estados estándar por defecto (Mecanizado, Montaje, Calidad / Pendiente, En curso, Terminado).
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={removeOperarios}
                  onChange={(e) => setRemoveOperarios(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block">
                    Limpiar también los operarios registrados ({operariosCount})
                  </span>
                  <span className="text-slate-500">
                    Elimina las cuentas de operarios para configurarlas de nuevo. Tu cuenta de administrador se mantendrá intacta.
                  </span>
                </div>
              </label>
            </div>

            {resetError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {resetError}
              </div>
            )}
          </div>

          {/* Action Trigger */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            {!resetStepConfirm ? (
              <button
                type="button"
                onClick={() => setResetStepConfirm(true)}
                disabled={isResetting || resetSuccessNotice}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-sm shadow-amber-200 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Continuar con el Reseteo de Datos</span>
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 animate-in fade-in">
                <p className="text-xs font-bold text-amber-900">
                  ¿Confirmas que deseas vaciar y resetear todos los datos de {currentCompany.name}?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    disabled={isResetting}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Reseteando datos...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Sí, ejecutar reseteo</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetStepConfirm(false)}
                    disabled={isResetting}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Atrás
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            PROCESO 2: BORRAR EMPRESA DEFINITIVAMENTE (Eliminación Total)
           ========================================================================= */}
        <div className="bg-white rounded-3xl border border-rose-200/90 shadow-sm p-6 sm:p-7 flex flex-col justify-between h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

          <div>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                Proceso 2 · Destructivo e Irreversible
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Borrar Empresa Definitivamente
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Elimina de forma <strong>permanente y total</strong> la empresa de la base de datos sincronizada. Nadie podrá volver a entrar con las credenciales actuales.
            </p>

            {/* What is destroyed */}
            <div className="mt-4 p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2.5 text-xs text-rose-900">
              <p className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                Se borrará de forma irreversible:
              </p>
              <ul className="space-y-1.5 text-rose-800/90 pl-5 list-disc marker:text-rose-500">
                <li>
                  <strong>Registro de la empresa:</strong> {currentCompany.name} ({currentCompany.code})
                </li>
                <li>
                  <strong>Partes de trabajo:</strong> {workOrders.length} OTs y todos los archivos PDF almacenados.
                </li>
                <li>
                  <strong>Configuraciones:</strong> {departments.length} departamentos y {statuses.length} estados.
                </li>
                <li>
                  <strong>Usuarios y accesos:</strong> {users.length} cuentas (incluyendo tu cuenta de Administrador).
                </li>
                <li>
                  <strong>Una vez borrada:</strong> La aplicación cerrará la sesión y saltará a la pantalla de inicio.
                </li>
              </ul>
            </div>

            {/* Safety Code Input */}
            <div className="mt-5 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Para confirmar la eliminación permanente, escribe el código de la empresa:{' '}
                <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800 select-all font-bold">
                  {currentCompany.code}
                </span>
              </label>
              <input
                type="text"
                value={deleteConfirmCode}
                onChange={(e) => setDeleteConfirmCode(e.target.value.toUpperCase())}
                placeholder={`Escribe ${currentCompany.code} aquí`}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs font-mono font-bold tracking-wider uppercase transition-all"
                disabled={isDeleting}
              />
            </div>

            {deleteError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {deleteError}
              </div>
            )}
          </div>

          {/* Action Trigger */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={handleExecuteDeleteCompany}
              disabled={!isDeleteCodeMatched || isDeleting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-sm shadow-rose-200 transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Borrando empresa y saltando a inicio...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Empresa y Salir al Login</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Reassuring Footer with Cancel button */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            ¿No estás seguro de proceder? Puedes cancelar en cualquier momento sin que se modifique ningún dato de la empresa.
          </span>
        </div>
        <button
          onClick={onCancel}
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Cancelar y volver al Panel</span>
        </button>
      </div>
    </div>
  );
};
