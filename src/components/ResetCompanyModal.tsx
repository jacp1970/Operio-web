import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  AlertTriangle,
  Building2,
  Trash2,
  X,
  FileText,
  Users,
  Building,
  Tag,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

interface ResetCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResetCompanyModal: React.FC<ResetCompanyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentCompany,
    workOrders,
    departments,
    statuses,
    users,
    deleteCurrentCompany,
    currentUser,
  } = useApp();

  const [confirmCodeInput, setConfirmCodeInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !currentCompany || currentUser?.role !== 'administrador') {
    return null;
  }

  const isCodeMatched =
    confirmCodeInput.trim().toUpperCase() === currentCompany.code.trim().toUpperCase();

  const handleConfirmDelete = async () => {
    if (!isCodeMatched || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage('');

    try {
      const res = await deleteCurrentCompany();
      if (!res.success) {
        setErrorMessage(res.error || 'Ocurrió un error al eliminar la empresa.');
        setIsDeleting(false);
      } else {
        // AppContext clears currentUser, triggering App.tsx to jump back to LoginView automatically
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error inesperado al eliminar los datos.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-rose-500 to-rose-600 text-white flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-xs text-white shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/20 text-white">
                  Zona de Peligro · Administrador
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold mt-1">
                Resetear y Borrar Empresa
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Current Company Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                Empresa seleccionada
              </span>
              <p className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>{currentCompany.name}</span>
              </p>
            </div>
            <div className="self-start sm:self-auto">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                Código de Empresa
              </span>
              <span className="font-mono text-sm font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 inline-block mt-0.5">
                {currentCompany.code}
              </span>
            </div>
          </div>

          {/* Detailed warning explanation */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>¿Qué ocurrirá al resetear y borrar la empresa?</span>
            </h4>
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-amber-950">
                Se eliminarán de forma definitiva todos los registros asociados en Firebase:
              </p>
              <ul className="space-y-1.5 pl-1">
                <li className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>
                    <strong>{workOrders.length} Órdenes de Trabajo (OT)</strong> y todos los planos/documentos PDF adjuntos.
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>
                    <strong>{departments.length} Departamentos técnicos</strong> configurados.
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    <strong>{statuses.length} Estados de fabricación</strong>.
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>
                    <strong>{users.length} Cuentas de usuarios y operarios</strong> (se darán de baja todas las claves).
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Todas las notificaciones, alertas y la propia ficha de la empresa.</span>
                </li>
              </ul>
              <div className="pt-2 border-t border-amber-200/60 font-medium text-amber-900">
                ⚠️ Una vez borrada, la aplicación <strong>cerrará la sesión y saltará automáticamente a la pantalla de inicio</strong> para que puedas empezar de cero o configurar otra empresa.
              </div>
            </div>
          </div>

          {/* Security confirmation text input */}
          <div className="pt-1">
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Para confirmar, escribe el código de la empresa (<span className="font-mono text-rose-700">{currentCompany.code}</span>):
            </label>
            <input
              type="text"
              disabled={isDeleting}
              value={confirmCodeInput}
              onChange={(e) => setConfirmCodeInput(e.target.value)}
              placeholder={`Escribe ${currentCompany.code} aquí`}
              className="w-full text-sm font-mono font-bold tracking-wider px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 bg-slate-50/50 uppercase"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              El botón de borrado solo se habilitará cuando el código coincida exactamente.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!isCodeMatched || isDeleting}
            onClick={handleConfirmDelete}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white transition-all shadow-md ${
              isCodeMatched && !isDeleting
                ? 'bg-rose-600 hover:bg-rose-700 active:scale-95 shadow-rose-200 cursor-pointer'
                : 'bg-slate-300 cursor-not-allowed shadow-none opacity-60'
            }`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Borrando empresa y registros...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Confirmar y Borrar Empresa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
