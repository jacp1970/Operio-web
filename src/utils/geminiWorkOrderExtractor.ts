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

const MAX_RETRIES_ON_TRANSIENT = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientBusyResponse(status: number, code: string, technicalDetail: string): boolean {
  if (status === 503 || status === 429) return true;
  if (code === 'TRANSIENT_OVERLOAD') return true;
  const upper = technicalDetail.toUpperCase();
  return (
    upper.includes('503') ||
    upper.includes('429') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED') ||
    upper.includes('TOO MANY REQUESTS')
  );
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

/**
 * Extracts work order fields from a PDF or compressed mobile photo via the server API routes
 * (/api/extract-work-order-pdf or /api/extract-work-order-photo).
 * Coordinates automatic retries (up to 3 retries with 2s delay) on 503/429 responses so the UI
 * can show real-time status updates while keeping all Gemini calls server-side.
 */
export async function extractWorkOrderFields(params: {
  base64Data: string;
  mimeType: string;
  fileName?: string;
  sourceType: 'pdf' | 'photo';
  onStatusChange?: (status: string) => void;
}): Promise<ExtractedWorkOrderFields> {
  const endpoint =
    params.sourceType === 'photo'
      ? '/api/extract-work-order-photo'
      : '/api/extract-work-order-pdf';

  const body =
    params.sourceType === 'photo'
      ? { imageBase64: params.base64Data, mimeType: params.mimeType, singleAttempt: true }
      : { pdfBase64: params.base64Data, fileName: params.fileName, singleAttempt: true };

  for (let attempt = 0; attempt <= MAX_RETRIES_ON_TRANSIENT; attempt++) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (networkErr: unknown) {
      const rawMsg = networkErr instanceof Error ? networkErr.message : String(networkErr);
      throw new WorkOrderExtractionError(
        'No se pudo conectar con el servicio de análisis de Gemini.',
        rawMsg
      );
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      if ((response.status === 503 || response.status === 429) && attempt < MAX_RETRIES_ON_TRANSIENT) {
        const retryNumber = attempt + 1;
        params.onStatusChange?.(
          `Servidor ocupado, reintentando (intento ${retryNumber}/${MAX_RETRIES_ON_TRANSIENT})...`
        );
        await sleep(RETRY_DELAY_MS);
        continue;
      }

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

      if (
        isTransientBusyResponse(response.status, code, technicalDetail) &&
        attempt < MAX_RETRIES_ON_TRANSIENT
      ) {
        const retryNumber = attempt + 1;
        params.onStatusChange?.(
          `Servidor ocupado, reintentando (intento ${retryNumber}/${MAX_RETRIES_ON_TRANSIENT})...`
        );
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      if (
        code === 'MISSING_GEMINI_API_KEY' ||
        serverError.includes(MISSING_API_KEY_MESSAGE)
      ) {
        throw new WorkOrderExtractionError(MISSING_API_KEY_MESSAGE, technicalDetail);
      }

      throw new WorkOrderExtractionError(
        serverError ||
          `No se pudo analizar ${params.sourceType === 'photo' ? 'la fotografía' : 'el PDF'} con Gemini (HTTP ${response.status}).`,
        technicalDetail
      );
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

  throw new WorkOrderExtractionError(
    'El servidor de Gemini está temporalmente saturado tras varios reintentos.',
    'MAX_RETRIES_EXCEEDED (503/429)'
  );
}
