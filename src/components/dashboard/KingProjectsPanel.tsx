import * as React from "react";
import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { CrownIcon } from "@hugeicons/core-free-icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCompactCurrency } from "@/lib/format";
import {
  filterByPeriod,
  PERIODS,
  DEFAULT_PERIOD,
  type PeriodKey,
} from "@/lib/dashboard/periods";
import type { Project } from "@/lib/dataverse/entities";

const TOP_N = 10;

interface KingProjectsPanelProps {
  projects: Project[];
}

interface ChartRow {
  projectNo: string;
  label: string;
  fullLabel: string;
  value: number;
  currency: string;
  vesselName: string;
  group: string;
}

const chartConfig: ChartConfig = {
  value: {
    label: "Faturalı Satış",
    color: "#fbbf24",
  },
};

/**
 * Realised sales total used for KingProjects ranking. Returns the per-project
 * invoiced total (`salesActualUsd`) only — populated by the bulk Güncelle's
 * "Satış Toplamları" aggregation step. NO fallback to plan values; projects
 * without invoiced sales contribute 0 and are filtered out of the leaderboard
 * downstream so plan-only "kings" don't dilute the realised-sales ranking.
 */
function projectValue(p: Project): number {
  return p.salesActualUsd ?? 0;
}

/** Rank-based color: top of the leaderboard gets the deep brand navy, the
 *  bottom of the top-10 fades into light sky. Maps "success" to color. */
const RANK_COLORS = [
  "#1e3a8a", // 1 — navy-900 (en başarılı)
  "#1e40af", // 2
  "#2563eb", // 3
  "#3b82f6", // 4
  "#60a5fa", // 5
  "#7dd3fc", // 6
  "#93c5fd", // 7
  "#bae6fd", // 8
  "#cffafe", // 9
  "#e0f2fe", // 10
];
function rankColor(idx: number): string {
  return RANK_COLORS[Math.min(idx, RANK_COLORS.length - 1)] ?? "#cbd5e1";
}

/** Bar shape that draws thin vertical stripes inside the bar's bounding box,
 *  inheriting the per-cell fill color so each bar's tone reflects its rank. */
function StripedBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = "#fbbf24" } = props;
  if (width <= 0 || height <= 0) return null;
  const stripeW = 4;
  const gap = 3;
  const step = stripeW + gap;
  const count = Math.max(1, Math.floor(width / step));
  const used = count * step - gap;
  const offset = Math.max(0, (width - used) / 2);
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => (
        <rect
          key={i}
          x={x + offset + i * step}
          y={y}
          width={stripeW}
          height={height}
          rx={1.5}
          fill={fill}
        />
      ))}
    </g>
  );
}

/** Left-aligned Y-axis tick — code on top line, project name below.
 *  Name wraps up to 2 lines with ellipsis if longer. Foreign-object
 *  is used so HTML clipping rules apply cleanly inside SVG. */
function LeftAlignedTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) {
  const { x = 0, y = 0, payload } = props;
  const value = String(payload?.value ?? "");
  const sepIdx = value.indexOf("␟");
  const code = sepIdx > 0 ? value.slice(0, sepIdx) : value;
  const name = sepIdx > 0 ? value.slice(sepIdx + 1) : "";
  const safeLeft = 4;
  const safeRight = 12;
  const foX = safeLeft;
  const foWidth = Math.max(0, x - safeLeft - safeRight);
  const blockHeight = 48;
  return (
    <foreignObject
      x={foX}
      y={y - blockHeight / 2}
      width={foWidth}
      height={blockHeight}
      style={{ overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          gap: 2,
          overflow: "hidden",
          color: "var(--foreground)",
        }}
      >
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.02em",
            opacity: 0.6,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          {code}
        </span>
        {name && (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              lineHeight: 1.25,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {name}
          </span>
        )}
      </div>
    </foreignObject>
  );
}

export function KingProjectsPanel({ projects }: KingProjectsPanelProps) {
  const [period, setPeriod] = React.useState<PeriodKey>(DEFAULT_PERIOD);
  const navigate = useNavigate();

  const data: ChartRow[] = React.useMemo(() => {
    const filtered = filterByPeriod(projects, period);
    return filtered
      .map((p) => ({
        projectNo: p.projectNo,
        label: `${p.projectNo}␟${p.projectName}`,
        fullLabel: `${p.projectNo}  ${p.projectName}`,
        value: projectValue(p),
        currency: p.currency,
        vesselName: p.vesselPlan?.vesselName ?? "",
        group: p.projectGroup,
      }))
      // Drop projects with no invoiced sales — leaderboard is realised-sales
      // only, not plan/forecast.
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N);
  }, [projects, period]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <HugeiconsIcon
              icon={CrownIcon}
              size={20}
              strokeWidth={1.75}
              className="shrink-0"
              style={{ color: "#e0ad3e" }}
            />
            Kral Projeler
          </CardTitle>
        </div>
        <Tabs
          value={period}
          onValueChange={(v) => setPeriod(v as PeriodKey)}
          className="shrink-0"
        >
          <TabsList className="h-8">
            {PERIODS.map((p) => (
              <TabsTrigger
                key={p.key}
                value={p.key}
                className="text-[11px] px-2.5 py-1 h-6"
              >
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Bu dönemde proje bulunamadı.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto w-full"
            style={{ height: Math.max(420, data.length * 60) }}
          >
            <BarChart
              accessibilityLayer
              data={data}
              layout="vertical"
              margin={{ left: 8, right: 80, top: 4, bottom: 4 }}
              barCategoryGap="35%"
              onClick={(state) => {
                const s = state as unknown as {
                  activePayload?: Array<{ payload?: ChartRow }>;
                };
                const payload = s.activePayload?.[0]?.payload;
                if (payload?.projectNo) {
                  navigate(`/projects/${payload.projectNo}`);
                }
              }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(v) => formatCompactCurrency(v, "USD")}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                width={300}
                interval={0}
                tick={<LeftAlignedTick />}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    nameKey="value"
                    labelFormatter={(_label, payload) => {
                      const row = payload?.[0]?.payload as ChartRow | undefined;
                      if (!row) return "";
                      return row.fullLabel;
                    }}
                    formatter={(value, _name, item) => {
                      const row = item?.payload as ChartRow | undefined;
                      return [
                        formatCompactCurrency(
                          Number(value),
                          row?.currency ?? "USD"
                        ),
                        `${row?.projectNo ?? ""} · ${row?.group ?? ""}`,
                      ];
                    }}
                  />
                }
              />
              <Bar
                dataKey="value"
                shape={<StripedBar />}
                cursor="pointer"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={rankColor(i)} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  className="fill-foreground"
                  formatter={(v) =>
                    typeof v === "number"
                      ? formatCompactCurrency(v, "USD")
                      : String(v ?? "")
                  }
                  style={{ fontSize: 10, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
