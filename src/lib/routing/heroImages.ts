/**
 * Voyage-status-aware hero images for the Project detail card.
 *
 * Each URL was verified directly from Pexels search results — actual cargo
 * ships / tankers at the right phase of voyage (no yachts, sailboats, or
 * scenic landscapes that earlier guesses had served up).
 *
 *   pending      → vessel moored / docked, no active loading
 *   loading      → crane lifting containers onto vessel
 *   in-transit   → cargo ship under way in open sea
 *   completed    → discharged at port, voyage finished
 */

import type { Project } from "@/lib/dataverse/entities";
import { isSea } from "@/lib/dataverse/entities";
import { selectStage } from "@/lib/selectors/project";

const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200&fit=crop`;

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

/** Pending — container ships moored at Hamburg terminal under clear sky. */
export const HERO_PENDING = pexels(31637365);

/** Loading — crane lifts containers onto a cargo vessel at port. */
export const HERO_LOADING = pexels(28438329);

/** In-transit — large container ship crossing open sea (verified cargo, not a yacht). */
export const HERO_IN_TRANSIT = pexels(35982637);

/** Completed — drone view of vessel with cargo containers near pier (discharge). */
export const HERO_COMPLETED = pexels(6572431);

/** Road / truck fallback for non-Gemi projects. */
export const HERO_ROAD = unsplash("1532330393533-443990a51d10");

/**
 * Pick the hero image URL for a project based on its current voyage
 * stage. Honours an explicit override (`vesselPlan.heroImageUrl`) when
 * the composer happens to set one (mock data does; real data won't).
 */
export function selectHeroImage(
  project: Project,
  now: Date = new Date()
): string {
  const explicit = project.vesselPlan?.heroImageUrl;
  if (explicit) return explicit;

  if (!isSea(project)) return HERO_ROAD;

  // Stage from milestones + vesselStatus. Falls back to vesselStatus alone
  // when no milestones are populated yet.
  const stage = selectStage(project, now);
  if (stage) {
    if (stage === "discharged") return HERO_COMPLETED;
    if (stage === "in-transit" || stage === "at-discharge-port") {
      return HERO_IN_TRANSIT;
    }
    if (stage === "loading" || stage === "at-loading-port") {
      return HERO_LOADING;
    }
    // pre-loading falls through to status-based pick
  }

  const vs = project.vesselPlan?.vesselStatus;
  if (vs === "Completed") return HERO_COMPLETED;
  if (vs === "Commenced") return HERO_IN_TRANSIT;
  return HERO_PENDING;
}
