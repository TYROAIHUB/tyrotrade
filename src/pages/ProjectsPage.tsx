import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layers, ChevronLeft } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { ProjectList } from "@/components/projects/ProjectList";
import { ProjectsEmptyState } from "@/components/projects/ProjectsEmptyState";
import { RouteMap } from "@/components/map/RouteMap";
import { ProjectOverviewCard } from "@/components/details/ProjectOverviewCard";
import { CommoditySalesCard } from "@/components/details/CommoditySalesCard";
import { BudgetSalesCard } from "@/components/details/BudgetSalesCard";
import { EstimatedExpenseCard } from "@/components/details/EstimatedExpenseCard";
import { BudgetPLCard } from "@/components/details/BudgetPLCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

type MobileView = "list" | "map" | "details";

export function ProjectsPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { projects, isEmpty } = useProjects();

  const initialId = projectId ?? projects[0]?.projectNo ?? null;
  const [selectedId, setSelectedId] = React.useState<string | null>(initialId);

  React.useEffect(() => {
    if (projectId && projectId !== selectedId) {
      setSelectedId(projectId);
    }
  }, [projectId, selectedId]);

  // When the projects array first arrives (cache hydration after mount), pick
  // the first project as the default selection so the right-rail isn't empty.
  React.useEffect(() => {
    if (!selectedId && projects.length > 0) {
      setSelectedId(projects[0].projectNo);
    }
  }, [projects, selectedId]);

  const [mobileView, setMobileView] = React.useState<MobileView>("list");

  if (isEmpty) {
    return <ProjectsEmptyState />;
  }

  const selected =
    projects.find((p) => p.projectNo === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    navigate(`/projects/${id}`, { replace: true });
    // After picking a project on mobile, jump to the details tab — that
    // is the operator's primary destination; they can still tap "Harita"
    // to see the route on the map afterwards.
    if (isMobile) setMobileView("details");
  };

  if (isMobile) {
    return (
      <div className="h-full flex flex-col gap-2">
        <MobileTabs view={mobileView} setView={setMobileView} hasSelection={!!selected} />
        <div className="flex-1 overflow-hidden">
          {mobileView === "list" && (
            <ProjectList
              projects={projects}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          )}
          {mobileView === "map" && (
            <div className="h-full flex flex-col gap-2">
              {selected && (
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => setMobileView("list")}
                  className="self-start"
                >
                  <ChevronLeft className="size-3.5" />
                  Projelere dön
                </Button>
              )}
              <div className="flex-1">
                <RouteMap project={selected} />
              </div>
            </div>
          )}
          {mobileView === "details" && selected && (
            <ScrollArea className="h-full">
              <div className="space-y-3 pb-4">
                <ProjectOverviewCard project={selected} />
                <CommoditySalesCard project={selected} />
                <BudgetSalesCard project={selected} />
                <EstimatedExpenseCard project={selected} />
                <BudgetPLCard project={selected} />
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-[224px_minmax(0,1fr)_320px] xl:grid-cols-[260px_minmax(0,1fr)_360px] 2xl:grid-cols-[296px_minmax(0,1fr)_400px] gap-3">
      <div className="min-h-0 min-w-0 overflow-hidden">
        <ProjectList
          projects={projects}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      <div className="min-h-0 min-w-0 overflow-hidden">
        <RouteMap project={selected} />
      </div>

      <div className="min-h-0 min-w-0 overflow-hidden">
        {selected ? (
          <ScrollArea className="h-full pr-1">
            <div className="space-y-3">
              <ProjectOverviewCard project={selected} />
              <CommoditySalesCard project={selected} />
              <BudgetSalesCard project={selected} />
              <EstimatedExpenseCard project={selected} />
              <BudgetPLCard project={selected} />
            </div>
          </ScrollArea>
        ) : (
          <div className="h-full grid place-items-center text-muted-foreground text-sm">
            Detay için bir proje seçin
          </div>
        )}
      </div>
    </div>
  );
}

function MobileTabs({
  view,
  setView,
  hasSelection,
}: {
  view: MobileView;
  setView: (v: MobileView) => void;
  hasSelection: boolean;
}) {
  const items: Array<{ key: MobileView; label: string }> = [
    { key: "list", label: "Liste" },
    { key: "map", label: "Harita" },
    { key: "details", label: "Detay" },
  ];
  return (
    <div className="glass rounded-2xl p-1 flex items-center gap-1">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => setView(it.key)}
          disabled={it.key !== "list" && !hasSelection}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all relative z-[3]",
            view === it.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground disabled:opacity-40 hover:text-foreground"
          )}
        >
          {it.key === "map" && <Layers className="inline size-3 mr-1" />}
          {it.label}
        </button>
      ))}
    </div>
  );
}
