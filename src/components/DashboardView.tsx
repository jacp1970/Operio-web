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
  Building2,
  ArrowRight,
  FileText,
  Calendar,
  Eye,
  Check,
  Trash2,
  ShieldAlert,
  Timer,
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  GripVertical,
} from 'lucide-react';
import { getDepartmentColor, getOperatorColor } from '../utils/colorUtils';
import { formatSecondsToHuman } from '../utils/timeUtils';
import { ConfirmModal } from './ConfirmModal';
import { useWorkOrderDragDrop } from '../hooks/useWorkOrderDragDrop';

interface DashboardViewProps {
  onOpenJobDetail: (job: WorkOrder) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenJobDetail,
}) => {
  const {
    currentUser,
    currentCompany,
    workOrders,
    users,
    departments,
    statuses,
    setCurrentNav,
    getDepartmentName,
    getStatus,
    getUser,
    reorderWorkOrder,
    moveWorkOrderToPosition,
    resetWorkOrdersOrderToDate,
    deleteWorkOrderPermanently,
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

  // Sort mode: custom priority order vs creation date (synced with JobsView preference)
  const [sortMode, setSortModeState] = useState<'custom' | 'date'>(() => {
    try {
      const saved = localStorage.getItem('operio_jobs_sort_criteria');
      return saved === 'date' ? 'date' : 'custom';
    } catch {
      return 'custom';
    }
  });
  const setSortMode = (next: 'custom' | 'date') => {
    setSortModeState(next);
    try {
      localStorage.setItem('operio_jobs_sort_criteria', next === 'custom' ? 'operator_order' : 'date');
    } catch {
      // Ignore storage errors
    }
  };

  // Delete confirmation state for Administrador
  const [deleteTargetJob, setDeleteTargetJob] = useState<WorkOrder | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = currentUser?.role === 'administrador';
  const canReorder = Boolean(currentUser) && currentUser?.role !== 'solo_lectura';

  const handleDropReorder = (
    sourceJobId: string,
    targetJobId: string,
    scopedJobIds: string[],
    targetPositionNumber: number
  ) => {
    if (!canReorder) return;
    if (sortMode !== 'custom') {
      setSortMode('custom');
    }
    const res = moveWorkOrderToPosition(sourceJobId, targetJobId, scopedJobIds);
    if (res.success) {
      const movedJob = workOrders.find((w) => w.id === sourceJobId);
      setFeedbackBanner({
        type: 'success',
        text: movedJob
          ? `Orden ${movedJob.ot} colocada en la posición #${targetPositionNumber} (orden personalizado).`
          : `Orden movida a la posición #${targetPositionNumber} (orden personalizado).`,
      });
      setTimeout(() => setFeedbackBanner(null), 2800);
    }
  };

  const {
    draggedJobId,
    touchPreview,
    shouldSuppressClick,
    getDragItemProps,
    getTouchHandleProps,
    getDropIndicator,
  } = useWorkOrderDragDrop({
    enabled: canReorder,
    onMove: handleDropReorder,
  });

  if (!currentUser) return null;

  const handleConfirmPermanentDelete = async () => {
    if (!deleteTargetJob || !isAdmin) return;
    const target = deleteTargetJob;
    setDeleteTargetJob(null);
    setIsDeletingId(target.id);
    setFeedbackBanner(null);

    const res = await deleteWorkOrderPermanently(target.id);
    setIsDeletingId(null);

    if (res.success) {
      setFeedbackBanner({
        type: 'success',
        text: `La orden ${target.ot} se ha eliminado definitivamente de la base de datos.`,
      });
      setTimeout(() => setFeedbackBanner(null), 3500);
    } else {
      setFeedbackBanner({
        type: 'error',
        text: res.error || 'No se pudo eliminar el trabajo de la base de datos.',
      });
    }
  };

  // Helpers
  const isJobCompleted = (wo: WorkOrder) => {
    const s = getStatus(wo.statusId);
    return s?.isCompleted ?? false;
  };

  const sortJobs = (list: WorkOrder[]) => {
    return [...list].sort((a, b) => {
      if (sortMode === 'date') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      const posA = a.orderPosition !== undefined ? a.orderPosition : 999999;
      const posB = b.orderPosition !== undefined ? b.orderPosition : 999999;
      if (posA !== posB) return posA - posB;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  };

  const handleReorderJob = (
    jobId: string,
    direction: 'up' | 'down',
    scopedJobIds: string[]
  ) => {
    if (!canReorder) return;
    if (sortMode !== 'custom') {
      setSortMode('custom');
    }
    const res = reorderWorkOrder(jobId, direction, scopedJobIds);
    if (res.success) {
      setFeedbackBanner({
        type: 'success',
        text:
          direction === 'up'
            ? 'Prioridad del trabajo aumentada (orden personalizado actualizado).'
            : 'Posición del trabajo reducida (orden personalizado actualizado).',
      });
      setTimeout(() => setFeedbackBanner(null), 2800);
    }
  };

  const handleResetOrderToDate = () => {
    if (!canReorder) return;
    resetWorkOrdersOrderToDate();
    setSortMode('date');
    setFeedbackBanner({
      type: 'success',
      text: 'Trabajos restablecidos al orden por fecha de creación.',
    });
    setTimeout(() => setFeedbackBanner(null), 2800);
  };

  const renderSortControlsBar = () => {
    if (!canReorder) return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-2xl border border-graphite-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-graphite-600 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-oterio-600" />
            <span>Ordenación:</span>
          </span>
          <div className="inline-flex p-0.5 bg-graphite-100 rounded-xl border border-graphite-200">
            <button
              type="button"
              onClick={() => setSortMode('custom')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                sortMode === 'custom'
                  ? 'bg-oterio-600 text-white shadow-2xs'
                  : 'text-graphite-600 hover:text-graphite-900'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Orden Personalizado</span>
            </button>
            <button
              type="button"
              onClick={() => setSortMode('date')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                sortMode === 'date'
                  ? 'bg-white text-oterio-700 shadow-2xs border border-oterio-100'
                  : 'text-graphite-600 hover:text-graphite-900'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Por Fecha</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-graphite-500 hidden lg:inline">
            Arrastra cualquier orden a la posición deseada (o usa ↑ / ↓)
          </span>
          {sortMode === 'custom' && (
            <button
              type="button"
              onClick={handleResetOrderToDate}
              className="text-xs font-semibold text-graphite-600 hover:text-rose-600 bg-graphite-50 hover:bg-rose-50 px-2.5 py-1 rounded-xl border border-graphite-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer a fecha</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const activeWorkOrders = sortJobs(workOrders.filter((wo) => !isJobCompleted(wo)));
  const completedWorkOrders = sortJobs(workOrders.filter((wo) => isJobCompleted(wo)));
  const urgentWorkOrders = sortJobs(workOrders.filter((wo) => wo.isUrgent && !isJobCompleted(wo)));
  const alertWorkOrders = sortJobs(workOrders.filter((wo) => wo.alerts.length > 0 && !isJobCompleted(wo)));

  const renderTouchPreview = () => {
    if (!touchPreview) return null;
    return (
      <div
        className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full px-3 py-1.5 rounded-xl bg-oterio-600 text-white text-xs font-bold shadow-lg border border-oterio-400 flex items-center gap-1.5"
        style={{ left: touchPreview.x, top: Math.max(24, touchPreview.y - 14) }}
      >
        <GripVertical className="w-3.5 h-3.5 opacity-80" />
        <span className="truncate max-w-[220px]">{touchPreview.label}</span>
      </div>
    );
  };

  // Render a job card item
  const renderJobCard = (
    job: WorkOrder,
    index?: number,
    scopedJobIds?: string[],
    scopeId?: string
  ) => {
    const status = getStatus(job.statusId);
    const assignedOp = getUser(job.assignedOperatorId);
    const deptName = getDepartmentName(job.departmentId);
    const deptColor = getDepartmentColor(job.departmentId, deptName);
    const opColor = getOperatorColor(job.assignedOperatorId, assignedOp?.name, assignedOp?.color);
    const showReorderControls =
      canReorder &&
      index !== undefined &&
      scopedJobIds !== undefined &&
      scopedJobIds.length > 1;
    const effectiveScopeId = scopeId || 'dashboard-default';
    const isDraggingThis = showReorderControls && draggedJobId === job.id;
    const dropIndicator = showReorderControls ? getDropIndicator(job.id, effectiveScopeId) : null;
    const dragProps = showReorderControls
      ? getDragItemProps(job, effectiveScopeId, scopedJobIds, index)
      : {};

    return (
      <div
        key={job.id}
        {...dragProps}
        onClick={() => {
          if (shouldSuppressClick()) return;
          onOpenJobDetail(job);
        }}
        className={`group relative bg-white border rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
          showReorderControls
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-pointer'
        } ${
          isDraggingThis
            ? 'opacity-45 border-dashed border-oterio-400 ring-2 ring-oterio-300 scale-[0.98]'
            : dropIndicator
            ? 'border-oterio-500 ring-2 ring-oterio-500 bg-oterio-50/40'
            : 'border-graphite-200/80 hover:border-oterio-300'
        }`}
      >
        {dropIndicator && (
          <div
            className={`pointer-events-none absolute left-3 right-3 h-1 rounded-full bg-oterio-600 ${
              dropIndicator === 'before' ? '-top-1' : '-bottom-1'
            }`}
          />
        )}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {showReorderControls && (
                <span
                  {...getTouchHandleProps(job, effectiveScopeId, scopedJobIds, index)}
                  onClick={(e) => e.stopPropagation()}
                  title="Arrastra para mover a otra posición"
                  className="touch-none p-1 -ml-1 rounded-md text-graphite-400 hover:text-oterio-600 hover:bg-oterio-50 cursor-grab active:cursor-grabbing shrink-0"
                >
                  <GripVertical className="w-4 h-4" />
                </span>
              )}
              <span className="font-mono text-sm font-bold text-graphite-900 bg-graphite-100 px-2.5 py-1 rounded-lg">
                {job.ot}
              </span>
              {showReorderControls && sortMode === 'custom' && (
                <span className="px-1.5 py-0.5 rounded-md bg-oterio-50 text-oterio-700 font-mono text-[11px] font-bold border border-oterio-200">
                  #{index + 1}
                </span>
              )}
              {job.isUrgent && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full animate-pulse">
                  <Flame className="w-3 h-3 text-rose-600" /> URGENTE
                </span>
              )}
            </div>

            {/* Status badge + Priority arrows + Admin Delete icon */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  status?.isCompleted
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-oterio-50 text-oterio-700 border border-oterio-200'
                }`}
              >
                {status?.name || 'Estado'}
              </span>

              {showReorderControls && (
                <div
                  className="flex items-center bg-graphite-100 rounded-lg p-0.5 border border-graphite-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleReorderJob(job.id, 'up', scopedJobIds)}
                    title="Subir prioridad"
                    aria-label={`Subir prioridad de ${job.ot}`}
                    className="p-1 rounded text-graphite-600 hover:text-oterio-600 hover:bg-white disabled:opacity-20 cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === scopedJobIds.length - 1}
                    onClick={() => handleReorderJob(job.id, 'down', scopedJobIds)}
                    title="Bajar prioridad"
                    aria-label={`Bajar prioridad de ${job.ot}`}
                    className="p-1 rounded text-graphite-600 hover:text-oterio-600 hover:bg-white disabled:opacity-20 cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {isAdmin && (
                <button
                  type="button"
                  disabled={isDeletingId === job.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetJob(job);
                  }}
                  title="Eliminar de la base de datos"
                  aria-label={`Eliminar ${job.ot} de la base de datos`}
                  className="p-1.5 rounded-lg text-graphite-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40"
                >
                  {isDeletingId === job.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          <h3 className="font-bold text-graphite-900 text-base mb-1 group-hover:text-oterio-600 transition-colors">
            {job.client}
          </h3>

          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-2 text-xs text-graphite-500 mb-3">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${deptColor.badgeSoft}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: deptColor.hex }} />
              <Building className="w-3 h-3 opacity-80" />
              {deptName}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${opColor.badgeSoft}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: opColor.hex }} />
              <Users className="w-3 h-3 opacity-80" />
              {assignedOp ? assignedOp.name : 'Sin asignar'}
            </span>
            <span className="inline-flex items-center gap-1 text-graphite-600 font-medium">
              <Calendar className="w-3.5 h-3.5 text-oterio-600" />
              Entrada: {new Date(job.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            {job.deliveryDate && (
              <span className="inline-flex items-center gap-1 text-graphite-600 font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Entrega: {job.deliveryDate}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] text-graphite-500 w-full pt-1 border-t border-graphite-100">
              <span className="text-oterio-600 font-bold">●</span>
              <span>Creado por <strong className="text-graphite-800">{job.createdByName || 'Administrador'}</strong></span>
              {job.participantsHistory && job.participantsHistory.length > 1 && (
                <span className="text-oterio-600 font-medium">· {job.participantsHistory.length} pases registrados</span>
              )}
            </span>
            {(job.timer?.totalSeconds || job.timer?.isRunning) && (
              <span className="inline-flex items-center justify-between text-[11px] w-full pt-1 border-t border-graphite-100">
                <span className="text-graphite-500 flex items-center gap-1">
                  <Timer className={`w-3.5 h-3.5 ${job.timer?.isRunning ? 'text-emerald-600 animate-pulse' : 'text-graphite-400'}`} />
                  <span>Tiempo cronometrado:</span>
                </span>
                <strong className={job.timer?.isRunning ? 'text-emerald-600 font-bold' : 'text-graphite-900 font-mono font-bold tabular-nums'}>
                  {job.timer?.isRunning ? 'En marcha' : formatSecondsToHuman(job.timer?.totalSeconds || 0)}
                </strong>
              </span>
            )}
          </div>

          {/* Notes brief */}
          {job.notes && (
            <p className="text-xs text-graphite-600 line-clamp-2 bg-graphite-50 p-2.5 rounded-xl border border-graphite-100 mb-3">
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
        <div className="flex items-center justify-between pt-3 border-t border-graphite-100 text-xs text-graphite-400">
          <div className="flex items-center gap-2">
            {job.pdfAttachment ? (
              <span className="inline-flex items-center gap-1 text-oterio-700 font-medium bg-oterio-50 px-2 py-0.5 rounded-md">
                <FileText className="w-3.5 h-3.5" /> PDF adjunto
              </span>
            ) : (
              <span className="text-graphite-400">Sin PDF</span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 text-oterio-600 font-semibold group-hover:translate-x-1 transition-transform">
            Ver detalle <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    );
  };

  /* =========================================================================
     ADMINISTRATOR VIEW
     ========================================================================= */
  if (currentUser.role === 'administrador') {
    return (
      <div className="space-y-6">
        {/* Welcome & Overview Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-oterio-50 via-white to-graphite-50 p-6 rounded-3xl border border-oterio-200/70 shadow-xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-oterio-600">
              Panel de Control · Administrador
            </span>
            <h2 className="text-2xl font-black text-graphite-900 tracking-tight mt-0.5">
              Control General de Partes de Trabajo
            </h2>
            <p className="text-sm text-graphite-600 mt-1">
              Supervisión en tiempo real de órdenes de trabajo, alertas y asignaciones del taller.
            </p>
          </div>
        </div>

        {/* Delete feedback banner */}
        {feedbackBanner && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span>{feedbackBanner.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {/* 5 Primary Classification Metric Cards matching PDF */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Trabajos activos */}
          <button
            onClick={() => setAdminTab('activos')}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
              adminTab === 'activos'
                ? 'bg-oterio-600 text-white border-oterio-600 shadow-md scale-[1.02]'
                : 'bg-white text-graphite-700 border-graphite-200/80 hover:border-oterio-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${adminTab === 'activos' ? 'bg-oterio-500/80' : 'bg-oterio-50 text-oterio-600'}`}>
                <Clock className="w-5 h-5" />
              </span>
              <span className="text-2xl font-black tabular-nums">{activeWorkOrders.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${adminTab === 'activos' ? 'text-oterio-100' : 'text-graphite-500'}`}>
              Trabajos Activos
            </p>
          </button>

          {/* 2. Trabajos por operario */}
          <button
            onClick={() => setAdminTab('por_operario')}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
              adminTab === 'por_operario'
                ? 'bg-graphite-900 text-white border-graphite-900 shadow-md scale-[1.02]'
                : 'bg-white text-graphite-700 border-graphite-200/80 hover:border-graphite-400 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${adminTab === 'por_operario' ? 'bg-graphite-800' : 'bg-graphite-100 text-graphite-800'}`}>
                <Users className="w-5 h-5" />
              </span>
              <span className="text-2xl font-black tabular-nums">
                {users.filter((u) => u.role === 'operario').length}
              </span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${adminTab === 'por_operario' ? 'text-graphite-300' : 'text-graphite-500'}`}>
              Por Operario
            </p>
          </button>

          {/* 3. Trabajos urgentes */}
          <button
            onClick={() => setAdminTab('urgentes')}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
              adminTab === 'urgentes'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md scale-[1.02]'
                : 'bg-white text-graphite-700 border-graphite-200/80 hover:border-rose-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${adminTab === 'urgentes' ? 'bg-rose-500/80' : 'bg-rose-50 text-rose-600'}`}>
                <Flame className="w-5 h-5" />
              </span>
              <span className="text-2xl font-black tabular-nums">{urgentWorkOrders.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${adminTab === 'urgentes' ? 'text-rose-100' : 'text-graphite-400'}`}>
              Trabajos Urgentes
            </p>
          </button>

          {/* 4. Trabajos con alertas */}
          <button
            onClick={() => setAdminTab('alertas')}
            className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
              adminTab === 'alertas'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md scale-[1.02]'
                : 'bg-white text-graphite-700 border-graphite-200/80 hover:border-amber-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${adminTab === 'alertas' ? 'bg-amber-600/80' : 'bg-amber-50 text-amber-600'}`}>
                <AlertTriangle className="w-5 h-5" />
              </span>
              <span className="text-2xl font-black tabular-nums">{alertWorkOrders.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${adminTab === 'alertas' ? 'text-amber-100' : 'text-graphite-400'}`}>
              Con Alertas
            </p>
          </button>

          {/* 5. Trabajos terminados */}
          <button
            onClick={() => setAdminTab('terminados')}
            className={`p-4 rounded-2xl text-left border transition-all col-span-2 lg:col-span-1 cursor-pointer ${
              adminTab === 'terminados'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]'
                : 'bg-white text-graphite-700 border-graphite-200/80 hover:border-emerald-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${adminTab === 'terminados' ? 'bg-emerald-500/80' : 'bg-emerald-50 text-emerald-600'}`}>
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <span className="text-2xl font-black tabular-nums">{completedWorkOrders.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${adminTab === 'terminados' ? 'text-emerald-100' : 'text-graphite-400'}`}>
              Terminados
            </p>
          </button>
        </div>

        {/* Content based on the selected classification */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-graphite-900 flex items-center gap-2">
              {adminTab === 'activos' && 'Trabajos Activos en Taller'}
              {adminTab === 'por_operario' && 'Clasificación de Trabajos por Operario'}
              {adminTab === 'urgentes' && 'Trabajos Marcados como Urgentes'}
              {adminTab === 'alertas' && 'Trabajos con Alertas o Incidencias'}
              {adminTab === 'terminados' && 'Historial de Trabajos Terminados'}
            </h3>
            <button
              onClick={() => setCurrentNav('trabajos')}
              className="text-xs font-semibold text-oterio-600 hover:text-oterio-800 inline-flex items-center gap-1 cursor-pointer"
            >
              Ver todos en Trabajos <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {renderSortControlsBar()}

          {/* TAB: Por operario view */}
          {adminTab === 'por_operario' ? (
            <div className="space-y-6">
              {users
                .filter((u) => u.role === 'operario')
                .map((op) => {
                  const opJobs = sortJobs(
                    workOrders.filter(
                      (w) => w.assignedOperatorId === op.id && !isJobCompleted(w)
                    )
                  );
                  const opJobIds = opJobs.map((j) => j.id);
                  const opUrgentCount = opJobs.filter((w) => w.isUrgent).length;
                  const opAlertsCount = opJobs.filter((w) => w.alerts.length > 0).length;

                  return (
                    <div
                      key={op.id}
                      className="bg-white rounded-2xl border border-graphite-200/80 p-5 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-graphite-100 gap-2 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-graphite-100 text-graphite-800 font-bold flex items-center justify-center">
                            {op.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-graphite-900">{op.name}</h4>
                            <p className="text-xs text-graphite-500 font-mono">Clave: {op.accessKey}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-oterio-50 text-oterio-700 font-semibold">
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
                        <p className="text-xs text-graphite-400 italic py-2">
                          No tiene trabajos activos asignados en este momento.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {opJobs.map((j, idx) =>
                            renderJobCard(j, idx, opJobIds, `dash-admin-op-${op.id}`)
                          )}
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
                  <div className="bg-white rounded-2xl border border-graphite-200 p-8 text-center text-graphite-500">
                    No hay trabajos activos actualmente.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeWorkOrders.map((j, idx) =>
                      renderJobCard(
                        j,
                        idx,
                        activeWorkOrders.map((x) => x.id),
                        'dash-admin-activos'
                      )
                    )}
                  </div>
                )
              )}

              {adminTab === 'urgentes' && (
                urgentWorkOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-graphite-200 p-8 text-center text-graphite-500">
                    ¡Excelente! No hay trabajos urgentes pendientes.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {urgentWorkOrders.map((j, idx) =>
                      renderJobCard(
                        j,
                        idx,
                        urgentWorkOrders.map((x) => x.id),
                        'dash-admin-urgentes'
                      )
                    )}
                  </div>
                )
              )}

              {adminTab === 'alertas' && (
                alertWorkOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-graphite-200 p-8 text-center text-graphite-500">
                    No hay ningún trabajo con alertas pendientes.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {alertWorkOrders.map((j, idx) =>
                      renderJobCard(
                        j,
                        idx,
                        alertWorkOrders.map((x) => x.id),
                        'dash-admin-alertas'
                      )
                    )}
                  </div>
                )
              )}

              {adminTab === 'terminados' && (
                completedWorkOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-graphite-200 p-8 text-center text-graphite-500">
                    Aún no se ha finalizado ningún trabajo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {completedWorkOrders.map((j, idx) =>
                      renderJobCard(
                        j,
                        idx,
                        completedWorkOrders.map((x) => x.id),
                        'dash-admin-terminados'
                      )
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {renderTouchPreview()}

        {/* Permanent Database Deletion Confirmation Modal */}
        <ConfirmModal
          isOpen={Boolean(deleteTargetJob)}
          title="Eliminar trabajo de la base de datos"
          message={
            deleteTargetJob
              ? `¿Confirmas que deseas eliminar definitivamente la orden ${deleteTargetJob.ot} (${deleteTargetJob.client}) de la base de datos? Esta acción no se puede deshacer.`
              : ''
          }
          confirmText="Sí, eliminar"
          cancelText="Cancelar"
          isDanger
          onConfirm={handleConfirmPermanentDelete}
          onCancel={() => setDeleteTargetJob(null)}
        />
      </div>
    );
  }

  /* =========================================================================
     OPERARIO & ADMINISTRATIVO VIEW
     ========================================================================= */
  if (currentUser.role === 'operario' || currentUser.role === 'administrativo') {
    // 1. Sus trabajos activos asignados
    const myActiveJobs = sortJobs(
      workOrders.filter(
        (wo) => wo.assignedOperatorId === currentUser.id && !isJobCompleted(wo)
      )
    );

    // 2. Sus trabajos urgentes
    const myUrgentJobs = sortJobs(myActiveJobs.filter((wo) => wo.isUrgent));

    // 3. Trabajos asignados a su departamento de otros operarios
    const userDepts = currentUser.departmentIds || [];
    const departmentOtherJobs = sortJobs(
      workOrders.filter(
        (wo) =>
          userDepts.includes(wo.departmentId) &&
          wo.assignedOperatorId !== currentUser.id &&
          !isJobCompleted(wo)
      )
    );

    const isAdministrativo = currentUser.role === 'administrativo';

    return (
      <div className="space-y-6">
        {/* Welcome Banner for Operario / Administrativo */}
        <div className={`bg-gradient-to-r ${isAdministrativo ? 'from-oterio-50 via-white to-graphite-50 border-oterio-200/70' : 'from-emerald-50 via-white to-graphite-50 border-emerald-200/70'} p-6 rounded-3xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div>
            <span className={`text-xs font-bold uppercase tracking-wider ${isAdministrativo ? 'text-oterio-700' : 'text-emerald-700'}`}>
              Panel de {isAdministrativo ? 'Administrativo' : 'Operario'} · {currentUser.name}
            </span>
            <h2 className="text-2xl font-black text-graphite-900 tracking-tight mt-0.5">
              Tus Tareas y Partes de Trabajo Asignados
            </h2>
            <p className="text-sm text-graphite-600 mt-1">
              {isAdministrativo
                ? 'Supervisa tus trabajos asignados, cronometra tramos y gestiona el estado de las órdenes.'
                : 'Revisa tus órdenes asignadas, consulta especificaciones, actualiza notas o añade alertas técnicas.'}
            </p>
          </div>
        </div>

        {feedbackBanner && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span>{feedbackBanner.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {/* 3 Metric Cards matching PDF for Operario */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setOperarioTab('mis_activos')}
            className={`p-5 rounded-2xl text-left border transition-all cursor-pointer ${
              operarioTab === 'mis_activos'
                ? 'bg-oterio-600 text-white border-oterio-600 shadow-md scale-[1.01]'
                : 'bg-white text-graphite-700 border-graphite-200/80 hover:border-oterio-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${operarioTab === 'mis_activos' ? 'bg-oterio-500/80' : 'bg-oterio-50 text-oterio-600'}`}>
                <Clock className="w-5 h-5" />
              </span>
              <span className="text-3xl font-black tabular-nums">{myActiveJobs.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${operarioTab === 'mis_activos' ? 'text-oterio-100' : 'text-graphite-500'}`}>
              Mis Trabajos Activos
            </p>
          </button>

          <button
            onClick={() => setOperarioTab('mis_urgentes')}
            className={`p-5 rounded-2xl text-left border transition-all cursor-pointer ${
              operarioTab === 'mis_urgentes'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md scale-[1.01]'
                : 'bg-white text-graphite-700 border-graphite-200/80 hover:border-rose-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${operarioTab === 'mis_urgentes' ? 'bg-rose-500/80' : 'bg-rose-50 text-rose-600'}`}>
                <Flame className="w-5 h-5" />
              </span>
              <span className="text-3xl font-black tabular-nums">{myUrgentJobs.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${operarioTab === 'mis_urgentes' ? 'text-rose-100' : 'text-graphite-500'}`}>
              Mis Trabajos Urgentes
            </p>
          </button>

          <button
            onClick={() => setOperarioTab('departamento_otros')}
            className={`p-5 rounded-2xl text-left border transition-all cursor-pointer ${
              operarioTab === 'departamento_otros'
                ? 'bg-graphite-900 text-white border-graphite-900 shadow-md scale-[1.01]'
                : 'bg-white text-graphite-700 border-graphite-200/80 hover:border-graphite-400 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-xl ${operarioTab === 'departamento_otros' ? 'bg-graphite-800' : 'bg-graphite-100 text-graphite-800'}`}>
                <Building className="w-5 h-5" />
              </span>
              <span className="text-3xl font-black tabular-nums">{departmentOtherJobs.length}</span>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider ${operarioTab === 'departamento_otros' ? 'text-graphite-300' : 'text-graphite-500'}`}>
              Mi Depto. (Otros Operarios)
            </p>
          </button>
        </div>

        {/* Tab view */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-graphite-900">
              {operarioTab === 'mis_activos' && 'Tus Órdenes de Trabajo Activas'}
              {operarioTab === 'mis_urgentes' && 'Tus Órdenes Urgentes (Máxima Prioridad)'}
              {operarioTab === 'departamento_otros' && 'Trabajos en tu Departamento asignados a Compañeros'}
            </h3>
            <button
              onClick={() => setCurrentNav('trabajos')}
              className="text-xs font-semibold text-oterio-600 hover:text-oterio-800 inline-flex items-center gap-1 cursor-pointer"
            >
              Ver todos en Trabajos <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {renderSortControlsBar()}

          {operarioTab === 'mis_activos' && (
            myActiveJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-graphite-200 p-8 text-center text-graphite-400">
                No tienes trabajos activos asignados actualmente.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {myActiveJobs.map((j, idx) =>
                  renderJobCard(
                    j,
                    idx,
                    myActiveJobs.map((x) => x.id),
                    'dash-op-mis-activos'
                  )
                )}
              </div>
            )
          )}

          {operarioTab === 'mis_urgentes' && (
            myUrgentJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-graphite-200 p-8 text-center text-graphite-400">
                ¡Sin trabajos urgentes asignados a ti!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {myUrgentJobs.map((j, idx) =>
                  renderJobCard(
                    j,
                    idx,
                    myUrgentJobs.map((x) => x.id),
                    'dash-op-mis-urgentes'
                  )
                )}
              </div>
            )
          )}

          {operarioTab === 'departamento_otros' && (
            departmentOtherJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-graphite-200 p-8 text-center text-graphite-400">
                No hay otros trabajos en tus departamentos en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {departmentOtherJobs.map((j, idx) =>
                  renderJobCard(
                    j,
                    idx,
                    departmentOtherJobs.map((x) => x.id),
                    'dash-op-depto-otros'
                  )
                )}
              </div>
            )
          )}
        </div>

        {renderTouchPreview()}
      </div>
    );
  }

  /* =========================================================================
     SÓLO LECTURA VIEW
     PDF: "El usuario con rol de sólo lectura, sólo podrá visualizar el total de trabajos
     creados, clasificados por departamento y operario, ver el estado y las alertas
     pero no podrá modificar nada."
     ========================================================================= */
  const filteredJobsForReadOnly = sortJobs(
    workOrders.filter((wo) => {
      if (selectedDeptFilter !== 'todos' && wo.departmentId !== selectedDeptFilter) return false;
      if (selectedOpFilter !== 'todos' && wo.assignedOperatorId !== selectedOpFilter) return false;
      return true;
    })
  );

  return (
    <div className="space-y-6">
      {/* Read-only Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-white to-graphite-50 p-6 rounded-3xl border border-amber-200/80 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <Eye className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Vista de Consulta y Auditoría · Rol Sólo Lectura
          </span>
        </div>
        <h2 className="text-2xl font-black text-graphite-900 tracking-tight">
          Total de Trabajos Registrados ({workOrders.length})
        </h2>
        <p className="text-sm text-graphite-500 mt-1">
          Visualización clasificada por departamento y operario, estado actual y alertas técnicas (modo consulta protegida).
        </p>
      </div>

      {/* Filter bars for Read Only */}
      <div className="bg-white p-4 rounded-2xl border border-graphite-200/80 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-graphite-500 uppercase">Departamento:</span>
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-graphite-200 bg-graphite-50 text-graphite-700"
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
          <span className="text-xs font-bold text-graphite-500 uppercase">Operario:</span>
          <select
            value={selectedOpFilter}
            onChange={(e) => setSelectedOpFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-graphite-200 bg-graphite-50 text-graphite-700"
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
