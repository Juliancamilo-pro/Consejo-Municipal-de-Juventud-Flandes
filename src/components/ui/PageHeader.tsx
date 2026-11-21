import { Fragment, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { FadeInSection } from './MotionPrimitives';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  breadcrumbs?: BreadcrumbItem[];
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };
  aside?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  primaryAction,
  aside,
}: PageHeaderProps) {
  return (
    <header className="cmj-territorial-weave border-b border-stone-200/90 bg-[#F7F4EE] dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <FadeInSection>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Ruta de navegación" className="mb-4">
              <ol className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-slate-400">
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <Fragment key={`${crumb.label}-${idx}`}>
                      {idx > 0 && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      )}
                      <li>
                        {crumb.onClick && !isLast ? (
                          <button
                            type="button"
                            onClick={crumb.onClick}
                            className="font-medium transition-colors hover:text-[#7B1832] dark:hover:text-[#D9B245]"
                          >
                            {crumb.label}
                          </button>
                        ) : (
                          <span
                            aria-current={isLast ? 'page' : undefined}
                            className={isLast ? 'font-semibold text-stone-800 dark:text-slate-200' : ''}
                          >
                            {crumb.label}
                          </span>
                        )}
                      </li>
                    </Fragment>
                  );
                })}
              </ol>
            </nav>
          )}

          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
                {eyebrow}
              </p>
              <h1 className="cmj-display-page mt-2.5 font-display font-semibold text-stone-950 dark:text-white">
                {title}
              </h1>
              <p className="cmj-prose mt-3.5 text-base text-stone-600 dark:text-slate-300">
                {description}
              </p>
            </div>
            {(primaryAction || aside) && (
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {aside}
                {primaryAction && (
                  <Button
                    type="button"
                    variant={primaryAction.variant ?? 'primary'}
                    onClick={primaryAction.onClick}
                  >
                    {primaryAction.label}
                  </Button>
                )}
              </div>
            )}
          </div>
        </FadeInSection>
      </div>
    </header>
  );
}
