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

// High body limit for base64 PDFs and high-res photos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Server-side Gemini AI Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: Extract Work Order data from uploaded PDF or captured photo
app.post('/api/extract-work-order', async (req, res) => {
  try {
    const { base64Data, mimeType, fileName } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: 'No se ha proporcionado el archivo PDF.' });
    }

    // Clean base64 string if it contains data prefix
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const cleanMime = mimeType || 'application/pdf';

    // Prompt instructions for Gemini
    const prompt = `Actúas como un sistema inteligente de digitalización para talleres industriales y fabricación mecánica (app OPERIO).
Analiza este documento PDF (plano técnico, hoja de pedido, orden de trabajo o albarán).

Tu objetivo es extraer los datos necesarios para autorellenar la NUEVA ORDEN DE TRABAJO:
1. "ot": Número de Orden de Trabajo (OT), código de pedido o referencia de fabricación.
   - Si encuentras algo como "OT-...", "Nº OT: ...", "ORDEN: ...", "PEDIDO: ...", úsalo en mayúsculas.
   - Si no hay ninguno identificable en el documento, sugiere uno coherente como "OT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}".
2. "client": Nombre del cliente, empresa o entidad solicitante. Si no aparece, déjalo vacío o usa "Cliente Industrial".
3. "deliveryDate": Fecha de entrega o plazo límite si aparece en el documento, estrictamente en formato YYYY-MM-DD. Si no hay fecha de entrega, déjalo como null o cadena vacía.
4. "isUrgent": Booleano (true/false). Marca true si el documento tiene sellos o textos de "URGENTE", "PRIORITARIO", "PLAZO CRÍTICO", "EXPRESS" o similar. De lo contrario, false.
5. "notes": Resumen técnico claro de las notas del trabajo, especificaciones, tolerancias dimensionales, materiales (ej. Acero F-114, Aluminio 7075, etc.), tratamientos o instrucciones particulares que contenga el documento para que el operario las tenga disponibles.

NOTA: No asignes operario ni departamento ni alertas (eso lo decide el supervisor manualmente).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: cleanMime,
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ot: {
              type: Type.STRING,
              description: 'Número de orden de trabajo o referencia',
            },
            client: {
              type: Type.STRING,
              description: 'Nombre de la empresa o cliente',
            },
            deliveryDate: {
              type: Type.STRING,
              description: 'Fecha de entrega formato YYYY-MM-DD o vacío si no se especifica',
            },
            isUrgent: {
              type: Type.BOOLEAN,
              description: 'Si el trabajo tiene indicación de urgente',
            },
            notes: {
              type: Type.STRING,
              description: 'Notas técnicas, materiales, tolerancias o aclaraciones',
            },
          },
          required: ['ot', 'client', 'isUrgent', 'notes'],
        },
      },
    });

    const rawText = response.text || '{}';
    let extractedData = {};
    try {
      extractedData = JSON.parse(rawText);
    } catch (e) {
      console.warn('Error parsing JSON from Gemini, fallback to raw', e);
    }

    return res.json({
      success: true,
      extracted: extractedData,
      sourceFileName: fileName || 'documento_adjunto.pdf',
    });
  } catch (error: any) {
    console.error('Error processing document with Gemini:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error al procesar el documento con inteligencia artificial.',
    });
  }
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
