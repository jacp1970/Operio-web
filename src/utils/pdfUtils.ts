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
 * in-memory Base64 JPEG string, scaling it down if needed for fast AI analysis,
 * and immediately revoking all temporary DOM/Blob resources so nothing is stored locally.
 */
export function readPhotoAsEphemeralBase64(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const tempObjectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        URL.revokeObjectURL(tempObjectUrl);
        const MAX_DIMENSION = 2000;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

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
          reject(new Error('No se pudo procesar la imagen en memoria.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);

        // Immediately release canvas memory
        canvas.width = 0;
        canvas.height = 0;

        resolve({ base64: dataUrl, mimeType: 'image/jpeg' });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(tempObjectUrl);
      // Fallback to transient FileReader in memory
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          base64: String(reader.result || ''),
          mimeType: file.type || 'image/jpeg',
        });
      };
      reader.onerror = () => {
        reject(new Error('No se pudo leer la fotografía capturada.'));
      };
      reader.readAsDataURL(file);
    };

    img.src = tempObjectUrl;
  });
}
