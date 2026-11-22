export interface ExtractedWorkOrderFields {
  ot: string | null;
  client: string | null;
  createdAt: string | null;
  deliveryDate: string | null;
  notes: string | null;
  isUrgent: boolean;
}

export class WorkOrderExtractionError extends Error {
  technicalDetail: string;

  constructor(message: string, technicalDetail?: string) {
    super(message);
    this.name = 'WorkOrderExtractionError';
    this.technicalDetail = technicalDetail || message;
  }
}

export const MISSING_API_KEY_MESSAGE = 'Falta configurar la API Key de Gemini';
export const FALLBACK_RETRY_MESSAGE = 'Reintentando en servidor alternativo...';

const PRIMARY_TIMEOUT_MS = 12000;
const FALLBACK_TIMEOUT_MS = 14000;

function extractCleanBase64(input: string): string {
  const withoutPrefix = input
    .replace(/^data:application\/pdf;base64,/i, '')
    .replace(/^data:[^;]+;base64,/i, '');
  const afterComma = withoutPrefix.includes(',')
    ? withoutPrefix.slice(withoutPrefix.indexOf(',') + 1)
    : withoutPrefix;
  return afterComma.replace(/\s/g, '');
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;

  const isoMatch = trimmed.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

function normalizeTextField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;
  return trimmed;
}

function isRetryableServerStatus(status: number, code: string, detail: string): boolean {
  if (status === 503 || status === 429 || status === 504) return true;
  if (code === 'TRANSIENT_OVERLOAD') return true;
  const upper = detail.toUpperCase();
  return (
    upper.includes('503') ||
    upper.includes('429') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED') ||
    upper.includes('TIMEOUT')
  );
}

async function postToServerExtractionEndpoint(params: {
  endpoint: string;
  body: Record<string, unknown>;
  timeoutMs: number;
  sourceType: 'pdf' | 'photo';
}): Promise<ExtractedWorkOrderFields> {
  const abortController = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    try {
      abortController.abort();
    } catch {
      // Ignore abort errors
    }
  }, params.timeoutMs);

  let response: Response;
  try {
    response = await fetch(params.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params.body),
      signal: abortController.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (
      timedOut ||
      (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted')))
    ) {
      const sec = Math.round(params.timeoutMs / 1000);
      throw new WorkOrderExtractionError(
        `Tiempo de espera agotado (${sec}s). Inténtalo de nuevo.`,
        `TIMEOUT_${sec}S`
      );
    }
    const rawMsg = err instanceof Error ? err.message : String(err || 'Error de red');
    throw new WorkOrderExtractionError(
      'No se pudo conectar con el servidor de análisis.',
      rawMsg
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    const rawBody = await response.text().catch(() => '');
    throw new WorkOrderExtractionError(
      `Respuesta inesperada del servidor (HTTP ${response.status}).`,
      rawBody.slice(0, 240) || `HTTP ${response.status} ${response.statusText}`
    );
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const code = typeof payload.code === 'string' ? payload.code : '';
    const serverError = typeof payload.error === 'string' ? payload.error : '';
    const technicalDetail =
      typeof payload.technicalError === 'string' && payload.technicalError.trim()
        ? payload.technicalError.trim()
        : serverError || `HTTP ${response.status} ${response.statusText}`;

    if (code === 'MISSING_GEMINI_API_KEY' || serverError.includes(MISSING_API_KEY_MESSAGE)) {
      throw new WorkOrderExtractionError(MISSING_API_KEY_MESSAGE, technicalDetail);
    }

    const err = new WorkOrderExtractionError(
      serverError ||
        `Error al analizar ${params.sourceType === 'photo' ? 'la fotografía' : 'el PDF'} con Gemini.`,
      technicalDetail
    );
    (err as WorkOrderExtractionError & { httpStatus?: number; errorCode?: string }).httpStatus =
      response.status;
    (err as WorkOrderExtractionError & { httpStatus?: number; errorCode?: string }).errorCode =
      code;
    throw err;
  }

  return {
    ot: normalizeTextField(payload.ot),
    client: normalizeTextField(payload.client),
    createdAt: normalizeIsoDate(payload.createdAt),
    deliveryDate: normalizeIsoDate(payload.deliveryDate),
    notes: normalizeTextField(payload.notes),
    isUrgent: payload.isUrgent === true,
  };
}

/**
 * Extracts work order fields from a compressed mobile photo or PDF via server-side API routes
 * (/api/extract-work-order-photo or /api/extract-work-order-pdf).
 */
export async function extractWorkOrderFields(params: {
  base64Data: string;
  mimeType: string;
  fileName?: string;
  sourceType: 'pdf' | 'photo';
  onStatusChange?: (status: string) => void;
}): Promise<ExtractedWorkOrderFields> {
  const cleanBase64 = extractCleanBase64(params.base64Data);
  if (!cleanBase64) {
    throw new WorkOrderExtractionError(
      params.sourceType === 'photo'
        ? 'La fotografía capturada está vacía o no tiene un formato válido.'
        : 'El archivo PDF está vacío o corrupto.',
      'EMPTY_BASE64_PAYLOAD'
    );
  }

  const endpoint =
    params.sourceType === 'photo'
      ? '/api/extract-work-order-photo'
      : '/api/extract-work-order-pdf';

  const baseBody =
    params.sourceType === 'photo'
      ? { imageBase64: cleanBase64, mimeType: params.mimeType || 'image/jpeg' }
      : { pdfBase64: cleanBase64, fileName: params.fileName };

  try {
    return await postToServerExtractionEndpoint({
      endpoint,
      body: { ...baseBody, attempt: 1 },
      timeoutMs: PRIMARY_TIMEOUT_MS,
      sourceType: params.sourceType,
    });
  } catch (primaryErr: unknown) {
    const status =
      (primaryErr as { httpStatus?: number })?.httpStatus || 0;
    const code =
      (primaryErr as { errorCode?: string })?.errorCode || '';
    const detail =
      primaryErr instanceof WorkOrderExtractionError
        ? primaryErr.technicalDetail
        : primaryErr instanceof Error
        ? primaryErr.message
        : String(primaryErr);

    if (!isRetryableServerStatus(status, code, detail)) {
      throw primaryErr;
    }

    params.onStatusChange?.(FALLBACK_RETRY_MESSAGE);

    return await postToServerExtractionEndpoint({
      endpoint,
      body: { ...baseBody, attempt: 2, useFallbackModel: true },
      timeoutMs: FALLBACK_TIMEOUT_MS,
      sourceType: params.sourceType,
    });
  }
}
