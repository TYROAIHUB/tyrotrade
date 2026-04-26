import * as React from "react";
import {
  Map,
  Source,
  Layer,
  Marker,
  AttributionControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Anchor,
  MapPin,
  Ship as ShipIcon,
  Compass,
  Plus,
  Minus,
  Crosshair,
  GitCommitHorizontal,
  X,
  Check,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import lineSliceAlong from "@turf/line-slice-along";
import bearing from "@turf/bearing";
import { point } from "@turf/helpers";
import type { Feature, LineString, Position } from "geojson";

import { GlassPanel } from "@/components/glass/GlassPanel";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_STYLE } from "@/lib/map/style";
import { useRouteGeometry } from "@/hooks/useRouteGeometry";
import { useRouteProgress } from "@/hooks/useRouteProgress";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";
import { useThemeAccent } from "@/components/layout/theme-accent";

interface RouteMapProps {
  project: Project | null;
}

const STAGE_LABEL: Record<string, string> = {
  "pre-loading": "Yüklemeye hazır",
  "at-loading-port": "Yükleme limanında",
  loading: "Yükleme yapılıyor",
  "in-transit": "Yolda",
  "at-discharge-port": "Varış limanında",
  discharged: "Tahliye tamamlandı",
};

/** Stage chip palette — semantic but minimal. Soft tinted bg + colored
 *  text + thin border so it reads as a status hint, not a CTA. Fixed,
 *  NOT theme-aware (voyage state isn't a brand concept). */
const STAGE_TONE: Record<string, { bg: string; text: string; border: string }> = {
  "pre-loading": {
    bg: "rgba(100, 116, 139, 0.10)",
    text: "#475569",
    border: "rgba(100, 116, 139, 0.30)",
  },
  "at-loading-port": {
    bg: "rgba(217, 119, 6, 0.10)",
    text: "#b45309",
    border: "rgba(217, 119, 6, 0.30)",
  },
  loading: {
    bg: "rgba(234, 88, 12, 0.10)",
    text: "#9a3412",
    border: "rgba(234, 88, 12, 0.30)",
  },
  "in-transit": {
    bg: "rgba(2, 132, 199, 0.10)",
    text: "#075985",
    border: "rgba(2, 132, 199, 0.30)",
  },
  "at-discharge-port": {
    bg: "rgba(16, 185, 129, 0.10)",
    text: "#047857",
    border: "rgba(16, 185, 129, 0.30)",
  },
  discharged: {
    bg: "rgba(5, 150, 105, 0.10)",
    text: "#065f46",
    border: "rgba(5, 150, 105, 0.35)",
  },
};
const FALLBACK_STAGE_TONE = STAGE_TONE["in-transit"];

export function RouteMap({ project }: RouteMapProps) {
  const mapRef = React.useRef<MapRef>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const [timelineOpen, setTimelineOpen] = React.useState(false);
  const accent = useThemeAccent();
  const geom = useRouteGeometry(project);
  const { progress, stage } = useRouteProgress(project);

  // Close timeline when project changes
  React.useEffect(() => {
    setTimelineOpen(false);
  }, [project?.projectNo]);

  const fitToRoute = React.useCallback(
    (animate: boolean) => {
      const map = mapRef.current;
      if (!map || !geom) return;
      const [west, south, east, north] = geom.bbox;
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 50, duration: animate ? 900 : 0, maxZoom: 4.5 }
      );
    },
    [geom]
  );

  React.useEffect(() => {
    if (!mapReady) return;
    fitToRoute(true);
  }, [mapReady, fitToRoute]);

  const { completedLine, position, headingDeg } = React.useMemo(() => {
    if (!geom) {
      return { completedLine: null, position: null as Position | null, headingDeg: 0 };
    }
    const { line, totalKm } = geom;
    const km = Math.max(0.001, totalKm * Math.max(0.0001, Math.min(0.9999, progress)));
    const completed: Feature<LineString> | null =
      progress > 0
        ? (lineSliceAlong(line, 0, km, { units: "kilometers" }) as Feature<LineString>)
        : null;
    const position = geom.positionAt(progress);
    let headingDeg = 0;
    if (completed && completed.geometry.coordinates.length >= 2) {
      const coords = completed.geometry.coordinates;
      const last = coords[coords.length - 1];
      const prev = coords[coords.length - 2];
      headingDeg = bearing(point(prev), point(last));
    } else if (line.geometry.coordinates.length >= 2) {
      const coords = line.geometry.coordinates;
      headingDeg = bearing(point(coords[0]), point(coords[1]));
    }
    return { completedLine: completed, position, headingDeg };
  }, [geom, progress]);

  const lp = project?.vesselPlan?.loadingPort;
  const dp = project?.vesselPlan?.dischargePort;
  const ms = project?.vesselPlan?.milestones;

  return (
    <TooltipProvider delayDuration={200} disableHoverableContent>
      <div className="relative h-full rounded-3xl overflow-hidden glass">
        <div className="absolute inset-0 z-[1]">
          {project && geom ? (
            <Map
              ref={mapRef}
              mapStyle={DEFAULT_STYLE}
              initialViewState={{
                longitude: (geom.bbox[0] + geom.bbox[2]) / 2,
                latitude: (geom.bbox[1] + geom.bbox[3]) / 2,
                zoom: 2,
              }}
              attributionControl={false}
              cooperativeGestures={false}
              onLoad={() => setMapReady(true)}
            >
              <Source id="route-full" type="geojson" data={geom.line}>
                <Layer
                  id="route-remaining-glow"
                  type="line"
                  paint={{
                    "line-color": "rgba(80, 95, 130, 0.35)",
                    "line-width": 7,
                    "line-blur": 6,
                  }}
                />
                <Layer
                  id="route-remaining"
                  type="line"
                  paint={{
                    "line-color": "#3f4a64",
                    "line-width": 2.5,
                    "line-dasharray": [1.6, 2],
                    "line-opacity": 0.9,
                  }}
                />
              </Source>

              {completedLine && (
                <Source id="route-completed" type="geojson" data={completedLine}>
                  <Layer
                    id="route-completed-glow"
                    type="line"
                    paint={{
                      "line-color": "rgba(42, 79, 127, 0.45)",
                      "line-width": 9,
                      "line-blur": 6,
                    }}
                  />
                  <Layer
                    id="route-completed-line"
                    type="line"
                    paint={{
                      "line-color": "#2a4f7f",
                      "line-width": 3.2,
                      "line-opacity": 1,
                    }}
                  />
                </Source>
              )}

              {lp && ms && (
                <Marker longitude={lp.lon} latitude={lp.lat} anchor="center">
                  <div title={`${lp.name} · ${lp.country}\nLP-ETA: ${formatDate(ms.lpEta)}`}>
                    <PortPin kind="loading" />
                  </div>
                </Marker>
              )}

              {dp && ms && (
                <Marker longitude={dp.lon} latitude={dp.lat} anchor="center">
                  <div title={`${dp.name} · ${dp.country}\nDP-ETA: ${formatDate(ms.dpEta)}`}>
                    <PortPin kind="discharge" />
                  </div>
                </Marker>
              )}

              {position && progress > 0.02 && progress < 0.98 && project && (
                <Marker
                  longitude={position[0]}
                  latitude={position[1]}
                  anchor="center"
                >
                  <div
                    title={`${project.vesselPlan!.vesselName} · ${
                      STAGE_LABEL[stage] ?? stage
                    } · %${(progress * 100).toFixed(0)}`}
                  >
                    <VesselMarker heading={headingDeg} accent={accent} />
                  </div>
                </Marker>
              )}

              <AttributionControl
                compact
                position="bottom-left"
                style={{ marginLeft: 12, marginBottom: 12 }}
              />
            </Map>
          ) : (
            <EmptyState
              kind={
                !project
                  ? "no-selection"
                  : !project.vesselPlan
                    ? "no-vessel-plan"
                    : "no-route"
              }
              projectNo={project?.projectNo}
            />
          )}
        </div>

        <div className="absolute top-3 left-3 z-[3] pointer-events-none">
          <GlassPanel
            tone="strong"
            className="rounded-xl pointer-events-auto"
            style={{
              boxShadow: `0 6px 18px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.55)`,
            }}
          >
            <div className="px-3 py-2 flex items-center gap-2">
              <Compass
                className="size-3.5"
                style={{ color: accent.solid }}
                strokeWidth={2.5}
              />
              <span className="text-[13px] font-semibold tracking-tight">
                Rota Haritası
              </span>
              {project &&
                (() => {
                  const stageTone = STAGE_TONE[stage] ?? FALLBACK_STAGE_TONE;
                  return (
                    <span
                      className="ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tight"
                      style={{
                        backgroundColor: stageTone.bg,
                        color: stageTone.text,
                        boxShadow: `inset 0 0 0 1px ${stageTone.border}`,
                      }}
                    >
                      {STAGE_LABEL[stage] ?? stage} · %
                      {(progress * 100).toFixed(0)}
                    </span>
                  );
                })()}
              <DurationPills project={project} />
            </div>
          </GlassPanel>
        </div>

        {project && (
          <div className="absolute top-3 right-3 z-[3] flex flex-col gap-2 pointer-events-none">
            <GlassPanel tone="strong" className="rounded-xl pointer-events-auto">
              <div className="flex flex-col p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
                      aria-label="Yakınlaştır"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Yakınlaştır</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
                      aria-label="Uzaklaştır"
                    >
                      <Minus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Uzaklaştır</TooltipContent>
                </Tooltip>
                <div className="h-px bg-border my-0.5" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => fitToRoute(true)}
                      aria-label="Rotaya odakla"
                    >
                      <Crosshair className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Rotaya odakla</TooltipContent>
                </Tooltip>
              </div>
            </GlassPanel>
          </div>
        )}

        {project?.vesselPlan && (
          <div className="absolute bottom-3 left-3 right-3 z-[3] flex flex-col gap-2 pointer-events-none">
            {timelineOpen && (
              <MilestoneStrip
                ms={project.vesselPlan.milestones}
                progress={progress}
                onClose={() => setTimelineOpen(false)}
              />
            )}
            <div className="flex items-stretch gap-2">
              <PortChip
                kind="loading"
                name={project.vesselPlan.loadingPort.name}
                country={project.vesselPlan.loadingPort.country}
                date={project.vesselPlan.milestones.lpEta}
                dateLabel="LP-ETA"
              />
              <button
                type="button"
                onClick={() => setTimelineOpen((v) => !v)}
                aria-label={
                  timelineOpen ? "Milestone zaman çizgisini kapat" : "Milestone zaman çizgisini aç"
                }
                className={cn(
                  "pointer-events-auto shrink-0 self-center size-11 rounded-full grid place-items-center transition-all",
                  "text-white shadow-lg ring-2 ring-white/80 backdrop-blur-sm",
                  "hover:scale-110 active:scale-95"
                )}
                style={{
                  background: accent.gradient,
                  boxShadow: timelineOpen
                    ? `0 0 0 4px ${accent.ring}, 0 8px 20px -6px ${accent.ring}`
                    : `0 8px 20px -6px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.2)`,
                }}
              >
                {timelineOpen ? (
                  <X className="size-4" />
                ) : (
                  <GitCommitHorizontal className="size-4" />
                )}
              </button>
              <PortChip
                kind="discharge"
                name={project.vesselPlan.dischargePort.name}
                country={project.vesselPlan.dischargePort.country}
                date={project.vesselPlan.milestones.dpEta}
                dateLabel="DP-ETA"
              />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/* ─────────── Duration pills (Transit + Operasyon) ─────────── */

/** Days between two ISO date strings (start → end). Negative or non-finite
 *  spans collapse to 0 so the pill never shows a misleading "-3g". */
function diffDays(startIso: string, endIso: string): number | null {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end < start) return null;
  return Math.round((end - start) / 86_400_000);
}

/** Transit Süre — `lpEd` (loading end) → `dpNorAccepted` (DP NOR
 *  accepted). Both endpoints required; returns null otherwise so the
 *  pill is hidden. */
function transitDays(p: Project): number | null {
  const ms = p.vesselPlan?.milestones;
  if (!ms?.lpEd || !ms.dpNorAccepted) return null;
  return diffDays(ms.lpEd, ms.dpNorAccepted);
}

/** Operasyon Süresi — earliest known LP milestone → DP NOR accepted.
 *  When the voyage is Completed / Closed and DP NOR is missing, fall
 *  back to the latest available DP date (dpEd > dpSd > dpEta) so closed
 *  projects still display a duration. */
function operationDays(p: Project): number | null {
  const ms = p.vesselPlan?.milestones;
  if (!ms) return null;
  const start = ms.lpEta ?? ms.lpNorAccepted ?? ms.lpSd ?? ms.lpEd;
  if (!start) return null;

  let end = ms.dpNorAccepted;
  if (!end) {
    const status = p.vesselPlan?.vesselStatus;
    const isTerminal =
      status === "Completed" ||
      status === "Closed" ||
      p.status === "Kapalı" ||
      p.status === "Closed";
    if (isTerminal) {
      end = ms.dpEd ?? ms.dpSd ?? ms.dpEta ?? null;
    }
  }
  if (!end) return null;
  return diffDays(start, end);
}

/** Two compact day-count pills shown next to the stage chip in the map
 *  header. Either pill renders only when both endpoints are known. */
function DurationPills({ project }: { project: Project }) {
  const transit = transitDays(project);
  const operation = operationDays(project);
  if (transit == null && operation == null) return null;
  return (
    <>
      {transit != null && (
        <span
          className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tight bg-foreground/[0.05] text-foreground/85"
          title={`Transit Süre: ${transit} gün (Yükleme bitişi → DP NOR Kabul)`}
        >
          <Clock className="size-2.5" strokeWidth={2.5} />
          <span className="uppercase tracking-wider text-muted-foreground">
            Transit
          </span>
          <span aria-hidden className="text-foreground/40">
            ·
          </span>
          <span className="font-semibold tabular-nums">{transit}g</span>
        </span>
      )}
      {operation != null && (
        <span
          className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tight bg-foreground/[0.05] text-foreground/85"
          title={`Operasyon Süresi: ${operation} gün (Toplam operasyon süresi)`}
        >
          <Clock className="size-2.5" strokeWidth={2.5} />
          <span className="uppercase tracking-wider text-muted-foreground">
            Operasyon
          </span>
          <span aria-hidden className="text-foreground/40">
            ·
          </span>
          <span className="font-semibold tabular-nums">{operation}g</span>
        </span>
      )}
    </>
  );
}

function EmptyState({
  kind,
  projectNo,
}: {
  kind: "no-selection" | "no-vessel-plan" | "no-route";
  projectNo?: string;
}) {
  const message =
    kind === "no-selection"
      ? "Bir proje seçin"
      : kind === "no-vessel-plan"
        ? "Bu projede gemi planı yok"
        : "Rota verisi eksik";
  const sublabel =
    kind === "no-vessel-plan"
      ? "Dataverse'de bu proje için bir Gemi Planı kaydı bulunamadı"
      : kind === "no-route"
        ? "Liman koordinatları eksik — port dictionary'e eklenmesi gerekebilir"
        : null;
  return (
    <div className="h-full grid place-items-center text-muted-foreground">
      <div className="text-center px-6 max-w-sm">
        <Compass className="size-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">{message}</p>
        {sublabel && (
          <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-relaxed">
            {sublabel}
          </p>
        )}
        {projectNo && (
          <p className="text-[10px] font-mono text-muted-foreground/60 mt-2">
            {projectNo}
          </p>
        )}
      </div>
    </div>
  );
}

function PortPin({ kind }: { kind: "loading" | "discharge" }) {
  const Icon = kind === "loading" ? Anchor : MapPin;
  const colorClass =
    kind === "loading"
      ? "bg-amber-500 border-amber-300"
      : "bg-emerald-500 border-emerald-300";
  return (
    <div className="relative">
      <span
        className={`absolute inset-0 -m-2 rounded-full ${
          kind === "loading" ? "bg-amber-500/25" : "bg-emerald-500/25"
        } animate-ping`}
        aria-hidden
      />
      <div
        className={`relative size-7 rounded-full ${colorClass} grid place-items-center text-white border-2 shadow-md`}
      >
        <Icon className="size-3.5" />
      </div>
    </div>
  );
}

function VesselMarker({
  heading,
  accent,
}: {
  heading: number;
  accent: ReturnType<typeof useThemeAccent>;
}) {
  return (
    <div className="relative" style={{ transform: "translate(-50%, -50%)" }}>
      {/* Pulsing halo — uses the live sidebar accent ring for the glow. */}
      <span
        className="absolute inset-0 -m-3 rounded-full blur-md animate-pulse"
        style={{ backgroundColor: accent.ring }}
      />
      <div
        className="relative size-9 rounded-full grid place-items-center text-white shadow-lg"
        style={{
          background: accent.gradient,
          boxShadow: `0 0 0 2px ${accent.ringStrong}, 0 6px 14px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.18)`,
          transform: `rotate(${heading}deg)`,
        }}
      >
        <ShipIcon
          className="size-4"
          style={{ transform: `rotate(${-heading}deg)` }}
        />
      </div>
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
    <GlassPanel tone="strong" className="rounded-2xl flex-1 min-w-0 pointer-events-auto">
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

interface MilestoneStripProps {
  ms: Project["vesselPlan"] extends infer V
    ? V extends { milestones: infer M }
      ? M
      : never
    : never;
  progress: number;
  onClose: () => void;
}

function MilestoneStrip({ ms, progress, onClose }: MilestoneStripProps) {
  // Production-aligned 9-step voyage timeline. Order matches the D365
  // F&O screen (LP loading → BL → DP discharge) so the chip strip reads
  // the same as the source system.
  const steps: Array<{ key: string; label: string; date: string | null }> = [
    { key: "lpEta", label: "LP-ETA", date: ms.lpEta },
    { key: "lpNor", label: "LP-NOR", date: ms.lpNorAccepted },
    { key: "lpSd", label: "LP-SD", date: ms.lpSd },
    { key: "lpEd", label: "LP-ED", date: ms.lpEd },
    { key: "bl", label: "BL", date: ms.blDate },
    { key: "dpEta", label: "DP-ETA", date: ms.dpEta },
    { key: "dpNor", label: "DP-NOR", date: ms.dpNorAccepted },
    { key: "dpSd", label: "DP-SD", date: ms.dpSd },
    { key: "dpEd", label: "DP-ED", date: ms.dpEd },
  ];
  const completedCount = steps.filter((s) => s.date).length;
  const pct = Math.round(progress * 100);

  return (
    <GlassPanel
      tone="strong"
      className="rounded-2xl pointer-events-auto animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
    >
      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Zaman Çizelgesi
            </span>
            <span className="text-[10px] font-semibold text-foreground/80 tabular-nums">
              {completedCount} / {steps.length}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] font-semibold text-emerald-700 tabular-nums">
              %{pct} yol alındı
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex items-stretch gap-1">
          {steps.map((s, i) => {
            const done = !!s.date;
            const nextDone = i < steps.length - 1 && !!steps[i + 1].date;
            const isCurrent = done && !nextDone;
            return (
              <div
                key={s.key}
                className="flex-1 min-w-0 flex flex-col items-center gap-1.5"
              >
                <div className="relative w-full flex items-center">
                  <div
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      done
                        ? isCurrent
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                          : "bg-emerald-500"
                        : "bg-muted"
                    )}
                  />
                  <div
                    className={cn(
                      "ml-1 size-4 shrink-0 rounded-full grid place-items-center transition-colors",
                      done
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground/60 border border-border"
                    )}
                  >
                    {done ? (
                      <Check className="size-2.5" strokeWidth={3} />
                    ) : (
                      <Clock className="size-2.5" strokeWidth={2.5} />
                    )}
                  </div>
                </div>
                <div className="text-center min-w-0 w-full">
                  <div
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-wider truncate",
                      done ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </div>
                  <div
                    className={cn(
                      "text-[9px] tabular-nums truncate",
                      done ? "text-muted-foreground" : "text-muted-foreground/60"
                    )}
                  >
                    {s.date ? formatDate(s.date) : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );
}
