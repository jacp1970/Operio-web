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

export const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash-lite';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.8-flash';

const PRIMARY_TIMEOUT_MS = 10000; // 10 seconds
const FALLBACK_TIMEOUT_MS = 12000; // 12 seconds

class GeminiRestCallError extends Error {
  status?: number;
  isTimeout: boolean;
  technicalDetail: string;

  constructor(
    message: string,
    options: { status?: number; isTimeout?: boolean; technicalDetail?: string } = {}
  ) {
    super(message);
    this.name = 'GeminiRestCallError';
    this.status = options.status;
    this.isTimeout = Boolean(options.isTimeout);
    this.technicalDetail = options.technicalDetail || message;
  }
}

function resolveBrowserGeminiApiKey(): string | null {
  try {
    const viteKey = (import.meta as unknown as { env?: Record<string, string | undefined> })
      ?.env?.VITE_GEMINI_API_KEY?.trim();
    if (viteKey) return viteKey;
  } catch {
    // Ignore if import.meta.env is unavailable
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storageKeys = [
        'gemini_api_key',
        'oterio_gemini_api_key',
        'operio_gemini_api_key',
        'VITE_GEMINI_API_KEY',
        'GEMINI_API_KEY',
      ];
      for (const key of storageKeys) {
        const val = window.localStorage.getItem(key)?.trim();
        if (val) return val;
      }
    } catch {
      // Ignore storage access errors
    }
  }

  return null;
}

/**
 * Strips any data URL header (e.g. "data:application/pdf;base64," or "data:image/jpeg;base64,")
 * and whitespace so only clean raw Base64 is sent to the REST API.
 */
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

function shouldFallbackToSecondaryModel(err: unknown): boolean {
  if (err instanceof GeminiRestCallError) {
    if (err.isTimeout) return true;
    if (err.status === 503 || err.status === 404 || err.status === 429) return true;
  }
  const msg = String(
    err instanceof Error ? err.message : (err as { message?: string })?.message || err || ''
  ).toUpperCase();
  return (
    msg.includes('503') ||
    msg.includes('404') ||
    msg.includes('429') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('NOT FOUND') ||
    msg.includes('HIGH DEMAND') ||
    msg.includes('OVERLOADED') ||
    msg.includes('TIMEOUT') ||
    msg.includes('ABORT')
  );
}

async function callGeminiRestEndpoint(params: {
  model: string;
  apiKey: string;
  mimeType: string;
  cleanBase64: string;
  timeoutMs: number;
}): Promise<string> {
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${encodeURIComponent(
    params.apiKey
  )}`;

  const requestBody = {
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
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: abortController.signal,
    });

    const rawBody = await response.text();

    if (!response.ok) {
      let apiErrorMessage = `HTTP ${response.status} (${params.model})`;
      try {
        const errJson = JSON.parse(rawBody) as {
          error?: { message?: string; status?: string; code?: number };
        };
        if (errJson?.error?.message) {
          apiErrorMessage = `HTTP ${response.status} [${params.model}]: ${errJson.error.message}`;
        }
      } catch {
        if (rawBody.trim()) {
          apiErrorMessage = `HTTP ${response.status} [${params.model}]: ${rawBody.slice(0, 220)}`;
        }
      }

      throw new GeminiRestCallError(apiErrorMessage, {
        status: response.status,
        isTimeout: false,
        technicalDetail: apiErrorMessage,
      });
    }

    let data: {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    try {
      data = JSON.parse(rawBody);
    } catch (parseErr: unknown) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      throw new GeminiRestCallError(
        'Respuesta no válida de la API REST de Gemini.',
        {
          technicalDetail: `JSON.parse REST envelope error (${params.model}): ${msg}`,
        }
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const extractedText = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (!extractedText) {
      throw new GeminiRestCallError(
        `La IA (${params.model}) no devolvió texto legible.`,
        {
          technicalDetail: `EMPTY_CANDIDATE_TEXT (${params.model})`,
        }
      );
    }

    return extractedText;
  } catch (err: unknown) {
    if (
      timedOut ||
      (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted')))
    ) {
      const sec = Math.round(params.timeoutMs / 1000);
      throw new GeminiRestCallError(
        `Tiempo de espera agotado (${sec}s) en ${params.model}. Inténtalo de nuevo.`,
        {
          isTimeout: true,
          technicalDetail: `TIMEOUT_${sec}S (${params.model})`,
        }
      );
    }

    if (err instanceof GeminiRestCallError) {
      throw err;
    }

    const rawMsg = err instanceof Error ? err.message : String(err || 'Error de red desconocido');
    throw new GeminiRestCallError(rawMsg, {
      technicalDetail: `${params.model}: ${rawMsg}`,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extracts work order fields directly from the browser using fetch() against the Google Gemini REST API:
 * - Primary attempt: gemini-3.8-flash-lite with a 10s AbortController timeout.
 * - Automatic anti-503/404/timeout fallback: notifies "Reintentando en servidor alternativo..." and calls
 *   gemini-3.8-flash with a 12s AbortController timeout.
 */
export async function extractWorkOrderFields(params: {
  base64Data: string;
  mimeType: string;
  fileName?: string;
  sourceType: 'pdf' | 'photo';
  onStatusChange?: (status: string) => void;
}): Promise<ExtractedWorkOrderFields> {
  const apiKey = resolveBrowserGeminiApiKey();
  if (!apiKey) {
    throw new WorkOrderExtractionError(
      MISSING_API_KEY_MESSAGE,
      'No se encontró import.meta.env.VITE_GEMINI_API_KEY.'
    );
  }

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

  let rawJsonText = '';

  try {
    // 1. Primary fast attempt: gemini-3.8-flash-lite (10s timeout)
    rawJsonText = await callGeminiRestEndpoint({
      model: PRIMARY_GEMINI_MODEL,
      apiKey,
      mimeType: resolvedMimeType,
      cleanBase64,
      timeoutMs: PRIMARY_TIMEOUT_MS,
    });
  } catch (primaryErr: unknown) {
    if (!shouldFallbackToSecondaryModel(primaryErr)) {
      const detail =
        primaryErr instanceof GeminiRestCallError
          ? primaryErr.technicalDetail
          : primaryErr instanceof Error
          ? primaryErr.message
          : String(primaryErr);
      throw new WorkOrderExtractionError(
        `Error al analizar ${params.sourceType === 'photo' ? 'la fotografía' : 'el PDF'} con Gemini.`,
        detail
      );
    }

    // 2. Automatic fallback on 503, 404, or >10s timeout: gemini-3.8-flash (12s timeout)
    params.onStatusChange?.(FALLBACK_RETRY_MESSAGE);

    try {
      rawJsonText = await callGeminiRestEndpoint({
        model: FALLBACK_GEMINI_MODEL,
        apiKey,
        mimeType: resolvedMimeType,
        cleanBase64,
        timeoutMs: FALLBACK_TIMEOUT_MS,
      });
    } catch (fallbackErr: unknown) {
      if (fallbackErr instanceof GeminiRestCallError && fallbackErr.isTimeout) {
        throw new WorkOrderExtractionError(
          'Tiempo de espera agotado. Inténtalo de nuevo.',
          fallbackErr.technicalDetail
        );
      }
      const detail =
        fallbackErr instanceof GeminiRestCallError
          ? fallbackErr.technicalDetail
          : fallbackErr instanceof Error
          ? fallbackErr.message
          : String(fallbackErr);
      throw new WorkOrderExtractionError(
        `Error al analizar ${params.sourceType === 'photo' ? 'la fotografía' : 'el PDF'} con Gemini.`,
        detail
      );
    }
  }

  let parsed: Record<string, unknown>;
  try {
    const cleaned = rawJsonText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (parseErr: unknown) {
    const parseMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
    throw new WorkOrderExtractionError(
      'No se pudo interpretar la respuesta JSON de Gemini.',
      `JSON.parse error: ${parseMessage} | Respuesta: ${rawJsonText.slice(0, 180)}`
    );
  }

  return {
    ot: normalizeTextField(parsed.ot),
    client: normalizeTextField(parsed.client),
    createdAt: normalizeIsoDate(parsed.createdAt),
    deliveryDate: normalizeIsoDate(parsed.deliveryDate),
    notes: normalizeTextField(parsed.notes),
    isUrgent: parsed.isUrgent === true,
  };
}
