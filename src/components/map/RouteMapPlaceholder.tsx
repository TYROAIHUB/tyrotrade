import { Anchor, MapPin, Compass, Layers } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project | null;
}

export function RouteMapPlaceholder({ project }: Props) {
  return (
    <div className="relative h-full rounded-3xl overflow-hidden glass">
      <div className="absolute inset-0 z-[1]">
        <WorldBackdrop />
      </div>

      <div className="absolute top-3 left-3 z-[3] flex items-center gap-2">
        <GlassPanel tone="strong" className="rounded-xl">
          <div className="px-3 py-2 flex items-center gap-2">
            <Compass className="size-3.5 text-primary" />
            <span className="text-xs font-semibold">Rota Haritası</span>
            <Badge variant="warning" className="ml-1 text-[9px]">
              Phase B · MapLibre
            </Badge>
          </div>
        </GlassPanel>
      </div>

      <div className="absolute top-3 right-3 z-[3] flex items-center gap-1.5">
        <GlassPanel tone="strong" className="rounded-xl">
          <div className="flex items-center">
            <Button variant="ghost" size="icon-sm" aria-label="Katmanlar">
              <Layers className="size-3.5" />
            </Button>
          </div>
        </GlassPanel>
      </div>

      {project?.vesselPlan && (
        <div className="absolute bottom-3 left-3 right-3 z-[3] flex flex-col sm:flex-row gap-2">
          <PortChip
            kind="loading"
            name={project.vesselPlan.loadingPort.name}
            country={project.vesselPlan.loadingPort.country}
            date={project.vesselPlan.milestones.lpEta}
            dateLabel="LP-ETA"
          />
          <div className="flex-1 self-center hidden sm:block">
            <RouteDashedLine />
          </div>
          <PortChip
            kind="discharge"
            name={project.vesselPlan.dischargePort.name}
            country={project.vesselPlan.dischargePort.country}
            date={project.vesselPlan.milestones.dpEta}
            dateLabel="DP-ETA"
          />
        </div>
      )}

      {!project && (
        <div className="absolute inset-0 z-[2] grid place-items-center">
          <div className="text-center text-muted-foreground">
            <Compass className="size-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Bir proje seçin</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PortChip({
  kind,
  name,
  country,
  date,
  dateLabel,
}: {
  kind: "loading" | "discharge";
  name: string;
  country: string;
  date: string | null;
  dateLabel: string;
}) {
  const Icon = kind === "loading" ? Anchor : MapPin;
  const tone = kind === "loading" ? "text-amber-700" : "text-emerald-700";
  const bg = kind === "loading" ? "bg-amber-500/15" : "bg-emerald-500/15";
  return (
    <GlassPanel tone="strong" className="rounded-2xl flex-1 min-w-0">
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div className={`size-9 rounded-xl ${bg} ${tone} grid place-items-center shrink-0`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {kind === "loading" ? "Kalkış Limanı" : "Varış Limanı"}
          </div>
          <div className="text-sm font-semibold truncate">{name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{country}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {dateLabel}
          </div>
          <div className="text-xs font-medium">{formatDate(date)}</div>
        </div>
      </div>
    </GlassPanel>
  );
}

function RouteDashedLine() {
  return (
    <svg viewBox="0 0 200 24" className="w-full h-6" preserveAspectRatio="none">
      <defs>
        <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="oklch(75% 0.13 35)" />
          <stop offset="100%" stopColor="oklch(58% 0.18 245)" />
        </linearGradient>
      </defs>
      <path
        d="M 0 12 Q 100 -8 200 12"
        stroke="url(#routeGrad)"
        strokeWidth="2"
        fill="none"
        strokeDasharray="4 4"
        opacity="0.85"
      />
    </svg>
  );
}

function WorldBackdrop() {
  return (
    <svg
      viewBox="0 0 1000 500"
      className="absolute inset-0 size-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="ocean" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="oklch(94% 0.04 220)" />
          <stop offset="60%" stopColor="oklch(92% 0.05 230)" />
          <stop offset="100%" stopColor="oklch(95% 0.03 215)" />
        </linearGradient>
        <linearGradient id="land" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(96% 0.02 100)" />
          <stop offset="100%" stopColor="oklch(94% 0.03 95)" />
        </linearGradient>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path
            d="M 50 0 L 0 0 0 50"
            fill="none"
            stroke="oklch(80% 0.02 240 / 0.18)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="1000" height="500" fill="url(#ocean)" />
      <rect width="1000" height="500" fill="url(#grid)" />

      {/* Stylized continents — abstract blobs */}
      <g fill="url(#land)" stroke="oklch(78% 0.02 100 / 0.55)" strokeWidth="0.7">
        {/* North America */}
        <path d="M 80 90 Q 60 130 90 200 L 200 240 Q 250 220 240 170 L 220 110 Q 180 70 130 75 Z" />
        {/* South America */}
        <path d="M 240 250 Q 215 320 250 400 Q 280 430 290 380 L 295 290 Z" />
        {/* Europe */}
        <path d="M 470 95 Q 450 130 490 165 L 540 155 Q 555 130 530 105 Z" />
        {/* Africa */}
        <path d="M 480 175 Q 455 240 480 320 Q 530 360 570 320 L 580 230 Q 555 175 510 165 Z" />
        {/* Asia */}
        <path d="M 555 90 Q 540 145 590 175 L 800 200 Q 880 170 870 110 Q 800 50 700 70 Z" />
        {/* Australia */}
        <path d="M 800 320 Q 790 360 830 380 L 890 370 Q 905 340 870 320 Z" />
      </g>

      {/* Equator line — subtle */}
      <line
        x1="0"
        y1="280"
        x2="1000"
        y2="280"
        stroke="oklch(60% 0.05 240 / 0.08)"
        strokeDasharray="2 6"
        strokeWidth="1"
      />
    </svg>
  );
}
