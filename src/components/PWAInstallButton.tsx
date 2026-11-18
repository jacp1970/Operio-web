import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        title="Crear acceso directo en el dispositivo"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-graphite-200 hover:border-oterio-300 bg-white hover:bg-oterio-50/60 text-graphite-700 hover:text-oterio-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
      >
        <img
          src="/assets/aistudio/IMG_20261118_203457_9dc5212b.jpg"
          alt="Icono OT"
          className="w-4 h-4 object-contain rounded-xs"
        />
        <span className="hidden sm:inline">Acceso directo</span>
        <Download className="w-3.5 h-3.5 text-oterio-600 sm:hidden" />
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-graphite-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-graphite-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl border border-graphite-200 bg-white shadow-xs flex items-center justify-center p-1.5 shrink-0">
                  <img
                    src="/assets/aistudio/IMG_20261118_203457_9dc5212b.jpg"
                    alt="Icono Acceso Directo Oterio"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-graphite-900">
                    Crear acceso directo a Oterio
                  </h3>
                  <p className="text-[11px] text-graphite-500">
                    Icono oficial OT en tu pantalla de inicio
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-xl text-graphite-400 hover:text-graphite-700 hover:bg-graphite-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2.5 text-xs text-graphite-700 bg-graphite-50 p-3.5 rounded-2xl border border-graphite-200/80">
                <p className="font-bold text-graphite-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-oterio-600" />
                  <span>En iPhone / iPad (Safari):</span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-graphite-600">
                  <li>
                    Pulsa el botón <strong>Compartir</strong> en la barra de Safari.
                  </li>
                  <li>
                    Selecciona <strong>Añadir a pantalla de inicio</strong>.
                  </li>
                  <li>
                    Confirma pulsando <strong>Añadir</strong>: se creará el acceso directo con el icono <strong>OT</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-graphite-700 bg-graphite-50 p-3.5 rounded-2xl border border-graphite-200/80">
                <p className="font-bold text-graphite-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-oterio-600" />
                  <span>En Android o Ordenador (Chrome / Edge):</span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-graphite-600">
                  <li>
                    Abre el menú del navegador (icono <strong>⋮</strong> arriba a la derecha).
                  </li>
                  <li>
                    Pulsa <strong>Añadir a pantalla de inicio</strong> o <strong>Instalar aplicación / Crear acceso directo</strong>.
                  </li>
                  <li>
                    Se añadirá a tu dispositivo con el nuevo icono <strong>OT</strong>.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full rounded-xl bg-graphite-900 hover:bg-graphite-800 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
