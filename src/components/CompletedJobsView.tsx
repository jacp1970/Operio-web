import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { WorkOrder } from '../types';
import {
  CheckCircle2,
  Receipt,
  Trash2,
  Search,
  RotateCcw,
  AlertTriangle,
  FileText,
  Clock,
  Building,
  User,
  Eye,
  Flame,
  Check,
  Loader2,
} from 'lucide-react';
import { formatSecondsToHuman } from '../utils/timeUtils';
import { getDepartmentColor, getOperatorColor } from '../utils/colorUtils';
import { ConfirmModal } from './ConfirmModal';

interface CompletedJobsViewProps {
  onOpenJobDetail: (job: WorkOrder) => void;
  onOpenPdfViewer: (attachment: { name: string; dataUrl: string }) => void;
}

type InvoiceFilter = 'todos' | 'pendientes' | 'facturados';

export const CompletedJobsView: React.FC<CompletedJobsViewProps> = ({
  onOpenJobDetail,
  onOpenPdfViewer,
}) => {
  const {
    currentUser,
    workOrders,
    getStatus,
    getDepartmentName,
    getUser,
    toggleWorkOrderInvoiced,
    deleteWorkOrderPermanently,
    resolveJobPdfDataUrl,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('todos');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [deleteTargetJob, setDeleteTargetJob] = useState<WorkOrder | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [resolvingPdfJobId, setResolvingPdfJobId] = useState<string | null>(null);

  const completedJobs = useMemo(() => {
    return workOrders.filter((wo) => Boolean(getStatus(wo.statusId)?.isCompleted));
  }, [workOrders, getStatus]);

  const invoicedCount = useMemo(
    () => completedJobs.filter((j) => Boolean(j.isInvoiced)).length,
    [completedJobs]
  );

  const pendingInvoiceCount = completedJobs.length - invoicedCount;

  const filteredJobs = useMemo(() => {
    return completedJobs.filter((wo) => {
      if (invoiceFilter === 'facturados' && !wo.isInvoiced) return false;
      if (invoiceFilter === 'pendientes' && wo.isInvoiced) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchOt = wo.ot.toLowerCase().includes(q);
        const matchClient = wo.client.toLowerCase().includes(q);
        const matchNotes = (wo.notes || '').toLowerCase().includes(q);
        if (!matchOt && !matchClient && !matchNotes) return false;
      }

      return true;
    });
  }, [completedJobs, invoiceFilter, searchTerm]);

  if (currentUser?.role !== 'administrador') {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center text-sm font-semibold">
        Acceso restringido: Solo el administrador puede consultar y gestionar los OT finalizados.
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.slice(0, 10);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr.slice(0, 10);
    }
  };

  const handleToggleInvoiced = (job: WorkOrder, nextInvoiced: boolean) => {
    setFeedbackBanner(null);
    const res = toggleWorkOrderInvoiced(job.id, nextInvoiced);
    if (res.success) {
      setFeedbackBanner({
        type: 'success',
        text: nextInvoiced
          ? `La orden ${job.ot} se ha marcado como facturada.`
          : `Se ha desmarcado la facturación de la orden ${job.ot}.`,
      });
    } else {
      setFeedbackBanner({
        type: 'error',
        text: res.error || 'No se pudo actualizar el estado de facturación.',
      });
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deleteTargetJob) return;
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
    } else {
      setFeedbackBanner({
        type: 'error',
        text: res.error || 'Error al eliminar definitivamente la orden de trabajo.',
      });
    }
  };

  const handleOpenJobPdf = async (job: WorkOrder) => {
    if (!job.pdfAttachment) return;
    if (job.pdfAttachment.dataUrl) {
      onOpenPdfViewer({ name: job.pdfAttachment.name, dataUrl: job.pdfAttachment.dataUrl });
      return;
    }

    setResolvingPdfJobId(job.id);
    setFeedbackBanner(null);
    try {
      const resolvedUrl = await resolveJobPdfDataUrl(job.id, job.pdfAttachment);
      if (resolvedUrl) {
        onOpenPdfViewer({ name: job.pdfAttachment.name, dataUrl: resolvedUrl });
      } else {
        setFeedbackBanner({
          type: 'error',
          text: `El PDF de la orden ${job.ot} se adjuntó antes de la sincronización en la nube y solo está disponible en el dispositivo original.`,
        });
      }
    } finally {
      setResolvingPdfJobId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-oterio-600">
            Administración · Archivo de Trabajos Terminados
          </span>
          <h2 className="text-2xl font-black text-graphite-900 tracking-tight mt-0.5 flex items-center gap-2">
            <span>OT Finalizados</span>
          </h2>
          <p className="text-xs sm:text-sm text-graphite-500 mt-0.5">
            Todos los trabajos marcados como finalizados para su control de facturación o eliminación definitiva de la base de datos.
          </p>
        </div>

        {/* Summary Counters */}
        <div className="flex items-center gap-2.5 flex-wrap tabular-nums">
          <div className="px-3.5 py-2 rounded-xl bg-white border border-graphite-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 block">
              Finalizados
            </span>
            <span className="text-lg font-black text-graphite-900">{completedJobs.length}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-amber-50/70 border border-amber-200/80 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
              Sin Facturar
            </span>
            <span className="text-lg font-black text-amber-800">{pendingInvoiceCount}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              Facturados
            </span>
            <span className="text-lg font-black text-emerald-800">{invoicedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-graphite-200 p-2.5 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-graphite-50 p-1 rounded-xl border border-graphite-200 text-[11px] font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setInvoiceFilter('todos')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              invoiceFilter === 'todos'
                ? 'bg-graphite-900 text-white'
                : 'text-graphite-600 hover:text-graphite-900'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setInvoiceFilter('pendientes')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              invoiceFilter === 'pendientes'
                ? 'bg-amber-600 text-white'
                : 'text-graphite-600 hover:text-graphite-900'
            }`}
          >
            Sin facturar
          </button>
          <button
            type="button"
            onClick={() => setInvoiceFilter('facturados')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              invoiceFilter === 'facturados'
                ? 'bg-emerald-600 text-white'
                : 'text-graphite-600 hover:text-graphite-900'
            }`}
          >
            Facturados
          </button>
        </div>

        <div className="relative min-w-[230px]">
          <Search className="w-3.5 h-3.5 text-graphite-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar OT o cliente..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-graphite-200 bg-graphite-50/70 focus:bg-white focus:ring-2 focus:ring-oterio-500 transition-colors"
          />
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* List / Table of Completed Work Orders */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-graphite-200 p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-graphite-100 text-graphite-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-graphite-900 text-base">
            {completedJobs.length === 0
              ? 'No hay órdenes de trabajo finalizadas'
              : 'No se encontraron OT finalizados con ese filtro'}
          </h3>
          <p className="text-xs text-graphite-500 mt-1">
            {completedJobs.length === 0
              ? 'Cuando una orden cambie a un estado marcado como finalizado aparecerá automáticamente en este apartado.'
              : 'Prueba a cambiar el filtro de búsqueda o el estado de facturación.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-graphite-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-graphite-50 border-b border-graphite-200 text-graphite-500 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">OT</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Entrada / Entrega</th>
                  <th className="px-4 py-3">Departamento / Operario</th>
                  <th className="px-4 py-3">Tiempo</th>
                  <th className="px-4 py-3">Facturación</th>
                  <th className="px-4 py-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-100 text-graphite-700">
                {filteredJobs.map((job) => {
                  const status = getStatus(job.statusId);
                  const deptName = getDepartmentName(job.departmentId);
                  const assignedOp = getUser(job.assignedOperatorId);
                  const deptColor = getDepartmentColor(job.departmentId, deptName);
                  const opColor = getOperatorColor(
                    job.assignedOperatorId,
                    assignedOp?.name,
                    assignedOp?.color
                  );
                  const isDeletingThis = isDeletingId === job.id;

                  return (
                    <tr
                      key={job.id}
                      className={`transition-colors ${
                        job.isInvoiced
                          ? 'bg-emerald-50/25 hover:bg-emerald-50/45'
                          : 'hover:bg-graphite-50/80'
                      }`}
                    >
                      {/* OT + Urgent + PDF */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenJobDetail(job)}
                            className="font-mono font-bold text-oterio-700 hover:text-oterio-900 hover:underline cursor-pointer"
                            title="Ver ficha de la orden"
                          >
                            {job.ot}
                          </button>
                          {job.isUrgent && (
                            <span
                              className="p-0.5 rounded bg-rose-100 text-rose-700"
                              title="Urgente"
                            >
                              <Flame className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {status?.name || 'Finalizado'}
                          </span>
                          {job.pdfAttachment && (
                            <button
                              type="button"
                              disabled={resolvingPdfJobId === job.id}
                              onClick={() => void handleOpenJobPdf(job)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-oterio-600 hover:text-oterio-800 cursor-pointer disabled:opacity-50"
                              title="Ver PDF adjunto"
                            >
                              {resolvingPdfJobId === job.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                              PDF
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Cliente + Descripción breve */}
                      <td className="px-4 py-3.5 max-w-[220px]">
                        <p className="font-semibold text-graphite-900 truncate" title={job.client}>
                          {job.client}
                        </p>
                        {job.notes && (
                          <p
                            className="text-[11px] text-graphite-500 truncate mt-0.5"
                            title={job.notes}
                          >
                            {job.notes}
                          </p>
                        )}
                      </td>

                      {/* Fechas */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs tabular-nums">
                        <div className="text-graphite-700 font-medium">
                          Ent: {formatDate(job.createdAt)}
                        </div>
                        <div className="text-[11px] text-graphite-400">
                          Plazo: {job.deliveryDate ? formatDate(job.deliveryDate) : '-'}
                        </div>
                      </td>

                      {/* Dept & Operator */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${deptColor.badgeSoft}`}
                          >
                            <Building className="w-3 h-3 opacity-75" />
                            <span>{deptName}</span>
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${opColor.badgeSoft}`}
                          >
                            <User className="w-3 h-3 opacity-75" />
                            <span>{assignedOp ? assignedOp.name : 'Sin asignar'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Timer */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        {job.timer?.totalSeconds ? (
                          <span className="inline-flex items-center gap-1 font-mono font-medium text-graphite-700 tabular-nums">
                            <Clock className="w-3.5 h-3.5 text-graphite-400" />
                            {formatSecondsToHuman(job.timer.totalSeconds)}
                          </span>
                        ) : (
                          <span className="text-graphite-400">-</span>
                        )}
                      </td>

                      {/* Invoicing Status Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {job.isInvoiced ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              Facturado
                            </span>
                            {job.invoicedAt && (
                              <span className="block text-[10px] text-graphite-500 mt-1 tabular-nums">
                                {formatDate(job.invoicedAt)}
                                {job.invoicedByName ? ` · ${job.invoicedByName}` : ''}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Pendiente de facturar
                          </span>
                        )}
                      </td>

                      {/* Exclusive Action Column based on Active Tab */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenJobDetail(job)}
                            className="p-2 rounded-xl text-graphite-500 hover:text-graphite-800 hover:bg-graphite-100 transition-colors cursor-pointer"
                            title="Ver ficha completa"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {job.isInvoiced ? (
                            <button
                              type="button"
                              onClick={() => handleToggleInvoiced(job, false)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors cursor-pointer"
                              title="Desmarcar facturado por si se accionó por error"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Desmarcar Facturado</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleInvoiced(job, true)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Marcar Facturado</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={() => setDeleteTargetJob(job)}
                            title="Eliminar de la base de datos"
                            aria-label={`Eliminar ${job.ot} de la base de datos`}
                            className="p-2 rounded-xl text-graphite-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            {isDeletingThis ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
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

      {/* Permanent Database Deletion Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetJob)}
        title="Eliminar OT de la base de datos"
        message={
          deleteTargetJob
            ? `¿Confirmas que deseas eliminar definitivamente la orden ${deleteTargetJob.ot} (${deleteTargetJob.client}) de la base de datos? Esta acción es irreversible.`
            : ''
        }
        confirmText="Sí, eliminar definitivamente"
        cancelText="Cancelar"
        isDanger
        onConfirm={handleConfirmPermanentDelete}
        onCancel={() => setDeleteTargetJob(null)}
      />
    </div>
  );
};
