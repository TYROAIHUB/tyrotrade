import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Clock } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Project, VesselMilestones } from "@/lib/dataverse/entities";

interface EventsPanelProps {
  projects: Project[];
  now?: Date;
  /** Days back from `now` for the "Recent" section (default 7). */
  recentWindowDays?: number;
  /** Days forward from `now` for "Upcoming" section (default 30). */
  upcomingWindowDays?: number;
  /** Max items per section (default 5). */
  perSectionLimit?: number;
}

interface EventItem {
  projectNo: string;
  vesselName?: string;
  label: string;
  date: Date;
  kind: "done" | "upcoming";
  /** Stage chip text (Yükleme / Yolda / Varış / Tahliye). */
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

function buildEvents(projects: Project[], now: Date): EventItem[] {
  const events: EventItem[] = [];
  for (const p of projects) {
    const vp = p.vesselPlan;
    if (!vp) continue;
    const ms = vp.milestones;
    for (const def of MILESTONE_DEFS) {
      const iso = ms[def.key];
      if (!iso) continue;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;
      events.push({
        projectNo: p.projectNo,
        vesselName: vp.vesselName,
        label: def.label,
        stage: def.stage,
        date: d,
        kind: d.getTime() <= now.getTime() ? "done" : "upcoming",
      });
    }
  }
  return events;
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

const STAGE_COLORS: Record<string, { bg: string; fg: string }> = {
  Yükleme: { bg: "rgba(245,158,11,0.14)", fg: "rgb(180 83 9)" },
  Yolda: { bg: "rgba(59,130,246,0.14)", fg: "rgb(29 78 216)" },
  Varış: { bg: "rgba(99,102,241,0.14)", fg: "rgb(67 56 202)" },
  Tahliye: { bg: "rgba(16,185,129,0.14)", fg: "rgb(4 120 87)" },
};

/**
 * Recent + upcoming milestone events. Replaces the simpler Activity feed
 * with two clearly-labelled sections — "Son" (within recentWindowDays)
 * and "Yaklaşan" (within upcomingWindowDays). Each row carries the
 * project code, milestone label, vessel name, stage chip, and relative
 * time ("3 gün önce" / "5 gün sonra").
 */
export function EventsPanel({
  projects,
  now = new Date(),
  recentWindowDays = 7,
  upcomingWindowDays = 30,
  perSectionLimit = 5,
}: EventsPanelProps) {
  const navigate = useNavigate();
  const recentCutoff = now.getTime() - recentWindowDays * 24 * 60 * 60 * 1000;
  const upcomingCutoff =
    now.getTime() + upcomingWindowDays * 24 * 60 * 60 * 1000;

  const all = React.useMemo(() => buildEvents(projects, now), [projects, now]);

  const recent = React.useMemo(() => {
    return all
      .filter(
        (e) =>
          e.kind === "done" &&
          e.date.getTime() >= recentCutoff &&
          e.date.getTime() <= now.getTime()
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, perSectionLimit);
  }, [all, recentCutoff, now, perSectionLimit]);

  // Primary: events inside the upcomingWindowDays window
  const upcoming = React.useMemo(() => {
    return all
      .filter(
        (e) =>
          e.kind === "upcoming" &&
          e.date.getTime() > now.getTime() &&
          e.date.getTime() <= upcomingCutoff
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, perSectionLimit);
  }, [all, upcomingCutoff, now, perSectionLimit]);

  // Fallback: when the primary window is empty, surface the next N
  // future milestones regardless of date so the panel never reads
  // "Bu pencerede planlı olay yok" while real future ETAs exist
  // farther out in the calendar.
  const futureFallback = React.useMemo(() => {
    if (upcoming.length > 0) return [];
    return all
      .filter((e) => e.kind === "upcoming" && e.date.getTime() > now.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, perSectionLimit);
  }, [all, upcoming.length, now, perSectionLimit]);

  const isUsingFallback = upcoming.length === 0 && futureFallback.length > 0;
  const upcomingShown = isUsingFallback ? futureFallback : upcoming;

  return (
    <GlassPanel tone="default" className="rounded-2xl h-full flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold">Olaylar</h3>
        <p className="text-[11px] text-muted-foreground">
          Son {recentWindowDays} gün
          {isUsingFallback
            ? " + ileriye dönük ilk milestone'lar"
            : ` + önümüzdeki ${upcomingWindowDays} gün`}
        </p>
      </div>
      <div className="px-4 pb-4 flex-1 min-h-0 overflow-y-auto">
        {/* Recent section */}
        <SectionHeader
          tone="done"
          title={`Son ${recentWindowDays} gün`}
          count={recent.length}
        />
        <ol className="space-y-2 mb-4">
          {recent.length === 0 ? (
            <li className="text-[11px] text-muted-foreground/70 italic py-1">
              Bu pencerede gerçekleşen olay yok
            </li>
          ) : (
            recent.map((e, i) => (
              <EventRow
                key={`r-${i}`}
                event={e}
                now={now}
                onClick={() => navigate(`/projects/${e.projectNo}`)}
              />
            ))
          )}
        </ol>

        {/* Upcoming section — primary 30-day window, with a fallback to
            "next N future milestones" when nothing falls inside the
            window. The dataset trends toward past milestones (most
            voyages are Completed/Closed); the fallback ensures the
            user always sees something actionable. */}
        <SectionHeader
          tone="upcoming"
          title={
            isUsingFallback
              ? "Yaklaşan ilk planlı olaylar"
              : `Önümüzdeki ${upcomingWindowDays} gün`
          }
          count={upcomingShown.length}
        />
        <ol className="space-y-2">
          {upcomingShown.length === 0 ? (
            <li className="text-[11px] text-muted-foreground/70 italic py-1">
              İleriye dönük tarihli milestone yok — gemi planlarında
              DP-ETA / yükleme tarihleri henüz girilmemiş olabilir.
            </li>
          ) : (
            <>
              {isUsingFallback && (
                <li className="text-[10.5px] text-muted-foreground/80 italic py-1 px-1">
                  Önümüzdeki {upcomingWindowDays} gün boş — daha uzaktaki
                  ilk {upcomingShown.length} olay gösteriliyor.
                </li>
              )}
              {upcomingShown.map((e, i) => (
                <EventRow
                  key={`u-${i}`}
                  event={e}
                  now={now}
                  onClick={() => navigate(`/projects/${e.projectNo}`)}
                />
              ))}
            </>
          )}
        </ol>
      </div>
    </GlassPanel>
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
    <div className="flex items-center justify-between gap-2 mb-1.5 mt-1">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 rounded-full",
            tone === "done" ? "bg-emerald-500" : "bg-sky-500"
          )}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      <span className="text-[10.5px] tabular-nums text-muted-foreground/80">
        {count} olay
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
  const stageColors =
    STAGE_COLORS[event.stage] ?? STAGE_COLORS["Yolda"];
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex gap-2.5 text-left hover:bg-foreground/[0.025] rounded-md p-1 -m-1 transition-colors"
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
