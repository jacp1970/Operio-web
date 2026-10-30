import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Building2, Plus, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export const DepartmentsView: React.FC = () => {
  const {
    currentUser,
    departments,
    workOrders,
    createDepartment,
    updateDepartment,
    deleteDepartment,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; jobsCount: number } | null>(null);

  if (currentUser?.role !== 'administrador') {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center">
        Acceso restringido: Solo el administrador puede gestionar los departamentos.
      </div>
    );
  }

  const handleOpenCreate = () => {
    setEditingDeptId(null);
    setName('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEdit = (id: string, currentName: string) => {
    setEditingDeptId(id);
    setName(currentName);
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSave = () => {
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('El nombre del departamento es obligatorio.');
      return;
    }

    if (editingDeptId) {
      const res = updateDepartment(editingDeptId, name);
      if (!res.success) {
        setErrorMsg(res.error || 'Error al actualizar');
        return;
      }
    } else {
      const res = createDepartment(name);
      if (!res.success) {
        setErrorMsg(res.error || 'Error al crear departamento');
        return;
      }
    }

    setModalOpen(false);
  };

  const handleDeleteClick = (id: string, deptName: string) => {
    const jobsInDept = workOrders.filter((w) => w.departmentId === id).length;
    setDeleteTarget({ id, name: deptName, jobsCount: jobsInDept });
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteDepartment(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Departamentos de la Empresa
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gestión y estructuración de secciones técnicas del taller
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-bold hover:bg-indigo-700 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Departamento</span>
        </button>
      </div>

      {/* Grid of departments */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => {
          const countJobs = workOrders.filter((w) => w.departmentId === dept.id).length;

          return (
            <div
              key={dept.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {countJobs} {countJobs === 1 ? 'trabajo' : 'trabajos'}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base mb-1">{dept.name}</h3>
                <p className="text-xs text-slate-400">ID: {dept.id}</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                <button
                  onClick={() => handleOpenEdit(dept.id, dept.name)}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Editar departamento"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteClick(dept.id, dept.name)}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Eliminar departamento"
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
                {editingDeptId ? 'Editar Departamento' : 'Nuevo Departamento'}
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
                  Nombre del Departamento *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                  placeholder="Ej. Mecanizado y Torno, Soldadura, etc."
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
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
                  {editingDeptId ? 'Guardar Cambios' : 'Crear Departamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Department Deletion */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Eliminar Departamento"
        message={
          deleteTarget
            ? deleteTarget.jobsCount > 0
              ? `Atención: Hay ${deleteTarget.jobsCount} trabajo(s) vinculados a "${deleteTarget.name}". ¿Deseas eliminarlo de todos modos?`
              : `¿Confirmas que deseas eliminar el departamento "${deleteTarget.name}"? Esta acción no se puede deshacer.`
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
