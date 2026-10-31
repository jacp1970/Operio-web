import * as pdfjsLib from 'pdfjs-dist';

// Configure worker using Vite's URL asset import
// Fallback to official cdnjs/unpkg if local worker URL fails in certain iframe environments
try {
  // @ts-ignore
  import('pdfjs-dist/build/pdf.worker.mjs?url').then((workerModule) => {
    if (workerModule?.default) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
    }
  }).catch(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  });
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface ExtractedPdfData {
  ot: string;
  client: string;
  creationDate: string;
  deliveryDate: string;
  isUrgent: boolean;
  notes: string;
  fullText: string;
}

/**
 * Normalizes any date string (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.) into YYYY-MM-DD
 */
function normalizeDateToIso(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();

  // Already YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const eurMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (eurMatch) {
    const [, day, month, year] = eurMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Verbal Spanish date: DD de [mes] de YYYY
  const spanishMonths: Record<string, string> = {
    enero: '01',
    febrero: '02',
    marzo: '03',
    abril: '04',
    mayo: '05',
    junio: '06',
    julio: '07',
    agosto: '08',
    septiembre: '09',
    setiembre: '09',
    octubre: '10',
    noviembre: '11',
    diciembre: '12',
  };

  const verbalMatch = clean.match(/(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+(\d{4})/i);
  if (verbalMatch) {
    const day = verbalMatch[1].padStart(2, '0');
    const monthName = verbalMatch[2].toLowerCase();
    const year = verbalMatch[3];
    const month = spanishMonths[monthName] || '01';
    return `${year}-${month}-${day}`;
  }

  return '';
}

/**
 * Intelligent pattern extractor for technical work orders from raw text
 */
export function extractDataFromText(text: string, fileName?: string): ExtractedPdfData {
  let ot = '';
  let client = '';
  let creationDate = '';
  let deliveryDate = '';
  let isUrgent = false;
  let notes = '';

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. EXTRACT OT (Orden de Trabajo / Pedido / Referencia)
  const otPatterns = [
    // OT-2026-123, OT 2026/45, OT: 4589
    /(?:N[º°\.]?\s*)?(?:O\.?T\.?|ORDEN(?:\s+DE\s+TRABAJO)?|N[º°\.]?\s*ORDEN)\s*[:#\-–—]?\s*([A-Za-z0-9\-_/]{2,20})/i,
    /(?:PEDIDO|N[º°\.]?\s*PEDIDO|REF(?:\.|ERENCIA)?)\s*[:#\-–—]?\s*([A-Za-z0-9\-_/]{2,20})/i,
    /\b(OT[-_]\d{2,6}[-_]?[A-Za-z0-9]*)\b/i,
  ];

  for (const pattern of otPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Avoid false positive matching just "DE" or "NO"
      if (candidate.length >= 2 && !/^(DE|NO|LA|EL|EN|UN)$/i.test(candidate)) {
        ot = candidate.toUpperCase();
        if (!ot.startsWith('OT') && !ot.includes('-') && !ot.includes('/')) {
          ot = `OT-${ot}`;
        }
        break;
      }
    }
  }

  // Also inspect filename if OT wasn't found in content (e.g. "OT-2026-44_Plano.pdf")
  if (!ot && fileName) {
    const fileMatch = fileName.match(/(?:OT[-_]?\d+[A-Za-z0-9\-_]*)/i);
    if (fileMatch) {
      ot = fileMatch[0].toUpperCase().replace('_', '-');
    }
  }

  // 2. EXTRACT CLIENTE
  const clientPatterns = [
    /(?:CLIENTE|EMPRESA|SOLICITANTE|RAZ[OÓ]N\s+SOCIAL|DESTINATARIO|ENVIAR\s+A)\s*[:#\-–—]?\s*([^\n\r:;]{3,50})/i,
    /(?:CLIENT|CUSTOMER)\s*[:#\-–—]?\s*([^\n\r:;]{3,50})/i,
  ];

  for (const pattern of clientPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const cand = match[1].trim();
      // Exclude generic header lines
      if (cand.length >= 2 && !/^(NIF|CIF|FECHA|DIRECCI|TELEFONO|CONTACTO|OT)/i.test(cand)) {
        client = cand;
        break;
      }
    }
  }

  // 3. EXTRACT FECHA DE CREACIÓN / DOCUMENTO / EMISIÓN
  const creationDatePatterns = [
    /(?:FECHA(?:\s+DE)?\s+(?:CREACI[OÓ]N|EMISI[OÓ]N|ENTRADA|PEDIDO|DOCUMENTO|ORDEN)|FECHA\s+ORDEN|FECHA\s+PEDIDO)\s*[:#\-–—]?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}|\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}|\d{1,2}\s+de\s+[a-zA-ZáéíóúÁÉÍÓÚ]+\s+de\s+\d{4})/i,
    /(?:ORDER\s+DATE|ISSUE\s+DATE|CREATED\s+DATE|DATE\s+CREATED)\s*[:#\-–—]?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}|\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2})/i,
    /(?:^|\n)\s*FECHA\s*[:#\-–—]?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}|\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}|\d{1,2}\s+de\s+[a-zA-ZáéíóúÁÉÍÓÚ]+\s+de\s+\d{4})/i,
  ];

  for (const pattern of creationDatePatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const parsedIso = normalizeDateToIso(match[1]);
      if (parsedIso) {
        creationDate = parsedIso;
        break;
      }
    }
  }

  // 4. EXTRACT FECHA DE ENTREGA
  const deliveryDatePatterns = [
    /(?:FECHA(?:\s+DE)?\s+ENTREGA|PLAZO(?:\s+DE\s+ENTREGA)?|F\.?\s*ENTREGA|ENTREGA|PLAZO\s+L[IÍ]MITE|FECHA\s+L[IÍ]MITE)\s*[:#\-–—]?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}|\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}|\d{1,2}\s+de\s+[a-zA-ZáéíóúÁÉÍÓÚ]+\s+de\s+\d{4})/i,
    /(?:DUE\s+DATE|DELIVERY\s+DATE)\s*[:#\-–—]?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}|\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2})/i,
  ];

  for (const pattern of deliveryDatePatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const parsedIso = normalizeDateToIso(match[1]);
      if (parsedIso) {
        deliveryDate = parsedIso;
        break;
      }
    }
  }

  // Fallback: If no explicit creation date, but another date exists
  if (!creationDate) {
    const allDates = [...cleanText.matchAll(/\b(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})\b/g)];
    for (const d of allDates) {
      const parsed = normalizeDateToIso(d[1]);
      if (parsed && parsed !== deliveryDate) {
        creationDate = parsed;
        break;
      }
    }
  }

  // If no delivery date, fallback
  if (!deliveryDate) {
    const deliveryMatch = cleanText.match(/(?:ENTREGA|DUE)[^0-9\n]{1,20}(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})/i);
    if (deliveryMatch && deliveryMatch[1]) {
      deliveryDate = normalizeDateToIso(deliveryMatch[1]);
    }
  }

  // 4. DETECT URGENCIA
  const urgentRegex = /\b(URGENTE|URGENCIA|MUY\s+URGENTE|PRIORITARI[OA]|PRIORIDAD\s+ALTA|ALTA\s+PRIORIDAD|PLAZO\s+CR[IÍ]TICO|EXPRESS|CR[IÍ]TICO)\b/i;
  isUrgent = urgentRegex.test(cleanText);

  // 5. EXTRACT OBSERVACIONES / NOTAS / MATERIALES
  const notesSegments: string[] = [];

  // Look for Material
  const materialMatch = cleanText.match(/(?:MATERIAL|MAT\.?)\s*[:#\-–—]?\s*([^\n\r:;]{3,60})/i);
  if (materialMatch && materialMatch[1]) {
    notesSegments.push(`Material: ${materialMatch[1].trim()}`);
  }

  // Look for Tratamiento / Acabado
  const treatmentMatch = cleanText.match(/(?:TRATAMIENTO|ACABADO|RECUBRIMIENTO)\s*[:#\-–—]?\s*([^\n\r:;]{3,60})/i);
  if (treatmentMatch && treatmentMatch[1]) {
    notesSegments.push(`Acabado: ${treatmentMatch[1].trim()}`);
  }

  // Look for Observaciones / Notas / Instrucciones block
  const obsBlockMatch = cleanText.match(/(?:OBSERVACIONES|NOTAS|ESPECIFICACIONES|INSTRUCCIONES|DESCRIPCI[OÓ]N)\s*[:#\-–—]?\s*([\s\S]{5,300}?)(?=\n[A-ZÁÉÍÓÚ\s]{3,20}:|$)/i);
  if (obsBlockMatch && obsBlockMatch[1]) {
    const cleanedObs = obsBlockMatch[1]
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 4)
      .join(' ');
    if (cleanedObs.length > 5) {
      notesSegments.push(cleanedObs);
    }
  }

  // If no structured notes were found, gather 1-2 interesting descriptive lines from the text
  if (notesSegments.length === 0 && lines.length > 0) {
    const candidateLines = lines.filter((l) => {
      if (l.length < 8 || l.length > 120) return false;
      if (/^(P[aá]gina|Fecha|Tel|Email|www\.|NIF|CIF)/i.test(l)) return false;
      return true;
    });
    if (candidateLines.length > 0) {
      notesSegments.push(candidateLines.slice(0, 2).join(' · '));
    }
  }

  notes = notesSegments.join('\n').trim();

  return {
    ot,
    client,
    creationDate,
    deliveryDate,
    isUrgent,
    notes,
    fullText: cleanText,
  };
}

/**
 * Fallback binary text extractor for simple PDFs without needing web workers
 * Scans standard PDF text streams (Tj, TJ, text operators) directly from ArrayBuffer
 */
export function extractTextFromPdfArrayBufferSimple(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    const latin1String = new TextDecoder('latin1').decode(bytes);

    const textPieces: string[] = [];

    // Match text within parenthesized strings before Tj or ' operator: (Text) Tj
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(latin1String)) !== null) {
      const str = match[1]
        .replace(/\\([()\\])/g, '$1')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, ' ')
        .trim();
      if (str) {
        textPieces.push(str);
      }
    }

    // Match array text chunks: [(chunk1) -10 (chunk2)] TJ
    const arrayRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = arrayRegex.exec(latin1String)) !== null) {
      const inner = match[1];
      const chunkRegex = /\(([^)]+)\)/g;
      let chunkMatch: RegExpExecArray | null;
      const combinedChunks: string[] = [];
      while ((chunkMatch = chunkRegex.exec(inner)) !== null) {
        combinedChunks.push(chunkMatch[1].replace(/\\([()\\])/g, '$1'));
      }
      if (combinedChunks.length > 0) {
        textPieces.push(combinedChunks.join(''));
      }
    }

    return textPieces.join('\n');
  } catch (e) {
    console.warn('Simple binary PDF extraction error:', e);
    return '';
  }
}

/**
 * Main client-side parsing function.
 * Extracts text from PDF using PDF.js and falls back to binary stream reader if worker fails.
 */
export async function parsePdfClientSide(
  fileOrBuffer: File | ArrayBuffer | string,
  fileName?: string
): Promise<ExtractedPdfData> {
  let arrayBuffer: ArrayBuffer;

  if (typeof fileOrBuffer === 'string') {
    // base64 data URL
    const base64Clean = fileOrBuffer.replace(/^data:[^;]+;base64,/, '');
    const binaryStr = atob(base64Clean);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    arrayBuffer = bytes.buffer;
  } else if (fileOrBuffer instanceof File) {
    fileName = fileName || fileOrBuffer.name;
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  let extractedText = '';

  // Attempt 1: Full PDF.js extraction (renders font maps, complex multi-page layouts)
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pageTexts: string[] = [];

    // Read up to 10 pages
    const maxPages = Math.min(numPages, 10);
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStr = textContent.items
        .map((item: any) => (item?.str ? item.str : ''))
        .join(' ');
      pageTexts.push(pageStr);
    }

    extractedText = pageTexts.join('\n');
  } catch (pdfJsErr) {
    console.warn('PDF.js client extraction fell back to binary stream parser:', pdfJsErr);
    // Attempt 2: Direct binary text stream extraction
    extractedText = extractTextFromPdfArrayBufferSimple(arrayBuffer);
  }

  // Extract structured fields from the collected text
  return extractDataFromText(extractedText, fileName);
}
