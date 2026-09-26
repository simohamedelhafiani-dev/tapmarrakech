import { RotateCcw, AlertTriangle } from 'lucide-react';

export function DataLoadError({
  message = 'Impossible de charger les données.',
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Erreur de chargement</p>
          <p className="mt-1 text-sm">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-xs font-semibold text-white"
      >
        <RotateCcw size={14} />
        Réessayer
      </button>
    </div>
  );
}
