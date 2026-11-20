import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface ServerlessReq {
  method?: string;
  body?: Record<string, unknown> | string;
}

export interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  json: (data: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
const MAX_RETRIES_ON_TRANSIENT = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable503Or429(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const status = e.status || e.code || e.statusCode;
    if (status === 503 || status === 429) return true;
  }
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

function isThinkingConfigError(err: unknown): boolean {
  const status =
    err && typeof err === 'object'
      ? (err as Record<string, unknown>).status ||
        (err as Record<string, unknown>).code ||
        (err as Record<string, unknown>).statusCode
      : undefined;
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

  for (let attempt = 0; attempt <= MAX_RETRIES_ON_TRANSIENT; attempt++) {
    try {
      return await ai.models.generateContent({
        model: PRIMARY_GEMINI_MODEL,
        contents: requestParams.contents,
        config: activeConfig,
      });
    } catch (err: unknown) {
      lastError = err;

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
          `[Vercel Gemini] Error 503/429 con ${PRIMARY_GEMINI_MODEL}. Reintentando (${attempt + 1}/${MAX_RETRIES_ON_TRANSIENT}) en ${RETRY_DELAY_MS}ms...`
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey =
    process.env.VITE_GEMINI_API_KEY?.trim() ||
    process.env.API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

function detectMimeTypeFromBase64(cleanBase64: string, fallbackMimeType: string): string {
  try {
    const headerBuf = Buffer.from(cleanBase64.slice(0, 64), 'base64');
    if (headerBuf.length >= 4) {
      if (headerBuf[0] === 0xff && headerBuf[1] === 0xd8 && headerBuf[2] === 0xff) {
        return 'image/jpeg';
      }
      if (
        headerBuf[0] === 0x89 &&
        headerBuf[1] === 0x50 &&
        headerBuf[2] === 0x4e &&
        headerBuf[3] === 0x47
      ) {
        return 'image/png';
      }
      if (
        headerBuf[0] === 0x25 &&
        headerBuf[1] === 0x50 &&
        headerBuf[2] === 0x44 &&
        headerBuf[3] === 0x46
      ) {
        return 'application/pdf';
      }
      if (
        headerBuf.length >= 12 &&
        headerBuf.subarray(0, 4).toString('ascii') === 'RIFF' &&
        headerBuf.subarray(8, 12).toString('ascii') === 'WEBP'
      ) {
        return 'image/webp';
      }
    }
  } catch {
    // Fall back to provided mimeType
  }

  const normalized = (fallbackMimeType || '').trim().toLowerCase();
  if (normalized === 'image/jpg') return 'image/jpeg';
  if (
    normalized === 'image/jpeg' ||
    normalized === 'image/png' ||
    normalized === 'image/webp' ||
    normalized === 'image/heic' ||
    normalized === 'image/heif' ||
    normalized === 'application/pdf'
  ) {
    return normalized;
  }
  return 'image/jpeg';
}

export async function runServerlessWorkOrderExtraction(
  req: ServerlessReq,
  res: ServerlessRes,
  sourceType: 'pdf' | 'photo'
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método no permitido. Usa POST.',
      technicalError: `HTTP 405 Method Not Allowed (${req.method || 'UNKNOWN'})`,
    });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body || '{}') as Record<string, unknown>)
        : ((req.body || {}) as Record<string, unknown>);

    const rawInput =
      sourceType === 'pdf' ? body.pdfBase64 : body.imageBase64;

    if (!rawInput || typeof rawInput !== 'string') {
      return res.status(400).json({
        error:
          sourceType === 'pdf'
            ? 'No se recibió ningún archivo PDF válido para analizar.'
            : 'No se recibió ninguna fotografía válida para analizar.',
        technicalError: 'MISSING_BASE64_INPUT',
      });
    }

    const cleanBase64 = extractRawBase64(rawInput);
    if (!cleanBase64) {
      return res.status(400).json({
        error:
          sourceType === 'pdf'
            ? 'El archivo PDF está vacío o corrupto.'
            : 'La fotografía recibida está vacía o no tiene un formato válido.',
        technicalError: 'EMPTY_BASE64_INPUT',
      });
    }

    const mimeType =
      sourceType === 'pdf'
        ? 'application/pdf'
        : detectMimeTypeFromBase64(
            cleanBase64,
            typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg'
          );

    const fileName = typeof body.fileName === 'string' ? body.fileName : undefined;
    const ai = getGeminiClient();

    const response = await generateWithRetry(ai, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: `Extrae los datos de esta orden de trabajo (${sourceType === 'photo' ? 'foto' : `PDF${fileName ? ` "${fileName}"` : ''}`}) en JSON estricto. Sin inventar datos; usa null si un campo no aparece.
- ot: Nº OT / Parte / Ref.
- client: Cliente destinatario.
- createdAt: Fecha de entrada (YYYY-MM-DD).
- deliveryDate: Fecha de entrega explícita (YYYY-MM-DD) o null.
- notes: Breve descripción técnica del trabajo.
- isUrgent: true solo si indica urgencia explícita, si no false.`,
          },
        ],
      },
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
      throw new Error('EMPTY_AI_RESPONSE');
    }

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText) as Record<string, unknown>;

    return res.status(200).json({
      ot: normalizeTextField(parsed.ot),
      client: normalizeTextField(parsed.client),
      createdAt: normalizeIsoDate(parsed.createdAt),
      deliveryDate: normalizeIsoDate(parsed.deliveryDate),
      notes: normalizeTextField(parsed.notes),
      isUrgent: parsed.isUrgent === true,
    });
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err || 'Error desconocido');
    if (rawMsg === 'MISSING_GEMINI_API_KEY') {
      return res.status(500).json({
        code: 'MISSING_GEMINI_API_KEY',
        error: 'Falta configurar la API Key de Gemini',
        technicalError: 'MISSING_GEMINI_API_KEY: No se encontró GEMINI_API_KEY ni API_KEY en Vercel.',
      });
    }

    return res.status(500).json({
      error: `Ocurrió un error al analizar ${sourceType === 'pdf' ? 'el PDF' : 'la fotografía'} con Gemini.`,
      technicalError: rawMsg,
    });
  }
}
