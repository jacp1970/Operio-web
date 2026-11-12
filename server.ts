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

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
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

  // Already YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
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

// Multimodal PDF extraction endpoint using Gemini Flash (gemini-4-hydrogen)
app.post('/api/extract-work-order-pdf', async (req, res) => {
  try {
    const { pdfBase64, fileName } = req.body || {};

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({
        error: 'No se recibió ningún archivo PDF válido para analizar.',
      });
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/i, '').trim();
    if (!cleanBase64) {
      return res.status(400).json({
        error: 'El archivo PDF está vacío o corrupto.',
      });
    }

    const ai = getGeminiClient();

    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `Analiza de forma visual y textual este documento PDF${
        fileName ? ` (nombre de archivo: "${String(fileName)}")` : ''
      } correspondiente a una orden de trabajo, parte, pedido o plano técnico de taller.

Extrae EXCLUSIVAMENTE estos 5 campos en JSON estricto siguiendo el esquema:
1. ot: Número o código de orden de trabajo (busca etiquetas como Nº OT, O.T., Orden de trabajo, Parte, Referencia, Ref., Expediente o similar). Si no figura en el documento, devuelve null.
2. client: Nombre, razón social o empresa del cliente destinatario del trabajo (no confundir con la empresa emisora/taller si aparecen ambas). Si no figura, devuelve null.
3. createdAt: Fecha de entrada, recepción, apertura, emisión o alta del trabajo en formato YYYY-MM-DD. Si no figura explícitamente en el documento, devuelve null.
4. deliveryDate: Fecha de entrega, vencimiento o compromiso de entrega en formato YYYY-MM-DD ÚNICAMENTE si aparece de forma explícita en el documento. Si no existe fecha de entrega explícita, devuelve null (bajo ningún concepto inventes ni deduzcas fechas).
5. notes: Descripción del trabajo limpia y estructurada con las tareas, piezas, materiales, operaciones u observaciones técnicas a realizar. Si hay varias líneas o conceptos de trabajo, unifícalos en un solo texto con saltos de línea claros. Si no hay descripción técnica, devuelve null.

Si algún campo no aparece en el documento, devuelve null.`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts: [pdfPart, textPart] },
      config: {
        systemInstruction:
          'Eres un asistente especializado en digitalización de órdenes de trabajo y partes técnicos industriales en español (incluidos documentos escaneados o fotografías guardadas en PDF). Extraes únicamente los 5 campos solicitados sin inventar datos ni deducir fechas ausentes. Cuando un dato no figure explícitamente, devuelves null.',
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
                'Fecha de entrega, vencimiento o compromiso en formato YYYY-MM-DD solo si aparece explícitamente. Null si no existe, sin inventar ni deducir.',
            },
            notes: {
              type: Type.STRING,
              nullable: true,
              description:
                'Descripción del trabajo limpia y estructurada con las tareas, observaciones técnicas o conceptos; varias líneas unificadas con saltos de línea claros. Null si no existe.',
            },
          },
          required: ['ot', 'client', 'createdAt', 'deliveryDate', 'notes'],
          propertyOrdering: ['ot', 'client', 'createdAt', 'deliveryDate', 'notes'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      return res.status(502).json({
        error: 'La IA no devolvió datos legibles para este PDF. Puedes completar los campos manualmente.',
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return res.status(502).json({
        error: 'No se pudo interpretar la respuesta estructurada de la IA. Revisa o completa los datos manualmente.',
      });
    }

    return res.json({
      ot: normalizeTextField(parsed.ot),
      client: normalizeTextField(parsed.client),
      createdAt: normalizeIsoDate(parsed.createdAt),
      deliveryDate: normalizeIsoDate(parsed.deliveryDate),
      notes: normalizeTextField(parsed.notes),
    });
  } catch (err: any) {
    console.error('Gemini PDF extraction error:', err);

    if (err?.message === 'MISSING_GEMINI_API_KEY') {
      return res.status(500).json({
        error: 'No está configurada la clave de API de Gemini en el servidor (Settings > Secrets).',
      });
    }

    const statusCode = err?.status || err?.code;
    const rawMsg = String(err?.message || '');

    if (statusCode === 403 || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
      return res.status(403).json({
        error: 'La clave de API de Gemini no es válida o no tiene permisos. Verifica tu clave en Settings > Secrets.',
      });
    }

    if (statusCode === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({
        error: 'Se ha superado temporalmente la cuota de peticiones de la IA. Inténtalo de nuevo en unos segundos.',
      });
    }

    return res.status(500).json({
      error: 'Ocurrió un error al analizar el PDF con Gemini. Puedes rellenar los campos manualmente.',
    });
  }
});

// Explicit static handlers for public assets and icon fallbacks
app.use(express.static(path.resolve(__dirname, 'public')));
app.use('/assets', express.static(path.resolve(__dirname, 'public', 'assets')));

// Direct fallbacks for logo and icon requests from any relative subpath
app.get(['*/OTERIOlogo_549a0e32.jpg', '*/assets/aistudio/OTERIOlogo_549a0e32.jpg'], (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'assets', 'aistudio', 'OTERIOlogo_549a0e32.jpg'));
});

app.get(['*/operio_icon.png', '*/assets/aistudio/operio_icon.png'], (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'assets', 'aistudio', 'operio_icon.png'));
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
