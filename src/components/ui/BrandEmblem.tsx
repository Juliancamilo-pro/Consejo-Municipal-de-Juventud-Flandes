interface BrandEmblemProps {
  className?: string;
}

export function BrandEmblem({ className = 'w-8 h-8' }: BrandEmblemProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="9"
        className="fill-[#7B1832] dark:fill-[#A62B4B]"
      />
      <rect
        x="4.5"
        y="4.5"
        width="31"
        height="31"
        rx="6.5"
        stroke="#C59B27"
        strokeWidth="1.2"
      />
      {/* Arco representativo del puente sobre el Río Magdalena en Flandes */}
      <path
        d="M9.5 23.5C12.8 15.5 27.2 15.5 30.5 23.5"
        stroke="#C59B27"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M8.5 23.5H31.5"
        stroke="#FAFAF8"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M15 23.5V18.5M20 23.5V17.4M25 23.5V18.5" stroke="#C59B27" strokeWidth="1.15" />
      {/* Ondas del Alto Magdalena */}
      <path
        d="M10.5 27.5C13.5 26 16.5 26 19.5 27.5C22.5 29 25.5 29 29.5 27.5"
        stroke="#FAFAF8"
        strokeOpacity="0.9"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Sol dorado tolimense */}
      <circle cx="20" cy="11.2" r="2" fill="#C59B27" />
    </svg>
  );
}
