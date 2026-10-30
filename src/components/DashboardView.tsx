import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { WorkOrder } from '../types';
import {
  Flame,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Building,
  ArrowRight,
  FileText,
  Calendar,
  Eye,
  Check,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenJobDetail: (job: WorkOrder) => void;
  onOpenNewJobModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenJobDetail,
  onOpenNewJobModal,
}) => {
  const {
    currentUser,
    workOrders,
    users,
    departments,
    statuses,
    setCurrentNav,
    getDepartmentName,
    getStatus,
    getUser,
  } = useApp();

  // Active subtab for Administrator
  const [adminTab, setAdminTab] = useState<
    'activos' | 'por_operario' | 'urgentes' | 'alertas' | 'terminados'
  >('activos');

  // Active subtab for Operario
  const [operarioTab, setOperarioTab] = useState<
    'mis_activos' | 'mis_urgentes' | 'departamento_otros'
  >('mis_activos');

  // Filter state for Operario & Solo lectura
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('todos');
  const [selectedOpFilter, setSelectedOpFilter] = useState<string>('todos');

  if (!currentUser) return null;

  // Helpers
  const isJobCompleted = (wo: WorkOrder) => {
    const s = getStatus(wo.statusId);
    return s?.isCompleted ?? false;
  };

  const activeWorkOrders = workOrders.filter((wo) => !isJobCompleted(wo));
  const completedWorkOrders = workOrders.filter((wo) => isJobCompleted(wo));
  const urgentWorkOrders = workOrders.filter((wo) => wo.isUrgent && !isJobCompleted(wo));
  const alertWorkOrders = workOrders.filter((wo) => wo.alerts.length > 0 && !isJobCompleted(wo));

  // Render a job card item
  const renderJobCard = (job: WorkOrder) => {
    const status = getStatus(job.statusId);
    const assignedOp = getUser(job.assignedOperatorId);
    const deptName = getDepartmentName(job.departmentId);

    return (
      <div
        key={job.id}
        onClick={() => onOpenJobDetail(job)}
        className="group relative bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                {job.ot}
              </span>
              {job.isUrgent && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full animate-pulse">
                  <Flame className="w-3 h-3 text-rose-600" /> URGENTE
                </span>
              )}
            </div>

            {/* Status badge */}
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                status?.isCompleted
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {status?.name || 'Estado'}
            </span>
          </div>

          <h3 className="font-bold text-slate-900 text-base mb-1 group-hover:text-indigo-600 transition-colors">
            {job.client}
          </h3>

          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs text-slate-500 mb-3">
            <span className="inline-flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              {deptName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {assignedOp ? assignedOp.name : 'Sin asignar'}
            </span>
            {job.deliveryDate && (
              <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Entrega: {job.deliveryDate}
              </span>
            )}
          </div>

          {/* Notes brief */}
          {job.notes && (
            <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 mb-3">
              {job.notes}
            </p>
          )}

          {/* Alerts badges */}
          {job.alerts.length > 0 && (
            <div className="space-y-1 mb-3">
              {job.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50/90 border border-amber-200/80 px-2.5 py-1 rounded-lg"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="font-medium truncate">{alert.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with PDF indicator & action */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            {job.pdfAttachment ? (
              <span className="inline-flex items-center gap-1 text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-md">
                <FileText className="w-3.5 h-3.5" /> PDF adjunto
              </span>
            ) : (
              <span className="text-slate-400">Sin PDF</span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold group-hover:translate-x-1 transition-transform">
            Ver detalle <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    );
  };

  /* =========================================================================
     ADMINISTRATOR VIEW
     PDF: "Aquí el administrador podrá ver todos los trabajos que están activos clasificados por:
     - Trabajos activos
     - Trabajos por operario
     - Trabajos urgentes
     - Trabajos con alertas
     - Trabajos terminados"
     ========================================================================= */
  if (currentUser.role === 'administrador') {
    return (
      <div className="space-y-6">
        {/* Welcome & Overview Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50 via-white to-slate-50 p-6 rounded-3xl border border-indigo-100/80 shadow-xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Panel de Control · Administrador
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              Control General de Partes de Trabajo
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Supervisión en tiempo real de órdenes de trabajo, alertas y asignaciones del taller.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenNewJobModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-all"
            >
              + Nuevo Trabajo
            </button>
          </div>
        </div>

        {/* 5 Primary Classification Metric Cards matching PDF */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Trabajos activos */}
          <button
            onClick={() => setAdminTab('activos')}
            className={`p-4 rounded-2xl text-left border transition-all ${
              adminTab === 'activos'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:border-indigo-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${adminTab === 'activos' ? 'bg-indigo-500/80' : 'bg-indigo-50 text-indigo-600'}`}>
                <Clock className="w-5 h-5" />
              </span>
              <span className="text-2xl font-black">{activeWorkOrders.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${adminTab === 'activos' ? 'text-indigo-100' : 'text-slate-400'}`}>
              Trabajos Activos
            </p>
          </button>

          {/* 2. Trabajos por operario */}
          <button
            onClick={() => setAdminTab('por_operario')}
            className={`p-4 rounded-2xl text-left border transition-all ${
              adminTab === 'por_operario'
                ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-[1.02]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-400 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${adminTab === 'por_operario' ? 'bg-slate-700' : 'bg-slate-100 text-slate-700'}`}>
                <Users className="w-5 h-5" />
              </span>
              <span className="text-2xl font-black">
                {users.filter((u) => u.role === 'operario').length}
              </span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${adminTab === 'por_operario' ? 'text-slate-300' : 'text-slate-400'}`}>
              Por Operario
            </p>
          </button>

          {/* 3. Trabajos urgentes */}
          <button
            onClick={() => setAdminTab('urgentes')}
            className={`p-4 rounded-2xl text-left border transition-all ${
              adminTab === 'urgentes'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md scale-[1.02]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:border-rose-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${adminTab === 'urgentes' ? 'bg-rose-500/80' : 'bg-rose-50 text-rose-600'}`}>
                <Flame className="w-5 h-5" />
              </span>
              <span className="text-2xl font-black">{urgentWorkOrders.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${adminTab === 'urgentes' ? 'text-rose-100' : 'text-slate-400'}`}>
              Trabajos Urgentes
            </p>
          </button>

          {/* 4. Trabajos con alertas */}
          <button
            onClick={() => setAdminTab('alertas')}
            className={`p-4 rounded-2xl text-left border transition-all ${
              adminTab === 'alertas'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md scale-[1.02]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:border-amber-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${adminTab === 'alertas' ? 'bg-amber-600/80' : 'bg-amber-50 text-amber-600'}`}>
                <AlertTriangle className="w-5 h-5" />
              </span>
              <span className="text-2xl font-black">{alertWorkOrders.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${adminTab === 'alertas' ? 'text-amber-100' : 'text-slate-400'}`}>
              Con Alertas
            </p>
          </button>

          {/* 5. Trabajos terminados */}
          <button
            onClick={() => setAdminTab('terminados')}
            className={`p-4 rounded-2xl text-left border transition-all col-span-2 lg:col-span-1 ${
              adminTab === 'terminados'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:border-emerald-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${adminTab === 'terminados' ? 'bg-emerald-500/80' : 'bg-emerald-50 text-emerald-600'}`}>
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <span className="text-2xl font-black">{completedWorkOrders.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${adminTab === 'terminados' ? 'text-emerald-100' : 'text-slate-400'}`}>
              Terminados
            </p>
          </button>
        </div>

        {/* Content based on the selected classification */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {adminTab === 'activos' && 'Trabajos Activos en Taller'}
              {adminTab === 'por_operario' && 'Clasificación de Trabajos por Operario'}
              {adminTab === 'urgentes' && 'Trabajos Marcados como Urgentes'}
              {adminTab === 'alertas' && 'Trabajos con Alertas o Incidencias'}
              {adminTab === 'terminados' && 'Historial de Trabajos Terminados'}
            </h3>
            <button
              onClick={() => setCurrentNav('trabajos')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
            >
              Ver todos en Trabajos <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TAB: Por operario view */}
          {adminTab === 'por_operario' ? (
            <div className="space-y-6">
              {users
                .filter((u) => u.role === 'operario')
                .map((op) => {
                  const opJobs = workOrders.filter(
                    (w) => w.assignedOperatorId === op.id && !isJobCompleted(w)
                  );
                  const opUrgentCount = opJobs.filter((w) => w.isUrgent).length;
                  const opAlertsCount = opJobs.filter((w) => w.alerts.length > 0).length;

                  return (
                    <div
                      key={op.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center">
                            {op.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">{op.name}</h4>
                            <p className="text-xs text-slate-400">{op.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">
                            {opJobs.length} activos
                          </span>
                          {opUrgentCount > 0 && (
                            <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold">
                              {opUrgentCount} urgentes
                            </span>
                          )}
                          {opAlertsCount > 0 && (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold">
                              {opAlertsCount} con alerta
                            </span>
                          )}
                        </div>
                      </div>

                      {opJobs.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          No tiene trabajos activos asignados en este momento.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {opJobs.map((j) => renderJobCard(j))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            /* Other TABs */
            <div>
              {adminTab === 'activos' && (
                activeWorkOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                    No hay trabajos activos actualmente.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeWorkOrders.map((j) => renderJobCard(j))}
                  </div>
                )
              )}

              {adminTab === 'urgentes' && (
                urgentWorkOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                    ¡Excelente! No hay trabajos urgentes pendientes.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {urgentWorkOrders.map((j) => renderJobCard(j))}
                  </div>
                )
              )}

              {adminTab === 'alertas' && (
                alertWorkOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                    No hay ningún trabajo con alertas pendientes.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {alertWorkOrders.map((j) => renderJobCard(j))}
                  </div>
                )
              )}

              {adminTab === 'terminados' && (
                completedWorkOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                    Aún no se ha finalizado ningún trabajo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {completedWorkOrders.map((j) => renderJobCard(j))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* =========================================================================
     OPERARIO VIEW
     PDF: "El operario podrá visualizar:
     - Sus trabajos activos asignados.
     - Sus trabajos urgentes.
     - Trabajos asignados a su departamento de otros operarios."
     ========================================================================= */
  if (currentUser.role === 'operario') {
    // 1. Sus trabajos activos asignados
    const myActiveJobs = workOrders.filter(
      (wo) => wo.assignedOperatorId === currentUser.id && !isJobCompleted(wo)
    );

    // 2. Sus trabajos urgentes
    const myUrgentJobs = myActiveJobs.filter((wo) => wo.isUrgent);

    // 3. Trabajos asignados a su departamento de otros operarios
    const userDepts = currentUser.departmentIds || [];
    const departmentOtherJobs = workOrders.filter(
      (wo) =>
        userDepts.includes(wo.departmentId) &&
        wo.assignedOperatorId !== currentUser.id &&
        !isJobCompleted(wo)
    );

    return (
      <div className="space-y-6">
        {/* Welcome Banner for Operario */}
        <div className="bg-gradient-to-r from-emerald-50 via-white to-slate-50 p-6 rounded-3xl border border-emerald-100 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Panel de Operario · {currentUser.name}
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Tus Tareas y Partes de Trabajo Asignados
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Revisa tus órdenes asignadas, consulta especificaciones, actualiza notas o añade alertas técnicas.
          </p>
        </div>

        {/* 3 Metric Cards matching PDF for Operario */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setOperarioTab('mis_activos')}
            className={`p-5 rounded-2xl text-left border transition-all ${
              operarioTab === 'mis_activos'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.01]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:border-indigo-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${operarioTab === 'mis_activos' ? 'bg-indigo-500/80' : 'bg-indigo-50 text-indigo-600'}`}>
                <Clock className="w-5 h-5" />
              </span>
              <span className="text-3xl font-black">{myActiveJobs.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${operarioTab === 'mis_activos' ? 'text-indigo-100' : 'text-slate-400'}`}>
              Mis Trabajos Activos
            </p>
          </button>

          <button
            onClick={() => setOperarioTab('mis_urgentes')}
            className={`p-5 rounded-2xl text-left border transition-all ${
              operarioTab === 'mis_urgentes'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md scale-[1.01]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:border-rose-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${operarioTab === 'mis_urgentes' ? 'bg-rose-500/80' : 'bg-rose-50 text-rose-600'}`}>
                <Flame className="w-5 h-5" />
              </span>
              <span className="text-3xl font-black">{myUrgentJobs.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${operarioTab === 'mis_urgentes' ? 'text-rose-100' : 'text-slate-400'}`}>
              Mis Trabajos Urgentes
            </p>
          </button>

          <button
            onClick={() => setOperarioTab('departamento_otros')}
            className={`p-5 rounded-2xl text-left border transition-all ${
              operarioTab === 'departamento_otros'
                ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-[1.01]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-400 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${operarioTab === 'departamento_otros' ? 'bg-slate-700' : 'bg-slate-100 text-slate-700'}`}>
                <Building className="w-5 h-5" />
              </span>
              <span className="text-3xl font-black">{departmentOtherJobs.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${operarioTab === 'departamento_otros' ? 'text-slate-300' : 'text-slate-400'}`}>
              Mi Depto. (Otros Operarios)
            </p>
          </button>
        </div>

        {/* Tab view */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800">
            {operarioTab === 'mis_activos' && 'Tus Órdenes de Trabajo Activas'}
            {operarioTab === 'mis_urgentes' && 'Tus Órdenes Urgentes (Máxima Prioridad)'}
            {operarioTab === 'departamento_otros' && 'Trabajos en tu Departamento asignados a Compañeros'}
          </h3>

          {operarioTab === 'mis_activos' && (
            myActiveJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                No tienes trabajos activos asignados actualmente.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {myActiveJobs.map((j) => renderJobCard(j))}
              </div>
            )
          )}

          {operarioTab === 'mis_urgentes' && (
            myUrgentJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                ¡Sin trabajos urgentes asignados a ti!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {myUrgentJobs.map((j) => renderJobCard(j))}
              </div>
            )
          )}

          {operarioTab === 'departamento_otros' && (
            departmentOtherJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                No hay otros trabajos en tus departamentos en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {departmentOtherJobs.map((j) => renderJobCard(j))}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  /* =========================================================================
     SÓLO LECTURA VIEW
     PDF: "El usuario con rol de sólo lectura, sólo podrá visualizar el total de trabajos
     creados, clasificados por departamento y operario, ver el estado y las alertas
     pero no podrá modificar nada."
     ========================================================================= */
  const filteredJobsForReadOnly = workOrders.filter((wo) => {
    if (selectedDeptFilter !== 'todos' && wo.departmentId !== selectedDeptFilter) return false;
    if (selectedOpFilter !== 'todos' && wo.assignedOperatorId !== selectedOpFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Read-only Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-white to-slate-50 p-6 rounded-3xl border border-amber-200/80 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <Eye className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Vista de Consulta y Auditoría · Rol Sólo Lectura
          </span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Total de Trabajos Registrados ({workOrders.length})
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Visualización clasificada por departamento y operario, estado actual y alertas técnicas (modo consulta protegida).
        </p>
      </div>

      {/* Filter bars for Read Only */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Departamento:</span>
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
          >
            <option value="todos">Todos los Departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Operario:</span>
          <select
            value={selectedOpFilter}
            onChange={(e) => setSelectedOpFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
          >
            <option value="todos">Todos los Operarios</option>
            {users
              .filter((u) => u.role === 'operario')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredJobsForReadOnly.map((j) => renderJobCard(j))}
      </div>
    </div>
  );
};
