import { GoogleGenAI, Type } from '@google/genai';

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

export const PRIMARY_GEMINI_MODEL = 'gemini-2.5-flash';
export const FALLBACK_GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

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

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  requestParams: {
    contents: { parts: Array<Record<string, unknown>> };
    config: Record<string, unknown>;
  }
) {
  let lastError: unknown;

  // 1. Try primary model (gemini-2.5-flash) with up to 3 automatic retries on 503 / 429 (waiting 2s each)
  for (let attempt = 0; attempt <= MAX_RETRIES_ON_TRANSIENT; attempt++) {
    try {
      return await ai.models.generateContent({
        model: PRIMARY_GEMINI_MODEL,
        contents: requestParams.contents,
        config: requestParams.config,
      });
    } catch (err: unknown) {
      lastError = err;
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

  // 2. If primary model still fails with 503/429 after retries, try backup fallback model
  for (const fallbackModel of FALLBACK_GEMINI_MODELS) {
    try {
      console.warn(
        `[Gemini] ${PRIMARY_GEMINI_MODEL} agotó los ${MAX_RETRIES_ON_TRANSIENT} reintentos. Intentando con modelo de respaldo ${fallbackModel}...`
      );
      return await ai.models.generateContent({
        model: fallbackModel,
        contents: requestParams.contents,
        config: requestParams.config,
      });
    } catch (fallbackErr: unknown) {
      lastError = fallbackErr;
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

  const docDescription =
    params.sourceType === 'photo'
      ? 'esta fotografía tomada con el móvil de un parte u orden de trabajo en papel, albarán, hoja de taller o plano técnico'
      : `este documento PDF${params.fileName ? ` (nombre de archivo: "${String(params.fileName)}")` : ''} correspondiente a una orden de trabajo, parte, pedido o plano técnico de taller`;

  const textPart = {
    text: `Analiza de forma visual y textual ${docDescription}.

Extrae EXCLUSIVAMENTE estos 6 campos en JSON estricto siguiendo el esquema:
1. ot: Número o código de orden de trabajo (busca etiquetas como Nº OT, O.T., Orden de trabajo, Parte, Nº Parte, Referencia, Ref., Expediente o similar, tanto impreso como manuscrito). Si no figura en el documento, devuelve null.
2. client: Nombre, razón social o empresa del cliente destinatario del trabajo (no confundir con la empresa emisora/taller si aparecen ambas). Si no figura, devuelve null.
3. createdAt: Fecha de entrada, recepción, apertura, emisión o alta del trabajo en formato YYYY-MM-DD. Si no figura explícitamente en el documento, devuelve null.
4. deliveryDate: Fecha de entrega, plazo de entrega, fecha límite, vencimiento, entrega prevista, fecha requerida o compromiso de entrega en formato YYYY-MM-DD ÚNICAMENTE si aparece explícitamente en el documento (busca etiquetas como Fecha de entrega, F. Entrega, Plazo, Vencimiento, Compromiso, Entrega prevista, Para entregar el, Deadline o Delivery Date). Si no existe fecha de entrega explícita, devuelve null (bajo ningún concepto inventes ni deduzcas fechas).
5. notes: Descripción del trabajo limpia y estructurada con las tareas, piezas, materiales, operaciones u observaciones técnicas a realizar (incluyendo anotaciones manuscritas legibles si las hubiera). Si hay varias líneas o conceptos de trabajo, unifícalos en un solo texto con saltos de línea claros. Si no hay descripción técnica, devuelve null.
6. isUrgent: Booleano (true/false). Devuelve true ÚNICAMENTE si el documento refleja de forma explícita que el trabajo es urgente (por ejemplo mediante textos, sellos, casillas marcadas o notas como URGENTE, MUY URGENTE, PRIORIDAD ALTA, PRIORITARIO, EXPRÉS, EXPRESS, INMEDIATO, ASAP o similar). En caso contrario, devuelve false.

Si algún campo de texto o fecha no aparece en el documento, devuelve null.`,
  };

  const response = await generateWithRetryAndFallback(ai, {
    contents: { parts: [mediaPart, textPart] },
    config: {
      systemInstruction:
        'Eres un asistente especializado en digitalización de órdenes de trabajo y partes técnicos industriales en español (incluidos documentos PDF, planos y fotografías tomadas con el móvil de partes impresos o manuscritos). Extraes únicamente los 6 campos solicitados sin inventar datos ni deducir fechas ausentes. Cuando un dato de texto o fecha no figure explícitamente, devuelves null; y en isUrgent devuelves true solo si el documento indica urgencia o prioridad alta.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ot: {
            type: Type.STRING,
            nullable: true,
            description:
              'Número de orden de trabajo (etiquetas como Nº OT, Orden de trabajo, Parte, Referencia o Expediente). Null si no existe.',
          },
          client: {
            type: Type.STRING,
            nullable: true,
            description:
              'Nombre, razón social o empresa del cliente al que pertenece el trabajo. Null si no existe.',
          },
          createdAt: {
            type: Type.STRING,
            nullable: true,
            description:
              'Fecha de entrada, recepción, apertura o alta del trabajo normalizada en formato YYYY-MM-DD. Null si no aparece.',
          },
          deliveryDate: {
            type: Type.STRING,
            nullable: true,
            description:
              'Fecha de entrega, plazo, vencimiento o compromiso en formato YYYY-MM-DD solo si aparece explícitamente. Null si no existe, sin inventar ni deducir.',
          },
          notes: {
            type: Type.STRING,
            nullable: true,
            description:
              'Descripción del trabajo limpia y estructurada con las tareas, observaciones técnicas o conceptos; varias líneas unificadas con saltos de línea claros. Null si no existe.',
          },
          isUrgent: {
            type: Type.BOOLEAN,
            description:
              'true únicamente si el documento indica explícitamente que el trabajo es urgente, prioritario o de prioridad alta; false en caso contrario.',
          },
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
