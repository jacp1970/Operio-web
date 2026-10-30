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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h3 className="font-bold text-slate-900 text-sm truncate">
                {attachment.name}
              </h3>
              <p className="text-xs text-slate-500">Documento técnico adjunto</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Descargar</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Frame / Preview Area */}
        <div className="flex-1 bg-slate-100 p-2 sm:p-4 overflow-hidden flex flex-col">
          <iframe
            src={attachment.dataUrl}
            title={attachment.name}
            className="w-full h-full rounded-2xl border border-slate-200 bg-white shadow-inner"
          />
        </div>
      </div>
    </div>
  );
};
