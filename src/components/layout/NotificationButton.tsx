import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Clock, Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { useProjects } from "@/hooks/useProjects";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Project, VesselMilestones } from "@/lib/dataverse/entities";

const RECENT_DAYS = 7;
const UPCOMING_DAYS = 14;

interface EventItem {
  projectNo: string;
  vesselName?: string;
  label: string;
  date: Date;
  kind: "done" | "upcoming";
  stage: string;
}

const MILESTONE_DEFS: Array<{
  key: keyof VesselMilestones;
  label: string;
  stage: string;
}> = [
  { key: "lpEta", label: "Yükleme limanına varış (LP-ETA)", stage: "Yükleme" },
  { key: "lpNorAccepted", label: "LP-NOR Kabul", stage: "Yükleme" },
  { key: "lpSd", label: "Yükleme başladı", stage: "Yükleme" },
  { key: "lpEd", label: "Yükleme tamamlandı", stage: "Yükleme" },
  { key: "blDate", label: "Bill of Lading düzenlendi", stage: "Yolda" },
  { key: "dpEta", label: "Varış limanına ulaşma (DP-ETA)", stage: "Varış" },
  { key: "dpNorAccepted", label: "DP-NOR Kabul", stage: "Varış" },
  { key: "dpSd", label: "Tahliye başladı (DP-SD)", stage: "Tahliye" },
  { key: "dpEd", label: "Tahliye tamamlandı (DP-ED)", stage: "Tahliye" },
];

const STAGE_COLORS: Record<string, { bg: string; fg: string }> = {
  Yükleme: { bg: "rgba(245,158,11,0.14)", fg: "rgb(180 83 9)" },
  Yolda: { bg: "rgba(59,130,246,0.14)", fg: "rgb(29 78 216)" },
  Varış: { bg: "rgba(99,102,241,0.14)", fg: "rgb(67 56 202)" },
  Tahliye: { bg: "rgba(16,185,129,0.14)", fg: "rgb(4 120 87)" },
};

function buildEvents(projects: Project[], now: Date): EventItem[] {
  const out: EventItem[] = [];
  for (const p of projects) {
    const vp = p.vesselPlan;
    if (!vp) continue;
    const ms = vp.milestones;
    for (const def of MILESTONE_DEFS) {
      const iso = ms[def.key];
      if (!iso) continue;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;
      out.push({
        projectNo: p.projectNo,
        vesselName: vp.vesselName,
        label: def.label,
        stage: def.stage,
        date: d,
        kind: d.getTime() <= now.getTime() ? "done" : "upcoming",
      });
    }
  }
  return out;
}

function relativeTime(date: Date, now: Date): string {
  const ms = date.getTime() - now.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "bugün";
  if (days === 1) return "yarın";
  if (days === -1) return "dün";
  if (days > 0) return `${days} gün sonra`;
  return `${Math.abs(days)} gün önce`;
}

/**
 * Premium notification button + popover for the topbar.
 *
 * Pulls events the same way `EventsPanel` does (last RECENT_DAYS + next
 * UPCOMING_DAYS) but renders them in a compact 360-px popover with
 * scrollable lists and stage chips. The bell carries a live badge that
 * counts the upcoming events and gently pulses when there are any
 * within the next 24 h.
 */
export function NotificationButton() {
  const accent = useThemeAccent();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const { projects } = useProjects();
  const now = React.useMemo(() => new Date(), []);

  const recentCutoff = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const upcomingCutoff = now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000;

  const all = React.useMemo(() => buildEvents(projects, now), [projects, now]);

  const recent = React.useMemo(
    () =>
      all
        .filter(
          (e) =>
            e.kind === "done" &&
            e.date.getTime() >= recentCutoff &&
            e.date.getTime() <= now.getTime()
        )
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 8),
    [all, recentCutoff, now]
  );

  const upcoming = React.useMemo(
    () =>
      all
        .filter(
          (e) =>
            e.kind === "upcoming" &&
            e.date.getTime() > now.getTime() &&
            e.date.getTime() <= upcomingCutoff
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 8),
    [all, upcomingCutoff, now]
  );

  const totalNew = recent.length + upcoming.length;
  // "Imminent" = anything happening in the next 24h. Triggers the pulse.
  const imminent = upcoming.some(
    (e) => e.date.getTime() - now.getTime() <= 24 * 60 * 60 * 1000
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Bildirimler"
          className="text-muted-foreground relative"
        >
          <Bell />
          {totalNew > 0 && (
            <>
              <span
                className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full grid place-items-center text-[9px] font-bold tabular-nums shadow-sm"
                style={{
                  background: accent.gradient,
                  color: "white",
                  boxShadow: `0 2px 6px -1px ${accent.ring}`,
                }}
              >
                {totalNew}
              </span>
              {imminent && (
                <span
                  aria-hidden
                  className="absolute top-1 right-1 size-[16px] rounded-full animate-ping pointer-events-none"
                  style={{
                    background: accent.solid,
                    opacity: 0.45,
                  }}
                />
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className={cn(
          "w-[min(22rem,calc(100vw-1rem))] p-0 overflow-hidden flex flex-col",
          "max-h-[min(calc(100vh-120px),580px)]",
          "bg-white/95 backdrop-blur-2xl backdrop-saturate-150",
          "ring-1 ring-white/55",
          "shadow-[0_28px_72px_-16px_rgba(15,23,42,0.45)]"
        )}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3 shrink-0 border-b border-border/40">
          <span
            className="size-9 rounded-xl grid place-items-center shrink-0 text-white shadow-sm"
            style={{
              background: accent.gradient,
              boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <Bell className="size-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold tracking-tight leading-tight">
              Bildirimler
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Son {RECENT_DAYS} gün · Önümüzdeki {UPCOMING_DAYS} gün
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 py-3">
            {/* Upcoming first — actionable */}
            <SectionHeader
              tone="upcoming"
              title="Yaklaşan"
              count={upcoming.length}
            />
            <ol className="space-y-1.5 mb-3">
              {upcoming.length === 0 ? (
                <li className="text-[11px] text-muted-foreground/70 italic px-2 py-1">
                  Bu pencerede planlı olay yok
                </li>
              ) : (
                upcoming.map((e, i) => (
                  <EventRow
                    key={`u-${i}`}
                    event={e}
                    now={now}
                    onClick={() => {
                      navigate(`/projects/${e.projectNo}`);
                      setOpen(false);
                    }}
                  />
                ))
              )}
            </ol>

            <SectionHeader
              tone="done"
              title="Son Olaylar"
              count={recent.length}
            />
            <ol className="space-y-1.5">
              {recent.length === 0 ? (
                <li className="text-[11px] text-muted-foreground/70 italic px-2 py-1">
                  Bu pencerede gerçekleşen olay yok
                </li>
              ) : (
                recent.map((e, i) => (
                  <EventRow
                    key={`r-${i}`}
                    event={e}
                    now={now}
                    onClick={() => {
                      navigate(`/projects/${e.projectNo}`);
                      setOpen(false);
                    }}
                  />
                ))
              )}
            </ol>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function SectionHeader({
  tone,
  title,
  count,
}: {
  tone: "done" | "upcoming";
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5 mt-1 px-2">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 rounded-full",
            tone === "done" ? "bg-emerald-500" : "bg-sky-500"
          )}
        />
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground/80">
        {count}
      </span>
    </div>
  );
}

function EventRow({
  event,
  now,
  onClick,
}: {
  event: EventItem;
  now: Date;
  onClick: () => void;
}) {
  const stageColors = STAGE_COLORS[event.stage] ?? STAGE_COLORS["Yolda"];
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex gap-2.5 text-left hover:bg-foreground/[0.04] rounded-lg p-2 transition-colors"
      >
        <div className="shrink-0 mt-0.5">
          {event.kind === "done" ? (
            <span className="size-6 rounded-full bg-emerald-500/15 text-emerald-700 grid place-items-center">
              <CircleCheck className="size-3.5" />
            </span>
          ) : (
            <span className="size-6 rounded-full bg-sky-500/15 text-sky-700 grid place-items-center">
              <Clock className="size-3.5" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span
              className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold tracking-tight shrink-0"
              style={{
                backgroundColor: stageColors.bg,
                color: stageColors.fg,
              }}
            >
              {event.stage}
            </span>
            <span
              className={cn(
                "text-xs leading-snug truncate",
                event.kind === "done" ? "text-foreground" : "text-foreground/85"
              )}
            >
              {event.label}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
            <span className="font-mono">{event.projectNo}</span>
            {event.vesselName && (
              <>
                {" · "}
                <span>{event.vesselName}</span>
              </>
            )}
            {" · "}
            <span className="tabular-nums">
              {formatDate(event.date.toISOString())}
            </span>
            <span className="text-muted-foreground/70">
              {" "}
              · {relativeTime(event.date, now)}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}
