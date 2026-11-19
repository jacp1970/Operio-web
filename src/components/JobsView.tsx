import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { WorkOrder, User as AppUser, Department } from '../types';
import {
  Search,
  Plus,
  Flame,
  AlertTriangle,
  FileText,
  Calendar,
  Building,
  User,
  Clock,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  Users,
  LayoutGrid,
  Palette,
  CheckCircle2,
  Table,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  Timer,
  Trash2,
  Loader2,
  X,
  GripVertical,
} from 'lucide-react';
import {
  getOperatorColor,
  getDepartmentColor,
  getUnassignedPalette,
} from '../utils/colorUtils';
import { formatSecondsToHuman } from '../utils/timeUtils';
import { ConfirmModal } from './ConfirmModal';
import { useWorkOrderDragDrop } from '../hooks/useWorkOrderDragDrop';

interface JobsViewProps {
  onOpenJobDetail: (job: WorkOrder) => void;
  onOpenNewJobModal: () => void;
  onOpenPdfViewer: (attachment: { name: string; dataUrl: string }) => void;
}

export const JobsView: React.FC<JobsViewProps> = ({
  onOpenJobDetail,
  onOpenNewJobModal,
  onOpenPdfViewer,
}) => {
  const {
    currentUser,
    workOrders,
    departments,
    statuses,
    users,
    getDepartmentName,
    getStatus,
    getUser,
    reorderWorkOrder,
    moveWorkOrderToPosition,
    resetWorkOrdersOrderToDate,
    deleteWorkOrderPermanently,
  } = useApp();

  const isAdmin = currentUser?.role === 'administrador';
  const isOperario = currentUser?.role === 'operario';
  const isAdministrativo = currentUser?.role === 'administrativo';
  const isReadOnly = currentUser?.role === 'solo_lectura';
  const canCreate = isAdmin || isAdministrativo;
  const canReorder = Boolean(currentUser) && !isReadOnly;

  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'todos' | 'activos' | 'completados'>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('activos');
  const [departmentFilter, setDepartmentFilter] = useState<string>('todos');
  const [operatorFilter, setOperatorFilter] = useState<string>('todos');
  const [onlyUrgent, setOnlyUrgent] = useState<boolean>(false);
  const [onlyAlerts, setOnlyAlerts] = useState<boolean>(false);

  // View modes: 'spreadsheet' (Hoja de cálculo - por defecto), 'grid' (Tarjetas), 'table' (Lista tradicional)
  const [viewMode, setViewMode] = useState<'spreadsheet' | 'grid' | 'table'>('spreadsheet');

  // Column grouping: 'operario' (cada empleado por columna) vs 'departamento' (cada departamento por columna)
  const [columnGroupBy, setColumnGroupBy] = useState<'operario' | 'departamento'>('operario');

  // Spreadsheet density: 'compact' (máxima información de un vistazo) vs 'standard'
  const [isCompact, setIsCompact] = useState<boolean>(true);

  // Legend visibility toggle
  const [showColorLegend, setShowColorLegend] = useState(false);

  // Sorting: defaults to creation date ('date'), persists preference when user switches or reorders ('operator_order')
  const [sortCriteria, setSortCriteriaState] = useState<'date' | 'operator_order'>(() => {
    try {
      const saved = localStorage.getItem('operio_jobs_sort_criteria');
      return saved === 'operator_order' ? 'operator_order' : 'date';
    } catch {
      return 'date';
    }
  });
  const setSortCriteria = (next: 'date' | 'operator_order') => {
    setSortCriteriaState(next);
    try {
      localStorage.setItem('operio_jobs_sort_criteria', next);
    } catch {
      // Ignore storage errors
    }
  };
  const [dateDirection, setDateDirection] = useState<'desc' | 'asc'>('desc');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [deleteTargetJob, setDeleteTargetJob] = useState<WorkOrder | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const handleDropReorder = (
    sourceJobId: string,
    targetJobId: string,
    scopedJobIds: string[],
    targetPositionNumber: number
  ) => {
    if (!canReorder) return;
    if (sortCriteria !== 'operator_order') {
      setSortCriteria('operator_order');
    }
    const res = moveWorkOrderToPosition(sourceJobId, targetJobId, scopedJobIds);
    if (res.success) {
      const movedJob = workOrders.find((w) => w.id === sourceJobId);
      setFeedbackNotice(
        movedJob
          ? `Orden ${movedJob.ot} colocada en la posición #${targetPositionNumber} (orden personalizado).`
          : `Orden movida a la posición #${targetPositionNumber} (orden personalizado).`
      );
      setTimeout(() => setFeedbackNotice(null), 3000);
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

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString.slice(0, 10);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateString.slice(0, 10);
    }
  };

  const normalizeSearchText = (val?: string) =>
    (val || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normalizedQuery = normalizeSearchText(searchTerm.trim());
  const hasSearchQuery = normalizedQuery.length > 0;

  // Base search matches across all non-deleted work orders (both active and completed)
  const searchBaseMatches = hasSearchQuery
    ? workOrders.filter((wo) => {
        const matchOt = normalizeSearchText(wo.ot).includes(normalizedQuery);
        const matchClient = normalizeSearchText(wo.client).includes(normalizedQuery);
        const matchNotes = normalizeSearchText(wo.notes).includes(normalizedQuery);
        const matchAlerts = wo.alerts.some((a) =>
          normalizeSearchText(a.text).includes(normalizedQuery)
        );
        if (!matchOt && !matchClient && !matchNotes && !matchAlerts) return false;

        if (departmentFilter !== 'todos' && wo.departmentId !== departmentFilter) {
          return false;
        }
        if (operatorFilter !== 'todos' && wo.assignedOperatorId !== operatorFilter) {
          return false;
        }
        if (onlyUrgent && !wo.isUrgent) {
          return false;
        }
        if (onlyAlerts && wo.alerts.length === 0) {
          return false;
        }
        return true;
      })
    : [];

  const searchActiveCount = hasSearchQuery
    ? searchBaseMatches.filter((wo) => !getStatus(wo.statusId)?.isCompleted).length
    : 0;
  const searchCompletedCount = hasSearchQuery
    ? searchBaseMatches.filter((wo) => Boolean(getStatus(wo.statusId)?.isCompleted)).length
    : 0;

  // Filter logic
  const filteredJobs = hasSearchQuery
    ? searchBaseMatches.filter((wo) => {
        const woStatus = getStatus(wo.statusId);
        if (searchScope === 'activos' && woStatus?.isCompleted) return false;
        if (searchScope === 'completados' && !woStatus?.isCompleted) return false;

        if (
          statusFilter !== 'activos' &&
          statusFilter !== 'todos' &&
          statusFilter !== 'completados' &&
          wo.statusId !== statusFilter
        ) {
          return false;
        }
        return true;
      })
    : workOrders.filter((wo) => {
        const woStatus = getStatus(wo.statusId);

        // Sin búsqueda activa, una vez marcado como finalizado desaparece de la lista del operario
        if (isOperario && woStatus?.isCompleted) {
          return false;
        }

        if (statusFilter !== 'todos') {
          if (statusFilter === 'completados') {
            if (!woStatus?.isCompleted) return false;
          } else if (statusFilter === 'activos') {
            if (woStatus?.isCompleted) return false;
          } else if (wo.statusId !== statusFilter) {
            return false;
          }
        }

        if (departmentFilter !== 'todos' && wo.departmentId !== departmentFilter) {
          return false;
        }

        if (operatorFilter !== 'todos' && wo.assignedOperatorId !== operatorFilter) {
          return false;
        }

        if (onlyUrgent && !wo.isUrgent) {
          return false;
        }

        if (onlyAlerts && wo.alerts.length === 0) {
          return false;
        }

        return true;
      });

  // Sorting logic
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortCriteria === 'date') {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return dateDirection === 'desc' ? timeB - timeA : timeA - timeB;
    } else {
      const posA = a.orderPosition !== undefined ? a.orderPosition : 999999;
      const posB = b.orderPosition !== undefined ? b.orderPosition : 999999;
      if (posA !== posB) return posA - posB;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }
  });

  const handleReorder = (
    jobId: string,
    direction: 'up' | 'down',
    scopedJobIds?: string[]
  ) => {
    if (!canReorder) return;
    if (sortCriteria !== 'operator_order') {
      setSortCriteria('operator_order');
    }
    const res = reorderWorkOrder(jobId, direction, scopedJobIds);
    if (res.success) {
      setFeedbackNotice(
        direction === 'up'
          ? 'Prioridad del trabajo aumentada (orden personalizado actualizado)'
          : 'Posición del trabajo reducida (orden personalizado actualizado)'
      );
      setTimeout(() => setFeedbackNotice(null), 3000);
    }
  };

  const handleResetToDate = () => {
    if (!canReorder) return;
    resetWorkOrdersOrderToDate();
    setSortCriteria('date');
    setDateDirection('desc');
    setFeedbackNotice('Trabajos restablecidos al orden por fecha de creación.');
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deleteTargetJob || !isAdmin) return;
    const target = deleteTargetJob;
    setDeleteTargetJob(null);
    setIsDeletingId(target.id);
    setErrorNotice(null);

    const res = await deleteWorkOrderPermanently(target.id);
    setIsDeletingId(null);

    if (res.success) {
      setFeedbackNotice(`La orden ${target.ot} se ha eliminado definitivamente de la base de datos.`);
      setTimeout(() => setFeedbackNotice(null), 3500);
    } else {
      setErrorNotice(res.error || 'No se pudo eliminar el trabajo de la base de datos.');
    }
  };

  // Build columns for "Por Empleado"
  const operatorColumns: { id: string; user?: AppUser; name: string }[] = [];
  const registeredOperators = users.filter((u) => u.role === 'operario');
  registeredOperators.forEach((u) => {
    operatorColumns.push({ id: u.id, user: u, name: u.name });
  });

  sortedJobs.forEach((job) => {
    if (
      job.assignedOperatorId &&
      !operatorColumns.some((col) => col.id === job.assignedOperatorId)
    ) {
      const otherUser = users.find((u) => u.id === job.assignedOperatorId);
      if (otherUser) {
        operatorColumns.push({
          id: otherUser.id,
          user: otherUser,
          name: otherUser.name,
        });
      }
    }
  });

  const hasUnassignedJobs = sortedJobs.some(
    (job) => !job.assignedOperatorId || !users.some((u) => u.id === job.assignedOperatorId)
  );
  if (hasUnassignedJobs) {
    operatorColumns.push({ id: 'unassigned', name: 'Sin Asignar' });
  }

  // Build columns for "Por Departamento"
  const departmentColumns: { id: string; department?: Department; name: string }[] = [];
  departments.forEach((d) => {
    departmentColumns.push({ id: d.id, department: d, name: d.name });
  });

  const hasUnassignedDeptJobs = sortedJobs.some(
    (job) => !job.departmentId || !departments.some((d) => d.id === job.departmentId)
  );
  if (hasUnassignedDeptJobs) {
    departmentColumns.push({ id: 'unassigned_dept', name: 'Sin Departamento' });
  }

  // Prepare columns & rows data for spreadsheet view
  const currentSpreadsheetColumns =
    columnGroupBy === 'operario'
      ? operatorColumns.map((col, colIdx) => {
          const isUnassigned = col.id === 'unassigned';
          const jobsInCol = sortedJobs.filter((j) => {
            if (isUnassigned) {
              return !j.assignedOperatorId || !users.some((u) => u.id === j.assignedOperatorId);
            }
            return j.assignedOperatorId === col.id;
          });
          const palette = isUnassigned
            ? getUnassignedPalette()
            : getOperatorColor(col.user?.id, col.user?.name, col.user?.color);
          return {
            id: col.id,
            letter: String.fromCharCode(65 + (colIdx % 26)),
            name: col.name,
            subtext: isUnassigned ? 'Pendiente' : 'Operario',
            jobs: jobsInCol,
            palette,
            isUnassigned,
          };
        })
      : departmentColumns.map((col, colIdx) => {
          const isUnassigned = col.id === 'unassigned_dept';
          const jobsInCol = sortedJobs.filter((j) => {
            if (isUnassigned) {
              return !j.departmentId || !departments.some((d) => d.id === j.departmentId);
            }
            return j.departmentId === col.id;
          });
          const palette = isUnassigned
            ? getUnassignedPalette()
            : getDepartmentColor(col.department?.id, col.department?.name, col.department?.color);
          return {
            id: col.id,
            letter: String.fromCharCode(65 + (colIdx % 26)),
            name: col.name,
            subtext: isUnassigned ? 'Sin sección' : 'Departamento',
            jobs: jobsInCol,
            palette,
            isUnassigned,
          };
        });

  // Calculate maximum rows needed in spreadsheet (minimum 8 rows so it always looks like a full spreadsheet grid)
  const maxJobCountInCols = Math.max(
    0,
    ...currentSpreadsheetColumns.map((c) => c.jobs.length)
  );
  const totalSpreadsheetRows = Math.max(8, maxJobCountInCols + 1);

  // Summary statistics for "De un vistazo"
  const activeJobsCount = sortedJobs.filter((j) => !getStatus(j.statusId)?.isCompleted).length;
  const completedJobsCount = sortedJobs.filter((j) => getStatus(j.statusId)?.isCompleted).length;
  const urgentJobsCount = sortedJobs.filter((j) => j.isUrgent).length;
  const alertsCount = sortedJobs.filter((j) => j.alerts.length > 0).length;

  return (
    <div className="space-y-4">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-graphite-900 tracking-tight">
              Órdenes de Trabajo (OT)
            </h2>
            {isAdmin ? (
              <span className="px-2 py-0.5 rounded-md bg-oterio-50 text-oterio-700 text-[11px] font-bold border border-oterio-200">
                Vista Administrador
              </span>
            ) : isAdministrativo ? (
              <span className="px-2 py-0.5 rounded-md bg-graphite-100 text-graphite-800 text-[11px] font-bold border border-graphite-300">
                Vista Administrativo
              </span>
            ) : null}
          </div>
          <p className="text-xs sm:text-sm text-graphite-500 mt-0.5">
            {sortedJobs.length} órdenes en vista
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Columnas / Tarjetas / Tabla */}
          <div className="bg-graphite-100 p-1 rounded-xl flex items-center border border-graphite-200">
            <button
              onClick={() => setViewMode('spreadsheet')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'spreadsheet'
                  ? 'bg-white text-oterio-700 shadow-2xs border border-oterio-100'
                  : 'text-graphite-600 hover:text-graphite-900'
              }`}
              title="Vista por Columnas"
            >
              <Table className="w-3.5 h-3.5" />
              <span>Columnas</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-oterio-700 shadow-2xs border border-oterio-100'
                  : 'text-graphite-600 hover:text-graphite-900'
              }`}
              title="Vista en Tarjetas"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tarjetas</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-oterio-700 shadow-2xs border border-oterio-100'
                  : 'text-graphite-600 hover:text-graphite-900'
              }`}
              title="Vista en Lista de Tabla"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>

          {/* Color Legend toggle button */}
          <button
            type="button"
            onClick={() => setShowColorLegend(!showColorLegend)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              showColorLegend
                ? 'bg-oterio-50 text-oterio-700 border-oterio-300 font-bold'
                : 'bg-white text-graphite-700 border-graphite-200 hover:bg-graphite-50'
            }`}
            title="Ver leyenda de colores asignados a operarios y departamentos"
          >
            <Palette className="w-3.5 h-3.5 text-oterio-600" />
            <span className="hidden sm:inline">Colores</span>
          </button>

          {/* New Work Order button (Admin & Administrativo) */}
          {canCreate && (
            <button
              onClick={onOpenNewJobModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-oterio-600 text-white text-xs sm:text-sm font-bold hover:bg-oterio-700 active:scale-95 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Trabajo</span>
            </button>
          )}
        </div>
      </div>

      {/* Reorder / Delete feedback notices */}
      {feedbackNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{feedbackNotice}</span>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 ml-2 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {errorNotice && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{errorNotice}</span>
          <button
            onClick={() => setErrorNotice(null)}
            className="text-rose-600 hover:text-rose-800 ml-2 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* =========================================================================
         BUSCADOR DE ÓRDENES DE TRABAJO Y CLIENTES (ACTIVOS Y TERMINADOS)
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-graphite-200 p-3.5 shadow-xs space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-oterio-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!e.target.value.trim()) {
                setSearchScope('todos');
              }
            }}
            placeholder="Buscar orden de trabajo (OT) o por cliente (muestra activos y terminados no eliminados)..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-graphite-200 text-xs sm:text-sm font-medium text-graphite-900 placeholder:text-graphite-400 focus:ring-2 focus:ring-oterio-500 focus:border-oterio-400 bg-graphite-50/60 focus:bg-white transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSearchScope('todos');
              }}
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-graphite-400 hover:text-graphite-700 hover:bg-graphite-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {hasSearchQuery && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-graphite-600">
              <span>
                Resultados para <strong className="text-graphite-900">"{searchTerm.trim()}"</strong>:
              </span>
              <span className="font-mono font-bold text-graphite-800 bg-graphite-100 px-2 py-0.5 rounded-md tabular-nums">
                {searchBaseMatches.length} {searchBaseMatches.length === 1 ? 'trabajo' : 'trabajos'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-graphite-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSearchScope('todos')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer tabular-nums ${
                  searchScope === 'todos'
                    ? 'bg-graphite-900 text-white shadow-2xs'
                    : 'text-graphite-600 hover:text-graphite-900'
                }`}
              >
                Todos ({searchBaseMatches.length})
              </button>
              <button
                type="button"
                onClick={() => setSearchScope('activos')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer tabular-nums ${
                  searchScope === 'activos'
                    ? 'bg-oterio-600 text-white shadow-2xs'
                    : 'text-graphite-600 hover:text-graphite-900'
                }`}
              >
                Activos ({searchActiveCount})
              </button>
              <button
                type="button"
                onClick={() => setSearchScope('completados')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer tabular-nums ${
                  searchScope === 'completados'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-graphite-600 hover:text-graphite-900'
                }`}
              >
                Terminados ({searchCompletedCount})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
         RESUMEN DE UN VISTAZO (AT-A-GLANCE EXECUTIVE STRIP)
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-graphite-200 p-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Key Totals */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span className="font-bold text-graphite-800 uppercase tracking-wider text-[11px] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-oterio-600" />
              <span>De un vistazo:</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-graphite-100 text-graphite-800 font-semibold border border-graphite-200">
              <strong className="text-graphite-900 font-mono tabular-nums">{sortedJobs.length}</strong> OTs Totales
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-oterio-50 text-oterio-800 font-semibold border border-oterio-200">
              <strong className="font-mono tabular-nums">{activeJobsCount}</strong> Activas
            </span>

            {(!isOperario || hasSearchQuery) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <strong className="font-mono tabular-nums">{completedJobsCount}</strong> Terminadas
              </span>
            )}

            {urgentJobsCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold border border-rose-200">
                <Flame className="w-3 h-3 text-rose-600" />
                <strong className="font-mono tabular-nums">{urgentJobsCount}</strong> Urgentes
              </span>
            )}

            {alertsCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <strong className="font-mono tabular-nums">{alertsCount}</strong> Con Alertas
              </span>
            )}
          </div>

          {/* Quick Column Badges Summary */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <span className="text-[11px] font-medium text-graphite-400 shrink-0 hidden sm:inline">
              {columnGroupBy === 'operario' ? 'Por operario:' : 'Por dpto:'}
            </span>
            <div className="flex items-center gap-1.5 flex-nowrap">
              {currentSpreadsheetColumns.map((col) => (
                <span
                  key={col.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0 ${col.palette.badgeSoft}`}
                  title={`${col.name}: ${col.jobs.length} trabajos`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: col.palette.hex }}
                  />
                  <span className="truncate max-w-[90px]">{col.name}</span>
                  <span className="font-mono font-bold text-[10px] bg-white/70 px-1 rounded tabular-nums">
                    {col.jobs.length}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* COLOR LEGEND PANEL */}
      {showColorLegend && (
        <div className="p-4 bg-white rounded-2xl border border-oterio-200 shadow-xs animate-in fade-in duration-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-oterio-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-graphite-800">
                Identificación de Colores Asignados
              </h4>
            </div>
            <button
              onClick={() => setShowColorLegend(false)}
              className="text-xs text-graphite-500 hover:text-graphite-800 cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Operators color legend */}
            <div className="bg-graphite-50/70 p-3 rounded-xl border border-graphite-200/80">
              <span className="font-bold text-graphite-700 flex items-center gap-1.5 mb-2">
                <User className="w-3.5 h-3.5 text-oterio-600" />
                <span>Colores por Operario / Empleado:</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {users
                  .filter((u) => u.role === 'operario')
                  .map((op) => {
                    const color = getOperatorColor(op.id, op.name, op.color);
                    return (
                      <span
                        key={op.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${color.badgeSoft}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`}></span>
                        <span>{op.name}</span>
                        <span className="text-[10px] text-graphite-400 font-normal">
                          ({color.name})
                        </span>
                      </span>
                    );
                  })}
              </div>
            </div>

            {/* Departments color legend */}
            <div className="bg-graphite-50/70 p-3 rounded-xl border border-graphite-200/80">
              <span className="font-bold text-graphite-700 flex items-center gap-1.5 mb-2">
                <Building className="w-3.5 h-3.5 text-oterio-600" />
                <span>Colores por Departamento:</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => {
                  const color = getDepartmentColor(dept.id, dept.name, dept.color);
                  return (
                    <span
                      key={dept.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${color.badgeSoft}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`}></span>
                      <span>{dept.name}</span>
                      <span className="text-[10px] text-graphite-400 font-normal">
                        ({color.name})
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPREADSHEET CONFIGURATION BAR: Group By & Density & Tip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-graphite-50 via-white to-oterio-50/40 rounded-2xl border border-graphite-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-graphite-800 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Table className="w-3.5 h-3.5 text-oterio-600" />
            <span>Encabezado de Columnas:</span>
          </span>

          {/* Toggle: Por Empleado vs Por Departamento */}
          <div className="inline-flex p-1 bg-white rounded-xl border border-graphite-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setColumnGroupBy('operario')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                columnGroupBy === 'operario'
                  ? 'bg-oterio-600 text-white shadow-2xs'
                  : 'text-graphite-600 hover:text-graphite-900 hover:bg-graphite-50'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Por Operario</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  columnGroupBy === 'operario'
                    ? 'bg-oterio-500 text-white'
                    : 'bg-graphite-100 text-graphite-600'
                }`}
              >
                {operatorColumns.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setColumnGroupBy('departamento')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                columnGroupBy === 'departamento'
                  ? 'bg-oterio-600 text-white shadow-2xs'
                  : 'text-graphite-600 hover:text-graphite-900 hover:bg-graphite-50'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Por Departamento</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  columnGroupBy === 'departamento'
                    ? 'bg-oterio-500 text-white'
                    : 'bg-graphite-100 text-graphite-600'
                }`}
              >
                {departmentColumns.length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Density toggle for spreadsheet */}
          {viewMode === 'spreadsheet' && (
            <button
              type="button"
              onClick={() => setIsCompact(!isCompact)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                isCompact
                  ? 'bg-oterio-50 text-oterio-700 border-oterio-200 font-bold'
                  : 'bg-white text-graphite-600 border-graphite-200 hover:bg-graphite-50'
              }`}
              title={isCompact ? 'Cambiar a celdas estándar' : 'Cambiar a celdas compactas (máxima vista)'}
            >
              {isCompact ? <Minimize2 className="w-3 h-3 text-oterio-600" /> : <Maximize2 className="w-3 h-3 text-graphite-500" />}
              <span>{isCompact ? 'Vista Compacta' : 'Vista Estándar'}</span>
            </button>
          )}

          <div className="text-[11px] text-graphite-500 font-medium hidden md:flex items-center gap-1">
            <span>Pincha en cualquier celda para abrir la orden.</span>
          </div>
        </div>
      </div>

      {/* ORDER BAR: Default Date Sort vs Operator Custom Reorder */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-graphite-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-graphite-700 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-oterio-600" />
            <span>Ordenación:</span>
          </span>

          <div className="inline-flex p-1 bg-graphite-100 rounded-xl border border-graphite-200">
            <button
              type="button"
              onClick={() => setSortCriteria('date')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                sortCriteria === 'date'
                  ? 'bg-white text-oterio-700 shadow-2xs border border-oterio-100'
                  : 'text-graphite-600 hover:text-graphite-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Por Fecha de Entrada (Predeterminado)</span>
            </button>

            <button
              type="button"
              onClick={() => setSortCriteria('operator_order')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                sortCriteria === 'operator_order'
                  ? 'bg-oterio-600 text-white shadow-2xs'
                  : 'text-graphite-600 hover:text-graphite-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Orden Personalizado</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {sortCriteria === 'date' ? (
            <button
              type="button"
              onClick={() => setDateDirection(dateDirection === 'desc' ? 'asc' : 'desc')}
              className="text-xs font-medium text-graphite-700 hover:text-oterio-600 bg-graphite-50 hover:bg-graphite-100 px-3 py-1.5 rounded-xl border border-graphite-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowUpDown className="w-3 h-3 text-graphite-400" />
              <span>
                {dateDirection === 'desc'
                  ? 'Más recientes primero'
                  : 'Más antiguas primero'}
              </span>
            </button>
          ) : canReorder ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-graphite-500 font-medium hidden lg:inline">
                Arrastra cualquier orden a la posición deseada (o usa ↑ / ↓)
              </span>
              <button
                type="button"
                onClick={handleResetToDate}
                title="Restablecer al orden por fecha"
                className="text-xs font-semibold text-graphite-600 hover:text-rose-600 bg-graphite-50 hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-graphite-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer a fecha</span>
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-medium">
              Modo consulta (solo lectura)
            </span>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-graphite-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-graphite-200 bg-graphite-50 text-graphite-700"
          >
            <option value="activos">Sólo Activos</option>
            {!isOperario && <option value="todos">Todos los Estados</option>}
            {!isOperario && <option value="completados">Sólo Terminados</option>}
            {statuses
              .filter((st) => !isOperario || !st.isCompleted)
              .map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-graphite-200 bg-graphite-50 text-graphite-700"
          >
            <option value="todos">Todos los Departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-graphite-200 bg-graphite-50 text-graphite-700"
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

          <button
            type="button"
            onClick={() => setOnlyUrgent(!onlyUrgent)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              onlyUrgent
                ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                : 'bg-graphite-50 border-graphite-200 text-graphite-600 hover:bg-graphite-100'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${onlyUrgent ? 'text-rose-600' : 'text-graphite-400'}`} />
            <span>Sólo Urgentes</span>
          </button>

          <button
            type="button"
            onClick={() => setOnlyAlerts(!onlyAlerts)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              onlyAlerts
                ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                : 'bg-graphite-50 border-graphite-200 text-graphite-600 hover:bg-graphite-100'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${onlyAlerts ? 'text-amber-600' : 'text-graphite-400'}`} />
            <span>Con Alertas</span>
          </button>

          {(searchTerm ||
            searchScope !== 'todos' ||
            statusFilter !== 'activos' ||
            departmentFilter !== 'todos' ||
            operatorFilter !== 'todos' ||
            onlyUrgent ||
            onlyAlerts) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSearchScope('todos');
                setStatusFilter('activos');
                setDepartmentFilter('todos');
                setOperatorFilter('todos');
                setOnlyUrgent(false);
                setOnlyAlerts(false);
              }}
              className="text-xs text-oterio-600 font-semibold hover:underline ml-auto cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Empty State OR View Mode */}
      {sortedJobs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-graphite-200 p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-graphite-100 text-graphite-400 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-graphite-900 text-base">
            {workOrders.length === 0 ? 'No hay partes de trabajo registrados' : 'No se encontraron partes de trabajo'}
          </h3>
          <p className="text-xs text-graphite-500 mt-1">
            {workOrders.length === 0
              ? 'Tu empresa está lista para empezar. Pulsa "Añadir Trabajo" arriba para crear la primera orden de trabajo manual o subiendo un PDF.'
              : 'Prueba a modificar los filtros o el término de búsqueda.'}
          </p>
        </div>
      ) : viewMode === 'spreadsheet' ? (
        /* =========================================================================
           SPREADSHEET VIEW (ESTRUCTURA REAL DE HOJA DE CÁLCULO: COLUMNAS Y FILAS)
           - Sin tarjetas: celdas compactas con mínima información.
           - Si columnas = Operario: cada celda muestra Cliente y Departamento (con color de dpto).
           - Si columnas = Departamento: cada celda muestra Operario (con color de operario) y Cliente.
           - Pinchar en celda abre la ficha de la orden.
           ========================================================================= */
        <div className="bg-white rounded-2xl border border-graphite-300 shadow-sm overflow-hidden flex flex-col">
          {/* Spreadsheet Header Banner */}
          <div className="px-4 py-2 bg-graphite-100 border-b border-graphite-300 flex items-center justify-between text-xs text-graphite-600">
            <div className="flex items-center gap-2">
              <span className="font-bold text-graphite-800">
                {columnGroupBy === 'operario'
                  ? 'Vista por Operario'
                  : 'Vista por Departamento'}
              </span>
              <span className="text-[11px] text-graphite-400">
                ({currentSpreadsheetColumns.length} columnas · {sortedJobs.length} trabajos)
              </span>
            </div>
            <div className="text-[11px] text-graphite-500">
              {columnGroupBy === 'operario'
                ? 'Celdas: [OT] · Cliente · Departamento'
                : 'Celdas: [OT] · Operario · Cliente'}
            </div>
          </div>

          {/* Spreadsheet Table Grid */}
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
            <table className="w-full border-collapse text-left table-fixed min-w-[700px]">
              {/* Column definitions */}
              <thead>
                {/* Excel Column Letters / Headers */}
                <tr className="bg-graphite-100 border-b border-graphite-300 sticky top-0 z-20 shadow-2xs">
                  {/* Top-Left Corner Cell */}
                  <th className="w-12 px-2 py-2 text-center text-[11px] font-mono font-bold text-graphite-500 border-r border-graphite-300 bg-graphite-200/80 sticky left-0 z-30 select-none">
                    #
                  </th>

                  {/* Header for each column (A, B, C...) */}
                  {currentSpreadsheetColumns.map((col) => (
                    <th
                      key={col.id}
                      className="min-w-[200px] w-64 max-w-[280px] p-0 border-r border-graphite-300 bg-graphite-100 font-semibold text-graphite-800 align-top"
                    >
                      {/* Top color indicator bar for column entity */}
                      <div
                        className="h-1.5 w-full"
                        style={{ backgroundColor: col.palette.hex }}
                      />

                      <div className="p-2 sm:p-2.5">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          {/* Column letter & Colored Badge */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-[11px] font-bold text-graphite-600 bg-graphite-200 px-1.5 py-0.2 rounded shrink-0">
                              {col.letter}
                            </span>
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: col.palette.hex }}
                              title={`Color: ${col.palette.name}`}
                            />
                            <h3
                              className="font-bold text-xs sm:text-sm text-graphite-900 truncate"
                              title={col.name}
                            >
                              {col.name}
                            </h3>
                          </div>

                          {/* Column items count badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0 tabular-nums ${
                              col.jobs.length > 0
                                ? 'bg-graphite-900 text-white'
                                : 'bg-graphite-200 text-graphite-500'
                            }`}
                          >
                            {col.jobs.length}
                          </span>
                        </div>

                        {/* Subtext info */}
                        <div className="flex items-center justify-between text-[10px] text-graphite-400">
                          <span className="truncate">{col.subtext}</span>
                          {col.jobs.filter((j) => j.isUrgent).length > 0 && (
                            <span className="text-rose-600 font-bold flex items-center gap-0.5">
                              <Flame className="w-2.5 h-2.5" />
                              {col.jobs.filter((j) => j.isUrgent).length} urg
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Rows */}
              <tbody className="divide-y divide-graphite-200">
                {Array.from({ length: totalSpreadsheetRows }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-graphite-50/40">
                    {/* Row Index Number Cell on the left */}
                    <td className="w-12 px-2 py-2 text-center font-mono text-[11px] font-semibold text-graphite-500 border-r border-b border-graphite-300 bg-graphite-100/90 sticky left-0 z-10 select-none">
                      {rowIndex + 1}
                    </td>

                    {/* Cells for each column */}
                    {currentSpreadsheetColumns.map((col) => {
                      const job = col.jobs[rowIndex];

                      // Empty spreadsheet cell
                      if (!job) {
                        return (
                          <td
                            key={col.id}
                            className="border-r border-b border-graphite-200/90 bg-graphite-50/15 p-2 text-center text-graphite-300 select-none"
                          >
                            <span className="text-[10px] opacity-25">·</span>
                          </td>
                        );
                      }

                      // Filled cell: minimal information as requested
                      const status = getStatus(job.statusId);
                      const deptName = getDepartmentName(job.departmentId);
                      const deptColor = getDepartmentColor(job.departmentId, deptName);
                      const assignedOp = getUser(job.assignedOperatorId);
                      const opColor = getOperatorColor(
                        job.assignedOperatorId,
                        assignedOp?.name,
                        assignedOp?.color
                      );
                      const colScopeId = `sheet-${columnGroupBy}-${col.id}`;
                      const colJobIds = col.jobs.map((j) => j.id);
                      const isDraggingThis = draggedJobId === job.id;
                      const dropIndicator = getDropIndicator(job.id, colScopeId);

                      return (
                        <td
                          key={col.id}
                          {...getDragItemProps(job, colScopeId, colJobIds, rowIndex)}
                          onClick={() => {
                            if (shouldSuppressClick()) return;
                            onOpenJobDetail(job);
                          }}
                          tabIndex={0}
                          role="button"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpenJobDetail(job);
                            }
                          }}
                          className={`border-r border-b border-graphite-300 transition-all relative group focus:outline-hidden focus:ring-2 focus:ring-oterio-500 hover:z-10 ${
                            canReorder && colJobIds.length > 1
                              ? 'cursor-grab active:cursor-grabbing'
                              : 'cursor-pointer'
                          } ${isCompact ? 'p-2' : 'p-2.5'} ${
                            isDraggingThis
                              ? 'opacity-45 bg-oterio-50/70 ring-2 ring-oterio-400'
                              : dropIndicator === 'before'
                              ? 'bg-oterio-50/80 ring-2 ring-oterio-500 shadow-[inset_0_4px_0_0_#ea580c] z-10'
                              : dropIndicator === 'after'
                              ? 'bg-oterio-50/80 ring-2 ring-oterio-500 shadow-[inset_0_-4px_0_0_#ea580c] z-10'
                              : status?.isCompleted
                              ? 'bg-emerald-50/35 hover:bg-emerald-50/75 hover:ring-2 hover:ring-emerald-400'
                              : job.isUrgent
                              ? 'bg-rose-50/30 hover:bg-rose-50/80 hover:ring-2 hover:ring-rose-400'
                              : 'bg-white hover:bg-oterio-50/50 hover:ring-2 hover:ring-oterio-500'
                          }`}
                        >
                          {/* SPREADSHEET CELL CONTENT (MINIMAL INFO) */}
                          <div className="flex flex-col gap-1">
                            {/* Line 1: Drag Handle + OT Tag & Urgent / Status indicators */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 min-w-0">
                                {canReorder && colJobIds.length > 1 && (
                                  <span
                                    {...getTouchHandleProps(job, colScopeId, colJobIds, rowIndex)}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Arrastra para cambiar de posición"
                                    className="touch-none p-0.5 -ml-0.5 text-graphite-400 hover:text-oterio-600 cursor-grab active:cursor-grabbing shrink-0"
                                  >
                                    <GripVertical className="w-3 h-3" />
                                  </span>
                                )}
                                <span className="font-mono text-[11px] font-bold text-graphite-900 bg-graphite-100 px-1.5 py-0.2 rounded border border-graphite-200 shrink-0">
                                  {job.ot}
                                </span>

                                {job.isUrgent && (
                                  <span
                                    className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-100 px-1 py-0.2 rounded shrink-0"
                                    title="Trabajo Urgente"
                                  >
                                    <Flame className="w-2.5 h-2.5 mr-0.5 text-rose-600" />
                                    Urg
                                  </span>
                                )}

                                {job.timer?.isRunning ? (
                                  <span
                                    className="inline-flex items-center text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded shrink-0"
                                    title="Cronómetro en marcha"
                                  >
                                    <Timer className="w-2.5 h-2.5 mr-0.5 animate-pulse text-emerald-600" />
                                    ON
                                  </span>
                                ) : job.timer?.totalSeconds ? (
                                  <span
                                    className="inline-flex items-center text-[9px] font-semibold text-graphite-700 bg-graphite-100 border border-graphite-200 px-1 py-0.2 rounded shrink-0"
                                    title={`Tiempo cronometrado: ${formatSecondsToHuman(job.timer.totalSeconds)}`}
                                  >
                                    <Timer className="w-2.5 h-2.5 mr-0.5 text-graphite-500" />
                                    {formatSecondsToHuman(job.timer.totalSeconds)}
                                  </span>
                                ) : null}

                                {job.alerts.length > 0 && (
                                  <span
                                    className="p-0.5 text-amber-600 rounded bg-amber-50"
                                    title={`${job.alerts.length} alertas`}
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>

                              {/* Status dot or tiny indicator + Admin Delete icon */}
                              <div className="flex items-center gap-1 shrink-0">
                                <span
                                  className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full ${
                                    status?.isCompleted
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-graphite-100 text-graphite-700'
                                  }`}
                                >
                                  {status?.name || 'En curso'}
                                </span>
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
                                    className="p-1 rounded-md text-graphite-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40"
                                  >
                                    {isDeletingId === job.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-rose-600" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Line 2 & 3 depending on Column Group */}
                            {columnGroupBy === 'operario' ? (
                              /* ========================================================
                                 MODE: POR OPERARIO
                                 Cell must show: CLIENTE and DEPARTAMENTO (with dept color)
                                 ======================================================== */
                              <>
                                {/* Cliente */}
                                <div
                                  className="font-bold text-graphite-900 text-xs truncate group-hover:text-oterio-700 transition-colors"
                                  title={`Cliente: ${job.client}`}
                                >
                                  {job.client}
                                </div>

                                {/* Departamento al que pertenece con color de dpto */}
                                <div className="flex items-center justify-between gap-1 mt-0.5">
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border truncate max-w-[170px] ${deptColor.badgeSoft}`}
                                    title={`Departamento: ${deptName}`}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full shrink-0"
                                      style={{ backgroundColor: deptColor.hex }}
                                    />
                                    <Building className="w-2.5 h-2.5 opacity-75 shrink-0" />
                                    <span className="truncate">{deptName}</span>
                                  </span>

                                  {/* Custom priority reposition arrows (all roles except solo_lectura) */}
                                  {canReorder && col.jobs.length > 1 && (
                                    <div
                                      className="opacity-100 sm:opacity-75 sm:group-hover:opacity-100 flex items-center bg-white border border-graphite-200 rounded p-0.5 shadow-2xs transition-opacity shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        disabled={rowIndex === 0}
                                        onClick={() =>
                                          handleReorder(
                                            job.id,
                                            'up',
                                            col.jobs.map((j) => j.id)
                                          )
                                        }
                                        title="Subir prioridad"
                                        aria-label={`Subir prioridad de ${job.ot}`}
                                        className="p-0.5 text-graphite-600 hover:text-oterio-600 hover:bg-oterio-50 rounded disabled:opacity-20 cursor-pointer"
                                      >
                                        <ChevronUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rowIndex === col.jobs.length - 1}
                                        onClick={() =>
                                          handleReorder(
                                            job.id,
                                            'down',
                                            col.jobs.map((j) => j.id)
                                          )
                                        }
                                        title="Bajar prioridad"
                                        aria-label={`Bajar prioridad de ${job.ot}`}
                                        className="p-0.5 text-graphite-600 hover:text-oterio-600 hover:bg-oterio-50 rounded disabled:opacity-20 cursor-pointer"
                                      >
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              /* ========================================================
                                 MODE: POR DEPARTAMENTO
                                 Cell must show: OPERARIO (with operator color) and CLIENTE
                                 ======================================================== */
                              <>
                                {/* Operario asignado con color de operario */}
                                <div className="flex items-center justify-between gap-1">
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border truncate max-w-[170px] ${opColor.badgeSoft}`}
                                    title={`Operario: ${assignedOp ? assignedOp.name : 'Sin Asignar'}`}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full shrink-0"
                                      style={{ backgroundColor: opColor.hex }}
                                    />
                                    <User className="w-2.5 h-2.5 opacity-75 shrink-0" />
                                    <span className="truncate">
                                      {assignedOp ? assignedOp.name : 'Sin Asignar'}
                                    </span>
                                  </span>

                                  {/* Custom priority reposition arrows (all roles except solo_lectura) */}
                                  {canReorder && col.jobs.length > 1 && (
                                    <div
                                      className="opacity-100 sm:opacity-75 sm:group-hover:opacity-100 flex items-center bg-white border border-graphite-200 rounded p-0.5 shadow-2xs transition-opacity shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        disabled={rowIndex === 0}
                                        onClick={() =>
                                          handleReorder(
                                            job.id,
                                            'up',
                                            col.jobs.map((j) => j.id)
                                          )
                                        }
                                        title="Subir prioridad"
                                        aria-label={`Subir prioridad de ${job.ot}`}
                                        className="p-0.5 text-graphite-600 hover:text-oterio-600 hover:bg-oterio-50 rounded disabled:opacity-20 cursor-pointer"
                                      >
                                        <ChevronUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rowIndex === col.jobs.length - 1}
                                        onClick={() =>
                                          handleReorder(
                                            job.id,
                                            'down',
                                            col.jobs.map((j) => j.id)
                                          )
                                        }
                                        title="Bajar prioridad"
                                        aria-label={`Bajar prioridad de ${job.ot}`}
                                        className="p-0.5 text-graphite-600 hover:text-oterio-600 hover:bg-oterio-50 rounded disabled:opacity-20 cursor-pointer"
                                      >
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Cliente */}
                                <div
                                  className="font-bold text-graphite-900 text-xs truncate group-hover:text-oterio-700 transition-colors mt-0.5"
                                  title={`Cliente: ${job.client}`}
                                >
                                  {job.client}
                                </div>
                              </>
                            )}

                            {/* Additional glance indicators: Date snippet if standard density */}
                            {!isCompact && (
                              <div className="flex items-center justify-between text-[10px] text-graphite-400 pt-1 border-t border-graphite-100">
                                <span>{formatDate(job.createdAt)}</span>
                                <div className="flex items-center gap-1.5">
                                  {job.timer?.totalSeconds ? (
                                    <span className="text-graphite-600 font-semibold flex items-center gap-0.5">
                                      <Timer className="w-2.5 h-2.5 text-oterio-600" />
                                      {formatSecondsToHuman(job.timer.totalSeconds)}
                                    </span>
                                  ) : null}
                                  {job.pdfAttachment && (
                                    <span className="text-oterio-600 font-bold">PDF</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* =========================================================================
           GRID VIEW (TARJETAS INDIVIDUALES)
           ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedJobs.map((job, index) => {
            const status = getStatus(job.statusId);
            const deptName = getDepartmentName(job.departmentId);
            const assignedOp = getUser(job.assignedOperatorId);
            const deptColor = getDepartmentColor(job.departmentId, deptName);
            const opColor = getOperatorColor(
              job.assignedOperatorId,
              assignedOp?.name,
              assignedOp?.color
            );

            const gridScopeId = 'jobs-grid';
            const gridJobIds = sortedJobs.map((j) => j.id);
            const isDraggingThis = draggedJobId === job.id;
            const dropIndicator = getDropIndicator(job.id, gridScopeId);

            return (
              <div
                key={job.id}
                {...getDragItemProps(job, gridScopeId, gridJobIds, index)}
                onClick={() => {
                  if (shouldSuppressClick()) return;
                  onOpenJobDetail(job);
                }}
                className={`group relative bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                  canReorder && gridJobIds.length > 1
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-pointer'
                } ${
                  isDraggingThis
                    ? 'opacity-45 border-dashed border-oterio-400 ring-2 ring-oterio-300 scale-[0.98]'
                    : dropIndicator
                    ? 'border-oterio-500 ring-2 ring-oterio-500 bg-oterio-50/40'
                    : 'border-graphite-200/90 hover:border-oterio-300'
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
                    <div className="flex items-center gap-2">
                      {canReorder && gridJobIds.length > 1 && (
                        <span
                          {...getTouchHandleProps(job, gridScopeId, gridJobIds, index)}
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
                      {job.isUrgent && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <Flame className="w-3 h-3 text-rose-600" /> Urgente
                        </span>
                      )}
                      {sortCriteria === 'operator_order' && (
                        <span className="px-2 py-0.5 rounded-md bg-oterio-50 text-oterio-700 font-mono text-[11px] font-bold border border-oterio-200">
                          #{index + 1}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          status?.isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-oterio-50 text-oterio-700 border border-oterio-200'
                        }`}
                      >
                        {status?.name || 'Estado'}
                      </span>

                      {canReorder && (
                        <div
                          className="flex items-center bg-graphite-100 rounded-lg p-0.5 border border-graphite-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() =>
                              handleReorder(
                                job.id,
                                'up',
                                sortedJobs.map((j) => j.id)
                              )
                            }
                            title="Subir prioridad"
                            aria-label={`Subir prioridad de ${job.ot}`}
                            className="p-1 rounded text-graphite-600 hover:text-oterio-600 hover:bg-white disabled:opacity-20 cursor-pointer"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === sortedJobs.length - 1}
                            onClick={() =>
                              handleReorder(
                                job.id,
                                'down',
                                sortedJobs.map((j) => j.id)
                              )
                            }
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

                  <h3 className="font-bold text-graphite-900 text-base mb-1.5 group-hover:text-oterio-600 transition-colors">
                    {job.client}
                  </h3>

                  <div className="space-y-1.5 text-xs text-graphite-500 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${deptColor.badgeSoft}`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: deptColor.hex }}
                        />
                        <Building className="w-3.5 h-3.5 opacity-80" />
                        <span>{deptName}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${opColor.badgeSoft}`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: opColor.hex }}
                        />
                        <User className="w-3.5 h-3.5 opacity-80" />
                        <span>{assignedOp ? assignedOp.name : 'Sin asignar'}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                      <div className="flex items-center gap-1 text-graphite-600 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-oterio-600 shrink-0" />
                        <span>Entrada: {formatDate(job.createdAt)}</span>
                      </div>

                      {job.deliveryDate && (
                        <div className="flex items-center gap-1 text-graphite-600 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Entrega: {formatDate(job.deliveryDate)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-graphite-500 pt-1 border-t border-graphite-100">
                      <Users className="w-3.5 h-3.5 text-oterio-600 shrink-0" />
                      <span className="truncate">
                        Creado por <strong className="text-graphite-800">{job.createdByName || 'Administrador'}</strong>
                        {job.participantsHistory && job.participantsHistory.length > 1 && (
                          <span className="text-oterio-600 font-semibold"> · {job.participantsHistory.length} registros</span>
                        )}
                      </span>
                    </div>

                    {(job.timer?.totalSeconds || job.timer?.isRunning) && (
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-graphite-100">
                        <span className="text-graphite-500 flex items-center gap-1 font-medium">
                          <Timer className={`w-3.5 h-3.5 ${job.timer?.isRunning ? 'text-emerald-600 animate-pulse' : 'text-graphite-400'}`} />
                          <span>Tiempo cronometrado:</span>
                        </span>
                        <strong className={job.timer?.isRunning ? 'text-emerald-600 font-bold' : 'text-graphite-900 font-mono font-bold tabular-nums'}>
                          {job.timer?.isRunning ? 'En marcha' : formatSecondsToHuman(job.timer?.totalSeconds || 0)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {job.alerts.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {job.alerts.map((al) => (
                        <div
                          key={al.id}
                          className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50/90 border border-amber-200 px-2.5 py-1 rounded-lg"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="font-medium truncate">{al.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-graphite-100 text-xs">
                  {job.pdfAttachment ? (
                    <div className="flex items-center gap-1 text-oterio-700 font-semibold bg-oterio-50/80 px-2 py-0.5 rounded-md">
                      <FileText className="w-3.5 h-3.5 text-oterio-600" />
                      <span className="truncate max-w-[130px]">{job.pdfAttachment.name}</span>
                    </div>
                  ) : (
                    <span className="text-graphite-400 text-[11px]">Sin archivo adjunto</span>
                  )}

                  <span className="text-oterio-600 font-bold group-hover:translate-x-0.5 transition-transform">
                    {currentUser.role === 'solo_lectura' ? 'Ver detalles' : 'Gestionar'} &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* =========================================================================
           TABLE VIEW (LISTA TRADICIONAL)
           ========================================================================= */
        <div className="bg-white rounded-2xl border border-graphite-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-graphite-50 border-b border-graphite-200 text-graphite-500 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  {canReorder && <th className="px-3 py-3 text-center">Prioridad</th>}
                  <th className="px-4 py-3">OT</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha Entrada</th>
                  <th className="px-4 py-3">Entrega</th>
                  <th className="px-4 py-3">Departamento</th>
                  <th className="px-4 py-3">Operario</th>
                  <th className="px-4 py-3">Historial</th>
                  <th className="px-4 py-3">Tiempo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Alertas</th>
                  <th className="px-4 py-3">PDF</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-100 text-graphite-700">
                {sortedJobs.map((job, index) => {
                  const status = getStatus(job.statusId);
                  const deptName = getDepartmentName(job.departmentId);
                  const assignedOp = getUser(job.assignedOperatorId);
                  const deptColor = getDepartmentColor(job.departmentId, deptName);
                  const opColor = getOperatorColor(
                    job.assignedOperatorId,
                    assignedOp?.name,
                    assignedOp?.color
                  );

                  const tableScopeId = 'jobs-table';
                  const tableJobIds = sortedJobs.map((j) => j.id);
                  const isDraggingThis = draggedJobId === job.id;
                  const dropIndicator = getDropIndicator(job.id, tableScopeId);

                  return (
                    <tr
                      key={job.id}
                      {...getDragItemProps(job, tableScopeId, tableJobIds, index)}
                      onClick={() => {
                        if (shouldSuppressClick()) return;
                        onOpenJobDetail(job);
                      }}
                      className={`transition-colors ${
                        canReorder && tableJobIds.length > 1
                          ? 'cursor-grab active:cursor-grabbing'
                          : 'cursor-pointer'
                      } ${
                        isDraggingThis
                          ? 'opacity-45 bg-oterio-50/70'
                          : dropIndicator === 'before'
                          ? 'bg-oterio-50/80 shadow-[inset_0_3px_0_0_#ea580c]'
                          : dropIndicator === 'after'
                          ? 'bg-oterio-50/80 shadow-[inset_0_-3px_0_0_#ea580c]'
                          : 'hover:bg-graphite-50/80'
                      }`}
                    >
                      {canReorder && (
                        <td
                          className="px-3 py-3 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1 bg-graphite-50 px-1 py-0.5 rounded-lg border border-graphite-200">
                            {tableJobIds.length > 1 && (
                              <span
                                {...getTouchHandleProps(job, tableScopeId, tableJobIds, index)}
                                title="Arrastra para mover a otra posición"
                                className="touch-none p-0.5 text-graphite-400 hover:text-oterio-600 cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <span className="font-mono text-[10px] font-bold text-graphite-500 px-1 tabular-nums">
                              #{index + 1}
                            </span>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() =>
                                handleReorder(
                                  job.id,
                                  'up',
                                  sortedJobs.map((j) => j.id)
                                )
                              }
                              title="Subir posición"
                              aria-label={`Subir prioridad de ${job.ot}`}
                              className="p-0.5 rounded text-graphite-600 hover:text-oterio-600 hover:bg-white disabled:opacity-20 cursor-pointer"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === sortedJobs.length - 1}
                              onClick={() =>
                                handleReorder(
                                  job.id,
                                  'down',
                                  sortedJobs.map((j) => j.id)
                                )
                              }
                              title="Bajar posición"
                              aria-label={`Bajar prioridad de ${job.ot}`}
                              className="p-0.5 rounded text-graphite-600 hover:text-oterio-600 hover:bg-white disabled:opacity-20 cursor-pointer"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      )}

                      <td className="px-4 py-3 font-mono font-bold text-graphite-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {job.ot}
                          {job.isUrgent && (
                            <span className="p-0.5 rounded bg-rose-100 text-rose-700" title="Urgente">
                              <Flame className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-medium text-graphite-900 whitespace-nowrap">
                        {job.client}
                      </td>

                      <td className="px-4 py-3 font-medium text-graphite-600 whitespace-nowrap tabular-nums">
                        {formatDate(job.createdAt)}
                      </td>

                      <td className="px-4 py-3 text-graphite-500 whitespace-nowrap tabular-nums">
                        {job.deliveryDate ? formatDate(job.deliveryDate) : '-'}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${deptColor.badgeSoft}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: deptColor.hex }}
                          />
                          <span>{deptName}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${opColor.badgeSoft}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: opColor.hex }}
                          />
                          <span>{assignedOp ? assignedOp.name : 'Sin asignar'}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-graphite-800">{job.createdByName || 'Admin'}</span>
                          {job.participantsHistory && job.participantsHistory.length > 1 && (
                            <span
                              className="px-1.5 py-0.5 rounded-full bg-oterio-50 text-oterio-700 font-bold text-[10px] border border-oterio-200"
                              title="Historial de pases"
                            >
                              +{job.participantsHistory.length - 1}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tiempo cronometrado */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        {job.timer?.isRunning ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <Timer className="w-3 h-3 text-emerald-600 animate-pulse" />
                            En marcha
                          </span>
                        ) : job.timer?.totalSeconds ? (
                          <span className="inline-flex items-center gap-1 text-graphite-700 font-mono font-medium tabular-nums">
                            <Timer className="w-3 h-3 text-graphite-400" />
                            {formatSecondsToHuman(job.timer.totalSeconds)}
                          </span>
                        ) : (
                          <span className="text-graphite-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            status?.isCompleted
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-oterio-50 text-oterio-700'
                          }`}
                        >
                          {status?.name}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {job.alerts.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-bold">
                            <AlertTriangle className="w-3 h-3" /> {job.alerts.length}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {job.pdfAttachment ? (
                          <span className="text-oterio-600 font-semibold inline-flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </span>
                        ) : (
                          <span className="text-graphite-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenJobDetail(job);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-oterio-600 hover:text-oterio-800 hover:bg-oterio-50 rounded-lg transition-colors cursor-pointer"
                          >
                            Abrir
                          </button>
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating touch drag preview pill for mobile/tablet */}
      {touchPreview && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full px-3 py-1.5 rounded-xl bg-oterio-600 text-white text-xs font-bold shadow-lg border border-oterio-400 flex items-center gap-1.5"
          style={{ left: touchPreview.x, top: Math.max(24, touchPreview.y - 14) }}
        >
          <GripVertical className="w-3.5 h-3.5 opacity-80" />
          <span className="truncate max-w-[220px]">{touchPreview.label}</span>
        </div>
      )}

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
};
