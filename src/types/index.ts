export type UserRole = 'administrador' | 'operario' | 'administrativo' | 'solo_lectura';

export interface Company {
  id: string;
  code: string; // Código de empresa único (alfanumérico en mayúsculas)
  name: string; // Nombre comercial de la empresa
  createdAt: string;
}

export interface User {
  id: string;
  companyId: string; // Empresa a la que pertenece
  name: string;
  email?: string; // Exclusivo para el administrador
  accessKey: string; // Clave de acceso adjudicada
  role: UserRole;
  departmentIds: string[]; // Departamentos técnicos asignados
  createdAt: string;
  color?: string; // Color distintivo para visualización
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  color?: string; // Color distintivo para visualización
}

export interface JobStatus {
  id: string;
  companyId: string;
  name: string;
  isCompleted?: boolean;
  color?: string;
}

export interface WorkAlert {
  id: string;
  text: string;
  createdAt: string;
  createdByName?: string;
}

export interface WorkNote {
  id: string;
  text: string;
  createdAt: string;
  authorName: string;
}

export interface PdfAttachment {
  name: string;
  size: number;
  dataUrl: string; // Base64 data URL o link
  uploadedAt: string;
}

export type WorkOrderActionType =
  | 'creacion' // Creación inicial de la orden por el administrador
  | 'asignacion' // Asignación o pase a un operario
  | 'cambio_departamento' // Cambio de departamento técnico
  | 'cambio_estado' // Modificación del estado de avance
  | 'intervencion' // Actualización de notas, alertas o detalles
  | 'pase_trabajo'; // Pase formal de trabajo entre operarios

export interface WorkOrderParticipant {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: WorkOrderActionType;
  actionLabel: string; // Ej: "Creado por Administrador", "Pase de trabajo a Pedro Gómez", etc.
  departmentId?: string;
  departmentName?: string;
  operatorId?: string;
  operatorName?: string;
  statusId?: string;
  statusName?: string;
  timestamp: string; // Fecha y hora ISO
  notes?: string;
}

export interface WorkOrderTimeSession {
  id: string;
  operatorId?: string;
  operatorName: string;
  startedAt: string; // ISO string
  endedAt?: string; // ISO string
  seconds: number; // Duración registrada en segundos
}

export interface WorkOrderTimer {
  totalSeconds: number; // Tiempo total acumulado registrado por el cronómetro
  isRunning: boolean; // Si el cronómetro está en marcha actualmente
  activeStartedAt?: string; // Fecha y hora ISO en la que se inició el cronómetro
  activeOperatorId?: string; // ID del operario que lo puso en marcha
  activeOperatorName?: string; // Nombre del operario
  sessions?: WorkOrderTimeSession[]; // Registro cronológico de tramos de trabajo
}

export interface WorkOrder {
  id: string;
  companyId: string;
  ot: string; // Orden de Trabajo
  client: string; // Cliente
  deliveryDate?: string; // Fecha de entrega (opcional)
  assignedOperatorId: string; // Operario asignado
  departmentId: string; // Departamento asignado
  statusId: string; // Estado del trabajo
  isUrgent: boolean; // Si el trabajo es urgente
  alerts: WorkAlert[]; // Alertas activas
  notes: string; // Recuadro para notas
  pdfAttachment?: PdfAttachment; // Archivo PDF adjunto
  createdAt: string; // Fecha de creación (automática o extraída de PDF)
  updatedAt: string;
  orderPosition?: number; // Posición bajo criterio de operarios para ordenación personalizada
  createdById?: string; // ID del administrador que creó la orden
  createdByName?: string; // Nombre del administrador creador
  participantsHistory?: WorkOrderParticipant[]; // Historial de personas por las que ha pasado el trabajo
  timer?: WorkOrderTimer; // Cronómetro de trabajo (opcional)
}

export type NotificationType =
  | 'new_assignment'
  | 'status_change'
  | 'alert_change'
  | 'urgent_marked'
  | 'system';

export interface AppNotification {
  id: string;
  companyId: string;
  userId: string; // 'admin' para notificaciones a administradores, o ID específico de usuario
  workOrderId?: string;
  ot?: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export type NavigationItemKey =
  | 'panel_de_control'
  | 'trabajos'
  | 'departamentos'
  | 'estados'
  | 'usuarios'
  | 'notificaciones'
  | 'cerrar_sesion'
  | 'resetear_empresa';
