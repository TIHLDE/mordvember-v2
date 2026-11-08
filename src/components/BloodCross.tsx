import { useId } from "react";

// Two brush strokes and a few drips, drawn over an eliminated player's portrait.
// Place inside a `relative` parent. The strokes draw themselves in when the cross mounts,
// unless `still` is set (for places that remount it often, like the status screen strip).
export function BloodCross({
  className = "",
  still = false,
}: {
  className?: string;
  still?: boolean;
}) {
  const rough = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      data-still={still || undefined}
      className={`blood-cross pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <defs>
        <filter id={rough} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="3.5" />
        </filter>
      </defs>
      <g filter={`url(#${rough})`} fill="none" stroke="currentColor" strokeLinecap="round">
        <path
          pathLength={1}
          className="blood-stroke"
          strokeWidth="9"
          d="M14 12 C 35 32, 62 60, 87 88"
        />
        <path
          pathLength={1}
          className="blood-stroke [animation-delay:280ms]"
          strokeWidth="8"
          d="M86 14 C 64 36, 38 62, 15 86"
        />
        <path
          pathLength={1}
          className="blood-drip [animation-delay:650ms]"
          strokeWidth="2.6"
          d="M52 50 L 52.5 70"
        />
        <path
          pathLength={1}
          className="blood-drip [animation-delay:750ms]"
          strokeWidth="2"
          d="M27 75 L 27.5 94"
        />
        <path
          pathLength={1}
          className="blood-drip [animation-delay:850ms]"
          strokeWidth="1.8"
          d="M74 75 L 74.4 90"
        />
      </g>
    </svg>
  );
}
