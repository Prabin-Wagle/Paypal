import { ArrowUpRight, Headphones, Laptop, Layers, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DemoPrompt } from "../lib/demo";

const ICONS = {
  laptop: Laptop,
  headphones: Headphones,
  smartphone: Smartphone,
  bundle: Layers,
} as const;

interface PromptStarterProps {
  item: DemoPrompt;
  onLaunch?: () => void;
}

export function PromptStarter({ item, onLaunch }: PromptStarterProps) {
  const navigate = useNavigate();
  const Icon = ICONS[item.icon];

  return (
    <button
      type="button"
      className="prompt-starter group"
      onClick={() => {
        onLaunch?.();
        navigate(`/app?prompt=${encodeURIComponent(item.prompt)}`);
      }}
      aria-label={`Launch the agent with: ${item.prompt}`}
    >
      <span className="prompt-icon" aria-hidden="true">
        <Icon size={15} strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="prompt-title">
          {item.title}
          {item.badge ? <span className="prompt-badge">{item.badge}</span> : null}
          <ArrowUpRight
            size={12}
            strokeWidth={1.8}
            className="ml-auto text-slate-light opacity-0 transition group-hover:opacity-100"
            aria-hidden="true"
          />
        </span>
        <span className="prompt-detail">{item.detail}</span>
      </span>
    </button>
  );
}
