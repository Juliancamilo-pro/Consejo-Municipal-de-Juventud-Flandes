import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';

const EASE_INSTITUTIONAL = [0.16, 1, 0.3, 1] as const;

interface FadeInSectionProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeInSection({
  children,
  delay = 0,
  className = '',
}: FadeInSectionProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.02 }}
      transition={{
        duration: 0.38,
        delay: Math.min(delay, 0.16),
        ease: EASE_INSTITUTIONAL,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface PageTransitionProps {
  routeKey: string;
  children: ReactNode;
}

export function PageTransition({ routeKey, children }: PageTransitionProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0.9, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE_INSTITUTIONAL }}
    >
      {children}
    </motion.div>
  );
}

interface HeroParallaxLayerProps {
  children: ReactNode;
  className?: string;
}

export function HeroParallaxLayer({
  children,
  className = '',
}: HeroParallaxLayerProps) {
  const prefersReduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 28]);

  return (
    <div ref={containerRef} className={className}>
      {prefersReduced ? (
        <div>{children}</div>
      ) : (
        <motion.div style={{ y }}>{children}</motion.div>
      )}
    </div>
  );
}

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({
  value,
  suffix = '',
  className = '',
}: AnimatedCounterProps) {
  const prefersReduced = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(prefersReduced ? value : 0);

  useEffect(() => {
    if (prefersReduced) {
      setDisplayValue(value);
      return;
    }

    const durationMs = 500;
    const start = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [value, prefersReduced]);

  return (
    <span className={`tabular-nums ${className}`}>
      {displayValue}
      {suffix}
    </span>
  );
}

interface SkeletonBlockProps {
  className?: string;
  label?: string;
}

export function SkeletonBlock({
  className = 'h-4 w-full rounded',
  label = 'Cargando contenido',
}: SkeletonBlockProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`cmj-skeleton bg-stone-200/70 dark:bg-slate-800/80 ${className}`}
    />
  );
}
