import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Ocurrió un error inesperado en la interfaz.',
    };
  }

  override render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      if (friendly.startsWith('{')) {
        try {
          const parsed = JSON.parse(friendly);
          if (parsed.error) {
            friendly = `Error de permisos o conexión en Firestore (${parsed.operationType || 'operación'}): ${parsed.error}`;
          }
        } catch {
          // conservar mensaje original
        }
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#090D16] p-6">
          <div className="max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Algo salió fuera de lo previsto
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Recargar portal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export class ModuleErrorBoundary extends React.Component<
  { children: React.ReactNode; moduleName?: string },
  State
> {
  constructor(props: { children: React.ReactNode; moduleName?: string }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Error al cargar este módulo.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No se pudo renderizar {this.props.moduleName || 'este módulo'}
          </h3>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar módulo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
