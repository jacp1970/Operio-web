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

export const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';

const MAX_RETRIES_ON_TRANSIENT = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatusCode(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.status === 'number') return e.status;
  if (typeof e.code === 'number') return e.code;
  if (typeof e.statusCode === 'number') return e.statusCode;
  return undefined;
}

function isRetryable503Or429(err: unknown): boolean {
  const status = getErrorStatusCode(err);
  if (status === 503 || status === 429) return true;
  const msg = String(
    err instanceof Error ? err.message : (err as { message?: string })?.message || err || ''
  ).toUpperCase();
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('HIGH DEMAND') ||
    msg.includes('OVERLOADED') ||
    msg.includes('TOO MANY REQUESTS')
  );
}

/**
 * Resolves the Gemini API key in the browser following the required precedence:
 * 1. User-saved key in localStorage (if configured)
 * 2. import.meta.env.VITE_GEMINI_API_KEY (Vite / Vercel client env)
 * 3. process.env.API_KEY or process.env.GEMINI_API_KEY (if injected at build/runtime)
 */
export function resolveClientGeminiApiKey(): string | null {
  // 1. Check localStorage first
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storageKeys = [
        'gemini_api_key',
        'oterio_gemini_api_key',
        'operio_gemini_api_key',
        'GEMINI_API_KEY',
        'VITE_GEMINI_API_KEY',
      ];
      for (const key of storageKeys) {
        const val = window.localStorage.getItem(key)?.trim();
        if (val) return val;
      }
    } catch {
      // Ignore storage access errors (e.g. private browsing restrictions)
    }
  }

  // 2. Check Vite environment variable (Vercel / Vite builds)
  try {
    const viteKey = (import.meta as unknown as { env?: Record<string, string | undefined> })
      ?.env?.VITE_GEMINI_API_KEY?.trim();
    if (viteKey) return viteKey;
  } catch {
    // Ignore if import.meta.env is unavailable
  }

  // 3. Fallback to process.env.API_KEY or process.env.GEMINI_API_KEY
  try {
    const procEnv = (
      globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }
    )?.process?.env;
    const processKey = procEnv?.API_KEY?.trim() || procEnv?.GEMINI_API_KEY?.trim();
    if (processKey) return processKey;
  } catch {
    // Ignore in strict browser runtimes without process
  }

  return null;
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

function isThinkingConfigError(err: unknown): boolean {
  const status = getErrorStatusCode(err);
  const msg = String(
    err instanceof Error ? err.message : (err as { message?: string })?.message || err || ''
  ).toLowerCase();
  return (
    (status === 400 || msg.includes('400') || msg.includes('invalid_argument')) &&
    (msg.includes('thinkingbudget') || msg.includes('thinking_budget') || msg.includes('thinkinglevel') || msg.includes('thinking'))
  );
}

async function generateWithRetry(
  ai: GoogleGenAI,
  requestParams: {
    contents: { parts: Array<Record<string, unknown>> };
    config: Record<string, unknown>;
  }
) {
  let lastError: unknown;
  const activeConfig: Record<string, unknown> = { ...requestParams.config };
  let thinkingFallbackStep = 0;

  // Retry primary model (gemini-3.8-flash) up to 3 times on 503 / 429 (waiting 2s each)
  for (let attempt = 0; attempt <= MAX_RETRIES_ON_TRANSIENT; attempt++) {
    try {
      return await ai.models.generateContent({
        model: PRIMARY_GEMINI_MODEL,
        contents: requestParams.contents,
        config: activeConfig,
      });
    } catch (err: unknown) {
      lastError = err;

      // If endpoint rejects thinkingBudget: 0 on Gemini 3, downgrade thinkingConfig cleanly without failing
      if (isThinkingConfigError(err) && thinkingFallbackStep < 2) {
        thinkingFallbackStep++;
        activeConfig.thinkingConfig =
          thinkingFallbackStep === 1
            ? { thinkingLevel: ThinkingLevel.MINIMAL }
            : { thinkingLevel: ThinkingLevel.LOW };
        attempt--;
        continue;
      }

      if (!isRetryable503Or429(err)) {
        throw err;
      }
      if (attempt < MAX_RETRIES_ON_TRANSIENT) {
        console.warn(
          `[Gemini] Error 503/429 con ${PRIMARY_GEMINI_MODEL}. Reintentando (${attempt + 1}/${MAX_RETRIES_ON_TRANSIENT}) tras ${RETRY_DELAY_MS}ms...`
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

async function extractDirectlyWithGeminiSdk(params: {
  apiKey: string;
  base64Data: string;
  mimeType: string;
  fileName?: string;
  sourceType: 'pdf' | 'photo';
}): Promise<ExtractedWorkOrderFields> {
  const cleanBase64 = extractRawBase64(params.base64Data);
  if (!cleanBase64) {
    throw new WorkOrderExtractionError(
      params.sourceType === 'photo'
        ? 'La fotografía capturada está vacía o no tiene un formato válido.'
        : 'El archivo PDF está vacío o corrupto.',
      'EMPTY_BASE64_PAYLOAD'
    );
  }

  const ai = new GoogleGenAI({ apiKey: params.apiKey });

  const mediaPart = {
    inlineData: {
      mimeType: params.mimeType,
      data: cleanBase64,
    },
  };

  const textPart = {
    text: `Extrae los datos de esta orden de trabajo (${params.sourceType === 'photo' ? 'foto' : `PDF${params.fileName ? ` "${String(params.fileName)}"` : ''}`}) en JSON estricto. Sin inventar datos; usa null si un campo no aparece.
- ot: Nº OT / Parte / Ref.
- client: Cliente destinatario.
- createdAt: Fecha de entrada (YYYY-MM-DD).
- deliveryDate: Fecha de entrega explícita (YYYY-MM-DD) o null.
- notes: Breve descripción técnica del trabajo.
- isUrgent: true solo si indica urgencia explícita, si no false.`,
  };

  const response = await generateWithRetry(ai, {
    contents: { parts: [mediaPart, textPart] },
    config: {
      thinkingConfig: { thinkingBudget: 0 },
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
    },
  });

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

/**
 * Extracts work order fields from a PDF or compressed mobile photo.
 * - Uses client-side Gemini SDK when a client API key is resolved (localStorage -> VITE_GEMINI_API_KEY -> process.env).
 * - Otherwise delegates to the backend API route (/api/extract-work-order-pdf or /api/extract-work-order-photo)
 *   used in AI Studio preview and Vercel Serverless Functions.
 * - Throws WorkOrderExtractionError with exact technical error.message details for visible mobile diagnostics.
 */
export async function extractWorkOrderFields(params: {
  base64Data: string;
  mimeType: string;
  fileName?: string;
  sourceType: 'pdf' | 'photo';
}): Promise<ExtractedWorkOrderFields> {
  const clientApiKey = resolveClientGeminiApiKey();

  if (clientApiKey) {
    try {
      return await extractDirectlyWithGeminiSdk({
        apiKey: clientApiKey,
        base64Data: params.base64Data,
        mimeType: params.mimeType,
        fileName: params.fileName,
        sourceType: params.sourceType,
      });
    } catch (err: unknown) {
      if (err instanceof WorkOrderExtractionError) {
        throw err;
      }
      const rawMessage = err instanceof Error ? err.message : String(err || 'Error desconocido');
      throw new WorkOrderExtractionError(
        `Error al analizar ${params.sourceType === 'photo' ? 'la fotografía' : 'el PDF'} con Gemini.`,
        rawMessage
      );
    }
  }

  // No client-side key: delegate to backend API route (AI Studio server.ts or Vercel /api/*)
  const endpoint =
    params.sourceType === 'photo'
      ? '/api/extract-work-order-photo'
      : '/api/extract-work-order-pdf';

  const body =
    params.sourceType === 'photo'
      ? { imageBase64: params.base64Data, mimeType: params.mimeType }
      : { pdfBase64: params.base64Data, fileName: params.fileName };

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
    if (response.status === 404 || response.status === 405 || contentType.includes('text/html')) {
      throw new WorkOrderExtractionError(
        MISSING_API_KEY_MESSAGE,
        `HTTP ${response.status} (${contentType || 'sin content-type'}) en ${endpoint} y no se encontró VITE_GEMINI_API_KEY`
      );
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
