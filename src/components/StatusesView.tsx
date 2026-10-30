import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Tag, Plus, Edit2, Trash2, X, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export const StatusesView: React.FC = () => {
  const {
    currentUser,
    statuses,
    workOrders,
    createStatus,
    updateStatus,
    deleteStatus,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [color, setColor] = useState('indigo');
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; jobsCount: number } | null>(null);

  if (currentUser?.role !== 'administrador') {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center">
        Acceso restringido: Solo el administrador puede gestionar los estados.
      </div>
    );
  }

  const handleOpenCreate = () => {
    setEditingStatusId(null);
    setName('');
    setIsCompleted(false);
    setColor('indigo');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEdit = (st: (typeof statuses)[0]) => {
    setEditingStatusId(st.id);
    setName(st.name);
    setIsCompleted(st.isCompleted || false);
    setColor(st.color || 'indigo');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSave = () => {
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('El nombre del Estado es obligatorio.');
      return;
    }

    if (editingStatusId) {
      const res = updateStatus(editingStatusId, name, color, isCompleted);
      if (!res.success) {
        setErrorMsg(res.error || 'Error al actualizar');
        return;
      }
    } else {
      const res = createStatus(name, color, isCompleted);
      if (!res.success) {
        setErrorMsg(res.error || 'Error al crear estado');
        return;
      }
    }

    setModalOpen(false);
  };

  const handleDeleteClick = (id: string, statusName: string) => {
    const jobsWithStatus = workOrders.filter((w) => w.statusId === id).length;
    setDeleteTarget({ id, name: statusName, jobsCount: jobsWithStatus });
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteStatus(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Estados de los Trabajos
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Fases por las que transcurre cada orden de trabajo desde el inicio hasta su finalización
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-bold hover:bg-indigo-700 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Estado</span>
        </button>
      </div>

      {/* Grid of statuses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statuses.map((st) => {
          const count = workOrders.filter((w) => w.statusId === st.id).length;

          return (
            <div
              key={st.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                      <Tag className="w-5 h-5" />
                    </div>
                    {st.isCompleted && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Finaliza trabajo
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {count} {count === 1 ? 'orden' : 'órdenes'}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base mb-1">{st.name}</h3>
                <p className="text-xs text-slate-400">ID: {st.id}</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                <button
                  onClick={() => handleOpenEdit(st)}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Editar estado"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteClick(st.id, st.name)}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Eliminar estado"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal create / edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base">
                {editingStatusId ? 'Editar Estado' : 'Nuevo Estado'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre del Estado *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                  placeholder="Ej. En curso, Control de calidad, Terminado..."
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-completed"
                  checked={isCompleted}
                  onChange={(e) => setIsCompleted(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <label htmlFor="chk-completed" className="text-xs text-slate-700 font-medium">
                  Marca el trabajo como completado / terminado
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                >
                  {editingStatusId ? 'Guardar Cambios' : 'Crear Estado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Status Deletion */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Eliminar Estado de Trabajo"
        message={
          deleteTarget
            ? deleteTarget.jobsCount > 0
              ? `Atención: Hay ${deleteTarget.jobsCount} orden(es) de trabajo con el estado "${deleteTarget.name}". ¿Deseas eliminarlo de todos modos?`
              : `¿Confirmas que deseas eliminar el estado "${deleteTarget.name}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
