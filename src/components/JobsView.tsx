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
} from 'lucide-react';
import {
  getOperatorColor,
  getDepartmentColor,
  getUnassignedPalette,
} from '../utils/colorUtils';
import { formatSecondsToHuman } from '../utils/timeUtils';

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
    resetWorkOrdersOrderToDate,
  } = useApp();

  const isAdmin = currentUser?.role === 'administrador';
  const isOperario = currentUser?.role === 'operario';
  const isAdministrativo = currentUser?.role === 'administrativo';
  const canCreate = isAdmin || isAdministrativo;
  const canReorder = isAdmin || isOperario || isAdministrativo;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
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

  // Sorting: by default ordered by date ('date'); operator can reposition ('operator_order')
  const [sortCriteria, setSortCriteria] = useState<'date' | 'operator_order'>('date');
  const [dateDirection, setDateDirection] = useState<'desc' | 'asc'>('desc');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

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

  // Filter logic
  const filteredJobs = workOrders.filter((wo) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchOt = wo.ot.toLowerCase().includes(q);
      const matchClient = wo.client.toLowerCase().includes(q);
      const matchNotes = wo.notes.toLowerCase().includes(q);
      const matchAlerts = wo.alerts.some((a) => a.text.toLowerCase().includes(q));
      if (!matchOt && !matchClient && !matchNotes && !matchAlerts) return false;
    }

    if (statusFilter !== 'todos') {
      if (statusFilter === 'completados') {
        const s = getStatus(wo.statusId);
        if (!s?.isCompleted) return false;
      } else if (statusFilter === 'activos') {
        const s = getStatus(wo.statusId);
        if (s?.isCompleted) return false;
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

  const handleReorder = (jobId: string, direction: 'up' | 'down') => {
    if (!canReorder) return;
    if (sortCriteria !== 'operator_order') {
      setSortCriteria('operator_order');
    }
    const res = reorderWorkOrder(jobId, direction);
    if (res.success) {
      setFeedbackNotice(
        direction === 'up'
          ? 'Prioridad del trabajo aumentada (orden de operario actualizado)'
          : 'Posición del trabajo reducida (orden de operario actualizado)'
      );
      setTimeout(() => setFeedbackNotice(null), 3000);
    }
  };

  const handleResetToDate = () => {
    resetWorkOrdersOrderToDate();
    setSortCriteria('date');
    setDateDirection('desc');
    setFeedbackNotice('Trabajos restablecidos al orden por fecha de creación.');
    setTimeout(() => setFeedbackNotice(null), 3000);
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
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Órdenes de Trabajo (OT)
            </h2>
            {isAdmin ? (
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200">
                Vista Administrador
              </span>
            ) : isAdministrativo ? (
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200">
                Vista Administrativo
              </span>
            ) : null}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {sortedJobs.length} órdenes en vista
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Columnas / Tarjetas / Tabla */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              onClick={() => setViewMode('spreadsheet')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'spreadsheet'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100'
                  : 'text-slate-600 hover:text-slate-900'
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
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Ver leyenda de colores asignados a operarios y departamentos"
          >
            <Palette className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Colores</span>
          </button>

          {/* New Work Order button (Admin & Administrativo) */}
          {canCreate && (
            <button
              onClick={onOpenNewJobModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-bold hover:bg-indigo-700 active:scale-95 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Trabajo</span>
            </button>
          )}
        </div>
      </div>

      {/* Reorder feedback notice */}
      {feedbackNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{feedbackNotice}</span>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* =========================================================================
         RESUMEN DE UN VISTAZO (AT-A-GLANCE EXECUTIVE STRIP)
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Key Totals */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>De un vistazo:</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-semibold border border-slate-200">
              <strong className="text-slate-900 font-mono">{sortedJobs.length}</strong> OTs Totales
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              <strong className="font-mono">{activeJobsCount}</strong> Activas
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <strong className="font-mono">{completedJobsCount}</strong> Terminadas
            </span>

            {urgentJobsCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold border border-rose-200">
                <Flame className="w-3 h-3 text-rose-600" />
                <strong className="font-mono">{urgentJobsCount}</strong> Urgentes
              </span>
            )}

            {alertsCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <strong className="font-mono">{alertsCount}</strong> Con Alertas
              </span>
            )}
          </div>

          {/* Quick Column Badges Summary */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <span className="text-[11px] font-medium text-slate-400 shrink-0 hidden sm:inline">
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
                  <span className="font-mono font-bold text-[10px] bg-white/70 px-1 rounded">
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
        <div className="p-4 bg-white rounded-2xl border border-indigo-200 shadow-xs animate-in fade-in duration-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Identificación de Colores Asignados
              </h4>
            </div>
            <button
              onClick={() => setShowColorLegend(false)}
              className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Operators color legend */}
            <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
              <span className="font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                <User className="w-3.5 h-3.5 text-indigo-600" />
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
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({color.name})
                        </span>
                      </span>
                    );
                  })}
              </div>
            </div>

            {/* Departments color legend */}
            <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
              <span className="font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                <Building className="w-3.5 h-3.5 text-indigo-600" />
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
                      <span className="text-[10px] text-slate-400 font-normal">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Table className="w-3.5 h-3.5 text-indigo-600" />
            <span>Encabezado de Columnas:</span>
          </span>

          {/* Toggle: Por Empleado vs Por Departamento */}
          <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setColumnGroupBy('operario')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                columnGroupBy === 'operario'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Por Operario</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  columnGroupBy === 'operario'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-600'
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
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Por Departamento</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  columnGroupBy === 'departamento'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-600'
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
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title={isCompact ? 'Cambiar a celdas estándar' : 'Cambiar a celdas compactas (máxima vista)'}
            >
              {isCompact ? <Minimize2 className="w-3 h-3 text-indigo-600" /> : <Maximize2 className="w-3 h-3 text-slate-500" />}
              <span>{isCompact ? 'Vista Compacta' : 'Vista Estándar'}</span>
            </button>
          )}

          <div className="text-[11px] text-slate-500 font-medium hidden md:flex items-center gap-1">
            <span>🖱️ Pincha en cualquier celda para abrir la orden.</span>
          </div>
        </div>
      </div>

      {/* ORDER BAR: Default Date Sort vs Operator Custom Reorder */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
            <span>Ordenación:</span>
          </span>

          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSortCriteria('date')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                sortCriteria === 'date'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Criterio del Operario</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {sortCriteria === 'date' ? (
            <button
              type="button"
              onClick={() => setDateDirection(dateDirection === 'desc' ? 'asc' : 'desc')}
              className="text-xs font-medium text-slate-700 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <span>
                {dateDirection === 'desc'
                  ? 'Más recientes primero'
                  : 'Más antiguas primero'}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-medium hidden lg:inline">
                Flechas ↑ y ↓ en cada orden para ajustar prioridad
              </span>
              <button
                type="button"
                onClick={handleResetToDate}
                title="Restablecer al orden por fecha"
                className="text-xs font-semibold text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer a fecha</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por OT, cliente, notas o alertas..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
          >
            <option value="todos">Todos los Estados</option>
            <option value="activos">Sólo Activos</option>
            <option value="completados">Sólo Terminados</option>
            {statuses.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
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
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
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
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${onlyUrgent ? 'text-rose-600' : 'text-slate-400'}`} />
            <span>Sólo Urgentes</span>
          </button>

          <button
            type="button"
            onClick={() => setOnlyAlerts(!onlyAlerts)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              onlyAlerts
                ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${onlyAlerts ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>Con Alertas</span>
          </button>

          {(searchTerm ||
            statusFilter !== 'todos' ||
            departmentFilter !== 'todos' ||
            operatorFilter !== 'todos' ||
            onlyUrgent ||
            onlyAlerts) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('todos');
                setDepartmentFilter('todos');
                setOperatorFilter('todos');
                setOnlyUrgent(false);
                setOnlyAlerts(false);
              }}
              className="text-xs text-indigo-600 font-semibold hover:underline ml-auto cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Empty State OR View Mode */}
      {sortedJobs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">
            {workOrders.length === 0 ? 'No hay partes de trabajo registrados' : 'No se encontraron partes de trabajo'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {workOrders.length === 0
              ? 'Tu empresa está lista para empezar. Crea la primera orden de trabajo manual o subiendo un plano PDF.'
              : 'Prueba a modificar los filtros o el término de búsqueda.'}
          </p>
          {canCreate && (
            <button
              onClick={onOpenNewJobModal}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
            >
              Crear nueva OT
            </button>
          )}
        </div>
      ) : viewMode === 'spreadsheet' ? (
        /* =========================================================================
           SPREADSHEET VIEW (ESTRUCTURA REAL DE HOJA DE CÁLCULO: COLUMNAS Y FILAS)
           - Sin tarjetas: celdas compactas con mínima información.
           - Si columnas = Operario: cada celda muestra Cliente y Departamento (con color de dpto).
           - Si columnas = Departamento: cada celda muestra Operario (con color de operario) y Cliente.
           - Pinchar en celda abre la ficha de la orden.
           ========================================================================= */
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden flex flex-col">
          {/* Spreadsheet Header Banner */}
          <div className="px-4 py-2 bg-slate-100 border-b border-slate-300 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">
                {columnGroupBy === 'operario'
                  ? 'Vista por Operario'
                  : 'Vista por Departamento'}
              </span>
              <span className="text-[11px] text-slate-400">
                ({currentSpreadsheetColumns.length} columnas · {sortedJobs.length} trabajos)
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
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
                <tr className="bg-slate-100 border-b border-slate-300 sticky top-0 z-20 shadow-2xs">
                  {/* Top-Left Corner Cell */}
                  <th className="w-12 px-2 py-2 text-center text-[11px] font-mono font-bold text-slate-500 border-r border-slate-300 bg-slate-200/80 sticky left-0 z-30 select-none">
                    #
                  </th>

                  {/* Header for each column (A, B, C...) */}
                  {currentSpreadsheetColumns.map((col) => (
                    <th
                      key={col.id}
                      className="min-w-[200px] w-64 max-w-[280px] p-0 border-r border-slate-300 bg-slate-100 font-semibold text-slate-800 align-top"
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
                            <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.2 rounded shrink-0">
                              {col.letter}
                            </span>
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: col.palette.hex }}
                              title={`Color: ${col.palette.name}`}
                            />
                            <h3
                              className="font-bold text-xs sm:text-sm text-slate-900 truncate"
                              title={col.name}
                            >
                              {col.name}
                            </h3>
                          </div>

                          {/* Column items count badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0 ${
                              col.jobs.length > 0
                                ? 'bg-slate-800 text-white'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {col.jobs.length}
                          </span>
                        </div>

                        {/* Subtext info */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
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
              <tbody className="divide-y divide-slate-200">
                {Array.from({ length: totalSpreadsheetRows }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50/40">
                    {/* Row Index Number Cell on the left */}
                    <td className="w-12 px-2 py-2 text-center font-mono text-[11px] font-semibold text-slate-500 border-r border-b border-slate-300 bg-slate-100/90 sticky left-0 z-10 select-none">
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
                            className="border-r border-b border-slate-200/90 bg-slate-50/15 p-2 text-center text-slate-300 select-none"
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

                      return (
                        <td
                          key={col.id}
                          onClick={() => onOpenJobDetail(job)}
                          tabIndex={0}
                          role="button"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpenJobDetail(job);
                            }
                          }}
                          className={`border-r border-b border-slate-300 transition-all cursor-pointer relative group focus:outline-hidden focus:ring-2 focus:ring-indigo-500 hover:z-10 ${
                            isCompact ? 'p-2' : 'p-2.5'
                          } ${
                            job.isUrgent
                              ? 'bg-rose-50/30 hover:bg-rose-50/80 hover:ring-2 hover:ring-rose-400'
                              : 'bg-white hover:bg-indigo-50/60 hover:ring-2 hover:ring-indigo-500'
                          }`}
                        >
                          {/* SPREADSHEET CELL CONTENT (MINIMAL INFO) */}
                          <div className="flex flex-col gap-1">
                            {/* Line 1: OT Tag & Urgent / Status indicators */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
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
                                    className="inline-flex items-center text-[9px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded shrink-0"
                                    title={`Tiempo cronometrado: ${formatSecondsToHuman(job.timer.totalSeconds)}`}
                                  >
                                    <Timer className="w-2.5 h-2.5 mr-0.5 text-slate-500" />
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

                              {/* Status dot or tiny indicator */}
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full shrink-0 ${
                                  status?.isCompleted
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {status?.name || 'En curso'}
                              </span>
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
                                  className="font-bold text-slate-900 text-xs truncate group-hover:text-indigo-700 transition-colors"
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

                                  {/* Operator reposition arrow if in operator order mode */}
                                  {canReorder && sortCriteria === 'operator_order' && (
                                    <div
                                      className="opacity-0 group-hover:opacity-100 flex items-center bg-white border border-slate-200 rounded p-0.5 shadow-2xs transition-opacity"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        disabled={rowIndex === 0}
                                        onClick={() => handleReorder(job.id, 'up')}
                                        title="Subir prioridad"
                                        className="p-0.5 text-slate-500 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                                      >
                                        <ChevronUp className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rowIndex === col.jobs.length - 1}
                                        onClick={() => handleReorder(job.id, 'down')}
                                        title="Bajar prioridad"
                                        className="p-0.5 text-slate-500 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                                      >
                                        <ChevronDown className="w-2.5 h-2.5" />
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

                                  {/* Operator reposition arrow if in operator order mode */}
                                  {canReorder && sortCriteria === 'operator_order' && (
                                    <div
                                      className="opacity-0 group-hover:opacity-100 flex items-center bg-white border border-slate-200 rounded p-0.5 shadow-2xs transition-opacity"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        disabled={rowIndex === 0}
                                        onClick={() => handleReorder(job.id, 'up')}
                                        title="Subir prioridad"
                                        className="p-0.5 text-slate-500 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                                      >
                                        <ChevronUp className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rowIndex === col.jobs.length - 1}
                                        onClick={() => handleReorder(job.id, 'down')}
                                        title="Bajar prioridad"
                                        className="p-0.5 text-slate-500 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                                      >
                                        <ChevronDown className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Cliente */}
                                <div
                                  className="font-bold text-slate-900 text-xs truncate group-hover:text-indigo-700 transition-colors mt-0.5"
                                  title={`Cliente: ${job.client}`}
                                >
                                  {job.client}
                                </div>
                              </>
                            )}

                            {/* Additional glance indicators: Date snippet if standard density */}
                            {!isCompact && (
                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                                <span>{formatDate(job.createdAt)}</span>
                                <div className="flex items-center gap-1.5">
                                  {job.timer?.totalSeconds ? (
                                    <span className="text-slate-600 font-semibold flex items-center gap-0.5">
                                      <Timer className="w-2.5 h-2.5 text-indigo-600" />
                                      {formatSecondsToHuman(job.timer.totalSeconds)}
                                    </span>
                                  ) : null}
                                  {job.pdfAttachment && (
                                    <span className="text-indigo-600 font-bold">PDF</span>
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

            return (
              <div
                key={job.id}
                onClick={() => onOpenJobDetail(job)}
                className="group relative bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {job.ot}
                      </span>
                      {job.isUrgent && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <Flame className="w-3 h-3 text-rose-600" /> Urgente
                        </span>
                      )}
                      {sortCriteria === 'operator_order' && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold border border-indigo-100">
                          #{index + 1}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          status?.isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {status?.name || 'Estado'}
                      </span>

                      {canReorder && (
                        <div
                          className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleReorder(job.id, 'up')}
                            title="Subir prioridad"
                            className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-20 cursor-pointer"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === sortedJobs.length - 1}
                            onClick={() => handleReorder(job.id, 'down')}
                            title="Bajar prioridad"
                            className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-20 cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mb-1.5 group-hover:text-indigo-600 transition-colors">
                    {job.client}
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-500 mb-3">
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
                      <div className="flex items-center gap-1 text-slate-600 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>Entrada: {formatDate(job.createdAt)}</span>
                      </div>

                      {job.deliveryDate && (
                        <div className="flex items-center gap-1 text-slate-600 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Entrega: {formatDate(job.deliveryDate)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="truncate">
                        Creado por <strong className="text-slate-800">{job.createdByName || 'Administrador'}</strong>
                        {job.participantsHistory && job.participantsHistory.length > 1 && (
                          <span className="text-indigo-600 font-semibold"> · {job.participantsHistory.length} registros</span>
                        )}
                      </span>
                    </div>

                    {(job.timer?.totalSeconds || job.timer?.isRunning) && (
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                        <span className="text-slate-500 flex items-center gap-1 font-medium">
                          <Timer className={`w-3.5 h-3.5 ${job.timer?.isRunning ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                          <span>Tiempo cronometrado:</span>
                        </span>
                        <strong className={job.timer?.isRunning ? 'text-emerald-600 font-bold' : 'text-slate-800 font-mono font-bold'}>
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

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  {job.pdfAttachment ? (
                    <div className="flex items-center gap-1 text-indigo-700 font-semibold bg-indigo-50/80 px-2 py-0.5 rounded-md">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="truncate max-w-[130px]">{job.pdfAttachment.name}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px]">Sin archivo adjunto</span>
                  )}

                  <span className="text-indigo-600 font-bold group-hover:translate-x-0.5 transition-transform">
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
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
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
              <tbody className="divide-y divide-slate-100 text-slate-700">
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

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onOpenJobDetail(job)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      {canReorder && (
                        <td
                          className="px-3 py-3 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1 bg-slate-50 px-1 py-0.5 rounded-lg border border-slate-200">
                            <span className="font-mono text-[10px] font-bold text-slate-500 px-1">
                              #{index + 1}
                            </span>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleReorder(job.id, 'up')}
                              title="Subir posición"
                              className="p-0.5 rounded text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-20 cursor-pointer"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === sortedJobs.length - 1}
                              onClick={() => handleReorder(job.id, 'down')}
                              title="Bajar posición"
                              className="p-0.5 rounded text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-20 cursor-pointer"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      )}

                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {job.ot}
                          {job.isUrgent && (
                            <span className="p-0.5 rounded bg-rose-100 text-rose-700" title="Urgente">
                              <Flame className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {job.client}
                      </td>

                      <td className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">
                        {formatDate(job.createdAt)}
                      </td>

                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
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
                          <span className="font-semibold text-slate-800">{job.createdByName || 'Admin'}</span>
                          {job.participantsHistory && job.participantsHistory.length > 1 && (
                            <span
                              className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-100"
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
                          <span className="inline-flex items-center gap-1 text-slate-700 font-mono font-medium">
                            <Timer className="w-3 h-3 text-slate-400" />
                            {formatSecondsToHuman(job.timer.totalSeconds)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            status?.isCompleted
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-indigo-50 text-indigo-700'
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
                          <span className="text-indigo-600 font-semibold inline-flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenJobDetail(job);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
