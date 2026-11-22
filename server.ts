import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Cloud Run dev runner expects the dev server strictly on port 3000
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const SERVER_CANDIDATE_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

let cachedServerModel: string | null = null;

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

async function extractWorkOrderOnServer(params: {
  cleanBase64: string;
  mimeType: string;
}) {
  const ai = getGeminiClient();

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
                mimeType: params.mimeType,
                data: params.cleanBase64,
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
    }
  }

  throw lastError || new Error('GEMINI_EXTRACTION_FAILED');
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', aiPdfExtraction: true });
});

app.post('/api/extract-work-order-pdf', async (req, res) => {
  try {
    const { pdfBase64 } = req.body || {};
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({ error: 'No se recibió ningún archivo PDF válido para analizar.' });
    }
    const cleanBase64 = extractRawBase64(pdfBase64);
    if (!cleanBase64) {
      return res.status(400).json({ error: 'El archivo PDF está vacío o corrupto.' });
    }
    const result = await extractWorkOrderOnServer({
      cleanBase64,
      mimeType: 'application/pdf',
    });
    return res.json(result);
  } catch (err: any) {
    const rawMsg = String(err?.message || err || 'Error desconocido');
    if (rawMsg === 'MISSING_GEMINI_API_KEY') {
      return res.status(500).json({
        code: 'MISSING_GEMINI_API_KEY',
        error: 'Falta configurar la API Key de Gemini',
        technicalError: rawMsg,
      });
    }
    return res.status(500).json({
      error: 'Ocurrió un error al analizar el PDF con Gemini.',
      technicalError: rawMsg,
    });
  }
});

app.post('/api/extract-work-order-photo', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'No se recibió ninguna fotografía válida para analizar.' });
    }
    const cleanBase64 = extractRawBase64(imageBase64);
    if (!cleanBase64) {
      return res.status(400).json({ error: 'La fotografía recibida está vacía o no tiene un formato válido.' });
    }
    const resolvedMimeType = detectMimeTypeFromBase64(
      cleanBase64,
      typeof mimeType === 'string' ? mimeType : 'image/jpeg'
    );
    const result = await extractWorkOrderOnServer({
      cleanBase64,
      mimeType: resolvedMimeType,
    });
    return res.json(result);
  } catch (err: any) {
    const rawMsg = String(err?.message || err || 'Error desconocido');
    if (rawMsg === 'MISSING_GEMINI_API_KEY') {
      return res.status(500).json({
        code: 'MISSING_GEMINI_API_KEY',
        error: 'Falta configurar la API Key de Gemini',
        technicalError: rawMsg,
      });
    }
    return res.status(500).json({
      error: 'Ocurrió un error al analizar la fotografía con Gemini.',
      technicalError: rawMsg,
    });
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
