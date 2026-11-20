import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

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
export const TIMEOUT_ERROR_MESSAGE = 'Tiempo de espera agotado (15s). Inténtalo de nuevo.';

export const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash-lite';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.8-flash';
const REQUEST_TIMEOUT_MS = 15000;

type ThinkingMode = 'budget0' | 'minimal' | 'none';

// Session cache so consecutive work-order uploads skip already-known 404 / thinking fallbacks
let cachedModel: string = PRIMARY_GEMINI_MODEL;
let cachedThinkingMode: ThinkingMode = 'budget0';

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

function getErrorStatusCode(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.status === 'number') return e.status;
  if (typeof e.code === 'number') return e.code;
  if (typeof e.statusCode === 'number') return e.statusCode;
  return undefined;
}

function isNotFound404Error(err: unknown): boolean {
  if (getErrorStatusCode(err) === 404) return true;
  const msg = String(
    err instanceof Error ? err.message : (err as { message?: string })?.message || err || ''
  ).toUpperCase();
  return msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('NOT FOUND');
}

function isThinkingConfigError(err: unknown): boolean {
  const status = getErrorStatusCode(err);
  const msg = String(
    err instanceof Error ? err.message : (err as { message?: string })?.message || err || ''
  ).toLowerCase();
  return (
    (status === 400 || msg.includes('400') || msg.includes('invalid_argument')) &&
    (msg.includes('thinkingbudget') ||
      msg.includes('thinking_budget') ||
      msg.includes('thinkinglevel') ||
      msg.includes('thinking'))
  );
}

function extractRawBase64(input: string): string {
  const withoutHeader = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  return withoutHeader.replace(/\s/g, '');
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

function buildRequestConfig(abortSignal: AbortSignal, thinkingMode: ThinkingMode) {
  const baseConfig: Record<string, unknown> = {
    abortSignal,
    temperature: 0,
    maxOutputTokens: 512,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        ot: { type: Type.STRING, nullable: true },
        client: { type: Type.STRING, nullable: true },
        createdAt: { type: Type.STRING, nullable: true },
        deliveryDate: { type: Type.STRING, nullable: true },
        notes: { type: Type.STRING, nullable: true },
        isUrgent: { type: Type.BOOLEAN },
      },
      required: ['ot', 'client', 'createdAt', 'deliveryDate', 'notes', 'isUrgent'],
      propertyOrdering: ['ot', 'client', 'createdAt', 'deliveryDate', 'notes', 'isUrgent'],
    },
  };

  if (thinkingMode === 'budget0') {
    baseConfig.thinkingConfig = { thinkingBudget: 0 };
  } else if (thinkingMode === 'minimal') {
    baseConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
  }

  return baseConfig;
}

/**
 * Extracts work order fields directly from the browser using @google/genai and VITE_GEMINI_API_KEY.
 * - Uses gemini-3.8-flash-lite as primary model, automatically falling back to gemini-3.8-flash on 404.
 * - Maximizes speed with temperature: 0, maxOutputTokens: 512, thinkingBudget: 0 (with safe fallback to MINIMAL or omitted),
 *   and a single-sentence extraction prompt.
 * - Enforces a strict 15-second timeout via AbortController + Promise.race.
 */
export async function extractWorkOrderFields(params: {
  base64Data: string;
  mimeType: string;
  fileName?: string;
  sourceType: 'pdf' | 'photo';
}): Promise<ExtractedWorkOrderFields> {
  const apiKey = resolveBrowserGeminiApiKey();
  if (!apiKey) {
    throw new WorkOrderExtractionError(
      MISSING_API_KEY_MESSAGE,
      'No se encontró import.meta.env.VITE_GEMINI_API_KEY en el cliente.'
    );
  }

  const cleanBase64 = extractRawBase64(params.base64Data);
  if (!cleanBase64) {
    throw new WorkOrderExtractionError(
      params.sourceType === 'photo'
        ? 'La fotografía capturada está vacía o no tiene un formato válido.'
        : 'El archivo PDF está vacío o corrupto.',
      'EMPTY_BASE64_PAYLOAD'
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        abortController.abort();
      } catch {
        // Ignore abort errors
      }
      reject(
        new WorkOrderExtractionError(
          TIMEOUT_ERROR_MESSAGE,
          'TIMEOUT_15S: La petición directa a Gemini superó los 15 segundos.'
        )
      );
    }, REQUEST_TIMEOUT_MS);
  });

  const mediaPart = {
    inlineData: {
      mimeType: params.mimeType,
      data: cleanBase64,
    },
  };

  const textPart = {
    text: 'Extrae de esta orden de trabajo en JSON los campos ot, client, createdAt (YYYY-MM-DD), deliveryDate (YYYY-MM-DD explícita o null), notes (breve) e isUrgent (boolean), usando null si no aparece.',
  };

  const runGeminiCall = async () => {
    let modelToUse = cachedModel;
    let thinkingMode: ThinkingMode = cachedThinkingMode;

    while (true) {
      if (abortController.signal.aborted) {
        throw new WorkOrderExtractionError(TIMEOUT_ERROR_MESSAGE, 'AbortError (15s timeout)');
      }

      try {
        const res = await ai.models.generateContent({
          model: modelToUse,
          contents: { parts: [mediaPart, textPart] },
          config: buildRequestConfig(abortController.signal, thinkingMode),
        });
        cachedModel = modelToUse;
        cachedThinkingMode = thinkingMode;
        return res;
      } catch (err: unknown) {
        // Automatic 404 fallback from gemini-3.8-flash-lite -> gemini-3.8-flash
        if (modelToUse === PRIMARY_GEMINI_MODEL && isNotFound404Error(err)) {
          modelToUse = FALLBACK_GEMINI_MODEL;
          cachedModel = FALLBACK_GEMINI_MODEL;
          continue;
        }

        // Safe fallback if thinkingBudget: 0 or ThinkingLevel.MINIMAL is rejected
        if (isThinkingConfigError(err)) {
          if (thinkingMode === 'budget0') {
            thinkingMode = 'minimal';
            continue;
          }
          if (thinkingMode === 'minimal') {
            thinkingMode = 'none';
            continue;
          }
        }

        throw err;
      }
    }
  };

  let response;
  try {
    response = await Promise.race([runGeminiCall(), timeoutPromise]);
  } catch (err: unknown) {
    if (err instanceof WorkOrderExtractionError) {
      throw err;
    }
    if (timedOut || (err instanceof Error && err.name === 'AbortError')) {
      throw new WorkOrderExtractionError(
        TIMEOUT_ERROR_MESSAGE,
        err instanceof Error ? err.message : 'AbortError (15s timeout)'
      );
    }
    const rawMessage = err instanceof Error ? err.message : String(err || 'Error desconocido');
    throw new WorkOrderExtractionError(
      `Error al analizar ${params.sourceType === 'photo' ? 'la fotografía' : 'el PDF'} con Gemini.`,
      rawMessage
    );
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new WorkOrderExtractionError(
      `La IA no devolvió datos legibles para ${params.sourceType === 'photo' ? 'la fotografía' : 'el PDF'}.`,
      'EMPTY_AI_RESPONSE: response.text vacío'
    );
  }

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
  } catch (parseErr: unknown) {
    const parseMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
    throw new WorkOrderExtractionError(
      'No se pudo interpretar la respuesta estructurada de Gemini.',
      `JSON.parse error: ${parseMessage}`
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
