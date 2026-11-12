import { Plus, X } from "lucide-react";
import type { Requirements } from "../../lib/types";
import { categoryLabel, money, titleCase } from "../../lib/format";

interface PillModel {
  key: string;
  label: string;
  value: string;
}

function buildPills(requirements: Requirements): PillModel[] {
  const pills: PillModel[] = [
    { key: "category", label: "Category", value: categoryLabel(requirements.category) },
  ];

  if (requirements.budget_max !== null) {
    pills.push({ key: "budget_max", label: "Max budget", value: money(requirements.budget_max) });
  }

  const filters = requirements.hard_filters;
  if (filters.min_ram_gb) {
    pills.push({ key: "min_ram_gb", label: "RAM", value: `≥ ${filters.min_ram_gb} GB` });
  }
  if (filters.min_storage_gb) {
    pills.push({
      key: "min_storage_gb",
      label: "Storage",
      value: `≥ ${filters.min_storage_gb} GB`,
    });
  }
  if (filters.min_battery_hours) {
    pills.push({
      key: "min_battery_hours",
      label: "Battery",
      value: `≥ ${filters.min_battery_hours} h`,
    });
  }
  if (filters.max_weight_kg) {
    pills.push({
      key: "max_weight_kg",
      label: "Weight",
      value: `≤ ${filters.max_weight_kg} kg`,
    });
  }
  if (filters.wireless) {
    pills.push({ key: "wireless", label: "Wireless", value: "required" });
  }
  if (filters.anc) {
    pills.push({ key: "anc", label: "ANC", value: "required" });
  }
  if (filters.min_comfort_rating) {
    pills.push({
      key: "min_comfort_rating",
      label: "Comfort",
      value: `≥ ${filters.min_comfort_rating}/5`,
    });
  }
  if (filters.min_camera_mp) {
    pills.push({
      key: "min_camera_mp",
      label: "Camera",
      value: `≥ ${filters.min_camera_mp} MP`,
    });
  }

  if (requirements.use_case !== "everyday") {
    pills.push({ key: "use_case", label: "Use", value: titleCase(requirements.use_case) });
  }

  if (requirements.priorities.length > 0) {
    pills.push({
      key: "priorities",
      label: "Priority",
      value: requirements.priorities.map(titleCase).join(" · "),
    });
  }

  return pills;
}

interface RequirementPillsProps {
  requirements: Requirements;
  onRemove: (key: string) => void;
  onAdd: () => void;
  disabled?: boolean;
  stretch?: { applied: boolean; relaxedBudget: number | null };
}

export function RequirementPills({
  requirements,
  onRemove,
  onAdd,
  disabled,
  stretch,
}: RequirementPillsProps) {
  const pills = buildPills(requirements);

  return (
    <div className="req-bar">
      <div className="req-bar-head">
        <span className="req-bar-label">Extracted requirements</span>
        <span className="req-bar-note">remove a pill to re-filter · server enforces</span>
      </div>
      <div className="req-pills">
        {pills.map((pill) => (
          <span className="req-pill" key={pill.key} title={`${pill.label}: ${pill.value}`}>
            <span>
              {pill.label}: <strong>{pill.value}</strong>
            </span>
            <button
              type="button"
              className="req-pill-remove"
              aria-label={`Remove ${pill.label} constraint`}
              disabled={disabled}
              onClick={() => onRemove(pill.key)}
            >
              <X size={10} strokeWidth={2} />
            </button>
          </span>
        ))}

        {stretch?.applied && stretch.relaxedBudget ? (
          <span className="req-pill" style={{ borderColor: "rgba(180,83,9,.22)" }}>
            <span style={{ color: "var(--color-amber)" }}>
              Stretch lane: <strong>≤ {money(stretch.relaxedBudget)}</strong>
            </span>
          </span>
        ) : null}

        <button
          type="button"
          className="req-pill add"
          onClick={onAdd}
          disabled={disabled}
          aria-label="Add a requirement through the agent"
        >
          <Plus size={10} strokeWidth={2} /> add via chat
        </button>
      </div>
    </div>
  );
}
