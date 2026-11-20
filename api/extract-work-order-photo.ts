import { GoogleGenAI, Type } from '@google/genai';

interface ServerlessReq {
  method?: string;
  body?: unknown;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | string>;
}

interface ServerlessRes {
  statusCode?: number;
  status?: (code: number) => ServerlessRes;
  json?: (data: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
}

const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
const MAX_RETRIES_ON_TRANSIENT = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(res: ServerlessRes, statusCode: number, payload: Record<string, unknown>) {
  try {
    res.setHeader?.('Content-Type', 'application/json; charset=utf-8');
  } catch {
    // Ignore header errors if headers were already set
  }
  if (typeof res.status === 'function') {
    const chained = res.status(statusCode);
    if (chained && typeof chained.json === 'function') {
      return chained.json(payload);
    }
  }
  if (typeof res.json === 'function') {
    res.statusCode = statusCode;
    return res.json(payload);
  }
  res.statusCode = statusCode;
  res.end?.(JSON.stringify(payload));
}

async function readJsonBody(req: ServerlessReq): Promise<Record<string, unknown>> {
  const rawBody = req?.body;
  if (rawBody !== undefined && rawBody !== null) {
    if (typeof rawBody === 'string') {
      return rawBody.trim() ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(rawBody)) {
      const text = rawBody.toString('utf8').trim();
      return text ? (JSON.parse(text) as Record<string, unknown>) : {};
    }
    if (typeof rawBody === 'object') {
      return rawBody as Record<string, unknown>;
    }
  }

  if (req && typeof req[Symbol.asyncIterator] === 'function') {
    const chunks: string[] = [];
    for await (const chunk of req as AsyncIterable<Uint8Array | string>) {
      if (typeof chunk === 'string') {
        chunks.push(chunk);
      } else if (typeof Buffer !== 'undefined') {
        chunks.push(Buffer.from(chunk).toString('utf8'));
      }
    }
    const text = chunks.join('').trim();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  }

  return {};
}

function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.status === 'number') return e.status;
  if (typeof e.code === 'number') return e.code;
  if (typeof e.statusCode === 'number') return e.statusCode;
  return undefined;
}

function isRetryable503Or429(err: unknown): boolean {
  const status = getErrorStatus(err);
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

function detectImageMimeType(cleanBase64: string, fallbackMimeType: string): string {
  try {
    if (typeof Buffer !== 'undefined') {
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
          headerBuf.length >= 12 &&
          headerBuf.subarray(0, 4).toString('ascii') === 'RIFF' &&
          headerBuf.subarray(8, 12).toString('ascii') === 'WEBP'
        ) {
          return 'image/webp';
        }
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
    normalized === 'image/heif'
  ) {
    return normalized;
  }
  return 'image/jpeg';
}

export default async function handler(req: ServerlessReq, res: ServerlessRes) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, {
        error: 'Método no permitido. Usa POST.',
        technicalError: `HTTP 405 Method Not Allowed (${req.method || 'UNKNOWN'})`,
      });
    }

    const body = await readJsonBody(req);
    const rawInput = body.imageBase64;

    if (!rawInput || typeof rawInput !== 'string') {
      return sendJson(res, 400, {
        error: 'No se recibió ninguna fotografía válida para analizar.',
        technicalError: 'MISSING_IMAGE_BASE64',
      });
    }

    const cleanBase64 = extractRawBase64(rawInput);
    if (!cleanBase64) {
      return sendJson(res, 400, {
        error: 'La fotografía recibida está vacía o no tiene un formato válido.',
        technicalError: 'EMPTY_IMAGE_BASE64',
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.VITE_GEMINI_API_KEY?.trim() ||
      process.env.API_KEY?.trim();

    if (!apiKey) {
      return sendJson(res, 500, {
        code: 'MISSING_GEMINI_API_KEY',
        error: 'Falta configurar la API Key de Gemini',
        technicalError:
          'MISSING_GEMINI_API_KEY: No se encontró GEMINI_API_KEY, VITE_GEMINI_API_KEY ni API_KEY en las variables de entorno del servidor.',
      });
    }

    const mimeType = detectImageMimeType(
      cleanBase64,
      typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg'
    );
    const maxRetries = body.singleAttempt === true ? 0 : MAX_RETRIES_ON_TRANSIENT;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let response;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: PRIMARY_GEMINI_MODEL,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: `Extrae los datos de esta orden de trabajo (foto) en JSON estricto. Sin inventar datos; usa null si un campo no aparece.
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
        break;
      } catch (err: unknown) {
        lastError = err;
        if (!isRetryable503Or429(err) || attempt >= maxRetries) {
          throw err;
        }
        await sleep(RETRY_DELAY_MS);
      }
    }

    if (!response) {
      throw lastError || new Error('EMPTY_AI_RESPONSE');
    }

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      return sendJson(res, 502, {
        error: 'La IA no devolvió datos legibles para la fotografía.',
        technicalError: 'EMPTY_AI_RESPONSE',
      });
    }

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText) as Record<string, unknown>;

    return sendJson(res, 200, {
      ot: normalizeTextField(parsed.ot),
      client: normalizeTextField(parsed.client),
      createdAt: normalizeIsoDate(parsed.createdAt),
      deliveryDate: normalizeIsoDate(parsed.deliveryDate),
      notes: normalizeTextField(parsed.notes),
      isUrgent: parsed.isUrgent === true,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error || 'Error interno desconocido');
    const upperMsg = errorMessage.toUpperCase();
    const errStatus = getErrorStatus(error);

    if (
      errStatus === 503 ||
      upperMsg.includes('503') ||
      upperMsg.includes('UNAVAILABLE') ||
      upperMsg.includes('HIGH DEMAND') ||
      upperMsg.includes('OVERLOADED')
    ) {
      return sendJson(res, 503, {
        code: 'TRANSIENT_OVERLOAD',
        error: errorMessage,
        technicalError: errorMessage,
      });
    }

    if (
      errStatus === 429 ||
      upperMsg.includes('429') ||
      upperMsg.includes('RESOURCE_EXHAUSTED') ||
      upperMsg.includes('TOO MANY REQUESTS')
    ) {
      return sendJson(res, 429, {
        code: 'TRANSIENT_OVERLOAD',
        error: errorMessage,
        technicalError: errorMessage,
      });
    }

    return sendJson(res, 500, {
      error: errorMessage,
      technicalError: errorMessage,
    });
  }
}
