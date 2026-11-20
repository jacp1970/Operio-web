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

/**
 * Reads an image file (e.g., from a mobile camera capture) into an ephemeral
 * in-memory Base64 string. Reads the file bytes with FileReader first so mobile
 * temporary camera captures are never lost, then downscales via an offscreen canvas
 * (falling back to the raw data URL for formats like HEIC that canvas cannot decode).
 */
export function readPhotoAsEphemeralBase64(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('No se pudo leer la fotografía capturada desde la cámara.'));
    };

    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        reject(new Error('La fotografía capturada está vacía.'));
        return;
      }

      const fallbackMime =
        file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';

      const img = new Image();

      img.onload = () => {
        try {
          const MAX_DIMENSION = 1024;
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            resolve({ base64: rawDataUrl, mimeType: fallbackMime });
            return;
          }

          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width >= height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            canvas.width = 0;
            canvas.height = 0;
            resolve({ base64: rawDataUrl, mimeType: fallbackMime });
            return;
          }

          // Fill white background in case of transparent PNG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);

          // Release canvas memory after encoding completes
          canvas.width = 0;
          canvas.height = 0;
          img.src = '';

          if (compressedDataUrl && compressedDataUrl.length > 64) {
            resolve({ base64: compressedDataUrl, mimeType: 'image/jpeg' });
          } else {
            resolve({ base64: rawDataUrl, mimeType: fallbackMime });
          }
        } catch {
          // If canvas encoding fails on mobile, send the raw data URL already in memory
          resolve({ base64: rawDataUrl, mimeType: fallbackMime });
        }
      };

      img.onerror = () => {
        // Browser couldn't decode image onto canvas (e.g. raw HEIC/HEIF on Android/Desktop);
        // send the raw DataURL so Gemini can process it directly on the server.
        resolve({ base64: rawDataUrl, mimeType: fallbackMime });
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}
