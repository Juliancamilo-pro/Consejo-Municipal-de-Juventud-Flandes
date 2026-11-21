import { SkeletonBlock } from './MotionPrimitives';

export { SkeletonBlock };

export function SkeletonCardGrid({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Cargando tarjetas"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/75"
        >
          <SkeletonBlock className="h-36 w-full rounded-lg" label="Cargando imagen" />
          <SkeletonBlock className="mt-4 h-3 w-24 rounded" label="Cargando etiqueta" />
          <SkeletonBlock className="mt-2 h-5 w-4/5 rounded" label="Cargando título" />
          <SkeletonBlock className="mt-2 h-3.5 w-full rounded" label="Cargando resumen" />
          <SkeletonBlock className="mt-1.5 h-3.5 w-2/3 rounded" label="Cargando detalle" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 5 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Cargando registros"
      className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/75"
    >
      <SkeletonBlock className="h-8 w-full rounded-lg" label="Cargando encabezados" />
      {Array.from({ length: rows }).map((_, idx) => (
        <SkeletonBlock key={idx} className="h-11 w-full rounded-lg" label="Cargando fila" />
      ))}
    </div>
  );
}
