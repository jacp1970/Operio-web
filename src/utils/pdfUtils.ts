/**
 * Converts a Base64 PDF data URL (or raw Base64 string) into a Uint8Array
 * so it can be rendered directly with PDF.js or converted into a Blob without
 * browser data-URI blocking.
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64Part = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const cleanBase64 = base64Part.replace(/\s/g, '');
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Triggers a safe Blob download for a PDF data URL across desktop and mobile browsers.
 */
export function downloadPdfFromDataUrl(dataUrl: string, fileName: string): void {
  const bytes = dataUrlToUint8Array(dataUrl);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName || 'orden-trabajo.pdf';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Allow mobile browsers enough time to start the download before revoking
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 4000);
}

export interface CompressedPhotoResult {
  base64: string;
  mimeType: string;
  sizeKB: number;
  originalSizeKB: number;
  width: number;
  height: number;
  wasCompressed: boolean;
}

const MAX_PHOTO_DIMENSION = 1024;
const PHOTO_JPEG_QUALITY = 0.65;

function calculateBase64Bytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const raw = (commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl).replace(/\s/g, '');
  const padding = raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((raw.length * 3) / 4) - padding);
}

function drawAndCompressToJpeg(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  originalSizeKB: number
): CompressedPhotoResult {
  let width = srcWidth;
  let height = srcHeight;

  if (width > MAX_PHOTO_DIMENSION || height > MAX_PHOTO_DIMENSION) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * MAX_PHOTO_DIMENSION) / width));
      width = MAX_PHOTO_DIMENSION;
    } else {
      width = Math.max(1, Math.round((width * MAX_PHOTO_DIMENSION) / height));
      height = MAX_PHOTO_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
  }

  // Fill white background in case of transparent PNG
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  const compressedDataUrl = canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY);

  // Release canvas memory immediately after encoding completes
  canvas.width = 0;
  canvas.height = 0;

  if (!compressedDataUrl || !compressedDataUrl.startsWith('data:image/jpeg;base64,') || compressedDataUrl.length <= 64) {
    throw new Error('CANVAS_ENCODE_FAILED');
  }

  const compressedBytes = calculateBase64Bytes(compressedDataUrl);
  return {
    base64: compressedDataUrl,
    mimeType: 'image/jpeg',
    sizeKB: Math.max(1, Math.round(compressedBytes / 1024)),
    originalSizeKB,
    width,
    height,
    wasCompressed: true,
  };
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    img.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la fotografía capturada desde la cámara.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('La fotografía capturada está vacía.'));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Reads and compresses an image file (e.g., from a mobile camera capture) into an ephemeral
 * in-memory JPEG Base64 string (max 1024px longest side, JPEG quality 0.65).
 * Uses createImageBitmap first (lowest memory + respects EXIF orientation on mobile),
 * then URL.createObjectURL + Image, then FileReader + Image so mobile camera captures
 * are reliably compressed rather than sent as raw multi-MB originals.
 */
export async function readPhotoAsEphemeralBase64(file: File): Promise<CompressedPhotoResult> {
  const originalSizeKB = Math.max(1, Math.round(file.size / 1024));

  // Strategy 1: createImageBitmap (best for large mobile camera photos, avoids giant DataURL allocation)
  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width > 0 && bitmap.height > 0) {
        return drawAndCompressToJpeg(bitmap, bitmap.width, bitmap.height, originalSizeKB);
      }
    } catch {
      // Fall through to object URL decoding
    } finally {
      if (bitmap) {
        try {
          bitmap.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  // Strategy 2: Object URL + HTMLImageElement (memory-efficient fallback)
  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(file);
    const img = await loadImageFromUrl(objectUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (width > 0 && height > 0) {
      const result = drawAndCompressToJpeg(img, width, height, originalSizeKB);
      img.src = '';
      return result;
    }
  } catch {
    // Fall through to FileReader strategy
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // Strategy 3: FileReader DataURL + HTMLImageElement
  const rawDataUrl = await readFileAsDataUrl(file);
  try {
    const img = await loadImageFromUrl(rawDataUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (width > 0 && height > 0) {
      const result = drawAndCompressToJpeg(img, width, height, originalSizeKB);
      img.src = '';
      return result;
    }
  } catch {
    // Only reached if the browser cannot decode the image format at all (e.g. raw HEIC on unsupported browser)
  }

  const fallbackMime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
  const fallbackBytes = calculateBase64Bytes(rawDataUrl);
  return {
    base64: rawDataUrl,
    mimeType: fallbackMime,
    sizeKB: Math.max(1, Math.round(fallbackBytes / 1024)),
    originalSizeKB,
    width: 0,
    height: 0,
    wasCompressed: false,
  };
}
