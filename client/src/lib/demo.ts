export interface DemoPrompt {
  id: string;
  icon: "laptop" | "headphones" | "smartphone" | "bundle";
  title: string;
  detail: string;
  prompt: string;
  badge?: string;
}

export const DEMO_PROMPTS: DemoPrompt[] = [
  {
    id: "laptop",
    icon: "laptop",
    title: "Programming laptop",
    detail: "16 GB RAM · strong battery · under $700",
    prompt: "Programming laptop under $700, 16GB RAM, strong battery for VS Code",
  },
  {
    id: "headphones",
    icon: "headphones",
    title: "Study headphones",
    detail: "Top comfort · ANC · under $100",
    prompt: "Wireless headphones for studying under $100, top comfort & ANC",
  },
  {
    id: "phone",
    icon: "smartphone",
    title: "A simpler phone",
    detail: "For my mother · big battery · under $250",
    prompt: "Simple smartphone for my mother under $250, big battery & great camera",
  },
  {
    id: "bundle",
    icon: "bundle",
    title: "The two-item bundle",
    detail: "Laptop + ANC headphones · $750 total",
    prompt: "Bundle: Programming laptop + ANC study headphones under $750 total",
    badge: "Bundle demo",
  },
];

export const BUNDLE_PROMPT =
  DEMO_PROMPTS.find((item) => item.id === "bundle")?.prompt ??
  "Bundle: Programming laptop + ANC study headphones under $750 total";

export function promptFromUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  const prompt = params.get("prompt");
  return prompt && prompt.trim().length > 0 ? prompt.trim() : null;
}
