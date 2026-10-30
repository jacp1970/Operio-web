import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { WorkOrder } from '../types';
import {
  Search,
  Plus,
  Flame,
  AlertTriangle,
  FileText,
  Calendar,
  Building,
  User,
  CheckCircle2,
  Filter,
  Download,
  ArrowUpDown,
} from 'lucide-react';

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
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [departmentFilter, setDepartmentFilter] = useState<string>('todos');
  const [operatorFilter, setOperatorFilter] = useState<string>('todos');
  const [onlyUrgent, setOnlyUrgent] = useState<boolean>(false);
  const [onlyAlerts, setOnlyAlerts] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'administrador';

  // Filter logic
  const filteredJobs = workOrders.filter((wo) => {
    // Search term in OT, Client, Notes, or Alerts
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchOt = wo.ot.toLowerCase().includes(q);
      const matchClient = wo.client.toLowerCase().includes(q);
      const matchNotes = wo.notes.toLowerCase().includes(q);
      const matchAlerts = wo.alerts.some((a) => a.text.toLowerCase().includes(q));
      if (!matchOt && !matchClient && !matchNotes && !matchAlerts) return false;
    }

    // Status filter
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

    // Department filter
    if (departmentFilter !== 'todos' && wo.departmentId !== departmentFilter) {
      return false;
    }

    // Operator filter
    if (operatorFilter !== 'todos' && wo.assignedOperatorId !== operatorFilter) {
      return false;
    }

    // Urgent filter
    if (onlyUrgent && !wo.isUrgent) {
      return false;
    }

    // Alerts filter
    if (onlyAlerts && wo.alerts.length === 0) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Órdenes de Trabajo (OT)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Mostrando {filteredJobs.length} de {workOrders.length} partes de trabajo registrados
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tarjetas
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tabla
            </button>
          </div>

          {/* New Work Order button (Admin only) */}
          {isAdmin && (
            <button
              onClick={onOpenNewJobModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-bold hover:bg-indigo-700 active:scale-95 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Trabajo</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        {/* Search Input */}
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

        {/* Filter Dropdowns and Quick Badges */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Status select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
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

          {/* Department select */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
          >
            <option value="todos">Todos los Departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Operator select */}
          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
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

          {/* Urgent checkbox pill */}
          <button
            type="button"
            onClick={() => setOnlyUrgent(!onlyUrgent)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              onlyUrgent
                ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${onlyUrgent ? 'text-rose-600' : 'text-slate-400'}`} />
            <span>Sólo Urgentes</span>
          </button>

          {/* Alerts checkbox pill */}
          <button
            type="button"
            onClick={() => setOnlyAlerts(!onlyAlerts)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              onlyAlerts
                ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${onlyAlerts ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>Con Alertas</span>
          </button>

          {/* Clear filters */}
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
              className="text-xs text-indigo-600 font-semibold hover:underline ml-auto"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredJobs.length === 0 ? (
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
          {isAdmin && (
            <button
              onClick={onOpenNewJobModal}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
            >
              Crear nueva OT
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const status = getStatus(job.statusId);
            const deptName = getDepartmentName(job.departmentId);
            const assignedOp = getUser(job.assignedOperatorId);

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
                    </div>

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

                  <h3 className="font-bold text-slate-900 text-base mb-1.5 group-hover:text-indigo-600 transition-colors">
                    {job.client}
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-500 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{deptName}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">
                        {assignedOp ? assignedOp.name : 'Sin asignar'}
                      </span>
                    </div>

                    {job.deliveryDate && (
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Entrega: {job.deliveryDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes snippet */}
                  {job.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2 mb-3">
                      {job.notes}
                    </p>
                  )}

                  {/* Alerts */}
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

                {/* Footer with PDF indicator & action */}
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
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">OT</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Departamento</th>
                  <th className="px-4 py-3">Operario</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Entrega</th>
                  <th className="px-4 py-3">Alertas</th>
                  <th className="px-4 py-3">PDF</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredJobs.map((job) => {
                  const status = getStatus(job.statusId);
                  const deptName = getDepartmentName(job.departmentId);
                  const assignedOp = getUser(job.assignedOperatorId);

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onOpenJobDetail(job)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
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
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{deptName}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {assignedOp ? assignedOp.name : <span className="text-slate-400">Sin asignar</span>}
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
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {job.deliveryDate || '-'}
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
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
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
