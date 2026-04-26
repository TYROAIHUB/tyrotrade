import {
  Building2,
  User,
  FileText,
  Globe2,
  Calendar,
  ArrowLeftRight,
  Leaf,
  Clock3,
  Briefcase,
} from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

export function ProjectInfoCard({ project }: Props) {
  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] tracking-tight text-muted-foreground">
                {project.projectNo}
              </span>
              {project.organic && (
                <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wide text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  <Leaf className="size-2.5" />
                  Organic
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold leading-snug mt-0.5">
              {project.projectName}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="info">{project.incoterm}</Badge>
            <span className="text-[10px] text-muted-foreground">
              {project.currency}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
          <Row icon={<User className="size-3.5" />} label="Trader" value={project.traderNo} />
          <Row
            icon={<User className="size-3.5" />}
            label="Ana Trader"
            value={project.mainTraderNo}
          />
          <Row
            icon={<Calendar className="size-3.5" />}
            label="Proje Tarihi"
            value={formatDate(project.projectDate)}
          />
          <Row
            icon={<Briefcase className="size-3.5" />}
            label="Ticaret Şekli"
            value={project.tradeType}
          />
          <Row
            icon={<Building2 className="size-3.5" />}
            label="Tedarikçi"
            value={project.vesselPlan?.supplier ?? "—"}
          />
          <Row
            icon={<Building2 className="size-3.5" />}
            label="Müşteri"
            value={project.vesselPlan?.buyer ?? "—"}
          />
          <Row
            icon={<FileText className="size-3.5" />}
            label="Grup"
            value={project.projectGroup}
          />
          <Row
            icon={<Globe2 className="size-3.5" />}
            label="Segment"
            value={project.segment ?? "—"}
          />
          {project.transactionDirection && (
            <Row
              icon={<ArrowLeftRight className="size-3.5" />}
              label="İşlem Yönü"
              value={project.transactionDirection}
            />
          )}
          {project.operationPeriod && (
            <Row
              icon={<Clock3 className="size-3.5" />}
              label="Operasyon Per."
              value={formatDate(project.operationPeriod)}
            />
          )}
          <Row
            icon={<FileText className="size-3.5" />}
            label="Durum"
            value={`${project.status} · ${project.workflowStatus}`}
          />
          {project.customerAccount && (
            <Row
              icon={<User className="size-3.5" />}
              label="Satıcı Hesabı"
              value={project.customerAccount}
            />
          )}
        </div>

        {project.vesselPlan?.operationStatus && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-xs">
            <div className="text-[10px] uppercase tracking-wider text-emerald-700 mb-0.5">
              Operasyon Durumu
            </div>
            <div className="text-foreground font-medium leading-snug">
              {project.vesselPlan.operationStatus}
            </div>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xs font-medium text-foreground/90 truncate mt-0.5">
        {value}
      </div>
    </div>
  );
}
