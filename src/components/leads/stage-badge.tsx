import { STAGE_LABELS, type LeadStage } from "@/lib/leads/constants";
import { cn } from "@/lib/utils";

const TONES: Record<LeadStage, string> = {
  new: "bg-brand-soft text-foreground",
  contacted: "bg-brand-soft text-foreground",
  quote_sent: "bg-brand-soft text-foreground",
  won: "bg-success-soft text-success",
  lost: "bg-danger-soft text-danger",
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[stage])}>
      {STAGE_LABELS[stage]}
    </span>
  );
}
