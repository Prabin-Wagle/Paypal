import { ShieldCheck } from "lucide-react";

interface BrandProps {
  badge?: boolean;
  compact?: boolean;
}

export function Brand({ badge = true, compact = false }: BrandProps) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        S
      </span>
      <span className="brand-word">
        ShopMate<span> AI</span>
      </span>
      {badge && !compact ? (
        <span className="status-badge">
          <ShieldCheck size={11} strokeWidth={1.8} />
          Verified agentic commerce
        </span>
      ) : null}
    </span>
  );
}
