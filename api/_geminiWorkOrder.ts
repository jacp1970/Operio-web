import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

export interface ServerlessReq {
  method?: string;
  body?: Record<string, unknown> | string;
}

export interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  json: (data: unknown) => void;
  setHeader?: (name: string, value: string) => void;
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

    const docDescription =
      sourceType === 'photo'
        ? 'esta fotografía tomada con el móvil de un parte u orden de trabajo en papel, albarán, hoja de taller o plano técnico'
        : `este documento PDF${fileName ? ` (nombre de archivo: "${fileName}")` : ''} correspondiente a una orden de trabajo, parte, pedido o plano técnico de taller`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: `Analiza de forma visual y textual ${docDescription}.

Extrae EXCLUSIVAMENTE estos 6 campos en JSON estricto siguiendo el esquema:
1. ot: Número o código de orden de trabajo (busca etiquetas como Nº OT, O.T., Orden de trabajo, Parte, Nº Parte, Referencia, Ref., Expediente o similar, tanto impreso como manuscrito). Si no figura en el documento, devuelve null.
2. client: Nombre, razón social o empresa del cliente destinatario del trabajo (no confundir con la empresa emisora/taller si aparecen ambas). Si no figura, devuelve null.
3. createdAt: Fecha de entrada, recepción, apertura, emisión o alta del trabajo en formato YYYY-MM-DD. Si no figura explícitamente en el documento, devuelve null.
4. deliveryDate: Fecha de entrega, plazo de entrega, fecha límite, vencimiento, entrega prevista, fecha requerida o compromiso de entrega en formato YYYY-MM-DD ÚNICAMENTE si aparece explícitamente en el documento. Si no existe fecha de entrega explícita, devuelve null.
5. notes: Descripción del trabajo limpia y estructurada con las tareas, piezas, materiales, operaciones u observaciones técnicas a realizar. Si hay varias líneas o conceptos de trabajo, unifícalos en un solo texto con saltos de línea claros. Si no hay descripción técnica, devuelve null.
6. isUrgent: Booleano (true/false). Devuelve true ÚNICAMENTE si el documento refleja de forma explícita que el trabajo es urgente. En caso contrario, devuelve false.

Si algún campo de texto o fecha no aparece en el documento, devuelve null.`,
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'Eres un asistente especializado en digitalización de órdenes de trabajo y partes técnicos industriales en español. Extraes únicamente los 6 campos solicitados sin inventar datos ni deducir fechas ausentes.',
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
