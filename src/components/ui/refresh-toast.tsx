import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CancelCircleIcon,
  HourglassIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/**
 * Premium "branded" toast bodies for the Dataverse refresh flow.
 *
 * Design language:
 * - Frosted-white surface, rounded-2xl, layered shadow.
 * - Thin gradient strip on the left edge (3px) carries the emerald
 *   accent without flooding the toast — "kararında yeşil".
 * - Icon pill (size-10) on the left:
 *     loading → tinted emerald + hourglass + orbiting dot
 *     success → emerald gradient + white check
 *     error   → rose gradient + white X
 * - Right text column: bold slate-900 title + smaller slate-600 detail.
 *
 * Used via `toast.custom(...)` from RefreshAllButton + DataverseLoginAutoRefresh.
 */

const SHELL =
  "relative flex items-center gap-3 min-w-[320px] max-w-[420px] " +
  "px-3.5 py-3 rounded-2xl overflow-hidden " +
  "bg-white/97 backdrop-blur-xl backdrop-saturate-150 " +
  "border border-foreground/[0.06] " +
  "shadow-[0_18px_44px_-14px_rgba(15,23,42,0.32)]";

/* ─────────── Loading ─────────── */

interface RefreshLoadingToastProps {
  /** "Projeler" / "Gemi Planı" / etc — current step label */
  stepLabel?: string;
  /** 1-based current step index */
  current?: number;
  /** Total number of steps */
  total?: number;
}

/**
 * Hourglass center + orbiting emerald dot. Two counter-rotating
 * orbits give the "yörünge" feel without spinning the icon itself.
 */
export function RefreshLoadingToast({
  stepLabel,
  current,
  total,
}: RefreshLoadingToastProps) {
  return (
    <div className={SHELL}>
      {/* Left accent strip */}
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-1 rounded-r-full"
        style={{
          background: "linear-gradient(180deg, #34d399 0%, #10b981 100%)",
        }}
      />

      {/* Icon pill with orbital animation */}
      <div className="relative size-10 shrink-0 ml-1">
        {/* Hourglass core — emerald-100 fill, emerald-700 stroke */}
        <span
          className="absolute inset-0 rounded-xl grid place-items-center"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, #d1fae5 0%, #ecfdf5 70%)",
            boxShadow:
              "inset 0 0 0 1px rgba(16,185,129,0.22), 0 2px 6px -2px rgba(16,185,129,0.20)",
          }}
        >
          <motion.div
            animate={{ rotate: [0, 180, 360] }}
            transition={{
              duration: 2,
              ease: "easeInOut",
              repeat: Infinity,
              times: [0, 0.45, 1],
            }}
            className="text-emerald-700"
          >
            <HugeiconsIcon icon={HourglassIcon} size={16} strokeWidth={2} />
          </motion.div>
        </span>

        {/* Orbit 1 — clockwise, single dot at 12 o'clock */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        >
          <span
            className="absolute left-1/2 -top-0.5 -translate-x-1/2 size-1.5 rounded-full"
            style={{
              background: "#10b981",
              boxShadow: "0 0 6px rgba(16,185,129,0.6)",
            }}
          />
        </motion.div>

        {/* Orbit 2 — counter-clockwise, smaller dot at 6 o'clock */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          animate={{ rotate: -360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        >
          <span
            className="absolute left-1/2 -bottom-0.5 -translate-x-1/2 size-1 rounded-full"
            style={{
              background: "#34d399",
              opacity: 0.85,
            }}
          />
        </motion.div>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold tracking-tight text-slate-900 leading-tight">
          Proje verileri güncelleniyor
        </div>
        <div className="text-[11px] text-slate-500 leading-tight mt-1 truncate">
          {stepLabel ? (
            <>
              <span className="text-slate-700 font-medium">{stepLabel}</span>
              {typeof current === "number" && typeof total === "number" && (
                <>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="tabular-nums">
                    {current}/{total}
                  </span>
                </>
              )}
            </>
          ) : (
            "Bağlantı kuruluyor…"
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Success ─────────── */

interface RefreshSuccessToastProps {
  projectCount?: number;
  durationSec?: number;
  stepCount?: number;
}

export function RefreshSuccessToast({
  projectCount,
  durationSec,
  stepCount,
}: RefreshSuccessToastProps) {
  return (
    <div className={SHELL}>
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-1 rounded-r-full"
        style={{
          background: "linear-gradient(180deg, #34d399 0%, #059669 100%)",
        }}
      />

      <span
        className="size-10 shrink-0 ml-1 rounded-xl grid place-items-center text-white"
        style={{
          background:
            "linear-gradient(135deg, #34d399 0%, #10b981 55%, #047857 100%)",
          boxShadow:
            "0 4px 12px -2px rgba(5,150,105,0.45), inset 0 1px 0 0 rgba(255,255,255,0.30)",
        }}
      >
        <HugeiconsIcon icon={Tick02Icon} size={18} strokeWidth={2.25} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold tracking-tight text-slate-900 leading-tight">
          Veriler başarıyla güncellendi
        </div>
        <div className="text-[11px] leading-tight mt-1 text-slate-600">
          {typeof projectCount === "number" && projectCount > 0 ? (
            <>
              <span className="font-bold tabular-nums text-emerald-700">
                {projectCount}
              </span>
              <span className="text-slate-500"> proje senkronlandı</span>
            </>
          ) : (
            <span className="text-slate-500">Senkronizasyon tamamlandı</span>
          )}
          {typeof durationSec === "number" && (
            <>
              <span className="text-slate-300 mx-1.5">·</span>
              <span className="tabular-nums">
                {durationSec.toFixed(1)} sn
              </span>
            </>
          )}
          {typeof stepCount === "number" && (
            <>
              <span className="text-slate-300 mx-1.5">·</span>
              <span className="tabular-nums">{stepCount} adım</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Error ─────────── */

interface RefreshErrorToastProps {
  stepLabel?: string;
  message?: string;
}

export function RefreshErrorToast({
  stepLabel,
  message,
}: RefreshErrorToastProps) {
  return (
    <div className={cn(SHELL, "bg-white/97")}>
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-1 rounded-r-full"
        style={{
          background: "linear-gradient(180deg, #fb7185 0%, #e11d48 100%)",
        }}
      />

      <span
        className="size-10 shrink-0 ml-1 rounded-xl grid place-items-center text-white"
        style={{
          background:
            "linear-gradient(135deg, #fb7185 0%, #f43f5e 55%, #be123c 100%)",
          boxShadow:
            "0 4px 12px -2px rgba(225,29,72,0.40), inset 0 1px 0 0 rgba(255,255,255,0.30)",
        }}
      >
        <HugeiconsIcon icon={CancelCircleIcon} size={18} strokeWidth={2.25} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold tracking-tight text-slate-900 leading-tight">
          Veri güncelleme başarısız
        </div>
        <div className="text-[11px] leading-tight mt-1 text-slate-600">
          {stepLabel && (
            <>
              <span className="font-medium text-rose-700">{stepLabel}</span>
              <span className="text-slate-400"> adımında</span>
            </>
          )}
          {message && (
            <>
              {stepLabel && <span className="text-slate-300 mx-1">·</span>}
              <span className="text-slate-500">
                {message.slice(0, 120)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
