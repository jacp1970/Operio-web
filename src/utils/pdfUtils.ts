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
