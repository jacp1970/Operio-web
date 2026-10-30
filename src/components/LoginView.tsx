import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Logo } from './Logo';
import {
  LogIn,
  UserPlus,
  Shield,
  Wrench,
  Eye,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Mail,
  Lock,
  Building2,
  KeyRound,
  Info,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const {
    loginAdmin,
    loginUser,
    registerAdminAndCompany,
    recoverAdminCredentials,
    companies,
  } = useApp();

  // Mode: 'login' | 'register' | 'recover'
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>(() =>
    companies.length === 0 ? 'register' : 'login'
  );

  // Login tab: 'user' (Operario / Solo Lectura) vs 'admin' (Administrador)
  const [loginRoleTab, setLoginRoleTab] = useState<'user' | 'admin'>('user');

  // Login inputs - Employee (Company Code + Key)
  const [userCompanyCode, setUserCompanyCode] = useState('');
  const [userAccessKey, setUserAccessKey] = useState('');

  // Login inputs - Administrator (Company Code + Email + Password)
  const [adminCompanyCode, setAdminCompanyCode] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [loginError, setLoginError] = useState('');

  // Register inputs - Company + Admin
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regCompanyCode, setRegCompanyCode] = useState('');
  const [regCompanyCodeConfirm, setRegCompanyCodeConfirm] = useState('');
  const [regAdminName, setRegAdminName] = useState('');
  const [regAdminEmail, setRegAdminEmail] = useState('');
  const [regAdminEmailConfirm, setRegAdminEmailConfirm] = useState('');
  const [regAdminPassword, setRegAdminPassword] = useState('');
  const [regAdminPasswordConfirm, setRegAdminPasswordConfirm] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Recovery inputs
  const [recCompanyCode, setRecCompanyCode] = useState('');
  const [recAdminEmail, setRecAdminEmail] = useState('');
  const [recMessage, setRecMessage] = useState<{ text: string; success: boolean } | null>(null);

  const handleUserLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!userCompanyCode.trim() || !userAccessKey.trim()) {
      setLoginError('Introduce el código de empresa y tu clave de acceso.');
      return;
    }

    const res = loginUser(userCompanyCode, userAccessKey);
    if (!res.success) {
      setLoginError(res.error || 'Código de empresa o clave incorrecta.');
    }
  };

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!adminCompanyCode.trim() || !adminEmail.trim() || !adminPassword) {
      setLoginError('Introduce el código de empresa, correo de administrador y contraseña.');
      return;
    }

    const res = loginAdmin(adminCompanyCode, adminEmail, adminPassword);
    if (!res.success) {
      setLoginError(res.error || 'Credenciales de administrador incorrectas.');
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    const res = registerAdminAndCompany({
      companyName: regCompanyName,
      companyCode: regCompanyCode,
      companyCodeConfirm: regCompanyCodeConfirm,
      adminName: regAdminName,
      adminEmail: regAdminEmail,
      adminEmailConfirm: regAdminEmailConfirm,
      adminPassword: regAdminPassword,
      adminPasswordConfirm: regAdminPasswordConfirm,
    });

    if (!res.success) {
      setRegError(res.error || 'Error al registrar la empresa');
    } else {
      setRegSuccess(
        `¡Empresa "${regCompanyName}" (Código: ${regCompanyCode.toUpperCase()}) y Administrador creados con éxito! Ya puedes iniciar sesión.`
      );
      setAdminCompanyCode(regCompanyCode.toUpperCase());
      setUserCompanyCode(regCompanyCode.toUpperCase());
      setAdminEmail(regAdminEmail);
      setAdminPassword(regAdminPassword);

      setTimeout(() => {
        setMode('login');
        setLoginRoleTab('admin');
        setRegCompanyName('');
        setRegCompanyCode('');
        setRegCompanyCodeConfirm('');
        setRegAdminName('');
        setRegAdminEmail('');
        setRegAdminEmailConfirm('');
        setRegAdminPassword('');
        setRegAdminPasswordConfirm('');
      }, 2000);
    }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRecMessage(null);

    if (!recCompanyCode.trim() || !recAdminEmail.trim()) {
      setRecMessage({ text: 'Introduce el código de empresa y el correo del administrador.', success: false });
      return;
    }

    const res = recoverAdminCredentials(recCompanyCode, recAdminEmail);
    setRecMessage({ text: res.message, success: res.success });
  };



  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* App Logo & Name always visible outside work area */}
        <div className="flex justify-center mb-3">
          <Logo size="lg" showSubtitle={true} className="items-center text-center" />
        </div>

        <p className="text-center text-xs text-slate-500 font-medium">
          Sistema multi-empresa para el control integral de partes de trabajo
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-medium text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Sincronización en tiempo real con Firebase
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 shadow-xl shadow-slate-200/50 sm:rounded-3xl border border-slate-200/80">
          {/* =========================================================
              VIEW: LOGIN
             ========================================================= */}
          {mode === 'login' && (
            <div>
              {/* Role selector tabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setLoginRoleTab('user');
                    setLoginError('');
                  }}
                  className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    loginRoleTab === 'user'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Operario / Lectura</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginRoleTab('admin');
                    setLoginError('');
                  }}
                  className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    loginRoleTab === 'admin'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Administrador</span>
                </button>
              </div>

              {regSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{regSuccess}</span>
                </div>
              )}

              {loginError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* TAB 1: OPERARIOS Y SOLO LECTURA (CÓDIGO DE EMPRESA + CLAVE, SIN CORREO) */}
              {loginRoleTab === 'user' && (
                <form onSubmit={handleUserLoginSubmit} className="space-y-4">
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900 mb-2">
                    <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      Acceso exclusivo para operarios y personal de taller. No se requiere correo, solo el código de tu empresa y tu clave personal adjudicada.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Código de Empresa *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={userCompanyCode}
                        onChange={(e) => setUserCompanyCode(e.target.value.toUpperCase())}
                        placeholder="Ej. EMPRESA01"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold tracking-wider focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Clave de Acceso Adjudicada *
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        value={userAccessKey}
                        onChange={(e) => setUserAccessKey(e.target.value)}
                        placeholder="Introduce tu clave de usuario"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-md shadow-emerald-100 transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Entrar como Operario / Empleado</span>
                  </button>
                </form>
              )}

              {/* TAB 2: ADMINISTRADOR (CÓDIGO DE EMPRESA + CORREO + CONTRASEÑA) */}
              {loginRoleTab === 'admin' && (
                <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                  <div className="p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-900 mb-2">
                    <Shield className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                    <span>
                      Acceso exclusivo para el Administrador de la empresa (requiere código de empresa, correo y contraseña).
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Código de Empresa *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={adminCompanyCode}
                        onChange={(e) => setAdminCompanyCode(e.target.value.toUpperCase())}
                        placeholder="Ej. EMPRESA01"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold tracking-wider focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Correo Electrónico del Administrador *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@empresa.com"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Contraseña *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('recover');
                          setRecCompanyCode(adminCompanyCode);
                          setRecAdminEmail(adminEmail);
                          setRecMessage(null);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-100 transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Entrar como Administrador</span>
                  </button>
                </form>
              )}

              {/* Registro de nueva empresa y administrador */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500 mb-2">
                  ¿Quieres dar de alta una nueva empresa en OPERIO?
                </p>
                <button
                  onClick={() => {
                    setMode('register');
                    setRegError('');
                    setRegSuccess('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/70 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Registrar Nueva Empresa y Administrador</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: REGISTRO DE EMPRESA Y ADMINISTRADOR
             ========================================================= */}
          {mode === 'register' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setMode('login')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Registrar Nueva Empresa
                  </h3>
                  <p className="text-xs text-slate-500">
                    Crea tu empresa asignándole un código único y tu perfil de administrador.
                  </p>
                </div>
              </div>

              {regError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {regError}
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* 1. Datos de la empresa */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Datos de la Empresa
                  </span>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nombre de la Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      value={regCompanyName}
                      onChange={(e) => setRegCompanyName(e.target.value)}
                      placeholder="Ej. Taller Mecánico Industrial S.L."
                      className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Código de Empresa *
                      </label>
                      <input
                        type="text"
                        required
                        value={regCompanyCode}
                        onChange={(e) => setRegCompanyCode(e.target.value.toUpperCase())}
                        placeholder="Ej. EMPRESA01"
                        className="w-full text-xs sm:text-sm font-mono font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Confirmar Código *
                      </label>
                      <input
                        type="text"
                        required
                        value={regCompanyCodeConfirm}
                        onChange={(e) => setRegCompanyCodeConfirm(e.target.value.toUpperCase())}
                        placeholder="Repite el código"
                        className="w-full text-xs sm:text-sm font-mono font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Datos del administrador */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Perfil del Administrador
                  </span>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nombre del Administrador *
                    </label>
                    <input
                      type="text"
                      required
                      value={regAdminName}
                      onChange={(e) => setRegAdminName(e.target.value)}
                      placeholder="Ej. Nombre y Apellidos"
                      className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Correo Electrónico * (1/2)
                      </label>
                      <input
                        type="email"
                        required
                        value={regAdminEmail}
                        onChange={(e) => setRegAdminEmail(e.target.value)}
                        placeholder="admin@empresa.com"
                        className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Confirmar Correo * (2/2)
                      </label>
                      <input
                        type="email"
                        required
                        value={regAdminEmailConfirm}
                        onChange={(e) => setRegAdminEmailConfirm(e.target.value)}
                        placeholder="Repite el correo"
                        className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Contraseña * (1/2)
                      </label>
                      <input
                        type="password"
                        required
                        value={regAdminPassword}
                        onChange={(e) => setRegAdminPassword(e.target.value)}
                        placeholder="Mínimo 4 caracteres"
                        className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Confirmar Contraseña * (2/2)
                      </label>
                      <input
                        type="password"
                        required
                        value={regAdminPasswordConfirm}
                        onChange={(e) => setRegAdminPasswordConfirm(e.target.value)}
                        placeholder="Repite la contraseña"
                        className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Volver al login
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm cursor-pointer"
                  >
                    Dar de Alta Empresa y Admin
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =========================================================
              VIEW: RECUPERAR ACCESO (ADMINISTRADOR)
             ========================================================= */}
          {mode === 'recover' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setMode('login')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Restaurar Contraseña de Administrador
                  </h3>
                  <p className="text-xs text-slate-500">
                    Introduce el código de empresa y tu correo de administrador.
                  </p>
                </div>
              </div>

              {recMessage && (
                <div
                  className={`mb-4 p-3.5 rounded-xl border text-xs font-semibold ${
                    recMessage.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {recMessage.text}
                </div>
              )}

              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Código de Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={recCompanyCode}
                    onChange={(e) => setRecCompanyCode(e.target.value.toUpperCase())}
                    placeholder="Ej. EMPRESA01"
                    className="w-full text-xs sm:text-sm font-mono font-bold px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Correo del Administrador *
                  </label>
                  <input
                    type="email"
                    required
                    value={recAdminEmail}
                    onChange={(e) => setRecAdminEmail(e.target.value)}
                    placeholder="admin@empresa.com"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Volver al Login
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm cursor-pointer"
                  >
                    Restablecer Contraseña
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
