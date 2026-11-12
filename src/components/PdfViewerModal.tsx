import React from 'react';
import { X, Download, FileText, ExternalLink } from 'lucide-react';

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
  if (!isOpen || !attachment) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = attachment.dataUrl;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-graphite-950/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl h-[85vh] bg-white rounded-3xl shadow-2xl border border-graphite-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-200 bg-graphite-50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 rounded-xl bg-oterio-50 text-oterio-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h3 className="font-bold text-graphite-900 text-sm truncate">
                {attachment.name}
              </h3>
              <p className="text-xs text-graphite-500">Documento técnico adjunto</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!attachment.dataUrl}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-oterio-600 hover:bg-oterio-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>Descargar</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-graphite-400 hover:text-graphite-700 hover:bg-graphite-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Frame / Preview Area */}
        <div className="flex-1 bg-graphite-100 p-2 sm:p-4 overflow-hidden flex flex-col">
          {attachment.dataUrl ? (
            <iframe
              src={attachment.dataUrl}
              title={attachment.name}
              className="w-full h-full rounded-2xl border border-graphite-200 bg-white shadow-inner"
            />
          ) : (
            <div className="w-full h-full rounded-2xl border border-graphite-200 bg-white flex flex-col items-center justify-center p-6 text-center">
              <FileText className="w-10 h-10 text-oterio-500 mb-3" />
              <p className="text-sm font-bold text-graphite-900 mb-1">
                Archivo adjunto demasiado grande para sincronización en la nube
              </p>
              <p className="text-xs text-graphite-500 max-w-md">
                Este PDF supera el límite por documento de la base de datos y solo está disponible en la sesión del navegador desde la que se subió.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
