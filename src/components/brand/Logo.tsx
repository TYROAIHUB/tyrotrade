import * as React from "react";
import { cn } from "@/lib/utils";

export type LogoPalette = "sky" | "amber" | "sky-bright";

interface LogoProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
  /** Sidebar/dark surface variant — same palette but tuned for blue gradient bg. */
  onDark?: boolean;
  /** Color palette: "sky" (default sky→navy) or "amber" (gold) — used on the navy sidebar theme. */
  palette?: LogoPalette;
}

const PALETTES: Record<LogoPalette, {
  gradStops: [string, string, string];
  rightBottom: string;
  mainTop: string;
  shadow: string;
}> = {
  sky: {
    gradStops: ["#38bdf8", "#2563eb", "#1e3a8a"],
    rightBottom: "#1e3a8a",
    mainTop: "#3b82f6",
    shadow: "#0c1a3e",
  },
  amber: {
    // Tiryaki Navy theme gold — matches the "trade" wordmark gradient exactly
    // (e0ad3e → c8922a → e0ad3e). Warm, muted, professional — not bright yellow.
    gradStops: ["#e0ad3e", "#c8922a", "#a87a1f"],
    rightBottom: "#7a5a18",
    mainTop: "#c8922a",
    shadow: "#3d2604",
  },
  "sky-bright": {
    // Lighter sky stops so the logo reads against pure black surfaces.
    gradStops: ["#bae6fd", "#38bdf8", "#0284c7"],
    rightBottom: "#0369a1",
    mainTop: "#38bdf8",
    shadow: "#0c4a6e",
  },
};

/**
 * TYRO origami "T" mark — 4-part folded paper letterform.
 * Palette mirrors the tyrostrategy sibling app so brand assets stay in sync:
 *   - Left flap: gold gradient (#c8922a → #e0ad3e → #c8922a)
 *   - Right-bottom, top-main, shadow: navy / royal-blue tones
 */
export const Logo = React.forwardRef<SVGSVGElement, LogoProps>(
  ({ size = 32, className, onDark = false, palette = "sky", ...props }, ref) => {
    const id = React.useId().replace(/:/g, "");
    const gradId = `tyro-grad-${id}`;
    const p = PALETTES[palette];
    void onDark;

    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 150 150"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("shrink-0", className)}
        aria-hidden="true"
        {...props}
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="61.29"
            y1="116.53"
            x2="14.04"
            y2="47.15"
            gradientTransform="translate(0 150.55) scale(1 -1)"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={p.gradStops[0]} />
            <stop offset="0.5" stopColor={p.gradStops[1]} />
            <stop offset="1" stopColor={p.gradStops[2]} />
          </linearGradient>
        </defs>
        {/* Sol parça — sky→navy gradient flap */}
        <path
          d="M14.52,68.93v33.41s-.28,6.49,3.59,4.28c10.49-6.21,21.95-12.7,26.51-15.05,9.39-4.69,8.01-10.49,8.01-10.49V48.77c0-8.42-5.8-4.69-5.8-4.69l-28.16,16.15s-4.14,2.35-4.14,8.7Z"
          fill={`url(#${gradId})`}
        />
        {/* Sağ alt parça — deep navy */}
        <path
          d="M97.77,70.17v40.31s1.52,10.91-7.45,15.88l-25.68,15.19s-6.9,3.31-6.49-2.76l1.66-48.73,37.96-19.88Z"
          fill={p.rightBottom}
        />
        {/* Ana üst büyük parça — blue-500 (main visible slab) */}
        <path
          d="M58.15,137.95V66.72s-1.52-13.67,18.5-24.99l54.94-31.61s5.8-3.59,5.8,4.69V47.12s1.52,5.8-8.01,10.49c-9.53,4.69-47.9,27.61-47.9,27.61,0,0-23.33,11.87-23.33,52.74Z"
          fill={p.mainTop}
        />
        {/* Gölge parça — very deep navy */}
        <path
          d="M84.52,91.98s5.52-3.31,13.25-7.87v-8.28c-9.11,5.25-16.43,9.66-16.43,9.66,0,0-20.29,10.35-22.92,45.14v1.1c7.32-30.23,26.09-39.76,26.09-39.76Z"
          fill={p.shadow}
        />
      </svg>
    );
  }
);
Logo.displayName = "Logo";
