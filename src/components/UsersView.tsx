import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, UserRole } from '../types';
import {
  Users as UsersIcon,
  Plus,
  Edit2,
  Trash2,
  X,
  Shield,
  Wrench,
  Eye,
  Key,
  Copy,
  Check,
  Building,
  Info,
  Sparkles,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export const UsersView: React.FC = () => {
  const {
    currentUser,
    currentCompany,
    users,
    departments,
    createUser,
    updateUser,
    deleteUser,
    updateCompanyDetails,
    setCurrentNav,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<User | null>(null);

  // Form fields
  const [role, setRole] = useState<UserRole>('operario');
  const [name, setName] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [accessKeyConfirm, setAccessKeyConfirm] = useState('');
  const [adminCompanyCif, setAdminCompanyCif] = useState('');
  const [adminCompanyCode, setAdminCompanyCode] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedKeyUserId, setCopiedKeyUserId] = useState<string | null>(null);

  if (currentUser?.role !== 'administrador') {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-center">
        Acceso restringido: Solo el administrador puede gestionar los usuarios.
      </div>
    );
  }

  const handleOpenCreate = () => {
    setEditingUserId(null);
    setRole('operario');
    setName('');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setAccessKey(`OP-${randomSuffix}`);
    setAccessKeyConfirm(`OP-${randomSuffix}`);
    setAdminCompanyCif(currentCompany?.cif || '');
    setAdminCompanyCode(currentCompany?.code || '');
    setSelectedDeptIds(departments.length > 0 ? [departments[0].id] : []);
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUserId(user.id);
    setRole(user.role);
    setName(user.name);
    setAccessKey(user.accessKey);
    setAccessKeyConfirm(user.accessKey);
    setAdminCompanyCif(currentCompany?.cif || '');
    setAdminCompanyCode(currentCompany?.code || '');
    const validDeptIds = (user.departmentIds || []).filter((id) =>
      departments.some((d) => d.id === id)
    );
    setSelectedDeptIds(validDeptIds);
    setErrorMsg('');
    setModalOpen(true);
  };

  const toggleDept = (deptId: string) => {
    if (selectedDeptIds.includes(deptId)) {
      setSelectedDeptIds(selectedDeptIds.filter((id) => id !== deptId));
    } else {
      setSelectedDeptIds([...selectedDeptIds, deptId]);
    }
  };

  const generateSuggestionKey = () => {
    const prefix =
      role === 'operario'
        ? 'OP'
        : role === 'administrativo'
        ? 'ADM'
        : role === 'solo_lectura'
        ? 'LEC'
        : 'ADMIN';
    const num = Math.floor(100 + Math.random() * 900);
    const suggested = `${prefix}-${num}`;
    setAccessKey(suggested);
    setAccessKeyConfirm(suggested);
  };

  const handleSave = () => {
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }

    if (!accessKey.trim() || !accessKeyConfirm.trim()) {
      setErrorMsg(
        role === 'administrador'
          ? 'Debes introducir la contraseña por partida doble.'
          : 'Debes introducir la clave de acceso por partida doble.'
      );
      return;
    }

    if (accessKey.trim() !== accessKeyConfirm.trim()) {
      setErrorMsg(
        role === 'administrador'
          ? 'Las dos contraseñas no coinciden.'
          : 'Las dos claves de acceso no coinciden.'
      );
      return;
    }

    if (role === 'administrador') {
      if (!adminCompanyCode.trim()) {
        setErrorMsg('El código de la empresa es obligatorio.');
        return;
      }
      if (!adminCompanyCif.trim()) {
        setErrorMsg('El CIF/NIF de la empresa es obligatorio.');
        return;
      }
      const companyRes = updateCompanyDetails({
        code: adminCompanyCode.trim().toUpperCase(),
        cif: adminCompanyCif.trim().toUpperCase(),
      });
      if (!companyRes.success) {
        setErrorMsg(companyRes.error || 'Error al actualizar los datos de la empresa.');
        return;
      }
    }

    if (editingUserId) {
      const res = updateUser(editingUserId, {
        name: name.trim(),
        role,
        accessKey: accessKey.trim(),
        departmentIds: selectedDeptIds,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Error al actualizar usuario');
        return;
      }
    } else {
      const res = createUser({
        role,
        name: name.trim(),
        accessKey: accessKey.trim(),
        accessKeyConfirm: accessKeyConfirm.trim(),
        departmentIds: selectedDeptIds,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Error al crear usuario');
        return;
      }
    }

    setModalOpen(false);
  };

  const handleDeleteClick = (user: User) => {
    if (user.id === currentUser.id) {
      return;
    }
    setDeleteTargetUser(user);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetUser) {
      deleteUser(deleteTargetUser.id);
      setDeleteTargetUser(null);
    }
  };

  const handleCopyCredentials = (u: User) => {
    const creds = `Empresa: ${currentCompany?.code || ''}\nUsuario: ${u.name}\nClave de acceso: ${u.accessKey}`;
    navigator.clipboard?.writeText(creds);
    setCopiedKeyUserId(u.id);
    setTimeout(() => setCopiedKeyUserId(null), 2500);
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'administrador':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-oterio-700 bg-oterio-50 border border-oterio-200 px-2 py-0.5 rounded-full">
            <Shield className="w-3 h-3 text-oterio-600" /> Administrador
          </span>
        );
      case 'administrativo':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <FileText className="w-3 h-3 text-blue-600" /> Administrativo
          </span>
        );
      case 'operario':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Wrench className="w-3 h-3 text-emerald-600" /> Operario
          </span>
        );
      case 'solo_lectura':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <Eye className="w-3 h-3 text-amber-600" /> Sólo lectura
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {currentCompany && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-graphite-500 font-semibold">{currentCompany.name}</span>
            </div>
          )}
          <h2 className="text-2xl font-black text-graphite-900 tracking-tight">
            Gestión de Usuarios y Permisos
          </h2>
          <p className="text-xs sm:text-sm text-graphite-500 mt-0.5">
            Gestión y asignación de claves de acceso y permisos por departamento para operarios y empleados.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-oterio-600 text-white text-xs sm:text-sm font-bold hover:bg-oterio-700 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Usuario</span>
        </button>
      </div>

      {/* Grid of users */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => {
          const isMe = u.id === currentUser.id;
          const isAdmin = u.role === 'administrador';

          return (
            <div
              key={u.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                isMe ? 'border-oterio-300 ring-2 ring-oterio-50' : 'border-graphite-200/90'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-oterio-600 to-graphite-900 text-white font-bold flex items-center justify-center text-sm shadow-2xs">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-graphite-900 text-sm">{u.name}</h3>
                      {isAdmin ? (
                        <p className="text-xs text-oterio-700 font-mono font-medium">
                          CIF: {currentCompany?.cif || '-'}
                        </p>
                      ) : (
                        <p className="text-[11px] text-graphite-400 font-medium font-mono">Clave: {u.accessKey}</p>
                      )}
                    </div>
                  </div>

                  {isMe && (
                    <span className="text-[10px] font-bold text-oterio-700 bg-oterio-50 border border-oterio-200/70 px-2 py-0.5 rounded-full">
                      Tú
                    </span>
                  )}
                </div>

                <div className="mb-3">{getRoleBadge(u.role)}</div>

                {/* Credenciales de acceso adjudicadas */}
                <div className="mb-3 p-2.5 rounded-xl bg-graphite-50 border border-graphite-200/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-graphite-500 font-medium">Clave adjudicada:</span>
                    <span className="font-mono font-black text-oterio-700 bg-white px-2 py-0.5 rounded border border-oterio-200/80">
                      {u.accessKey}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(u)}
                    className="w-full mt-1.5 pt-1.5 border-t border-graphite-200/60 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-graphite-600 hover:text-oterio-600 transition-colors cursor-pointer"
                  >
                    {copiedKeyUserId === u.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">¡Datos de acceso copiados!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar credenciales de acceso</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Departamentos asignados (sólo válidos y existentes) */}
                {(() => {
                  const validDepts = (u.departmentIds || [])
                    .map((dId) => departments.find((d) => d.id === dId))
                    .filter((d): d is (typeof departments)[0] => Boolean(d));

                  if (validDepts.length === 0) return null;

                  return (
                    <div className="space-y-1.5 pt-2 border-t border-graphite-100">
                      <span className="text-[11px] font-bold text-graphite-400 uppercase tracking-wider block">
                        Departamentos asignados:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {validDepts.map((dept) => (
                          <span
                            key={dept.id}
                            className="text-[11px] bg-graphite-100 text-graphite-700 font-medium px-2 py-0.5 rounded-md"
                          >
                            {dept.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-graphite-100 text-xs">
                <span className="text-graphite-400 text-[11px]">
                  {isAdmin ? 'Cuenta de Administración' : 'Empleado'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(u)}
                    className="p-1.5 text-graphite-500 hover:text-oterio-600 hover:bg-oterio-50 rounded-lg transition-colors cursor-pointer"
                    title="Editar usuario"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!isMe && (
                    <button
                      onClick={() => handleDeleteClick(u)}
                      className="p-1.5 text-graphite-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal create / edit with role-specific fields */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-graphite-950/55 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-graphite-200 p-6 my-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-graphite-100 mb-4">
              <h3 className="font-bold text-graphite-900 text-base">
                {editingUserId
                  ? role === 'administrador'
                    ? 'Editar Administrador y Datos de Empresa'
                    : 'Editar Usuario'
                  : 'Nuevo Usuario'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-graphite-400 hover:text-graphite-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Rol: Administrador, Administrativo, Operario o Sólo lectura */}
              <div>
                <label className="block text-xs font-bold text-graphite-700 uppercase tracking-wider mb-1.5">
                  Rol de acceso *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('operario');
                      if (!editingUserId) {
                        const num = Math.floor(100 + Math.random() * 900);
                        setAccessKey(`OP-${num}`);
                        setAccessKeyConfirm(`OP-${num}`);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      role === 'operario'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200'
                        : 'bg-white border-graphite-200 text-graphite-600 hover:bg-graphite-50'
                    }`}
                  >
                    <Wrench className="w-4 h-4 text-emerald-600" />
                    <span>Operario</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('administrativo');
                      if (!editingUserId) {
                        const num = Math.floor(100 + Math.random() * 900);
                        setAccessKey(`ADM-${num}`);
                        setAccessKeyConfirm(`ADM-${num}`);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      role === 'administrativo'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-200'
                        : 'bg-white border-graphite-200 text-graphite-600 hover:bg-graphite-50'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Administrativo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('solo_lectura');
                      if (!editingUserId) {
                        const num = Math.floor(100 + Math.random() * 900);
                        setAccessKey(`LEC-${num}`);
                        setAccessKeyConfirm(`LEC-${num}`);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      role === 'solo_lectura'
                        ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200'
                        : 'bg-white border-graphite-200 text-graphite-600 hover:bg-graphite-50'
                    }`}
                  >
                    <Eye className="w-4 h-4 text-amber-600" />
                    <span>Sólo lectura</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('administrador');
                      if (!editingUserId) {
                        const num = Math.floor(100 + Math.random() * 900);
                        setAccessKey(`ADMIN-${num}`);
                        setAccessKeyConfirm(`ADMIN-${num}`);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      role === 'administrador'
                        ? 'bg-oterio-50 border-oterio-600 text-oterio-700 ring-2 ring-oterio-200'
                        : 'bg-white border-graphite-200 text-graphite-600 hover:bg-graphite-50'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-oterio-600" />
                    <span>Administrador</span>
                  </button>
                </div>

                {role === 'administrativo' && (
                  <p className="text-[11px] text-blue-800 bg-blue-50/80 border border-blue-200/80 p-2.5 rounded-xl mt-2 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Rol Administrativo:</strong> Mismos permisos que un operario (acceso por clave, visualización de trabajos, tramos de cronómetro, notas y alertas) <strong>más el poder crear nuevas órdenes de trabajo</strong>.
                    </span>
                  </p>
                )}
              </div>

              {/* Nombre completo */}
              <div>
                <label className="block text-xs font-bold text-graphite-700 uppercase tracking-wider mb-1.5">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Pedro Ramírez"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-graphite-300 focus:ring-2 focus:ring-oterio-500"
                />
              </div>

              {/* Si es Operario, Administrativo o Sólo Lectura: clave adjudicada */}
              {role !== 'administrador' ? (
                <div className="space-y-3 p-3.5 bg-graphite-50 rounded-2xl border border-graphite-200/80">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-graphite-800">
                        Clave de acceso adjudicada
                      </span>
                      <p className="text-[11px] text-graphite-500 mt-0.5">
                        Clave personal adjudicada al usuario para identificarse.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={generateSuggestionKey}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-oterio-700 bg-oterio-50 hover:bg-oterio-100 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      Sugerir
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-graphite-600 uppercase mb-1">
                        Clave adjudicada *
                      </label>
                      <input
                        type="text"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        placeholder="Ej. OP-101"
                        className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-graphite-300 bg-white font-mono font-bold focus:ring-2 focus:ring-oterio-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-graphite-600 uppercase mb-1">
                        Confirmar clave adjudicada *
                      </label>
                      <input
                        type="text"
                        value={accessKeyConfirm}
                        onChange={(e) => setAccessKeyConfirm(e.target.value)}
                        placeholder="Repite la clave"
                        className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-graphite-300 bg-white font-mono font-bold focus:ring-2 focus:ring-oterio-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Si es Administrador: Contraseña y corrección del CIF/NIF y Código de la empresa */
                <div className="space-y-3.5 p-3.5 bg-oterio-50/50 rounded-2xl border border-oterio-200/80">
                  <div className="text-xs text-oterio-950 font-semibold flex items-center justify-between">
                    <span>Datos de Administrador y Empresa</span>
                    <span className="text-[11px] text-oterio-700 font-medium">
                      Modificables
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-graphite-700 uppercase tracking-wider mb-1">
                        Código de Empresa *
                      </label>
                      <input
                        type="text"
                        value={adminCompanyCode}
                        onChange={(e) => setAdminCompanyCode(e.target.value.toUpperCase())}
                        placeholder="Ej. EMPRESA01"
                        className="w-full text-xs sm:text-sm font-mono font-bold uppercase px-3 py-2 rounded-xl border border-graphite-300 bg-white focus:ring-2 focus:ring-oterio-500"
                      />
                      <p className="text-[10px] text-graphite-500 mt-1">
                        Código que usan los operarios para acceder.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-graphite-700 uppercase tracking-wider mb-1">
                        CIF/NIF de la Empresa *
                      </label>
                      <input
                        type="text"
                        maxLength={9}
                        value={adminCompanyCif}
                        onChange={(e) => setAdminCompanyCif(e.target.value.toUpperCase())}
                        placeholder="Ej. B12345678 o 12345678Z"
                        className="w-full text-xs sm:text-sm font-mono font-bold uppercase px-3 py-2 rounded-xl border border-graphite-300 bg-white focus:ring-2 focus:ring-oterio-500"
                      />
                      <p className="text-[10px] text-graphite-500 mt-1">
                        Identificador único: letra y 8 números u 8 números y letra.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                    <div>
                      <label className="block text-xs font-bold text-graphite-700 uppercase tracking-wider mb-1">
                        Contraseña * (1/2)
                      </label>
                      <input
                        type="password"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-graphite-300 bg-white focus:ring-2 focus:ring-oterio-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-graphite-700 uppercase tracking-wider mb-1">
                        Confirmar contraseña * (2/2)
                      </label>
                      <input
                        type="password"
                        value={accessKeyConfirm}
                        onChange={(e) => setAccessKeyConfirm(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-graphite-300 bg-white focus:ring-2 focus:ring-oterio-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Departamentos asignados */}
              <div>
                <label className="block text-xs font-bold text-graphite-700 uppercase tracking-wider mb-1.5">
                  Departamentos técnicos asignados
                </label>
                {departments.length === 0 ? (
                  <p className="text-xs text-graphite-400 italic">No hay departamentos creados en esta empresa.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 rounded-xl border border-graphite-200 bg-graphite-50/60">
                    {departments.map((dept) => {
                      const isChecked = selectedDeptIds.includes(dept.id);
                      return (
                        <label
                          key={dept.id}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors text-xs text-graphite-700"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleDept(dept.id)}
                            className="rounded text-oterio-600 focus:ring-oterio-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="font-medium">{dept.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Resetear / Borrar Empresa (solo visible al editar la ficha del administrador) */}
              {editingUserId && role === 'administrador' && (
                <div className="pt-3 border-t border-graphite-200">
                  <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Resetear o borrar empresa</span>
                      </p>
                      <p className="text-[11px] text-rose-700/90 mt-0.5">
                        Acceso a la pestaña de puesta a cero o eliminación definitiva de la empresa.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setModalOpen(false);
                        setCurrentNav('resetear_empresa');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer shrink-0"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Resetear Empresa</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-graphite-100 mt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-graphite-600 hover:bg-graphite-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 text-xs font-bold text-white bg-oterio-600 hover:bg-oterio-700 rounded-xl shadow-xs cursor-pointer"
              >
                {editingUserId ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for User Deletion */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetUser)}
        title="Eliminar Usuario"
        message={
          deleteTargetUser
            ? `¿Confirmas que deseas eliminar al usuario "${deleteTargetUser.name}"? Se revocarán todas sus claves y accesos al sistema.`
            : ''
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetUser(null)}
      />
    </div>
  );
};
