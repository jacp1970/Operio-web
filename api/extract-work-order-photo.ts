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

const SERVER_CANDIDATE_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

let cachedServerModel: string | null = null;

function sendJson(res: ServerlessRes, statusCode: number, payload: Record<string, unknown>) {
  try {
    res.setHeader?.('Content-Type', 'application/json; charset=utf-8');
  } catch {
    // Ignore header errors
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
      process.env.API_KEY?.trim();

    if (!apiKey) {
      return sendJson(res, 500, {
        code: 'MISSING_GEMINI_API_KEY',
        error: 'Falta configurar la API Key de Gemini',
        technicalError:
          'MISSING_GEMINI_API_KEY: No se encontró GEMINI_API_KEY en las variables de entorno del servidor.',
      });
    }

    const mimeType = detectImageMimeType(
      cleanBase64,
      typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg'
    );

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const modelsToTry: string[] = [];
    if (cachedServerModel) {
      modelsToTry.push(cachedServerModel);
    }
    for (const m of SERVER_CANDIDATE_MODELS) {
      if (!modelsToTry.includes(m)) {
        modelsToTry.push(m);
      }
    }

    let lastError: unknown;
    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: 'Extrae de esta orden de trabajo únicamente un JSON con las claves {"ot": string|null, "client": string|null, "createdAt": "YYYY-MM-DD"|null, "deliveryDate": "YYYY-MM-DD"|null, "notes": string|null, "isUrgent": boolean}, usando null si un dato no aparece.',
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

        const rawText = (response.text ?? '').trim();
        if (!rawText) {
          throw new Error('EMPTY_AI_RESPONSE');
        }

        cachedServerModel = model;
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
      } catch (err: unknown) {
        lastError = err;
      }
    }

    throw lastError || new Error('GEMINI_EXTRACTION_FAILED');
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error || 'Error interno desconocido');
    return sendJson(res, 500, {
      error: errorMessage,
      technicalError: errorMessage,
    });
  }
}
