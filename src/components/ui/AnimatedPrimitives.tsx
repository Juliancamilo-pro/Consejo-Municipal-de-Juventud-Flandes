import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Inbox } from 'lucide-react';

export function AnimatedCounter({
  value,
  suffix = '',
  durationMs = 900,
}: {
  value: number;
  suffix?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return (
    <span className="font-mono-num tabular-nums">
      {display}
      {suffix}
    </span>
  );
}

export function SectionReveal({
  children,
  className = '',
  delay = 0,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.38, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export function SkeletonBlock({ className = 'h-24 w-full' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/70 ${className}`}
    />
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/50 p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
        <Inbox className="h-6 w-6" />
      </div>
      <h4 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h4>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600 dark:text-slate-400">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
