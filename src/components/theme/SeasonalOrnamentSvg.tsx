import { SeasonalOrnamentKind } from '../../types/siteContent';

interface SeasonalOrnamentSvgProps {
  kind: SeasonalOrnamentKind;
  accentHex?: string;
  secondaryHex?: string;
  className?: string;
}

export function SeasonalOrnamentSvg({
  kind,
  accentHex = '#7B1832',
  secondaryHex = '#C59B27',
  className = 'h-16 w-28',
}: SeasonalOrnamentSvgProps) {
  switch (kind) {
    case 'puente_flandes':
      // Puente Metálico / Férreo sobre el río Magdalena (Flandes–Girardot)
      return (
        <svg viewBox="0 0 180 72" fill="none" className={className} aria-hidden="true">
          <path
            d="M8 54 H172 M18 54 L36 30 L58 30 L78 54 M78 54 L90 22 L102 54 M102 54 L122 30 L144 30 L162 54"
            stroke={secondaryHex}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M36 30 V54 M58 30 V54 M90 22 V54 M122 30 V54 M144 30 V54 M36 54 L58 30 M122 30 L144 54"
            stroke={secondaryHex}
            strokeWidth="1.5"
            strokeOpacity="0.8"
          />
          <path
            d="M6 63 Q34 59 62 63 T118 63 T174 63"
            stroke="#60A5FA"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'tambora':
      // Tambora tolimense y sombrero tradicional estilizados
      return (
        <svg viewBox="0 0 140 72" fill="none" className={className} aria-hidden="true">
          <ellipse cx="44" cy="40" rx="20" ry="15" stroke={secondaryHex} strokeWidth="2.2" />
          <path d="M24 40 L34 29 L44 49 L54 29 L64 40" stroke={accentHex} strokeWidth="1.8" />
          <path d="M84 44 C84 31 124 31 124 44" stroke={secondaryHex} strokeWidth="2.2" />
          <ellipse cx="104" cy="45" rx="28" ry="5" stroke={secondaryHex} strokeWidth="2" />
          <path d="M90 40 H118" stroke={accentHex} strokeWidth="2.5" />
        </svg>
      );

    case 'folclor':
      // Pentagrama, estrella rítmica y ondas folclóricas
      return (
        <svg viewBox="0 0 140 72" fill="none" className={className} aria-hidden="true">
          <path d="M10 24 Q70 16 130 24 M10 38 Q70 30 130 38 M10 52 Q70 44 130 52" stroke={secondaryHex} strokeWidth="1.4" strokeOpacity="0.7" />
          <circle cx="44" cy="44" r="6" fill={secondaryHex} fillOpacity="0.85" />
          <path d="M50 44 V18 L76 14 V38" stroke={secondaryHex} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="70" cy="39" r="6" fill={accentHex} />
          <path d="M104 18 L108 26 L117 27 L110 33 L112 42 L104 37 L96 42 L98 33 L91 27 L100 26 Z" stroke={secondaryHex} strokeWidth="1.6" />
        </svg>
      );

    case 'independencia':
      // Escarapela tricolor sobria y laureles
      return (
        <svg viewBox="0 0 140 72" fill="none" className={className} aria-hidden="true">
          <circle cx="70" cy="36" r="21" stroke="#EAB308" strokeWidth="4" />
          <circle cx="70" cy="36" r="14" stroke="#2563EB" strokeWidth="4" />
          <circle cx="70" cy="36" r="7" fill="#B91C1C" />
          <path d="M38 52 C26 42 26 24 38 16 M102 52 C114 42 114 24 102 16" stroke={secondaryHex} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'juventud':
      // Nodos de diálogo y estrella juvenil
      return (
        <svg viewBox="0 0 140 72" fill="none" className={className} aria-hidden="true">
          <rect x="20" y="16" width="46" height="28" rx="8" stroke={secondaryHex} strokeWidth="2" />
          <path d="M32 44 L28 54 L42 44" stroke={secondaryHex} strokeWidth="2" strokeLinejoin="round" />
          <circle cx="96" cy="36" r="16" stroke={accentHex} strokeWidth="2.2" />
          <path d="M96 24 L100 32 L108 36 L100 40 L96 48 L92 40 L84 36 L92 32 Z" fill={secondaryHex} fillOpacity="0.85" />
        </svg>
      );

    case 'velitas':
      // Faroles geométricos luminosos
      return (
        <svg viewBox="0 0 140 72" fill="none" className={className} aria-hidden="true">
          {[38, 70, 102].map((cx, i) => (
            <g key={cx}>
              <line x1={cx} y1="6" x2={cx} y2={i === 1 ? 16 : 20} stroke={secondaryHex} strokeWidth="1.5" />
              <rect x={cx - 10} y={i === 1 ? 16 : 20} width="20" height="32" rx="4" stroke={secondaryHex} strokeWidth="2" />
              <path d={`M${cx} ${i === 1 ? 26 : 30} C${cx + 4} ${i === 1 ? 32 : 36}, ${cx - 4} ${i === 1 ? 32 : 36}, ${cx} ${i === 1 ? 26 : 30}`} fill={secondaryHex} />
              <circle cx={cx} cy={i === 1 ? 36 : 40} r="4" fill="#FBBF24" fillOpacity="0.85" />
            </g>
          ))}
        </svg>
      );

    case 'navidad':
      // Pinos geométricos y estrella decembrina
      return (
        <svg viewBox="0 0 140 72" fill="none" className={className} aria-hidden="true">
          <path d="M44 56 L58 24 L72 56 Z" stroke="#4ADE80" strokeWidth="2" strokeLinejoin="round" />
          <path d="M74 56 L90 18 L106 56 Z" stroke={secondaryHex} strokeWidth="2" strokeLinejoin="round" />
          <path d="M90 8 L92 13 L97 14 L93 17 L94 22 L90 19 L86 22 L87 17 L83 14 L88 13 Z" fill={secondaryHex} />
          <circle cx="30" cy="22" r="2.5" fill={secondaryHex} />
          <circle cx="116" cy="26" r="2.5" fill="#4ADE80" />
        </svg>
      );

    default:
      // Identidad institucional CMJ
      return (
        <svg viewBox="0 0 140 72" fill="none" className={className} aria-hidden="true">
          <circle cx="70" cy="36" r="22" stroke={secondaryHex} strokeWidth="1.6" strokeDasharray="4 4" />
          <path d="M42 36 H98 M70 12 V60" stroke={secondaryHex} strokeWidth="1.4" strokeOpacity="0.55" />
          <circle cx="70" cy="36" r="7" fill={accentHex} stroke={secondaryHex} strokeWidth="2" />
        </svg>
      );
  }
}
