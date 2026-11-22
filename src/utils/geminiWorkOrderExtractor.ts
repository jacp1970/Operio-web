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

const CLIENT_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

function resolveOptionalClientKey(): string | null {
  try {
    const viteKey = (import.meta as unknown as { env?: Record<string, string | undefined> })
      ?.env?.VITE_GEMINI_API_KEY?.trim();
    if (viteKey && viteKey !== 'MY_GEMINI_API_KEY') return viteKey;
  } catch {
    // Ignore
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keys = [
        'gemini_api_key',
        'oterio_gemini_api_key',
        'operio_gemini_api_key',
        'VITE_GEMINI_API_KEY',
        'GEMINI_API_KEY',
      ];
      for (const k of keys) {
        const val = window.localStorage.getItem(k)?.trim();
        if (val && val !== 'MY_GEMINI_API_KEY') return val;
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

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

async function callDirectRestFallback(params: {
  apiKey: string;
  cleanBase64: string;
  mimeType: string;
  timeoutMs: number;
}): Promise<ExtractedWorkOrderFields> {
  let lastError: unknown;

  for (const model of CLIENT_FALLBACK_MODELS) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        abortController.abort();
      } catch {
        // Ignore
      }
    }, params.timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        params.apiKey
      )}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: params.mimeType,
                    data: params.cleanBase64,
                  },
                },
                {
                  text: 'Extrae de esta orden de trabajo únicamente un JSON con las claves {"ot": string|null, "client": string|null, "createdAt": "YYYY-MM-DD"|null, "deliveryDate": "YYYY-MM-DD"|null, "notes": string|null, "isUrgent": boolean}, usando null si un dato no aparece.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
          },
        }),
      });

      const rawBody = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} (${model}): ${rawBody.slice(0, 200)}`);
      }

      const data = JSON.parse(rawBody) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
        .join('')
        .trim();

      if (!text) {
        throw new Error(`Respuesta vacía de ${model}`);
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as Record<string, unknown>;

      return {
        ot: normalizeTextField(parsed.ot),
        client: normalizeTextField(parsed.client),
        createdAt: normalizeIsoDate(parsed.createdAt),
        deliveryDate: normalizeIsoDate(parsed.deliveryDate),
        notes: normalizeTextField(parsed.notes),
        isUrgent: parsed.isUrgent === true,
      };
    } catch (err: unknown) {
      lastError = err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError || 'Error REST');
  throw new WorkOrderExtractionError('Error al analizar con Gemini.', msg);
}

async function postToServerExtractionEndpoint(params: {
  endpoint: string;
  body: Record<string, unknown>;
  clientKey: string | null;
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (params.clientKey) {
    headers['x-gemini-api-key'] = params.clientKey;
  }

  let response: Response;
  try {
    response = await fetch(params.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        params.clientKey ? { ...params.body, apiKey: params.clientKey } : params.body
      ),
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
      const missingErr = new WorkOrderExtractionError(MISSING_API_KEY_MESSAGE, technicalDetail);
      (missingErr as WorkOrderExtractionError & { errorCode?: string }).errorCode =
        'MISSING_GEMINI_API_KEY';
      throw missingErr;
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
 * Also forwards any build-time VITE_GEMINI_API_KEY to the server route and falls back to direct
 * REST fetch if the serverless environment lacks runtime env vars.
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

  const resolvedMimeType =
    params.sourceType === 'pdf' ? 'application/pdf' : params.mimeType || 'image/jpeg';

  const clientKey = resolveOptionalClientKey();

  const endpoint =
    params.sourceType === 'photo'
      ? '/api/extract-work-order-photo'
      : '/api/extract-work-order-pdf';

  const baseBody =
    params.sourceType === 'photo'
      ? { imageBase64: cleanBase64, mimeType: resolvedMimeType }
      : { pdfBase64: cleanBase64, fileName: params.fileName };

  try {
    return await postToServerExtractionEndpoint({
      endpoint,
      body: { ...baseBody, attempt: 1 },
      clientKey,
      timeoutMs: PRIMARY_TIMEOUT_MS,
      sourceType: params.sourceType,
    });
  } catch (primaryErr: unknown) {
    const status = (primaryErr as { httpStatus?: number })?.httpStatus || 0;
    const code = (primaryErr as { errorCode?: string })?.errorCode || '';
    const detail =
      primaryErr instanceof WorkOrderExtractionError
        ? primaryErr.technicalDetail
        : primaryErr instanceof Error
        ? primaryErr.message
        : String(primaryErr);

    // If the serverless function failed or didn't have the key, and we have a client VITE_GEMINI_API_KEY, run direct REST
    if (clientKey) {
      try {
        return await callDirectRestFallback({
          apiKey: clientKey,
          cleanBase64,
          mimeType: resolvedMimeType,
          timeoutMs: PRIMARY_TIMEOUT_MS,
        });
      } catch {
        // Continue to server retry or throw original error
      }
    }

    if (!isRetryableServerStatus(status, code, detail)) {
      throw primaryErr;
    }

    params.onStatusChange?.(FALLBACK_RETRY_MESSAGE);

    return await postToServerExtractionEndpoint({
      endpoint,
      body: { ...baseBody, attempt: 2, useFallbackModel: true },
      clientKey,
      timeoutMs: FALLBACK_TIMEOUT_MS,
      sourceType: params.sourceType,
    });
  }
}
