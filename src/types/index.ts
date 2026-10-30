export type UserRole = 'administrador' | 'operario' | 'solo_lectura';

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
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
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
  createdAt: string;
  updatedAt: string;
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
  | 'cerrar_sesion';
