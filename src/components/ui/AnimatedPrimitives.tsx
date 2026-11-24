import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Inbox } from 'lucide-react';

export function AnimatedCounter({
  value,
  suffix = '',
  durationMs = 850,
}: {
  value: number;
  suffix?: string;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
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
  }, [value, durationMs, inView, reduceMotion]);

  return (
    <span ref={ref} className="font-mono-num tabular-nums">
      {display}
      {suffix}
    </span>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SlideUp({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.38, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerList({
  children,
  className = '',
  stagger = 0.05,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.08 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScaleOnHover({
  children,
  className = '',
  scale = 1.015,
}: {
  children: React.ReactNode;
  className?: string;
  scale?: number;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      whileHover={{ scale, y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Tarjeta con elevación y sutil inclinación 3D al pasar el puntero */
export function TiltCard({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  if (reduceMotion) {
    return (
      <div onClick={onClick} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      onClick={onClick}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        setTilt({ rx: -py * 4, ry: px * 4 });
      }}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
      animate={{
        rotateX: tilt.rx,
        rotateY: tilt.ry,
      }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ParallaxHero({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 28]);

  return (
    <div ref={ref} className={className}>
      {reduceMotion ? (
        children
      ) : (
        <motion.div style={{ y, willChange: 'transform' }}>{children}</motion.div>
      )}
    </div>
  );
}

export function MagneticButton({
  children,
  className = '',
  onClick,
  type = 'button',
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [pos, setPos] = useState({ x: 0, y: 0 });

  if (reduceMotion) {
    return (
      <button type={type} disabled={disabled} onClick={onClick} className={className}>
        {children}
      </button>
    );
  }

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={(e) => {
        if (disabled) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.14;
        const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.14;
        setPos({ x: Math.max(-6, Math.min(6, dx)), y: Math.max(-6, Math.min(6, dy)) });
      }}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className={className}
    >
      {children}
    </motion.button>
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
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return (
      <section id={id} className={className}>
        {children}
      </section>
    );
  }
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.38, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export function SkeletonShimmer({ className = 'h-24 w-full' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-200/80 dark:bg-slate-800/70 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent" />
    </div>
  );
}

export const SkeletonBlock = SkeletonShimmer;

const CONFETTI_PIECES = [
  { x: -90, y: -70, r: 45, c: '#059669' },
  { x: -55, y: -95, r: -35, c: '#2563EB' },
  { x: -20, y: -110, r: 65, c: '#F59E0B' },
  { x: 18, y: -105, r: -50, c: '#10B981' },
  { x: 58, y: -90, r: 30, c: '#06B6D4' },
  { x: 92, y: -65, r: -75, c: '#E11D48' },
  { x: -75, y: -40, r: 80, c: '#F59E0B' },
  { x: 75, y: -40, r: -40, c: '#2563EB' },
  { x: 0, y: -85, r: 20, c: '#10B981' },
];

/** Confeti discreto y respetuoso de prefers-reduced-motion */
export function ConfettiBurst({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  if (!active || reduceMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-24 z-[100] flex justify-center overflow-visible"
    >
      <div className="relative h-4 w-4">
        {CONFETTI_PIECES.map((p, idx) => (
          <motion.span
            key={idx}
            initial={{ opacity: 1, x: 0, y: 0, scale: 0.7, rotate: 0 }}
            animate={{
              opacity: [1, 1, 0],
              x: p.x,
              y: [0, p.y, p.y + 85],
              scale: [0.8, 1.1, 0.7],
              rotate: p.r * 3,
            }}
            transition={{ duration: 1.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute h-2.5 w-1.5 rounded-sm"
            style={{ backgroundColor: p.c }}
          />
        ))}
      </div>
    </div>
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
