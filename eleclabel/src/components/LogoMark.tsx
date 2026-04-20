// Logo ElecLabel — concept "Badge" : éclair dans un anneau rouge sur fond bleu nuit.
// Composant SVG inline, parfaitement net à toutes les tailles.
// useId() garantit des id de gradient uniques quand plusieurs logos coexistent sur la page.
import { useId } from "react";

interface LogoMarkProps {
  /** Taille en px (carré) */
  size?: number;
  /** Coins arrondis façon icône d'app (true) ou carré net (false) */
  rounded?: boolean;
}

export default function LogoMark({ size = 32, rounded = true }: LogoMarkProps) {
  const uid = useId().replace(/:/g, "");
  const bg = `lm-bg-${uid}`;
  const ring = `lm-ring-${uid}`;
  const bolt = `lm-bolt-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={bg} x1="70" y1="40" x2="450" y2="490" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1F2C44" />
          <stop offset="1" stopColor="#0C1426" />
        </linearGradient>
        <linearGradient id={ring} x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F2495A" />
          <stop offset="1" stopColor="#C0303C" />
        </linearGradient>
        <linearGradient id={bolt} x1="256" y1="150" x2="256" y2="362" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF5663" />
          <stop offset="1" stopColor="#E63946" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx={rounded ? 116 : 0} fill={`url(#${bg})`} />
      <path d="M0 116 A116 116 0 0 1 116 0 L300 0 L0 300 Z" fill="#FFFFFF" opacity="0.05" />

      <circle cx="256" cy="256" r="150" stroke={`url(#${ring})`} strokeWidth="26" fill="none" />
      <circle cx="256" cy="92" r="13" fill="#E63946" />
      <circle cx="256" cy="420" r="13" fill="#E63946" />

      <path
        d="M288 138 L168 298 L246 298 L222 374 L344 244 L266 244 Z"
        fill={`url(#${bolt})`}
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
