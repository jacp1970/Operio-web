import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Cloud Run dev runner expects the dev server strictly on port 3000
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

function getGeminiClient(): GoogleGenAI {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.API_KEY?.trim();
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

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;

  // Already YYYY-MM-DD or YYYY/MM/DD
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

  // Fallback for DD/MM/YYYY or DD-MM-YYYY
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

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', aiPdfExtraction: true });
});

function extractRawBase64(input: string): string {
  const withoutHeader = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  return withoutHeader.replace(/\s/g, '');
}

function detectMimeTypeFromBase64(cleanBase64: string, fallbackMimeType: string): string {
  try {
    const headerBuf = Buffer.from(cleanBase64.slice(0, 64), 'base64');
    if (headerBuf.length >= 4) {
      // JPEG: FF D8 FF
      if (headerBuf[0] === 0xff && headerBuf[1] === 0xd8 && headerBuf[2] === 0xff) {
        return 'image/jpeg';
      }
      // PNG: 89 50 4E 47
      if (
        headerBuf[0] === 0x89 &&
        headerBuf[1] === 0x50 &&
        headerBuf[2] === 0x4e &&
        headerBuf[3] === 0x47
      ) {
        return 'image/png';
      }
      // PDF: 25 50 44 46 (%PDF)
      if (
        headerBuf[0] === 0x25 &&
        headerBuf[1] === 0x50 &&
        headerBuf[2] === 0x44 &&
        headerBuf[3] === 0x46
      ) {
        return 'application/pdf';
      }
      // WEBP: RIFF....WEBP
      if (
        headerBuf.length >= 12 &&
        headerBuf.subarray(0, 4).toString('ascii') === 'RIFF' &&
        headerBuf.subarray(8, 12).toString('ascii') === 'WEBP'
      ) {
        return 'image/webp';
      }
      // HEIC / HEIF (ftyp box at offset 4)
      if (headerBuf.length >= 12 && headerBuf.subarray(4, 8).toString('ascii') === 'ftyp') {
        const brand = headerBuf.subarray(8, 12).toString('ascii').toLowerCase();
        if (brand.startsWith('hei') || brand.startsWith('hevc') || brand.startsWith('hevx')) {
          return 'image/heic';
        }
        if (brand === 'mif1' || brand === 'msf1' || brand.startsWith('heif')) {
          return 'image/heif';
        }
      }
    }
  } catch {
    // Ignore magic-byte parse error and fall back
  }

  const normalized = (fallbackMimeType || '').trim().toLowerCase();
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
  if (normalized === 'image/jpg') {
    return 'image/jpeg';
  }
  return 'image/jpeg';
}

interface ExtractedWorkOrderFields {
  ot: string | null;
  client: string | null;
  createdAt: string | null;
  deliveryDate: string | null;
  notes: string | null;
  isUrgent: boolean;
}

const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
const MAX_RETRIES_ON_TRANSIENT = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable503Or429(err: any): boolean {
  const status = err?.status || err?.code || err?.statusCode;
  if (status === 503 || status === 429) return true;
  const msg = String(err?.message || err || '').toUpperCase();
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

function isThinkingConfigError(err: any): boolean {
  const status = err?.status || err?.code || err?.statusCode;
  const msg = String(err?.message || err || '').toLowerCase();
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
  },
  maxRetries = MAX_RETRIES_ON_TRANSIENT
) {
  let lastError: any;
  const activeConfig: Record<string, unknown> = { ...requestParams.config };
  let thinkingFallbackStep = 0;

  // Retry primary model (gemini-3.8-flash) up to maxRetries times waiting 2s on 503 / 429
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent({
        model: PRIMARY_GEMINI_MODEL,
        contents: requestParams.contents,
        config: activeConfig,
      });
    } catch (err: any) {
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
      if (attempt < maxRetries) {
        console.warn(
          `[Server Gemini] Error 503/429 con ${PRIMARY_GEMINI_MODEL}. Reintentando (${attempt + 1}/${maxRetries}) en ${RETRY_DELAY_MS}ms...`
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

async function extractWorkOrderWithGemini(params: {
  base64Data: string;
  mimeType: string;
  fileName?: string;
  sourceType: 'pdf' | 'photo';
  singleAttempt?: boolean;
}): Promise<ExtractedWorkOrderFields> {
  const ai = getGeminiClient();

  const mediaPart = {
    inlineData: {
      mimeType: params.mimeType,
      data: params.base64Data,
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

  const response = await generateWithRetry(
    ai,
    {
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
    },
    params.singleAttempt ? 0 : MAX_RETRIES_ON_TRANSIENT
  );

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('EMPTY_AI_RESPONSE');
  }

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
  } catch {
    throw new Error('INVALID_AI_JSON');
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

function handleGeminiRouteError(err: any, res: express.Response, sourceLabel: string) {
  console.error(`Gemini ${sourceLabel} extraction error:`, err);

  const rawMsg = String(err?.message || err || 'Error desconocido');

  if (err?.message === 'MISSING_GEMINI_API_KEY') {
    return res.status(500).json({
      code: 'MISSING_GEMINI_API_KEY',
      error: 'Falta configurar la API Key de Gemini',
      technicalError: 'MISSING_GEMINI_API_KEY: No se encontró GEMINI_API_KEY ni API_KEY en el entorno.',
    });
  }

  if (err?.message === 'EMPTY_AI_RESPONSE') {
    return res.status(502).json({
      error: `La IA no devolvió datos legibles para ${sourceLabel}. Puedes completar los campos manualmente.`,
      technicalError: rawMsg,
    });
  }

  if (err?.message === 'INVALID_AI_JSON') {
    return res.status(502).json({
      error: 'No se pudo interpretar la respuesta estructurada de la IA. Revisa o completa los datos manualmente.',
      technicalError: rawMsg,
    });
  }

  const statusCode = err?.status || err?.code;

  if (statusCode === 403 || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
    return res.status(403).json({
      error: 'La clave de API de Gemini no es válida o no tiene permisos.',
      technicalError: rawMsg,
    });
  }

  if (
    statusCode === 503 ||
    rawMsg.toUpperCase().includes('503') ||
    rawMsg.toUpperCase().includes('UNAVAILABLE') ||
    rawMsg.toUpperCase().includes('HIGH DEMAND') ||
    rawMsg.toUpperCase().includes('OVERLOADED')
  ) {
    return res.status(503).json({
      code: 'TRANSIENT_OVERLOAD',
      error: 'El servidor de Gemini está temporalmente saturado (503). Inténtalo de nuevo en unos segundos.',
      technicalError: rawMsg,
    });
  }

  if (statusCode === 429 || rawMsg.toUpperCase().includes('429') || rawMsg.toUpperCase().includes('RESOURCE_EXHAUSTED')) {
    return res.status(429).json({
      code: 'TRANSIENT_OVERLOAD',
      error: 'Se ha superado temporalmente la cuota de peticiones de la IA (429). Inténtalo de nuevo en unos segundos.',
      technicalError: rawMsg,
    });
  }

  return res.status(500).json({
    error: `Ocurrió un error al analizar ${sourceLabel} con Gemini. Puedes rellenar los campos manualmente.`,
    technicalError: rawMsg,
  });
}

// Multimodal PDF extraction endpoint using Gemini (gemini-3.8-flash)
app.post('/api/extract-work-order-pdf', async (req, res) => {
  try {
    const { pdfBase64, fileName, singleAttempt } = req.body || {};

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({
        error: 'No se recibió ningún archivo PDF válido para analizar.',
      });
    }

    const cleanBase64 = extractRawBase64(pdfBase64);
    if (!cleanBase64) {
      return res.status(400).json({
        error: 'El archivo PDF está vacío o corrupto.',
      });
    }

    const result = await extractWorkOrderWithGemini({
      base64Data: cleanBase64,
      mimeType: 'application/pdf',
      fileName: typeof fileName === 'string' ? fileName : undefined,
      sourceType: 'pdf',
      singleAttempt: singleAttempt === true,
    });

    return res.json(result);
  } catch (err: any) {
    return handleGeminiRouteError(err, res, 'el PDF');
  }
});

// Ephemeral mobile photo extraction endpoint using Gemini (gemini-3.8-flash)
// Processes the image strictly in memory to extract work order fields and immediately discards it.
app.post('/api/extract-work-order-photo', async (req, res) => {
  try {
    const { imageBase64, mimeType, singleAttempt } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({
        error: 'No se recibió ninguna fotografía válida para analizar.',
      });
    }

    const cleanBase64 = extractRawBase64(imageBase64);
    if (!cleanBase64) {
      return res.status(400).json({
        error: 'La fotografía recibida está vacía o no tiene un formato válido.',
      });
    }

    const resolvedMimeType = detectMimeTypeFromBase64(
      cleanBase64,
      typeof mimeType === 'string' ? mimeType : 'image/jpeg'
    );

    const result = await extractWorkOrderWithGemini({
      base64Data: cleanBase64,
      mimeType: resolvedMimeType,
      sourceType: 'photo',
      singleAttempt: singleAttempt === true,
    });

    return res.json(result);
  } catch (err: any) {
    return handleGeminiRouteError(err, res, 'la fotografía');
  }
});

// Explicit static handlers for public assets and icon fallbacks
app.use(express.static(path.resolve(__dirname, 'public')));
app.use('/assets', express.static(path.resolve(__dirname, 'public', 'assets')));

// Direct fallbacks for logo and shortcut icon requests from any relative subpath
app.get(['*/OTERIOlogo_549a0e32.jpg', '*/assets/aistudio/OTERIOlogo_549a0e32.jpg'], (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'assets', 'aistudio', 'OTERIOlogo_549a0e32.jpg'));
});

app.get(['*/IMG_20261118_203457_9dc5212b.jpg', '*/assets/aistudio/IMG_20261118_203457_9dc5212b.jpg'], (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'assets', 'aistudio', 'IMG_20261118_203457_9dc5212b.jpg'));
});

app.get(['*/operio_icon.png', '*/assets/aistudio/operio_icon.png'], (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'operio_icon.png'));
});

app.get('*/apple-touch-icon.png', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'apple-touch-icon.png'));
});

app.get('*/pwa-192x192.png', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'pwa-192x192.png'));
});

app.get('*/pwa-512x512.png', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'pwa-512x512.png'));
});

app.get('*/pwa-maskable-512x512.png', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'pwa-maskable-512x512.png'));
});

// Transparent internal rewrite for /main.tsx to /src/main.tsx (no 302 redirect)
app.use((req, _res, next) => {
  if (req.path === '/main.tsx' || req.path === '/main.js') {
    req.url = req.url.replace(/^\/main\.(tsx|js)/, '/src/main.tsx');
  }
  next();
});

// Vite Middleware for development or static build for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`OPERIO server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
