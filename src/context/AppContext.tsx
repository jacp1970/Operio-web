import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  Company,
  User,
  UserRole,
  Department,
  JobStatus,
  WorkOrder,
  WorkAlert,
  AppNotification,
  NavigationItemKey,
} from '../types';
import {
  INITIAL_COMPANIES,
  INITIAL_USERS,
  INITIAL_DEPARTMENTS,
  INITIAL_STATUSES,
  INITIAL_WORK_ORDERS,
  INITIAL_NOTIFICATIONS,
} from '../data/initialData';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';

interface AppContextType {
  currentUser: User | null;
  currentCompany: Company | null;
  companies: Company[];
  currentNav: NavigationItemKey;
  setCurrentNav: (nav: NavigationItemKey) => void;
  users: User[];
  departments: Department[];
  statuses: JobStatus[];
  workOrders: WorkOrder[];
  notifications: AppNotification[];
  selectedFilter: string;
  setSelectedFilter: (filter: string) => void;
  isFirebaseConnected: boolean;

  // Auth methods
  loginAdmin: (companyCode: string, email: string, password: string) => { success: boolean; error?: string };
  loginUser: (companyCode: string, accessKey: string) => { success: boolean; error?: string };
  logout: () => void;
  registerAdminAndCompany: (data: {
    companyName: string;
    companyCode: string;
    companyCodeConfirm: string;
    adminName: string;
    adminEmail: string;
    adminEmailConfirm: string;
    adminPassword: string;
    adminPasswordConfirm: string;
  }) => { success: boolean; error?: string };
  recoverAdminCredentials: (companyCode: string, email: string) => { success: boolean; message: string; temporaryPassword?: string };
  quickSwitchUser: (userId: string) => void;

  // Work Orders methods
  createWorkOrder: (data: Omit<WorkOrder, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'alerts'> & { initialAlert?: string }) => { success: boolean; error?: string };
  updateWorkOrder: (id: string, updates: Partial<WorkOrder>) => { success: boolean; error?: string };
  deleteWorkOrder: (id: string) => { success: boolean; error?: string };
  addAlertToJob: (workOrderId: string, alertText: string) => void;
  removeAlertFromJob: (workOrderId: string, alertId: string) => void;
  updateJobNotes: (workOrderId: string, notes: string) => void;
  uploadJobPdf: (workOrderId: string, file: File) => Promise<boolean>;
  deleteJobPdf: (workOrderId: string) => void;

  // Departments methods (Admin only)
  createDepartment: (name: string) => { success: boolean; error?: string };
  updateDepartment: (id: string, name: string) => { success: boolean; error?: string };
  deleteDepartment: (id: string) => { success: boolean; error?: string };

  // Statuses methods (Admin only)
  createStatus: (name: string, color?: string, isCompleted?: boolean) => { success: boolean; error?: string };
  updateStatus: (id: string, name: string, color?: string, isCompleted?: boolean) => { success: boolean; error?: string };
  deleteStatus: (id: string) => { success: boolean; error?: string };

  // Users methods (Admin only)
  createUser: (data: {
    name: string;
    accessKey: string;
    accessKeyConfirm: string;
    role: UserRole;
    departmentIds: string[];
    email?: string;
    emailConfirm?: string;
  }) => { success: boolean; error?: string };
  updateUser: (id: string, data: Partial<User>) => { success: boolean; error?: string };
  deleteUser: (id: string) => { success: boolean; error?: string };

  // Notifications methods
  userNotifications: AppNotification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;

  // Helpers
  getDepartmentName: (id: string) => string;
  getStatus: (id: string) => JobStatus | undefined;
  getUser: (id: string) => User | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CURRENT_USER: 'operio_current_user_v3',
  COMPANIES: 'operio_companies_v3',
  USERS: 'operio_users_v3',
  DEPARTMENTS: 'operio_departments_v3',
  STATUSES: 'operio_statuses_v3',
  WORK_ORDERS: 'operio_work_orders_v3',
  NOTIFICATIONS: 'operio_notifications_v3',
};

// Helper function to remove undefined properties before sending to Firestore
function sanitizeForFirestore<T>(data: T): Record<string, unknown> {
  const json = JSON.stringify(data, (_, value) => (value === undefined ? null : value));
  return JSON.parse(json);
}

async function fsSet(collectionName: string, id: string, data: unknown) {
  try {
    const cleanData = sanitizeForFirestore(data);
    await setDoc(doc(db, collectionName, id), cleanData, { merge: true });
  } catch (err) {
    console.warn(`Firestore setDoc error on ${collectionName}/${id}:`, err);
  }
}

async function fsUpdate(collectionName: string, id: string, data: unknown) {
  try {
    const cleanData = sanitizeForFirestore(data);
    await updateDoc(doc(db, collectionName, id), cleanData);
  } catch (err) {
    console.warn(`Firestore updateDoc error on ${collectionName}/${id}:`, err);
  }
}

async function fsDelete(collectionName: string, id: string) {
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (err) {
    console.warn(`Firestore deleteDoc error on ${collectionName}/${id}:`, err);
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COMPANIES);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_COMPANIES;
  });

  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_USERS;
  });

  const [allDepartments, setAllDepartments] = useState<Department[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_DEPARTMENTS;
  });

  const [allStatuses, setAllStatuses] = useState<JobStatus[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STATUSES);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_STATUSES;
  });

  const [allWorkOrders, setAllWorkOrders] = useState<WorkOrder[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.WORK_ORDERS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_WORK_ORDERS;
  });

  const [allNotifications, setAllNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_NOTIFICATIONS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return null;
  });

  const [currentNav, setCurrentNav] = useState<NavigationItemKey>('panel_de_control');
  const [selectedFilter, setSelectedFilter] = useState<string>('todos');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  // Keep a reference to current user to avoid stale closures
  const currentUserRef = useRef<User | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // ==========================================
  // REAL-TIME FIRESTORE SYNCHRONIZATION
  // ==========================================
  useEffect(() => {
    // 1. Sync Companies
    const unsubCompanies = onSnapshot(
      collection(db, 'companies'),
      (snapshot) => {
        setIsFirebaseConnected(true);
        if (!snapshot.empty) {
          const remoteCompanies: Company[] = [];
          snapshot.forEach((d) => remoteCompanies.push(d.data() as Company));
          setCompanies(remoteCompanies);
        }
      },
      (err) => {
        console.warn('Firebase companies listener warning:', err);
      }
    );

    // 2. Sync Users
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setIsFirebaseConnected(true);
        if (!snapshot.empty) {
          const remoteUsers: User[] = [];
          snapshot.forEach((d) => remoteUsers.push(d.data() as User));
          setAllUsers(remoteUsers);

          // Update active session user if their profile was updated
          if (currentUserRef.current) {
            const matched = remoteUsers.find((u) => u.id === currentUserRef.current?.id);
            if (matched) {
              setCurrentUser(matched);
            }
          }
        }
      },
      (err) => {
        console.warn('Firebase users listener warning:', err);
      }
    );

    // 3. Sync Departments
    const unsubDepartments = onSnapshot(
      collection(db, 'departments'),
      (snapshot) => {
        setIsFirebaseConnected(true);
        if (!snapshot.empty) {
          const remoteDepts: Department[] = [];
          snapshot.forEach((d) => remoteDepts.push(d.data() as Department));
          setAllDepartments(remoteDepts);
        }
      },
      (err) => {
        console.warn('Firebase departments listener warning:', err);
      }
    );

    // 4. Sync Job Statuses
    const unsubStatuses = onSnapshot(
      collection(db, 'statuses'),
      (snapshot) => {
        setIsFirebaseConnected(true);
        if (!snapshot.empty) {
          const remoteStatuses: JobStatus[] = [];
          snapshot.forEach((d) => remoteStatuses.push(d.data() as JobStatus));
          setAllStatuses(remoteStatuses);
        }
      },
      (err) => {
        console.warn('Firebase statuses listener warning:', err);
      }
    );

    // 5. Sync Work Orders (Real-time updates for OTs, status, alerts, notes)
    const unsubWorkOrders = onSnapshot(
      collection(db, 'workOrders'),
      (snapshot) => {
        setIsFirebaseConnected(true);
        const remoteOrders: WorkOrder[] = [];
        snapshot.forEach((d) => remoteOrders.push(d.data() as WorkOrder));
        remoteOrders.sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime()
        );
        setAllWorkOrders(remoteOrders);
      },
      (err) => {
        console.warn('Firebase workOrders listener warning:', err);
      }
    );

    // 6. Sync Notifications
    const unsubNotifications = onSnapshot(
      collection(db, 'notifications'),
      (snapshot) => {
        setIsFirebaseConnected(true);
        const remoteNotifs: AppNotification[] = [];
        snapshot.forEach((d) => remoteNotifs.push(d.data() as AppNotification));
        remoteNotifs.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setAllNotifications(remoteNotifs);
      },
      (err) => {
        console.warn('Firebase notifications listener warning:', err);
      }
    );

    return () => {
      unsubCompanies();
      unsubUsers();
      unsubDepartments();
      unsubStatuses();
      unsubWorkOrders();
      unsubNotifications();
    };
  }, []);

  // Local storage persistence backups
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(allDepartments));
  }, [allDepartments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STATUSES, JSON.stringify(allStatuses));
  }, [allStatuses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(allWorkOrders));
  }, [allWorkOrders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(allNotifications));
  }, [allNotifications]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  // Derive current company from current user
  const currentCompany = useMemo(() => {
    if (!currentUser) return null;
    return companies.find((c) => c.id === currentUser.companyId) || null;
  }, [currentUser, companies]);

  // Scoped views for the current company
  const companyId = currentCompany?.id;

  const users = useMemo(() => {
    if (!companyId) return [];
    return allUsers.filter((u) => u.companyId === companyId);
  }, [allUsers, companyId]);

  const departments = useMemo(() => {
    if (!companyId) return [];
    return allDepartments.filter((d) => d.companyId === companyId);
  }, [allDepartments, companyId]);

  const statuses = useMemo(() => {
    if (!companyId) return [];
    return allStatuses.filter((s) => s.companyId === companyId);
  }, [allStatuses, companyId]);

  const workOrders = useMemo(() => {
    if (!companyId) return [];
    return allWorkOrders.filter((w) => w.companyId === companyId);
  }, [allWorkOrders, companyId]);

  const notifications = useMemo(() => {
    if (!companyId) return [];
    return allNotifications.filter((n) => n.companyId === companyId);
  }, [allNotifications, companyId]);

  // Sanitize deleted department IDs from company users
  useEffect(() => {
    const validDeptIds = new Set(allDepartments.map((d) => d.id));
    setAllUsers((prev) => {
      let hasChanges = false;
      const updated = prev.map((u) => {
        const cleaned = (u.departmentIds || []).filter((dId) => validDeptIds.has(dId));
        if (cleaned.length !== (u.departmentIds || []).length) {
          hasChanges = true;
          // Update Firestore user document
          fsUpdate('users', u.id, { departmentIds: cleaned });
          return { ...u, departmentIds: cleaned };
        }
        return u;
      });
      return hasChanges ? updated : prev;
    });
  }, [allDepartments]);

  // Push notification helper with Firestore sync
  const sendNotification = (
    notification: Omit<AppNotification, 'id' | 'companyId' | 'createdAt' | 'read'>
  ) => {
    if (!companyId) return;
    const newNotif: AppNotification = {
      ...notification,
      companyId,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setAllNotifications((prev) => [newNotif, ...prev]);
    fsSet('notifications', newNotif.id, newNotif);
  };

  // Helper getters
  const getDepartmentName = (id: string) => {
    const dept = departments.find((d) => d.id === id);
    return dept ? dept.name : '';
  };

  const getStatus = (id: string) => {
    return statuses.find((s) => s.id === id);
  };

  const getUser = (id: string) => {
    return users.find((u) => u.id === id);
  };

  // ==========================================
  // AUTHENTICATION LOGIC
  // ==========================================

  /**
   * Administrator Login:
   * Requires: Company Code + Admin Email + Password
   */
  const loginAdmin = (companyCode: string, email: string, password: string) => {
    const normCode = companyCode.trim().toUpperCase();
    const normEmail = email.trim().toLowerCase();

    const company = companies.find((c) => c.code.trim().toUpperCase() === normCode);
    if (!company) {
      return { success: false, error: `No se encuentra ninguna empresa con el código "${companyCode}".` };
    }

    const adminUser = allUsers.find(
      (u) =>
        u.companyId === company.id &&
        u.role === 'administrador' &&
        u.email?.trim().toLowerCase() === normEmail
    );

    if (!adminUser) {
      return {
        success: false,
        error: `No existe ningún administrador con el correo "${email}" en la empresa ${company.name}.`,
      };
    }

    if (adminUser.accessKey !== password) {
      return { success: false, error: 'La contraseña introducida es incorrecta.' };
    }

    setCurrentUser(adminUser);
    setCurrentNav('panel_de_control');
    return { success: true };
  };

  /**
   * Employee / Operator / Solo Lectura Login:
   * Requires ONLY: Company Code + Personal Access Key
   */
  const loginUser = (companyCode: string, accessKey: string) => {
    const normCode = companyCode.trim().toUpperCase();
    const trimmedKey = accessKey.trim();

    if (!normCode) {
      return { success: false, error: 'Por favor, introduce el código de la empresa.' };
    }
    if (!trimmedKey) {
      return { success: false, error: 'Por favor, introduce tu clave de acceso.' };
    }

    const company = companies.find((c) => c.code.trim().toUpperCase() === normCode);
    if (!company) {
      return { success: false, error: `No se encuentra ninguna empresa con el código "${companyCode}".` };
    }

    const matchedUser = allUsers.find(
      (u) => u.companyId === company.id && u.accessKey.trim() === trimmedKey
    );

    if (!matchedUser) {
      return {
        success: false,
        error: `La clave de acceso no corresponde a ningún usuario en la empresa ${company.name} (${company.code}).`,
      };
    }

    setCurrentUser(matchedUser);
    setCurrentNav('panel_de_control');
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentNav('panel_de_control');
  };

  /**
   * Register a new Administrator and Company:
   * Sets up Company Code, Company Name, and Admin profile
   */
  const registerAdminAndCompany = (data: {
    companyName: string;
    companyCode: string;
    companyCodeConfirm: string;
    adminName: string;
    adminEmail: string;
    adminEmailConfirm: string;
    adminPassword: string;
    adminPasswordConfirm: string;
  }) => {
    if (!data.companyName.trim()) return { success: false, error: 'Introduce el nombre de la empresa.' };
    if (!data.companyCode.trim()) return { success: false, error: 'Introduce el código único de la empresa.' };
    if (data.companyCode.trim().toUpperCase() !== data.companyCodeConfirm.trim().toUpperCase()) {
      return { success: false, error: 'Los dos códigos de empresa introducidos no coinciden.' };
    }

    const normCode = data.companyCode.trim().toUpperCase();
    if (companies.some((c) => c.code.toUpperCase() === normCode)) {
      return { success: false, error: `El código de empresa "${normCode}" ya está en uso. Por favor, elige otro.` };
    }

    if (!data.adminName.trim()) return { success: false, error: 'Introduce el nombre del administrador.' };
    if (!data.adminEmail.trim()) return { success: false, error: 'Introduce el correo electrónico.' };
    if (data.adminEmail.trim().toLowerCase() !== data.adminEmailConfirm.trim().toLowerCase()) {
      return { success: false, error: 'Los correos electrónicos introducidos no coinciden.' };
    }
    if (!data.adminPassword) return { success: false, error: 'Introduce la contraseña del administrador.' };
    if (data.adminPassword !== data.adminPasswordConfirm) {
      return { success: false, error: 'Las contraseñas del administrador no coinciden.' };
    }

    const newCompanyId = `comp-${Date.now()}`;
    const newCompany: Company = {
      id: newCompanyId,
      code: normCode,
      name: data.companyName.trim(),
      createdAt: new Date().toISOString(),
    };

    // Default initial departments for this new company
    const newDepts: Department[] = [
      { id: `dept-${Date.now()}-1`, companyId: newCompanyId, name: 'Mecanizado y Fabricación' },
      { id: `dept-${Date.now()}-2`, companyId: newCompanyId, name: 'Montaje y Ensamblaje' },
      { id: `dept-${Date.now()}-3`, companyId: newCompanyId, name: 'Control de Calidad' },
    ];

    // Default initial statuses for this new company
    const newStatuses: JobStatus[] = [
      { id: `stat-${Date.now()}-1`, companyId: newCompanyId, name: 'Pendiente', color: 'amber', isCompleted: false },
      { id: `stat-${Date.now()}-2`, companyId: newCompanyId, name: 'En curso', color: 'sky', isCompleted: false },
      { id: `stat-${Date.now()}-3`, companyId: newCompanyId, name: 'Control de calidad', color: 'indigo', isCompleted: false },
      { id: `stat-${Date.now()}-4`, companyId: newCompanyId, name: 'Terminado', color: 'emerald', isCompleted: true },
    ];

    // Administrator user
    const newAdmin: User = {
      id: `user-admin-${Date.now()}`,
      companyId: newCompanyId,
      name: data.adminName.trim(),
      email: data.adminEmail.trim().toLowerCase(),
      accessKey: data.adminPassword,
      role: 'administrador',
      departmentIds: newDepts.map((d) => d.id),
      createdAt: new Date().toISOString(),
    };

    // Optimistic local state update
    setCompanies((prev) => [...prev, newCompany]);
    setAllDepartments((prev) => [...prev, ...newDepts]);
    setAllStatuses((prev) => [...prev, ...newStatuses]);
    setAllUsers((prev) => [...prev, newAdmin]);
    setCurrentUser(newAdmin);
    setCurrentNav('panel_de_control');

    // Real-time Firestore write
    fsSet('companies', newCompany.id, newCompany);
    newDepts.forEach((d) => fsSet('departments', d.id, d));
    newStatuses.forEach((s) => fsSet('statuses', s.id, s));
    fsSet('users', newAdmin.id, newAdmin);

    return { success: true };
  };

  const recoverAdminCredentials = (companyCode: string, email: string) => {
    const normCode = companyCode.trim().toUpperCase();
    const normEmail = email.trim().toLowerCase();

    const company = companies.find((c) => c.code.toUpperCase() === normCode);
    if (!company) {
      return { success: false, message: `No encontramos ninguna empresa con el código "${companyCode}".` };
    }

    const adminUser = allUsers.find(
      (u) =>
        u.companyId === company.id &&
        u.role === 'administrador' &&
        u.email?.toLowerCase() === normEmail
    );

    if (!adminUser) {
      return {
        success: false,
        message: `No existe ningún administrador con el correo "${email}" en la empresa ${company.name}.`,
      };
    }

    const tempPass = `adm-${Math.random().toString(36).substring(2, 7)}`;
    setAllUsers((prev) =>
      prev.map((u) => (u.id === adminUser.id ? { ...u, accessKey: tempPass } : u))
    );

    // Sync to Firestore
    fsUpdate('users', adminUser.id, { accessKey: tempPass });

    return {
      success: true,
      message: `Se ha restablecido la clave para ${adminUser.name} en ${company.name}. Tu clave provisional es: ${tempPass}`,
      temporaryPassword: tempPass,
    };
  };

  const quickSwitchUser = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setCurrentNav('panel_de_control');
    }
  };

  // ==========================================
  // WORK ORDERS LOGIC
  // ==========================================
  const createWorkOrder = (
    data: Omit<WorkOrder, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'alerts'> & { initialAlert?: string }
  ) => {
    if (!currentUser || currentUser.role !== 'administrador' || !companyId) {
      return { success: false, error: 'Solo el administrador puede crear nuevos trabajos.' };
    }
    if (!data.ot.trim()) return { success: false, error: 'El número de Orden de Trabajo (OT) es obligatorio.' };
    if (!data.client.trim()) return { success: false, error: 'El cliente es obligatorio.' };

    const initialAlerts: WorkAlert[] = [];
    if (data.initialAlert && data.initialAlert.trim()) {
      initialAlerts.push({
        id: `al-${Date.now()}`,
        text: data.initialAlert.trim(),
        createdAt: new Date().toISOString(),
        createdByName: currentUser.name,
      });
    }

    const newOrder: WorkOrder = {
      id: `wo-${Date.now()}`,
      companyId,
      ot: data.ot.trim().toUpperCase(),
      client: data.client.trim(),
      deliveryDate: data.deliveryDate || undefined,
      assignedOperatorId: data.assignedOperatorId,
      departmentId: data.departmentId,
      statusId: data.statusId || statuses[0]?.id || '',
      isUrgent: data.isUrgent || false,
      alerts: initialAlerts,
      notes: data.notes || '',
      pdfAttachment: data.pdfAttachment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAllWorkOrders((prev) => [newOrder, ...prev]);

    // Sync new Work Order to Firestore
    fsSet('workOrders', newOrder.id, newOrder);

    if (newOrder.assignedOperatorId) {
      sendNotification({
        userId: newOrder.assignedOperatorId,
        workOrderId: newOrder.id,
        ot: newOrder.ot,
        title: 'Nuevo trabajo asignado',
        message: `El administrador te ha asignado la orden de trabajo ${newOrder.ot} para "${newOrder.client}".`,
        type: 'new_assignment',
      });

      if (newOrder.isUrgent) {
        sendNotification({
          userId: newOrder.assignedOperatorId,
          workOrderId: newOrder.id,
          ot: newOrder.ot,
          title: 'Trabajo marcado como URGENTE',
          message: `La orden ${newOrder.ot} que se te ha asignado está clasificada como URGENTE.`,
          type: 'urgent_marked',
        });
      }
    }

    return { success: true };
  };

  const updateWorkOrder = (id: string, updates: Partial<WorkOrder>) => {
    const existing = allWorkOrders.find((w) => w.id === id);
    if (!existing) return { success: false, error: 'Trabajo no encontrado.' };

    if (!currentUser) return { success: false, error: 'Debes iniciar sesión.' };

    if (currentUser.role === 'solo_lectura') {
      return { success: false, error: 'El usuario de solo lectura no tiene permisos de modificación.' };
    }

    const finalUpdates: Partial<WorkOrder> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (currentUser.role === 'operario') {
      delete finalUpdates.ot;
      delete finalUpdates.client;
      delete finalUpdates.deliveryDate;
    }

    // Status change notifications
    if (updates.statusId && updates.statusId !== existing.statusId) {
      const oldStatus = getStatus(existing.statusId)?.name || 'Anterior';
      const newStatus = getStatus(updates.statusId)?.name || 'Nuevo';

      if (currentUser.role === 'operario') {
        sendNotification({
          userId: 'admin',
          workOrderId: existing.id,
          ot: existing.ot,
          title: `Cambio de estado en ${existing.ot}`,
          message: `El operario ${currentUser.name} ha cambiado el estado de "${oldStatus}" a "${newStatus}" en la orden ${existing.ot}.`,
          type: 'status_change',
        });
      } else if (currentUser.role === 'administrador') {
        if (existing.assignedOperatorId) {
          sendNotification({
            userId: existing.assignedOperatorId,
            workOrderId: existing.id,
            ot: existing.ot,
            title: `Actualización de estado en ${existing.ot}`,
            message: `El administrador ha actualizado el estado de tu orden ${existing.ot} a "${newStatus}".`,
            type: 'status_change',
          });
        }
      }
    }

    if (updates.assignedOperatorId && updates.assignedOperatorId !== existing.assignedOperatorId) {
      sendNotification({
        userId: updates.assignedOperatorId,
        workOrderId: existing.id,
        ot: existing.ot,
        title: 'Nuevo trabajo asignado',
        message: `Se te ha asignado la orden de trabajo ${existing.ot} (${existing.client}).`,
        type: 'new_assignment',
      });
    }

    if (currentUser.role === 'administrador' && updates.isUrgent !== undefined && updates.isUrgent !== existing.isUrgent) {
      if (updates.isUrgent && existing.assignedOperatorId) {
        sendNotification({
          userId: existing.assignedOperatorId,
          workOrderId: existing.id,
          ot: existing.ot,
          title: 'Trabajo clasificado como URGENTE',
          message: `El administrador ha marcado tu trabajo ${existing.ot} como URGENTE.`,
          type: 'urgent_marked',
        });
      }
    }

    setAllWorkOrders((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...finalUpdates } : w))
    );

    // Sync updates to Firestore
    fsUpdate('workOrders', id, finalUpdates);

    return { success: true };
  };

  const deleteWorkOrder = (id: string) => {
    if (!currentUser || currentUser.role !== 'administrador') {
      return { success: false, error: 'Solo el administrador puede borrar trabajos.' };
    }
    setAllWorkOrders((prev) => prev.filter((w) => w.id !== id));
    fsDelete('workOrders', id);
    return { success: true };
  };

  const addAlertToJob = (workOrderId: string, alertText: string) => {
    if (!alertText.trim()) return;
    const existing = allWorkOrders.find((w) => w.id === workOrderId);
    if (!existing) return;

    const newAlert: WorkAlert = {
      id: `al-${Date.now()}`,
      text: alertText.trim(),
      createdAt: new Date().toISOString(),
      createdByName: currentUser?.name || 'Usuario',
    };

    const updatedAlerts = [...existing.alerts, newAlert];
    const updatedAt = new Date().toISOString();

    setAllWorkOrders((prev) =>
      prev.map((w) =>
        w.id === workOrderId ? { ...w, alerts: updatedAlerts, updatedAt } : w
      )
    );

    fsUpdate('workOrders', workOrderId, { alerts: updatedAlerts, updatedAt });

    if (currentUser?.role === 'operario') {
      sendNotification({
        userId: 'admin',
        workOrderId: existing.id,
        ot: existing.ot,
        title: `Nueva alerta en ${existing.ot}`,
        message: `El operario ${currentUser.name} ha reportado una alerta en ${existing.ot}: "${alertText.trim()}".`,
        type: 'alert_change',
      });
    } else if (currentUser?.role === 'administrador') {
      if (existing.assignedOperatorId) {
        sendNotification({
          userId: existing.assignedOperatorId,
          workOrderId: existing.id,
          ot: existing.ot,
          title: `Alerta añadida en ${existing.ot}`,
          message: `El administrador ha añadido una alerta a tu trabajo: "${alertText.trim()}".`,
          type: 'alert_change',
        });
      }
    }
  };

  const removeAlertFromJob = (workOrderId: string, alertId: string) => {
    const existing = allWorkOrders.find((w) => w.id === workOrderId);
    if (!existing) return;

    const removed = existing.alerts.find((a) => a.id === alertId);
    const updatedAlerts = existing.alerts.filter((a) => a.id !== alertId);
    const updatedAt = new Date().toISOString();

    setAllWorkOrders((prev) =>
      prev.map((w) =>
        w.id === workOrderId ? { ...w, alerts: updatedAlerts, updatedAt } : w
      )
    );

    fsUpdate('workOrders', workOrderId, { alerts: updatedAlerts, updatedAt });

    if (currentUser?.role === 'operario' && removed) {
      sendNotification({
        userId: 'admin',
        workOrderId: existing.id,
        ot: existing.ot,
        title: `Alerta resuelta en ${existing.ot}`,
        message: `El operario ${currentUser.name} ha retirado la alerta: "${removed.text}".`,
        type: 'alert_change',
      });
    }
  };

  const updateJobNotes = (workOrderId: string, notes: string) => {
    const updatedAt = new Date().toISOString();
    setAllWorkOrders((prev) =>
      prev.map((w) =>
        w.id === workOrderId ? { ...w, notes, updatedAt } : w
      )
    );
    fsUpdate('workOrders', workOrderId, { notes, updatedAt });
  };

  const uploadJobPdf = async (workOrderId: string, file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const updatedAt = new Date().toISOString();
        const pdfAttachment = {
          name: file.name,
          size: file.size,
          dataUrl,
          uploadedAt: updatedAt,
        };

        setAllWorkOrders((prev) =>
          prev.map((w) =>
            w.id === workOrderId ? { ...w, pdfAttachment, updatedAt } : w
          )
        );

        // If file is smaller than ~600KB, sync complete attachment to Firestore
        if (dataUrl.length < 800000) {
          fsUpdate('workOrders', workOrderId, { pdfAttachment, updatedAt });
        } else {
          // Sync metadata so other nodes know file exists without exceeding 1MB doc limit
          fsUpdate('workOrders', workOrderId, {
            pdfAttachment: { name: file.name, size: file.size, dataUrl: '', uploadedAt: updatedAt },
            updatedAt,
          });
        }
        resolve(true);
      };
      reader.onerror = () => resolve(false);
      reader.readAsDataURL(file);
    });
  };

  const deleteJobPdf = (workOrderId: string) => {
    if (currentUser?.role !== 'administrador') return;
    const updatedAt = new Date().toISOString();
    setAllWorkOrders((prev) =>
      prev.map((w) =>
        w.id === workOrderId
          ? { ...w, pdfAttachment: undefined, updatedAt }
          : w
      )
    );
    fsUpdate('workOrders', workOrderId, { pdfAttachment: null, updatedAt });
  };

  // ==========================================
  // DEPARTMENTS CRUD
  // ==========================================
  const createDepartment = (name: string) => {
    if (!currentUser || currentUser.role !== 'administrador' || !companyId) {
      return { success: false, error: 'Solo el administrador puede crear departamentos.' };
    }
    if (!name.trim()) return { success: false, error: 'El nombre del departamento es obligatorio.' };

    const newDept: Department = {
      id: `dept-${Date.now()}`,
      companyId,
      name: name.trim(),
    };
    setAllDepartments((prev) => [...prev, newDept]);
    fsSet('departments', newDept.id, newDept);
    return { success: true };
  };

  const updateDepartment = (id: string, name: string) => {
    if (!currentUser || currentUser.role !== 'administrador') {
      return { success: false, error: 'Solo el administrador puede editar departamentos.' };
    }
    if (!name.trim()) return { success: false, error: 'El nombre no puede estar vacío.' };

    setAllDepartments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: name.trim() } : d))
    );
    fsUpdate('departments', id, { name: name.trim() });
    return { success: true };
  };

  const deleteDepartment = (id: string) => {
    if (!currentUser || currentUser.role !== 'administrador') {
      return { success: false, error: 'Solo el administrador puede borrar departamentos.' };
    }
    setAllDepartments((prev) => prev.filter((d) => d.id !== id));
    fsDelete('departments', id);

    setAllUsers((prev) =>
      prev.map((u) => {
        const cleaned = (u.departmentIds || []).filter((deptId) => deptId !== id);
        if (cleaned.length !== (u.departmentIds || []).length) {
          fsUpdate('users', u.id, { departmentIds: cleaned });
          return { ...u, departmentIds: cleaned };
        }
        return u;
      })
    );

    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            departmentIds: (prev.departmentIds || []).filter((deptId) => deptId !== id),
          }
        : null
    );
    return { success: true };
  };

  // ==========================================
  // STATUSES CRUD
  // ==========================================
  const createStatus = (name: string, color = 'sky', isCompleted = false) => {
    if (!currentUser || currentUser.role !== 'administrador' || !companyId) {
      return { success: false, error: 'Solo el administrador puede crear estados.' };
    }
    if (!name.trim()) return { success: false, error: 'El nombre del estado es obligatorio.' };

    const newStatus: JobStatus = {
      id: `stat-${Date.now()}`,
      companyId,
      name: name.trim(),
      color,
      isCompleted,
    };
    setAllStatuses((prev) => [...prev, newStatus]);
    fsSet('statuses', newStatus.id, newStatus);
    return { success: true };
  };

  const updateStatus = (id: string, name: string, color = 'sky', isCompleted = false) => {
    if (!currentUser || currentUser.role !== 'administrador') {
      return { success: false, error: 'Solo el administrador puede editar estados.' };
    }
    if (!name.trim()) return { success: false, error: 'El nombre no puede estar vacío.' };

    setAllStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: name.trim(), color, isCompleted } : s))
    );
    fsUpdate('statuses', id, { name: name.trim(), color, isCompleted });
    return { success: true };
  };

  const deleteStatus = (id: string) => {
    if (!currentUser || currentUser.role !== 'administrador') {
      return { success: false, error: 'Solo el administrador puede borrar estados.' };
    }
    setAllStatuses((prev) => prev.filter((s) => s.id !== id));
    fsDelete('statuses', id);
    return { success: true };
  };

  // ==========================================
  // USERS CRUD
  // ==========================================
  const createUser = (data: {
    name: string;
    accessKey: string;
    accessKeyConfirm: string;
    role: UserRole;
    departmentIds: string[];
    email?: string;
    emailConfirm?: string;
  }) => {
    if (!currentUser || currentUser.role !== 'administrador' || !companyId) {
      return { success: false, error: 'Solo el administrador puede crear usuarios.' };
    }
    if (!data.name.trim()) return { success: false, error: 'El nombre es obligatorio.' };
    if (!data.accessKey || !data.accessKeyConfirm) {
      return { success: false, error: 'Introduce la clave de acceso adjudicada por partida doble.' };
    }
    if (data.accessKey !== data.accessKeyConfirm) {
      return { success: false, error: 'Las dos claves de acceso no coinciden.' };
    }

    if (data.role === 'administrador') {
      if (!data.email || !data.emailConfirm) {
        return { success: false, error: 'El correo electrónico es obligatorio para el administrador.' };
      }
      if (data.email.trim().toLowerCase() !== data.emailConfirm.trim().toLowerCase()) {
        return { success: false, error: 'Los dos correos electrónicos no coinciden.' };
      }
    }

    // Check key uniqueness within this company
    const keyTrimmed = data.accessKey.trim();
    const existingWithKey = allUsers.find(
      (u) => u.companyId === companyId && u.accessKey.trim().toLowerCase() === keyTrimmed.toLowerCase()
    );
    if (existingWithKey) {
      return {
        success: false,
        error: `La clave de acceso "${keyTrimmed}" ya está asignada a "${existingWithKey.name}". Asigna una clave única.`,
      };
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      companyId,
      name: data.name.trim(),
      accessKey: keyTrimmed,
      role: data.role,
      departmentIds: data.departmentIds,
      email: data.role === 'administrador' ? data.email?.trim().toLowerCase() : undefined,
      createdAt: new Date().toISOString(),
    };

    setAllUsers((prev) => [...prev, newUser]);
    fsSet('users', newUser.id, newUser);
    return { success: true };
  };

  const updateUser = (id: string, data: Partial<User>) => {
    if (!currentUser || currentUser.role !== 'administrador') {
      return { success: false, error: 'Solo el administrador puede editar usuarios.' };
    }
    setAllUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
    fsUpdate('users', id, data);
    return { success: true };
  };

  const deleteUser = (id: string) => {
    if (!currentUser || currentUser.role !== 'administrador') {
      return { success: false, error: 'Solo el administrador puede borrar usuarios.' };
    }
    if (currentUser.id === id) {
      return { success: false, error: 'No puedes borrar tu propio usuario activo.' };
    }
    setAllUsers((prev) => prev.filter((u) => u.id !== id));
    fsDelete('users', id);
    return { success: true };
  };

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  const userNotifications = notifications.filter((n) => {
    if (!currentUser) return false;
    if (currentUser.role === 'administrador') {
      return n.userId === 'admin' || n.userId === currentUser.id;
    }
    if (currentUser.role === 'operario') {
      return n.userId === currentUser.id;
    }
    return false;
  });

  const unreadNotificationsCount = userNotifications.filter((n) => !n.read).length;

  const markNotificationAsRead = (id: string) => {
    setAllNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    fsUpdate('notifications', id, { read: true });
  };

  const markAllNotificationsAsRead = () => {
    if (!currentUser) return;
    setAllNotifications((prev) =>
      prev.map((n) => {
        const belongs =
          currentUser.role === 'administrador'
            ? n.userId === 'admin' || n.userId === currentUser.id
            : n.userId === currentUser.id;
        if (belongs && !n.read) {
          fsUpdate('notifications', n.id, { read: true });
          return { ...n, read: true };
        }
        return n;
      })
    );
  };

  const clearNotification = (id: string) => {
    setAllNotifications((prev) => prev.filter((n) => n.id !== id));
    fsDelete('notifications', id);
  };

  const clearAllNotifications = () => {
    if (!currentUser) return;
    setAllNotifications((prev) => {
      prev.forEach((n) => {
        const belongs =
          currentUser.role === 'administrador'
            ? n.userId === 'admin' || n.userId === currentUser.id
            : n.userId === currentUser.id;
        if (belongs) {
          fsDelete('notifications', n.id);
        }
      });
      return prev.filter((n) => {
        if (currentUser.role === 'administrador') {
          return n.userId !== 'admin' && n.userId !== currentUser.id;
        }
        return n.userId !== currentUser.id;
      });
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentCompany,
        companies,
        currentNav,
        setCurrentNav,
        users,
        departments,
        statuses,
        workOrders,
        notifications,
        selectedFilter,
        setSelectedFilter,
        isFirebaseConnected,
        loginAdmin,
        loginUser,
        logout,
        registerAdminAndCompany,
        recoverAdminCredentials,
        quickSwitchUser,
        createWorkOrder,
        updateWorkOrder,
        deleteWorkOrder,
        addAlertToJob,
        removeAlertFromJob,
        updateJobNotes,
        uploadJobPdf,
        deleteJobPdf,
        createDepartment,
        updateDepartment,
        deleteDepartment,
        createStatus,
        updateStatus,
        deleteStatus,
        createUser,
        updateUser,
        deleteUser,
        userNotifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotification,
        clearAllNotifications,
        getDepartmentName,
        getStatus,
        getUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
