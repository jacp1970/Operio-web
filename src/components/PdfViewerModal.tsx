import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Download,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { dataUrlToUint8Array, downloadPdfFromDataUrl } from '../utils/pdfUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerModalProps {
  attachment: { name: string; dataUrl: string } | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  attachment,
  isOpen,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pagesHostRef = useRef<HTMLDivElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [zoomMultiplier, setZoomMultiplier] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Measure viewer container width so pages auto-fit nicely on both mobile and desktop
  useEffect(() => {
    if (!isOpen) return;

    const updateWidth = () => {
      if (containerRef.current) {
        const inner = containerRef.current.clientWidth - 24;
        if (inner > 0) setContainerWidth(inner);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isOpen]);

  // Load PDF document from dataUrl bytes using PDF.js
  useEffect(() => {
    if (!isOpen || !attachment?.dataUrl) {
      setPdfDoc(null);
      setNumPages(0);
      setRenderError(null);
      return;
    }

    let cancelled = false;
    let loadedTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let activeDoc: pdfjsLib.PDFDocumentProxy | null = null;

    const loadPdf = async () => {
      setIsLoading(true);
      setRenderError(null);
      setZoomMultiplier(1);

      try {
        const bytes = dataUrlToUint8Array(attachment.dataUrl);
        loadedTask = pdfjsLib.getDocument({ data: bytes });
        const docProxy = await loadedTask.promise;

        if (cancelled) {
          void loadedTask.destroy();
          return;
        }

        activeDoc = docProxy;
        setPdfDoc(docProxy);
        setNumPages(docProxy.numPages);
      } catch (err) {
        console.error('PDF.js load error:', err);
        if (!cancelled) {
          setRenderError(
            'No se pudo renderizar la vista previa de este PDF en el navegador. Puedes descargarlo directamente con el botón "Descargar".'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      if (activeDoc) {
        void activeDoc.cleanup();
      }
      if (loadedTask) {
        void loadedTask.destroy();
      }
    };
  }, [isOpen, attachment?.dataUrl]);

  // Render all pages onto high-DPI <canvas> elements inside pagesHostRef
  const renderAllPages = useCallback(async () => {
    if (!pdfDoc || !pagesHostRef.current) return;

    const host = pagesHostRef.current;
    host.innerHTML = '';

    const availableWidth =
      containerWidth > 0 ? containerWidth : Math.max((containerRef.current?.clientWidth || 720) - 24, 280);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let cancelled = false;

    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
      if (cancelled) break;

      const page = await pdfDoc.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = Math.min(availableWidth / baseViewport.width, 1.8);
      const displayScale = Math.max(fitScale * zoomMultiplier, 0.35);
      const viewport = page.getViewport({ scale: displayScale });

      const wrapper = document.createElement('div');
      wrapper.className =
        'relative bg-white rounded-xl shadow-md border border-graphite-200 overflow-hidden mx-auto';
      wrapper.style.width = `${Math.floor(viewport.width)}px`;

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.style.display = 'block';

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        }).promise;
      }

      if (pdfDoc.numPages > 1) {
        const badge = document.createElement('div');
        badge.className =
          'px-2.5 py-1 bg-graphite-50 border-t border-graphite-100 text-[10px] font-semibold text-graphite-500 text-right';
        badge.textContent = `Página ${pageNumber} de ${pdfDoc.numPages}`;
        wrapper.appendChild(canvas);
        wrapper.appendChild(badge);
      } else {
        wrapper.appendChild(canvas);
      }

      host.appendChild(wrapper);
    }

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, containerWidth, zoomMultiplier]);

  useEffect(() => {
    if (!isOpen || !pdfDoc) return;

    let active = true;
    const run = async () => {
      try {
        await renderAllPages();
      } catch (err) {
        console.error('PDF.js render error:', err);
        if (active) {
          setRenderError(
            'No se pudo dibujar la página del documento. Utiliza el botón "Descargar" para abrir el PDF.'
          );
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [isOpen, pdfDoc, renderAllPages]);

  if (!isOpen || !attachment) return null;

  const handleDownload = () => {
    if (!attachment.dataUrl) return;
    downloadPdfFromDataUrl(attachment.dataUrl, attachment.name);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-6 bg-graphite-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl h-[90vh] sm:h-[88vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-graphite-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3.5 border-b border-graphite-200 bg-graphite-50">
          <div className="flex items-center gap-2.5 overflow-hidden min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-oterio-50 text-oterio-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="overflow-hidden min-w-0">
              <h3 className="font-bold text-graphite-900 text-xs sm:text-sm truncate">
                {attachment.name}
              </h3>
              <p className="text-[11px] text-graphite-500">
                Documento técnico adjunto
                {numPages > 0 ? ` · ${numPages} ${numPages === 1 ? 'página' : 'páginas'}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Zoom Controls */}
            {pdfDoc && !renderError && (
              <div className="inline-flex items-center bg-white border border-graphite-200 rounded-xl p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setZoomMultiplier((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  disabled={zoomMultiplier <= 0.5}
                  title="Alejar"
                  className="p-1.5 rounded-lg text-graphite-600 hover:bg-graphite-100 disabled:opacity-35 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-[11px] font-bold text-graphite-700 tabular-nums min-w-[42px] text-center">
                  {Math.round(zoomMultiplier * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomMultiplier((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                  disabled={zoomMultiplier >= 2.5}
                  title="Acercar"
                  className="p-1.5 rounded-lg text-graphite-600 hover:bg-graphite-100 disabled:opacity-35 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {zoomMultiplier !== 1 && (
                  <button
                    type="button"
                    onClick={() => setZoomMultiplier(1)}
                    title="Ajustar al ancho"
                    className="p-1.5 rounded-lg text-graphite-500 hover:bg-graphite-100 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={!attachment.dataUrl}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-oterio-600 hover:bg-oterio-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>Descargar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar visor PDF"
              className="p-2 rounded-xl text-graphite-400 hover:text-graphite-700 hover:bg-graphite-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Canvas PDF Preview Area */}
        <div
          ref={containerRef}
          className="flex-1 bg-graphite-100 p-3 sm:p-5 overflow-auto"
        >
          {!attachment.dataUrl ? (
            <div className="w-full h-full rounded-2xl border border-graphite-200 bg-white flex flex-col items-center justify-center p-6 text-center">
              <FileText className="w-10 h-10 text-oterio-500 mb-3" />
              <p className="text-sm font-bold text-graphite-900 mb-1">
                Archivo PDF no disponible en este dispositivo
              </p>
              <p className="text-xs text-graphite-500 max-w-md">
                Este PDF fue adjuntado antes de activar la sincronización por fragmentos en la nube. Pide al administrador que vuelva a subirlo para verlo desde cualquier dispositivo.
              </p>
            </div>
          ) : isLoading ? (
            <div className="w-full h-full rounded-2xl border border-graphite-200 bg-white flex flex-col items-center justify-center p-6 text-center">
              <Loader2 className="w-8 h-8 text-oterio-600 animate-spin mb-3" />
              <p className="text-sm font-bold text-graphite-900">Cargando documento PDF...</p>
              <p className="text-xs text-graphite-500 mt-1">Preparando visualización segura</p>
            </div>
          ) : renderError ? (
            <div className="w-full h-full rounded-2xl border border-graphite-200 bg-white flex flex-col items-center justify-center p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
              <p className="text-sm font-bold text-graphite-900 mb-1">
                No se pudo mostrar la vista previa
              </p>
              <p className="text-xs text-graphite-500 max-w-md mb-4">{renderError}</p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-oterio-600 hover:bg-oterio-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar PDF</span>
              </button>
            </div>
          ) : (
            <div ref={pagesHostRef} className="space-y-4 min-w-fit mx-auto" />
          )}
        </div>
      </div>
    </div>
  );
};
