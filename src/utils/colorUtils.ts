export interface ColorPalette {
  id: string;
  name: string;
  bgLight: string;
  bgCard: string;
  border: string;
  borderAccent: string;
  text: string;
  textDark: string;
  badge: string;
  badgeSoft: string;
  dot: string;
  headerBg: string;
  headerLight: string;
  ring: string;
  hex: string;
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'indigo',
    name: 'Índigo',
    bgLight: 'bg-indigo-50',
    bgCard: 'bg-indigo-50/40',
    border: 'border-indigo-200',
    borderAccent: 'border-l-indigo-600',
    text: 'text-indigo-700',
    textDark: 'text-indigo-950',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    badgeSoft: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    dot: 'bg-indigo-600',
    headerBg: 'bg-indigo-600 text-white',
    headerLight: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    ring: 'ring-indigo-400',
    hex: '#4f46e5',
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    bgLight: 'bg-emerald-50',
    bgCard: 'bg-emerald-50/40',
    border: 'border-emerald-200',
    borderAccent: 'border-l-emerald-600',
    text: 'text-emerald-700',
    textDark: 'text-emerald-950',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    badgeSoft: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-600',
    headerBg: 'bg-emerald-600 text-white',
    headerLight: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    ring: 'ring-emerald-400',
    hex: '#059669',
  },
  {
    id: 'amber',
    name: 'Ámbar',
    bgLight: 'bg-amber-50',
    bgCard: 'bg-amber-50/40',
    border: 'border-amber-200',
    borderAccent: 'border-l-amber-500',
    text: 'text-amber-800',
    textDark: 'text-amber-950',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    badgeSoft: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-500',
    headerBg: 'bg-amber-500 text-slate-900',
    headerLight: 'bg-amber-50 border-amber-200 text-amber-950',
    ring: 'ring-amber-400',
    hex: '#d97706',
  },
  {
    id: 'blue',
    name: 'Azul Zafiro',
    bgLight: 'bg-blue-50',
    bgCard: 'bg-blue-50/40',
    border: 'border-blue-200',
    borderAccent: 'border-l-blue-600',
    text: 'text-blue-700',
    textDark: 'text-blue-950',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    badgeSoft: 'bg-blue-50 text-blue-700 border-blue-200/80',
    dot: 'bg-blue-600',
    headerBg: 'bg-blue-600 text-white',
    headerLight: 'bg-blue-50 border-blue-200 text-blue-950',
    ring: 'ring-blue-400',
    hex: '#2563eb',
  },
  {
    id: 'purple',
    name: 'Púrpura',
    bgLight: 'bg-purple-50',
    bgCard: 'bg-purple-50/40',
    border: 'border-purple-200',
    borderAccent: 'border-l-purple-600',
    text: 'text-purple-700',
    textDark: 'text-purple-950',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    badgeSoft: 'bg-purple-50 text-purple-700 border-purple-200/80',
    dot: 'bg-purple-600',
    headerBg: 'bg-purple-600 text-white',
    headerLight: 'bg-purple-50 border-purple-200 text-purple-950',
    ring: 'ring-purple-400',
    hex: '#9333ea',
  },
  {
    id: 'rose',
    name: 'Rosa Coral',
    bgLight: 'bg-rose-50',
    bgCard: 'bg-rose-50/40',
    border: 'border-rose-200',
    borderAccent: 'border-l-rose-500',
    text: 'text-rose-700',
    textDark: 'text-rose-950',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    badgeSoft: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-500',
    headerBg: 'bg-rose-600 text-white',
    headerLight: 'bg-rose-50 border-rose-200 text-rose-950',
    ring: 'ring-rose-400',
    hex: '#e11d48',
  },
  {
    id: 'teal',
    name: 'Turquesa',
    bgLight: 'bg-teal-50',
    bgCard: 'bg-teal-50/40',
    border: 'border-teal-200',
    borderAccent: 'border-l-teal-600',
    text: 'text-teal-700',
    textDark: 'text-teal-950',
    badge: 'bg-teal-100 text-teal-800 border-teal-200',
    badgeSoft: 'bg-teal-50 text-teal-700 border-teal-200/80',
    dot: 'bg-teal-600',
    headerBg: 'bg-teal-600 text-white',
    headerLight: 'bg-teal-50 border-teal-200 text-teal-950',
    ring: 'ring-teal-400',
    hex: '#0d9488',
  },
  {
    id: 'orange',
    name: 'Naranja',
    bgLight: 'bg-orange-50',
    bgCard: 'bg-orange-50/40',
    border: 'border-orange-200',
    borderAccent: 'border-l-orange-500',
    text: 'text-orange-800',
    textDark: 'text-orange-950',
    badge: 'bg-orange-100 text-orange-900 border-orange-200',
    badgeSoft: 'bg-orange-50 text-orange-800 border-orange-200/80',
    dot: 'bg-orange-500',
    headerBg: 'bg-orange-600 text-white',
    headerLight: 'bg-orange-50 border-orange-200 text-orange-950',
    ring: 'ring-orange-400',
    hex: '#ea580c',
  },
  {
    id: 'violet',
    name: 'Violeta',
    bgLight: 'bg-violet-50',
    bgCard: 'bg-violet-50/40',
    border: 'border-violet-200',
    borderAccent: 'border-l-violet-600',
    text: 'text-violet-700',
    textDark: 'text-violet-950',
    badge: 'bg-violet-100 text-violet-800 border-violet-200',
    badgeSoft: 'bg-violet-50 text-violet-700 border-violet-200/80',
    dot: 'bg-violet-600',
    headerBg: 'bg-violet-600 text-white',
    headerLight: 'bg-violet-50 border-violet-200 text-violet-950',
    ring: 'ring-violet-400',
    hex: '#7c3aed',
  },
  {
    id: 'cyan',
    name: 'Cian',
    bgLight: 'bg-cyan-50',
    bgCard: 'bg-cyan-50/40',
    border: 'border-cyan-200',
    borderAccent: 'border-l-cyan-600',
    text: 'text-cyan-800',
    textDark: 'text-cyan-950',
    badge: 'bg-cyan-100 text-cyan-900 border-cyan-200',
    badgeSoft: 'bg-cyan-50 text-cyan-800 border-cyan-200/80',
    dot: 'bg-cyan-600',
    headerBg: 'bg-cyan-600 text-white',
    headerLight: 'bg-cyan-50 border-cyan-200 text-cyan-950',
    ring: 'ring-cyan-400',
    hex: '#0891b2',
  },
  {
    id: 'fuchsia',
    name: 'Fucsia',
    bgLight: 'bg-fuchsia-50',
    bgCard: 'bg-fuchsia-50/40',
    border: 'border-fuchsia-200',
    borderAccent: 'border-l-fuchsia-600',
    text: 'text-fuchsia-800',
    textDark: 'text-fuchsia-950',
    badge: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
    badgeSoft: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200/80',
    dot: 'bg-fuchsia-600',
    headerBg: 'bg-fuchsia-600 text-white',
    headerLight: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-950',
    ring: 'ring-fuchsia-400',
    hex: '#c026d3',
  },
  {
    id: 'lime',
    name: 'Lima',
    bgLight: 'bg-lime-50',
    bgCard: 'bg-lime-50/40',
    border: 'border-lime-200',
    borderAccent: 'border-l-lime-600',
    text: 'text-lime-800',
    textDark: 'text-lime-950',
    badge: 'bg-lime-100 text-lime-900 border-lime-200',
    badgeSoft: 'bg-lime-50 text-lime-800 border-lime-200/80',
    dot: 'bg-lime-600',
    headerBg: 'bg-lime-600 text-white',
    headerLight: 'bg-lime-50 border-lime-200 text-lime-950',
    ring: 'ring-lime-400',
    hex: '#65a30d',
  },
  {
    id: 'sky',
    name: 'Cielo',
    bgLight: 'bg-sky-50',
    bgCard: 'bg-sky-50/40',
    border: 'border-sky-200',
    borderAccent: 'border-l-sky-500',
    text: 'text-sky-700',
    textDark: 'text-sky-950',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    badgeSoft: 'bg-sky-50 text-sky-700 border-sky-200/80',
    dot: 'bg-sky-500',
    headerBg: 'bg-sky-600 text-white',
    headerLight: 'bg-sky-50 border-sky-200 text-sky-950',
    ring: 'ring-sky-400',
    hex: '#0284c7',
  },
];

const UNASSIGNED_PALETTE: ColorPalette = {
  id: 'slate',
  name: 'Sin Asignar',
  bgLight: 'bg-slate-50',
  bgCard: 'bg-slate-50/60',
  border: 'border-slate-200',
  borderAccent: 'border-l-slate-400',
  text: 'text-slate-600',
  textDark: 'text-slate-800',
  badge: 'bg-slate-100 text-slate-700 border-slate-200',
  badgeSoft: 'bg-slate-100/80 text-slate-600 border-slate-200/80',
  dot: 'bg-slate-400',
  headerBg: 'bg-slate-600 text-white',
  headerLight: 'bg-slate-100 border-slate-200 text-slate-800',
  ring: 'ring-slate-300',
  hex: '#64748b',
};

// Deterministic string hash
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Returns a consistent, distinct color palette for an Operator/Employee.
 */
export function getOperatorColor(
  userId?: string | null,
  userName?: string | null,
  customColor?: string | null
): ColorPalette {
  if (!userId || userId === 'unassigned' || userId === 'sin_asignar') {
    return UNASSIGNED_PALETTE;
  }

  // If a custom color id was given and matches
  if (customColor) {
    const matched = COLOR_PALETTES.find((p) => p.id === customColor);
    if (matched) return matched;
  }

  const key = `${userId}_${userName || ''}`;
  const index = hashString(key) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
}

/**
 * Returns a consistent, distinct color palette for a Department.
 * Uses an offset to minimize palette collision with operators.
 */
export function getDepartmentColor(
  deptId?: string | null,
  deptName?: string | null,
  customColor?: string | null
): ColorPalette {
  if (!deptId || deptId === 'unassigned' || deptId === 'sin_departamento') {
    return UNASSIGNED_PALETTE;
  }

  if (customColor) {
    const matched = COLOR_PALETTES.find((p) => p.id === customColor);
    if (matched) return matched;
  }

  const key = `${deptId}_${deptName || ''}`;
  // Offset by 5 to contrast with operator palette distribution
  const index = (hashString(key) + 5) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
}

export function getUnassignedPalette(): ColorPalette {
  return UNASSIGNED_PALETTE;
}
