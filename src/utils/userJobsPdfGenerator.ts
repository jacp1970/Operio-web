import { jsPDF } from 'jspdf';
import { User, WorkOrder } from '../types';

export interface GenerateUserAssignedJobsPdfParams {
  user: User;
  companyName?: string;
  companyCode?: string;
  jobs: WorkOrder[];
  getDepartmentName: (departmentId: string) => string;
}

function formatDateEs(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return '-';
  try {
    // Handle YYYY-MM-DD directly to avoid timezone offset shifts
    const ymdMatch = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
    }
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
}

function formatRoleLabel(role: User['role']): string {
  switch (role) {
    case 'administrador':
      return 'Administrador';
    case 'administrativo':
      return 'Administrativo';
    case 'operario':
      return 'Operario';
    case 'solo_lectura':
      return 'Solo lectura';
    default:
      return role;
  }
}

function sanitizeFileName(raw: string): string {
  return (raw || 'usuario')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function extractIdTimestamp(id?: string): number {
  if (!id) return 0;
  const match = id.match(/wo-(\d+)/);
  return match ? Number(match[1]) : 0;
}

function parseCreationTimestamp(createdAt?: string): number {
  if (!createdAt || !createdAt.trim()) return Number.MAX_SAFE_INTEGER;
  const trimmed = createdAt.trim();
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const utcMs = Date.UTC(
      Number(ymdMatch[1]),
      Number(ymdMatch[2]) - 1,
      Number(ymdMatch[3])
    );
    if (Number.isFinite(utcMs)) return utcMs;
  }
  const parsed = new Date(trimmed).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/**
 * Determines which jobs in the list have an effective operator-assigned custom order.
 * - Explicitly ordered jobs have `hasCustomOrder === true` and a finite `orderPosition`.
 * - Legacy jobs (where `hasCustomOrder === undefined`) only count as custom-ordered if
 *   their `orderPosition` sequence contains an inversion relative to their `wo-<timestamp>`
 *   creation sequence (distinguishing manual reorders from initial auto-incremented positions).
 */
function getEffectiveCustomOrderedJobIds(jobs: WorkOrder[]): Set<string> {
  const customOrderedIds = new Set<string>();

  const explicitOrdered = jobs.filter(
    (j) =>
      j.hasCustomOrder === true &&
      typeof j.orderPosition === 'number' &&
      Number.isFinite(j.orderPosition)
  );
  if (explicitOrdered.length > 0) {
    explicitOrdered.forEach((j) => customOrderedIds.add(j.id));
    return customOrderedIds;
  }

  const legacyCandidates = jobs.filter(
    (j) =>
      j.hasCustomOrder === undefined &&
      typeof j.orderPosition === 'number' &&
      Number.isFinite(j.orderPosition)
  );

  if (legacyCandidates.length > 1) {
    const sortedByIdTime = [...legacyCandidates].sort(
      (a, b) => extractIdTimestamp(a.id) - extractIdTimestamp(b.id)
    );
    let hasInversion = false;
    for (let i = 1; i < sortedByIdTime.length; i++) {
      if (
        (sortedByIdTime[i].orderPosition as number) <
        (sortedByIdTime[i - 1].orderPosition as number)
      ) {
        hasInversion = true;
        break;
      }
    }
    if (hasInversion) {
      legacyCandidates.forEach((j) => customOrderedIds.add(j.id));
    }
  }

  return customOrderedIds;
}

/**
 * Sorts work orders assigned to an operator for PDF export:
 * 1. First by Department (alphabetical, with unassigned department at the end).
 * 2. Second by the custom order assigned by the operator (`orderPosition` when assigned).
 * 3. Third (if no custom order has been assigned) by Creation Date (`createdAt`).
 */
export function sortUserJobsForPdf(
  jobs: WorkOrder[],
  getDepartmentName: (departmentId: string) => string
): WorkOrder[] {
  const customOrderedIds = getEffectiveCustomOrderedJobIds(jobs);

  return [...jobs].sort((a, b) => {
    // 1. Primero por Departamento
    const deptA = (getDepartmentName(a.departmentId) || '').trim();
    const deptB = (getDepartmentName(b.departmentId) || '').trim();

    if (Boolean(deptA) !== Boolean(deptB)) {
      return deptA ? -1 : 1;
    }
    if (deptA && deptB) {
      const deptCmp = deptA.localeCompare(deptB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });
      if (deptCmp !== 0) return deptCmp;
    }
    if ((a.departmentId || '') !== (b.departmentId || '')) {
      return (a.departmentId || '').localeCompare(b.departmentId || '');
    }

    // 2. Segundo por el orden asignado por el operario (si lo tiene asignado)
    const hasCustomA = customOrderedIds.has(a.id);
    const hasCustomB = customOrderedIds.has(b.id);

    if (hasCustomA && hasCustomB) {
      const posDiff = (a.orderPosition as number) - (b.orderPosition as number);
      if (posDiff !== 0) return posDiff;
    } else if (hasCustomA !== hasCustomB) {
      return hasCustomA ? -1 : 1;
    }

    // 3. De no haberle asignado un orden, por fecha de Creación (createdAt)
    const createdA = parseCreationTimestamp(a.createdAt);
    const createdB = parseCreationTimestamp(b.createdAt);
    if (createdA !== createdB) {
      return createdA - createdB;
    }

    const idTimeA = extractIdTimestamp(a.id);
    const idTimeB = extractIdTimestamp(b.id);
    if (idTimeA !== idTimeB) {
      return idTimeA - idTimeB;
    }

    return (a.ot || '').localeCompare(b.ot || '', 'es', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

/**
 * Generates and downloads a high-contrast, easy-to-read A4 Landscape PDF
 * containing all work orders assigned to a user with:
 * - Número de parte (OT)
 * - Cliente
 * - Departamento
 * - Breve descripción
 * - Fecha de entrada
 * - Fecha de entrega (si la tuviera)
 * - Si es urgente
 */
export function generateAndDownloadUserJobsPdf({
  user,
  companyName,
  companyCode,
  jobs,
  getDepartmentName,
}: GenerateUserAssignedJobsPdfParams): void {
  const sortedJobs = sortUserJobsForPdf(jobs, getDepartmentName);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2; // 273 mm

  const urgentCount = sortedJobs.filter((j) => j.isUrgent).length;
  const nowStr = new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Column layout (total = 273 mm)
  const columns = [
    { key: 'ot', title: 'N.º PARTE (OT)', width: 32 },
    { key: 'client', title: 'CLIENTE', width: 46 },
    { key: 'department', title: 'DEPARTAMENTO', width: 36 },
    { key: 'description', title: 'BREVE DESCRIPCIÓN', width: 89 },
    { key: 'createdAt', title: 'F. ENTRADA', width: 24 },
    { key: 'deliveryDate', title: 'F. ENTREGA', width: 24 },
    { key: 'urgent', title: 'URGENTE', width: 22 },
  ] as const;

  const drawPageHeader = (isFirstPage: boolean): number => {
    // Top brand accent bar
    doc.setFillColor(234, 88, 12); // Oterio orange (#ea580c)
    doc.rect(0, 0, pageWidth, 4, 'F');

    if (isFirstPage) {
      // Header card box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.35);
      doc.roundedRect(marginX, 8, contentWidth, 26, 2.5, 2.5, 'FD');

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text('LISTADO DE TRABAJOS ASIGNADOS', marginX + 5, 16);

      // Subtitle: User details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(234, 88, 12);
      doc.text(`Usuario: ${user.name}`, marginX + 5, 23);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      const roleInfo = `Rol: ${formatRoleLabel(user.role)}   |   DNI/Clave: ${user.accessKey || '-'}`;
      doc.text(roleInfo, marginX + 5, 29.5);

      // Right side metadata: Company, Date, Totals
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      const companyTitle = companyName
        ? `${companyName}${companyCode ? ` (${companyCode})` : ''}`
        : 'OTERIO - Gestión de Partes de Trabajo';
      doc.text(companyTitle, pageWidth - marginX - 5, 15.5, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Fecha de emisión: ${nowStr}`, pageWidth - marginX - 5, 22, { align: 'right' });

      // Summary pill text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      if (urgentCount > 0) {
        doc.setTextColor(190, 18, 60);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(
        `Total asignados: ${sortedJobs.length}   |   Urgentes: ${urgentCount}`,
        pageWidth - marginX - 5,
        29.5,
        { align: 'right' }
      );

      return 39;
    } else {
      // Compact continuation header on subsequent pages
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(
        `Trabajos asignados a: ${user.name} (${formatRoleLabel(user.role)})`,
        marginX,
        12
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Emitido: ${nowStr}`, pageWidth - marginX, 12, { align: 'right' });
      return 16;
    }
  };

  const drawTableHeader = (startY: number): number => {
    const headerHeight = 9.5;
    doc.setFillColor(30, 41, 59); // Dark slate header for maximum contrast
    doc.rect(marginX, startY, contentWidth, headerHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);

    let currentX = marginX;
    columns.forEach((col) => {
      const isCentered =
        col.key === 'createdAt' || col.key === 'deliveryDate' || col.key === 'urgent';
      if (isCentered) {
        doc.text(col.title, currentX + col.width / 2, startY + 6.2, { align: 'center' });
      } else {
        doc.text(col.title, currentX + 3, startY + 6.2);
      }
      currentX += col.width;
    });

    return startY + headerHeight;
  };

  let cursorY = drawPageHeader(true);
  cursorY = drawTableHeader(cursorY);

  if (sortedJobs.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, cursorY + 3, contentWidth, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Este usuario no tiene órdenes de trabajo asignadas en este momento.',
      pageWidth / 2,
      cursorY + 15.5,
      { align: 'center' }
    );
  } else {
    const lineHeight = 4.6;
    const minRowHeight = 11.5;
    const bottomLimit = pageHeight - 16;

    sortedJobs.forEach((job, idx) => {
      const otText = (job.ot || '-').trim();
      const clientText = (job.client || '-').trim();
      const deptText = (getDepartmentName(job.departmentId) || 'Sin departamento').trim();

      // Build concise, legible description from notes (or fallback if empty)
      const rawNotes = (job.notes || '').replace(/\r\n/g, '\n').trim();
      const normalizedDescription = rawNotes
        ? rawNotes.length > 260
          ? `${rawNotes.slice(0, 257).trim()}...`
          : rawNotes
        : 'Sin descripción especificada';

      const entryDateText = formatDateEs(job.createdAt);
      const deliveryDateText =
        job.deliveryDate && job.deliveryDate.trim()
          ? formatDateEs(job.deliveryDate)
          : 'Sin fecha';
      const isUrgent = Boolean(job.isUrgent);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      const otLines: string[] = doc.splitTextToSize(otText, columns[0].width - 6);
      const clientLines: string[] = doc.splitTextToSize(clientText, columns[1].width - 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const deptLines: string[] = doc.splitTextToSize(deptText, columns[2].width - 6);
      const descLinesAll: string[] = doc.splitTextToSize(
        normalizedDescription,
        columns[3].width - 6
      );
      // Cap at 4 lines so each row stays clean and easy to scan
      const descLines = descLinesAll.slice(0, 4);

      const maxLines = Math.max(
        otLines.length,
        clientLines.length,
        deptLines.length,
        descLines.length,
        1
      );
      const rowHeight = Math.max(minRowHeight, maxLines * lineHeight + 5);

      // Page break check
      if (cursorY + rowHeight > bottomLimit) {
        doc.addPage('a4', 'landscape');
        cursorY = drawPageHeader(false);
        cursorY = drawTableHeader(cursorY);
      }

      // Row background: highlight urgent rows softly or alternate zebra stripes
      if (isUrgent) {
        doc.setFillColor(255, 241, 242); // Soft rose tint for urgent work orders
      } else if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252); // Soft alternating slate stripe
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.rect(marginX, cursorY, contentWidth, rowHeight, 'FD');

      // Vertical column dividers
      let dividerX = marginX;
      columns.forEach((col, cIdx) => {
        if (cIdx > 0) {
          doc.setDrawColor(226, 232, 240);
          doc.line(dividerX, cursorY, dividerX, cursorY + rowHeight);
        }
        dividerX += col.width;
      });

      const textStartY = cursorY + 5.8;
      let cellX = marginX;

      // 1. Número de parte (OT)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(otLines, cellX + 3, textStartY);
      cellX += columns[0].width;

      // 2. Cliente
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(clientLines, cellX + 3, textStartY);
      cellX += columns[1].width;

      // 3. Departamento
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(deptLines, cellX + 3, textStartY);
      cellX += columns[2].width;

      // 4. Breve descripción
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(rawNotes ? 30 : 148, rawNotes ? 41 : 163, rawNotes ? 59 : 184);
      doc.text(descLines, cellX + 3, textStartY);
      cellX += columns[3].width;

      // 5. Fecha de entrada
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(entryDateText, cellX + columns[4].width / 2, textStartY, { align: 'center' });
      cellX += columns[4].width;

      // 6. Fecha de entrega (si la tuviera)
      const hasDelivery = Boolean(job.deliveryDate && job.deliveryDate.trim());
      doc.setFont('helvetica', hasDelivery ? 'bold' : 'normal');
      doc.setFontSize(9.5);
      if (hasDelivery) {
        doc.setTextColor(180, 83, 9); // Amber accent for explicit delivery date
      } else {
        doc.setTextColor(148, 163, 184);
      }
      doc.text(deliveryDateText, cellX + columns[5].width / 2, textStartY, { align: 'center' });
      cellX += columns[5].width;

      // 7. Si es urgente
      const badgeCenterX = cellX + columns[6].width / 2;
      if (isUrgent) {
        const badgeW = 17;
        const badgeH = 5.8;
        doc.setFillColor(225, 29, 72); // Rose-600
        doc.roundedRect(
          badgeCenterX - badgeW / 2,
          cursorY + 2.4,
          badgeW,
          badgeH,
          1.4,
          1.4,
          'F'
        );
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text('SÍ · URG', badgeCenterX, cursorY + 6.4, { align: 'center' });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139);
        doc.text('No', badgeCenterX, textStartY, { align: 'center' });
      }

      cursorY += rowHeight;
    });
  }

  // Page footers with page numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `OTERIO · Ficha de trabajos asignados a ${user.name}`,
      marginX,
      pageHeight - 6.5
    );
    doc.text(
      `Página ${p} de ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 6.5,
      { align: 'right' }
    );
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = `trabajos_asignados_${sanitizeFileName(user.name)}_${dateSlug}.pdf`;

  // Trigger reliable download across desktop and mobile browsers
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 4000);
}
