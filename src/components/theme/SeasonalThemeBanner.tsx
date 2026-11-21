import { Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { SeasonalThemeDefinition } from '../../types/siteContent';
import { SeasonalOrnamentSvg } from './SeasonalOrnamentSvg';

interface SeasonalThemeBannerProps {
  theme: SeasonalThemeDefinition;
  hideOrnaments?: boolean;
}

export function SeasonalThemeBanner({ theme, hideOrnaments }: SeasonalThemeBannerProps) {
  const prefersReduced = useReducedMotion();

  if (hideOrnaments || theme.id === 'institucional' || !theme.bannerText) {
    return null;
  }

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ backgroundColor: theme.bannerBgHex }}
      className="border-b border-white/15 text-white"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#FDE68A]" aria-hidden="true" />
          <p className="truncate font-medium">{theme.bannerText}</p>
        </div>
        <SeasonalOrnamentSvg
          kind={theme.ornamentKind}
          accentHex={theme.accentHex}
          secondaryHex={theme.secondaryHex}
          className="hidden h-6 w-14 shrink-0 sm:block"
        />
      </div>
    </motion.div>
  );
}
