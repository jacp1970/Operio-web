import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { WorkOrder, PdfAttachment, WorkOrderTimer, WorkOrderTimeSession } from '../types';
import { parsePdfClientSide } from '../utils/pdfExtractor';
import {
  formatSecondsToHMS,
  formatSecondsToHuman,
  computeLiveTimerSeconds,
} from '../utils/timeUtils';
import {
  X,
  FileText,
  Upload,
  Download,
  Trash2,
  AlertTriangle,
  Flame,
  Check,
  Building,
  User,
  Calendar,
  Lock,
  Sparkles,
  Loader2,
  Eye,
  Users,
  Clock,
  Timer,
  Play,
  Pause,
  RotateCcw,
  History,
  Square,
} from 'lucide-react';

interface JobModalProps {
  job: WorkOrder | null; // null if creating a new job
  isOpen: boolean;
  onClose: () => void;
  onOpenPdfViewer?: (attachment: { name: string; dataUrl: string }) => void;
}

export const JobModal: React.FC<JobModalProps> = ({
  job,
  isOpen,
  onClose,
  onOpenPdfViewer,
}) => {
  const {
    currentUser,
    users,
    departments,
    statuses,
    createWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    uploadJobPdf,
    deleteJobPdf,
    getJobParticipants,
    getDepartmentName,
    getStatus,
  } = useApp();

  const isCreating = !job;
  const isAdmin = currentUser?.role === 'administrador';
  const isOperario = currentUser?.role === 'operario';
  const isAdministrativo = currentUser?.role === 'administrativo';
  const isReadOnly = currentUser?.role === 'solo_lectura';
  const canCreateJob = isAdmin || isAdministrativo;
  const canEditCoreFields = isAdmin || (isCreating && isAdministrativo);

  // Form fields
  const [ot, setOt] = useState('');
  const [client, setClient] = useState('');
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState('');
  const [assignedOperatorId, setAssignedOperatorId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [notes, setNotes] = useState('');
  const [newAlertText, setNewAlertText] = useState('');
  const [alerts, setAlerts] = useState<WorkOrder['alerts']>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // PDF Attachment and client-side extraction state
  const [attachedPdf, setAttachedPdf] = useState<PdfAttachment | null>(null);
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [pdfSuccessNotice, setPdfSuccessNotice] = useState<string | null>(null);

  // Stopwatch / Cronómetro state
  const [timer, setTimer] = useState<WorkOrderTimer | undefined>(job?.timer);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState<number>(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSessionsList, setShowSessionsList] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize form state
  useEffect(() => {
    setShowDeleteConfirm(false);
    setIsAnalyzingPdf(false);
    setPdfSuccessNotice(null);
    setShowResetConfirm(false);
    setShowSessionsList(false);

    if (job) {
      setOt(job.ot);
      setClient(job.client);
      setCreatedAt(job.createdAt ? job.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setDeliveryDate(job.deliveryDate || '');
      setAssignedOperatorId(job.assignedOperatorId || '');
      setDepartmentId(job.departmentId || '');
      setStatusId(job.statusId || '');
      setIsUrgent(job.isUrgent);
      setNotes(job.notes || '');
      setAlerts(job.alerts || []);
      setAttachedPdf(job.pdfAttachment || null);
      setTimer(job.timer);
      setLiveElapsedSeconds(computeLiveTimerSeconds(job.timer));
    } else {
      // New job defaults: OT starts empty so the user can enter their own work order number directly
      setOt('');
      setClient('');
      setCreatedAt(new Date().toISOString().slice(0, 10)); // Generada automáticamente
      setDeliveryDate('');
      const defaultOp = users.find((u) => u.role === 'operario' || u.role === 'administrativo')?.id || '';
      setAssignedOperatorId(defaultOp);
      setDepartmentId(departments[0]?.id || '');
      setStatusId(statuses[0]?.id || '');
      setIsUrgent(false);
      setNotes('');
      setAlerts([]);
      setAttachedPdf(null);
      setTimer(undefined);
      setLiveElapsedSeconds(0);
    }
    setNewAlertText('');
    setErrorMessage('');
  }, [job, isOpen, users, departments, statuses]);

  // Live stopwatch tick effect: updates liveElapsedSeconds every second when isRunning is true
  useEffect(() => {
    setLiveElapsedSeconds(computeLiveTimerSeconds(timer));
    if (!timer?.isRunning) return;

    const interval = setInterval(() => {
      setLiveElapsedSeconds(computeLiveTimerSeconds(timer));
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  // Stopwatch Handlers: Start, Pause/Stop, Reset
  const handleStartTimer = () => {
    if (!currentUser || isReadOnly) return;
    const nowIso = new Date().toISOString();
    const newTimer: WorkOrderTimer = {
      totalSeconds: timer?.totalSeconds || 0,
      isRunning: true,
      activeStartedAt: nowIso,
      activeOperatorId: currentUser.id,
      activeOperatorName: currentUser.name,
      sessions: timer?.sessions || [],
    };
    setTimer(newTimer);
    setLiveElapsedSeconds(computeLiveTimerSeconds(newTimer));
    if (job) {
      updateWorkOrder(job.id, { timer: newTimer });
    }
  };

  const handlePauseTimer = () => {
    if (!currentUser || isReadOnly || !timer) return;
    const now = Date.now();
    const start = timer.activeStartedAt ? new Date(timer.activeStartedAt).getTime() : now;
    const sessionSeconds = Math.max(0, Math.floor((now - start) / 1000));
    const newTotal = (timer.totalSeconds || 0) + sessionSeconds;
    const session: WorkOrderTimeSession = {
      id: `sess-${Date.now()}`,
      operatorId: timer.activeOperatorId || currentUser.id,
      operatorName: timer.activeOperatorName || currentUser.name,
      startedAt: timer.activeStartedAt || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      seconds: sessionSeconds,
    };
    const newTimer: WorkOrderTimer = {
      totalSeconds: newTotal,
      isRunning: false,
      activeStartedAt: undefined,
      activeOperatorId: undefined,
      activeOperatorName: undefined,
      sessions: [session, ...(timer.sessions || [])],
    };
    setTimer(newTimer);
    setLiveElapsedSeconds(newTotal);
    if (job) {
      updateWorkOrder(job.id, { timer: newTimer });
    }
  };

  const handleResetTimer = () => {
    if (isReadOnly) return;
    const newTimer: WorkOrderTimer = {
      totalSeconds: 0,
      isRunning: false,
      activeStartedAt: undefined,
      activeOperatorId: undefined,
      activeOperatorName: undefined,
      sessions: [],
    };
    setTimer(newTimer);
    setLiveElapsedSeconds(0);
    setShowResetConfirm(false);
    if (job) {
      updateWorkOrder(job.id, { timer: newTimer });
    }
  };

  if (!isOpen || !currentUser) return null;

  // Alerts handling
  const handleAddAlert = () => {
    if (!newAlertText.trim()) return;
    const newAlert = {
      id: `al-${Date.now()}`,
      text: newAlertText.trim(),
      createdAt: new Date().toISOString(),
      createdByName: currentUser.name,
    };
    setAlerts([...alerts, newAlert]);
    setNewAlertText('');
  };

  const handleRemoveAlert = (alertId: string) => {
    setAlerts(alerts.filter((a) => a.id !== alertId));
  };

  /**
   * Client-side PDF Extraction: parses PDF text locally in the browser with no API keys or credits
   */
  const extractDataFromPdfLocally = async (fileOrDataUrl: File | string, fileName: string) => {
    setIsAnalyzingPdf(true);
    setPdfSuccessNotice(null);
    setErrorMessage('');

    try {
      const ext = await parsePdfClientSide(fileOrDataUrl, fileName);

      let detectedFields = 0;
      let dateNotice = '';

      if (ext.ot && ext.ot.trim()) {
        setOt(ext.ot.trim().toUpperCase());
        detectedFields++;
      }
      if (ext.client && ext.client.trim()) {
        setClient(ext.client.trim());
        detectedFields++;
      }
      // Creation date: update if different from current
      if (ext.creationDate && ext.creationDate.trim()) {
        const pdfDate = ext.creationDate.trim();
        if (pdfDate !== createdAt) {
          setCreatedAt(pdfDate);
          detectedFields++;
          dateNotice = ` Fecha de creación actualizada a ${pdfDate} según el PDF.`;
          if (job) {
            updateWorkOrder(job.id, { createdAt: new Date(pdfDate).toISOString() });
          }
        }
      }
      if (ext.deliveryDate && ext.deliveryDate.trim()) {
        setDeliveryDate(ext.deliveryDate.trim());
        detectedFields++;
      }
      if (ext.isUrgent !== undefined) {
        setIsUrgent(Boolean(ext.isUrgent));
      }
      if (ext.notes && ext.notes.trim()) {
        setNotes(ext.notes.trim());
        detectedFields++;
      }

      if (detectedFields > 0) {
        setPdfSuccessNotice(
          `✨ Datos identificados y autorellenados localmente en el navegador (100% autónomo, sin API ni créditos).${dateNotice} Recuerda asignar operario, departamento y alertas manualmente.`
        );
      } else {
        setPdfSuccessNotice(
          'Archivo PDF adjuntado correctamente. Puedes completar los campos manualmente a continuación.'
        );
      }
    } catch (err: any) {
      console.warn('Client-side PDF extraction error:', err);
      setPdfSuccessNotice('Archivo PDF adjuntado. Puedes completar los datos manualmente.');
    } finally {
      setIsAnalyzingPdf(false);
    }
  };

  /**
   * Handles PDF file upload from disk
   */
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Por favor, selecciona un archivo en formato PDF (.pdf).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const pdfDataUrl = reader.result as string;

      const attachment: PdfAttachment = {
        name: file.name,
        size: file.size,
        dataUrl: pdfDataUrl,
        uploadedAt: new Date().toISOString(),
      };

      setAttachedPdf(attachment);

      if (job) {
        await uploadJobPdf(job.id, file);
      }

      // Automatically trigger client-side extraction on uploaded PDF for both new and existing jobs
      await extractDataFromPdfLocally(file, file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownloadPdf = () => {
    const currentAttachment = attachedPdf || job?.pdfAttachment;
    if (!currentAttachment) return;
    const link = document.createElement('a');
    link.href = currentAttachment.dataUrl;
    link.download = currentAttachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRemoveAttachment = () => {
    setAttachedPdf(null);
    if (job) {
      deleteJobPdf(job.id);
    }
    setPdfSuccessNotice(null);
  };

  const handleSave = () => {
    setErrorMessage('');
    setIsSaving(true);

    if (isCreating) {
      if (!canCreateJob) {
        setErrorMessage('Solo los administradores o administrativos pueden crear trabajos.');
        setIsSaving(false);
        return;
      }

      const res = createWorkOrder({
        ot,
        client,
        createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
        deliveryDate: deliveryDate || undefined,
        assignedOperatorId,
        departmentId,
        statusId,
        isUrgent,
        notes,
        pdfAttachment: attachedPdf || undefined,
        timer,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Error al crear trabajo');
        setIsSaving(false);
        return;
      }
    } else if (job) {
      // Update existing
      if (isReadOnly) {
        setErrorMessage('El rol de sólo lectura no puede guardar cambios.');
        setIsSaving(false);
        return;
      }

      const updates: Partial<WorkOrder> = {
        departmentId,
        assignedOperatorId,
        alerts,
        notes,
        statusId,
        pdfAttachment: attachedPdf || undefined,
        createdAt: createdAt ? new Date(createdAt).toISOString() : undefined,
        timer,
      };

      if (isAdmin) {
        updates.ot = ot;
        updates.client = client;
        updates.deliveryDate = deliveryDate;
        updates.isUrgent = isUrgent;
      }

      const res = updateWorkOrder(job.id, updates);
      if (!res.success) {
        setErrorMessage(res.error || 'Error al actualizar trabajo');
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    onClose();
  };

  const handleConfirmDelete = () => {
    if (!job || !isAdmin) return;
    deleteWorkOrder(job.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const formatHistoryDate = (isoStr: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const participantsList = job ? getJobParticipants(job) : [];

  // 1. Administrador que lo creó y fecha
  const creatorEntry = participantsList.find(
    (p) => p.action === 'creacion' || p.userRole === 'administrador'
  );
  const adminCreatorName = isCreating
    ? currentUser.name
    : creatorEntry?.userName || job?.createdByName || 'Administrador';
  const adminCreatorDate = isCreating
    ? formatHistoryDate(new Date().toISOString())
    : formatHistoryDate(creatorEntry?.timestamp || job?.createdAt || '');

  // 2. Operarios por los que ha pasado (nombre y fecha en la que se le asignó el trabajo)
  const rawOpHistory = participantsList.filter(
    (p) => p.action === 'asignacion' || p.action === 'pase_trabajo' || (p.operatorName && p.action !== 'creacion')
  );

  let operatorAssignments: { name: string; date: string; isCurrent?: boolean }[] = [];

  if (isCreating) {
    if (assignedOperatorId) {
      const op = users.find((u) => u.id === assignedOperatorId);
      operatorAssignments = [
        {
          name: op?.name || 'Operario asignado',
          date: 'Se registrará al crear el trabajo',
          isCurrent: true,
        },
      ];
    }
  } else if (rawOpHistory.length > 0) {
    operatorAssignments = rawOpHistory.map((p, idx) => ({
      name: p.operatorName || p.userName || 'Operario',
      date: formatHistoryDate(p.timestamp),
      isCurrent: idx === rawOpHistory.length - 1,
    }));
  } else if (job?.assignedOperatorId) {
    const op = users.find((u) => u.id === job.assignedOperatorId);
    operatorAssignments = [
      {
        name: op?.name || 'Operario asignado',
        date: formatHistoryDate(job.createdAt),
        isCurrent: true,
      },
    ];
  }

  const currentAttachment = attachedPdf || job?.pdfAttachment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold bg-white text-indigo-700 px-3 py-1 rounded-xl border border-indigo-100 shadow-2xs">
              {isCreating ? ot || 'NUEVA OT' : job?.ot}
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {isCreating ? 'Nueva Orden de Trabajo' : 'Detalles de la Orden de Trabajo'}
              </h2>
              {isCreating && (
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Sube el PDF para autorellenar datos o introduce la información manualmente
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Client-Side PDF Auto-fill Status */}
          {isAnalyzingPdf && (
            <div className="p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200/90 flex items-center gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-950">
                  Leyendo archivo PDF localmente en el navegador...
                </p>
                <p className="text-[11px] text-indigo-700">
                  Extrayendo datos de forma 100% autónoma en el cliente (sin claves de API ni consumo de créditos).
                </p>
              </div>
            </div>
          )}

          {pdfSuccessNotice && !isAnalyzingPdf && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-2 text-xs text-emerald-800 animate-in fade-in">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{pdfSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setPdfSuccessNotice(null)}
                className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Role Permission Notice */}
          {isOperario && !isCreating && (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200/70 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <span className="font-bold">Permisos de Operario:</span>
              Puedes cambiar el operario, departamento, añadir/quitar alertas, editar notas y descargar el PDF adjunto.
            </div>
          )}

          {isAdministrativo && !isCreating && (
            <div className="p-3 bg-blue-50/80 border border-blue-200/70 rounded-xl text-xs text-blue-800 flex items-center gap-2">
              <span className="font-bold">Permisos de Administrativo:</span>
              Mismos accesos que un operario (cambiar operario, departamento, alertas, notas y cronómetro) más la creación de órdenes de trabajo.
            </div>
          )}

          {isReadOnly && (
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Modo sólo lectura: Puedes consultar la información y descargar el PDF adjunto.</span>
            </div>
          )}

          {/* ATTACHMENT CARD: Subir archivo PDF */}
          <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Archivo adjunto en PDF (Plano / Hoja de Proceso)
                </span>
              </div>
              {isCreating && (
                <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1 self-start sm:self-auto">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  Autocompletar tras subida
                </span>
              )}
            </div>

            {currentAttachment ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentAttachment.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {Math.round(currentAttachment.size / 1024)} KB · Adjuntado el{' '}
                      {new Date(currentAttachment.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {onOpenPdfViewer && (
                    <button
                      type="button"
                      onClick={() => onOpenPdfViewer(currentAttachment)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Borrar archivo PDF"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Adjunta el archivo en formato PDF. Al subirlo, la aplicación identificará los datos del trabajo y autorellenará la orden automáticamente. Si no dispones de PDF, puedes rellenar todos los campos manualmente.
                </p>

                {(isAdmin || (isCreating && canCreateJob)) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isAnalyzingPdf}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Subir archivo PDF</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Basic Info: OT & Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                OT (Orden de Trabajo) *
              </label>
              <input
                type="text"
                disabled={!canEditCoreFields}
                value={ot}
                onChange={(e) => setOt(e.target.value)}
                placeholder="Ej. OT-2026-101"
                className={`w-full text-sm font-mono font-semibold px-3.5 py-2.5 rounded-xl border ${
                  !canEditCoreFields
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Cliente *
              </label>
              <input
                type="text"
                disabled={!canEditCoreFields}
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Nombre de la empresa o cliente"
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl border ${
                  !canEditCoreFields
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                }`}
              />
            </div>
          </div>

          {/* Creation Date & Delivery Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Fecha de Creación / Entrada *</span>
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Auto / PDF
                </span>
              </label>
              <input
                type="date"
                disabled={!isAdmin && !isOperario && !isAdministrativo}
                value={createdAt}
                onChange={(e) => setCreatedAt(e.target.value)}
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl border ${
                  !isAdmin && !isOperario && !isAdministrativo
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                }`}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Generada automáticamente. Si adjuntas un PDF con otra fecha, se actualizará sola.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Fecha de entrega (opcional)
              </label>
              <input
                type="date"
                disabled={!canEditCoreFields}
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl border ${
                  !canEditCoreFields
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                }`}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Plazo límite o compromiso de entrega con el cliente.
              </p>
            </div>
          </div>

          {/* Urgent Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Prioridad / Urgencia
            </label>
            <button
              type="button"
              disabled={!canEditCoreFields}
              onClick={() => setIsUrgent(!isUrgent)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                isUrgent
                  ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              } ${!canEditCoreFields ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2">
                <Flame className={`w-4 h-4 ${isUrgent ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>{isUrgent ? 'TRABAJO URGENTE' : 'Normal (No urgente)'}</span>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  isUrgent ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300'
                }`}
              >
                {isUrgent && <Check className="w-3 h-3" />}
              </span>
            </button>
          </div>

          {/* Department & Operator assignment (Always manual) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Departamento asignado *</span>
                <span className="text-[10px] text-indigo-600 font-semibold lowercase">asignación manual</span>
              </label>
              <select
                disabled={isReadOnly}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl border ${
                  isReadOnly
                    ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                }`}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Operario asignado</span>
                <span className="text-[10px] text-indigo-600 font-semibold lowercase">asignación manual</span>
              </label>
              <select
                disabled={isReadOnly}
                value={assignedOperatorId}
                onChange={(e) => setAssignedOperatorId(e.target.value)}
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl border ${
                  isReadOnly
                    ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                }`}
              >
                <option value="">-- Sin operario asignado --</option>
                {users
                  .filter((u) => u.role === 'operario' || u.role === 'administrativo' || u.role === 'administrador')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Estado de trabajo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Estado de la orden de trabajo
            </label>
            <select
              disabled={isReadOnly}
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className={`w-full text-sm font-semibold px-3.5 py-2.5 rounded-xl border ${
                isReadOnly
                  ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                  : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
              }`}
            >
              {statuses.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {st.isCompleted ? '(Finalizado)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* ======================================================== */}
          {/* CRONÓMETRO DE TIEMPO DE TRABAJO (OPCIONAL) */}
          {/* ======================================================== */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-md border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-xl ${
                    timer?.isRunning
                      ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <Timer className={`w-4 h-4 ${timer?.isRunning ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white tracking-tight">
                      Cronómetro de Trabajo
                    </h4>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      Opcional
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {timer?.isRunning
                      ? 'Cronómetro en marcha. Pulsa "Pausar" para pausar el conteo o "Detener" para finalizar.'
                      : liveElapsedSeconds > 0
                      ? 'Cronómetro en pausa. Pulsa "Reanudar" para continuar o "Poner a cero" para reiniciar.'
                      : 'Solo contará el tiempo que marque el cronómetro para calcular la duración.'}
                  </p>
                </div>
              </div>

              {/* Status pill badge */}
              <div className="self-start sm:self-auto">
                {timer?.isRunning ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>EN MARCHA</span>
                  </span>
                ) : liveElapsedSeconds > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>EN PAUSA</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    <span>SIN INICIAR</span>
                  </span>
                )}
              </div>
            </div>

            {/* Counter display & Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div>
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-3xl sm:text-4xl font-black tracking-wider text-white select-none">
                    {formatSecondsToHMS(liveElapsedSeconds)}
                  </span>
                  {liveElapsedSeconds > 0 && (
                    <span className="text-xs font-semibold text-emerald-400">
                      ({formatSecondsToHuman(liveElapsedSeconds)})
                    </span>
                  )}
                </div>

                {timer?.isRunning && timer.activeOperatorName && (
                  <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                    <User className="w-3 h-3 shrink-0" />
                    <span>Iniciado por <strong>{timer.activeOperatorName}</strong></span>
                  </p>
                )}
                {!timer?.isRunning && liveElapsedSeconds > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Tiempo total registrado: <strong>{formatSecondsToHuman(liveElapsedSeconds)}</strong>
                  </p>
                )}
              </div>

              {/* Controls */}
              {!isReadOnly && (
                <div className="flex flex-wrap items-center gap-2">
                  {timer?.isRunning ? (
                    <>
                      {/* Botón de Pausa principal */}
                      <button
                        type="button"
                        onClick={handlePauseTimer}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs cursor-pointer shadow-sm transition-all"
                        title="Pausar el cronómetro (podrás reanudarlo cuando quieras)"
                      >
                        <Pause className="w-4 h-4 fill-slate-950" />
                        <span>Pausar</span>
                      </button>

                      {/* Botón de Detener / Parar */}
                      <button
                        type="button"
                        onClick={handlePauseTimer}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/70 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-800/80 active:scale-95 text-xs font-semibold cursor-pointer shadow-sm transition-all"
                        title="Detener y registrar el tramo de trabajo"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Detener</span>
                      </button>
                    </>
                  ) : liveElapsedSeconds > 0 ? (
                    <>
                      {/* Botón Reanudar */}
                      <button
                        type="button"
                        onClick={handleStartTimer}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs cursor-pointer shadow-sm transition-all"
                        title="Reanudar el cronómetro de trabajo"
                      >
                        <Play className="w-4 h-4 fill-slate-950" />
                        <span>Reanudar</span>
                      </button>

                      {/* Indicador de Pausa */}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium select-none">
                        <Pause className="w-3.5 h-3.5" />
                        <span>En Pausa</span>
                      </span>

                      {/* Botón Poner a cero */}
                      {!showResetConfirm ? (
                        <button
                          type="button"
                          onClick={() => setShowResetConfirm(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer border border-slate-700 transition-colors"
                          title="Poner a 00:00:00"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Poner a cero</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-700/80 p-1.5 rounded-xl text-xs">
                          <span className="text-[11px] text-rose-300 font-medium px-1">¿Resetear?</span>
                          <button
                            type="button"
                            onClick={handleResetTimer}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowResetConfirm(false)}
                            className="px-1.5 py-0.5 rounded text-slate-300 hover:text-white text-[11px] cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Botón Iniciar cuando está en 00:00:00 */
                    <button
                      type="button"
                      onClick={handleStartTimer}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs cursor-pointer shadow-sm transition-all"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>Iniciar Trabajo</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sessions history accordion */}
            {timer?.sessions && timer.sessions.length > 0 && (
              <div className="pt-2 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setShowSessionsList(!showSessionsList)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <History className="w-3 h-3 text-indigo-400" />
                  <span>
                    {showSessionsList ? 'Ocultar' : 'Ver'} registro de tramos ({timer.sessions.length})
                  </span>
                </button>

                {showSessionsList && (
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                    {timer.sessions.map((sess, idx) => (
                      <div
                        key={sess.id || idx}
                        className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px]"
                      >
                        <span className="text-slate-300 font-medium">
                          {sess.operatorName}
                        </span>
                        <div className="flex items-center gap-3 text-slate-400 font-mono">
                          <span>
                            {new Date(sess.startedAt).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {sess.endedAt &&
                              ` - ${new Date(sess.endedAt).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`}
                          </span>
                          <span className="font-bold text-emerald-400">
                            +{formatSecondsToHuman(sess.seconds)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alertas (Manual) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Alertas del Trabajo
              </label>
              <span className="text-[10px] text-indigo-600 font-semibold lowercase">gestión manual</span>
            </div>

            {/* List of active alerts */}
            <div className="space-y-2 mb-2">
              {alerts.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200">
                  Sin alertas técnicas o incidencias registradas.
                </p>
              ) : (
                alerts.map((al) => (
                  <div
                    key={al.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-semibold">{al.text}</span>
                        {al.createdByName && (
                          <span className="text-[11px] text-amber-700 block">
                            Por {al.createdByName}
                          </span>
                        )}
                      </div>
                    </div>

                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAlert(al.id)}
                        className="text-amber-700 hover:text-rose-700 p-1 hover:bg-amber-100/60 rounded-lg transition-colors cursor-pointer"
                        title="Quitar alerta"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add Alert Input */}
            {!isReadOnly && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAlertText}
                  onChange={(e) => setNewAlertText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAlert();
                    }
                  }}
                  placeholder="Ej. Esperando material, Falta plano acotado..."
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddAlert}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-2xs cursor-pointer"
                >
                  + Añadir Alerta
                </button>
              </div>
            )}
          </div>

          {/* Recuadro para notas (Auto-filled by PDF or manual) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Recuadro para notas y aclaraciones del trabajo
            </label>
            <textarea
              rows={3}
              disabled={isReadOnly}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Escribe aquí cualquier indicación técnica, proceso, herramientas especiales o aclaraciones..."
              className={`w-full text-xs sm:text-sm p-3 rounded-xl border ${
                isReadOnly
                  ? 'bg-slate-100 text-slate-600 cursor-not-allowed'
                  : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
              }`}
            />
          </div>

          {/* ========================================================== */}
          {/* SECCIÓN INFORMATIVA: HISTORIAL DE CREADOR Y OPERARIOS */}
          {/* ========================================================== */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Historial de asignaciones</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Informativo</span>
            </div>

            {/* Administrador que lo creó */}
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
              <span className="text-slate-500 font-medium">Creado por (Administrador):</span>
              <span className="font-semibold text-slate-800">
                {adminCreatorName}{' '}
                <span className="text-slate-400 font-normal">· {adminCreatorDate}</span>
              </span>
            </div>

            {/* Operarios por los que ha pasado */}
            <div className="pt-1.5 border-t border-slate-200/60">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Operarios por los que ha pasado:
              </span>

              {operatorAssignments.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-0.5">
                  Sin operarios asignados hasta el momento.
                </p>
              ) : (
                <div className="space-y-1">
                  {operatorAssignments.map((op, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-white border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-slate-800 truncate">
                          {op.name}
                        </span>
                        {op.isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            Actual
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-2">
                        {op.date}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <div>
            {!isCreating && isAdmin && (
              !showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Borrar Trabajo</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-in fade-in duration-150">
                  <span className="text-xs font-bold text-rose-800">
                    ¿Eliminar orden {job?.ot}?
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg shadow-xs transition-all cursor-pointer"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-rose-100/60 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              {isReadOnly ? 'Cerrar' : 'Cancelar'}
            </button>

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isAnalyzingPdf}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? 'Guardando...' : isCreating ? 'Crear Trabajo' : 'Guardar Cambios'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
