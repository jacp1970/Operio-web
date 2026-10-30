import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { WorkOrder, PdfAttachment } from '../types';
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
  } = useApp();

  const isCreating = !job;
  const isAdmin = currentUser?.role === 'administrador';
  const isOperario = currentUser?.role === 'operario';
  const isReadOnly = currentUser?.role === 'solo_lectura';

  // Form fields
  const [ot, setOt] = useState('');
  const [client, setClient] = useState('');
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

  // PDF Attachment and AI extraction state
  const [attachedPdf, setAttachedPdf] = useState<PdfAttachment | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiSuccessNotice, setAiSuccessNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize form state
  useEffect(() => {
    setShowDeleteConfirm(false);
    setIsAnalyzingAi(false);
    setAiSuccessNotice(null);

    if (job) {
      setOt(job.ot);
      setClient(job.client);
      setDeliveryDate(job.deliveryDate || '');
      setAssignedOperatorId(job.assignedOperatorId || '');
      setDepartmentId(job.departmentId || '');
      setStatusId(job.statusId || '');
      setIsUrgent(job.isUrgent);
      setNotes(job.notes || '');
      setAlerts(job.alerts || []);
      setAttachedPdf(job.pdfAttachment || null);
    } else {
      // New job defaults (can be manually edited or auto-filled via uploaded PDF)
      const nextOtNum = String(Math.floor(Math.random() * 900) + 100);
      setOt(`OT-2026-${nextOtNum}`);
      setClient('');
      setDeliveryDate('');
      const defaultOp = users.find((u) => u.role === 'operario')?.id || '';
      setAssignedOperatorId(defaultOp);
      setDepartmentId(departments[0]?.id || '');
      setStatusId(statuses[0]?.id || '');
      setIsUrgent(false);
      setNotes('');
      setAlerts([]);
      setAttachedPdf(null);
    }
    setNewAlertText('');
    setErrorMessage('');
  }, [job, isOpen, users, departments, statuses]);

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
   * AI Extraction: sends PDF dataUrl to server backend running Gemini to autofill fields
   */
  const extractDataFromPdfWithAi = async (dataUrl: string, fileName: string) => {
    setIsAnalyzingAi(true);
    setAiSuccessNotice(null);
    setErrorMessage('');

    try {
      const response = await fetch('/api/extract-work-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: dataUrl,
          mimeType: 'application/pdf',
          fileName,
        }),
      });

      const result = await response.json();

      if (result.success && result.extracted) {
        const ext = result.extracted;
        if (ext.ot && typeof ext.ot === 'string' && ext.ot.trim()) {
          setOt(ext.ot.trim().toUpperCase());
        }
        if (ext.client && typeof ext.client === 'string' && ext.client.trim()) {
          setClient(ext.client.trim());
        }
        if (ext.deliveryDate && typeof ext.deliveryDate === 'string' && ext.deliveryDate.trim()) {
          const dateMatch = ext.deliveryDate.match(/\d{4}-\d{2}-\d{2}/);
          if (dateMatch) {
            setDeliveryDate(dateMatch[0]);
          }
        }
        if (ext.isUrgent !== undefined) {
          setIsUrgent(Boolean(ext.isUrgent));
        }
        if (ext.notes && typeof ext.notes === 'string' && ext.notes.trim()) {
          setNotes(ext.notes.trim());
        }

        setAiSuccessNotice(
          '✨ Datos identificados y autorellenados con éxito desde el PDF (OT, Cliente, Fecha y Notas). Recuerda asignar el operario, departamento y alertas manualmente.'
        );
      } else {
        setAiSuccessNotice('Archivo PDF adjuntado. Puedes completar los campos manualmente a continuación.');
      }
    } catch (err: any) {
      console.warn('AI analysis error:', err);
      setAiSuccessNotice('Archivo PDF adjuntado correctamente. Puedes completar los datos manualmente.');
    } finally {
      setIsAnalyzingAi(false);
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

      // Automatically trigger AI extraction on uploaded PDF for new jobs
      if (isCreating) {
        await extractDataFromPdfWithAi(pdfDataUrl, file.name);
      }
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
    setAiSuccessNotice(null);
  };

  const handleSave = () => {
    setErrorMessage('');
    setIsSaving(true);

    if (isCreating) {
      if (!isAdmin) {
        setErrorMessage('Solo el administrador puede crear trabajos.');
        setIsSaving(false);
        return;
      }

      const res = createWorkOrder({
        ot,
        client,
        deliveryDate: deliveryDate || undefined,
        assignedOperatorId,
        departmentId,
        statusId,
        isUrgent,
        notes,
        pdfAttachment: attachedPdf || undefined,
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

          {/* AI Auto-fill Status */}
          {isAnalyzingAi && (
            <div className="p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200/90 flex items-center gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-950">
                  Leyendo PDF e identificando datos con Inteligencia Artificial...
                </p>
                <p className="text-[11px] text-indigo-700">
                  Extrayendo número de OT, cliente, fecha de entrega y notas técnicas del documento PDF.
                </p>
              </div>
            </div>
          )}

          {aiSuccessNotice && !isAnalyzingAi && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-2 text-xs text-emerald-800 animate-in fade-in">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{aiSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiSuccessNotice(null)}
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

                {isAdmin && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isAnalyzingAi}
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
                disabled={!isAdmin}
                value={ot}
                onChange={(e) => setOt(e.target.value)}
                placeholder="Ej. OT-2026-101"
                className={`w-full text-sm font-mono font-semibold px-3.5 py-2.5 rounded-xl border ${
                  !isAdmin
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
                disabled={!isAdmin}
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Nombre de la empresa o cliente"
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl border ${
                  !isAdmin
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                }`}
              />
            </div>
          </div>

          {/* Delivery Date & Urgent Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Fecha de entrega (opcional)
              </label>
              <input
                type="date"
                disabled={!isAdmin}
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl border ${
                  !isAdmin
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Prioridad / Urgencia
              </label>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => setIsUrgent(!isUrgent)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  isUrgent
                    ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                } ${!isAdmin ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
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
                  .filter((u) => u.role === 'operario' || u.role === 'administrador')
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
                disabled={isSaving || isAnalyzingAi}
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
