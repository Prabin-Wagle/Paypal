import type { HardFilters, ProductCategory, Requirements, SearchTarget } from "../types.js";

const ALLOWED_PRIORITIES = [
  "battery",
  "comfort",
  "anc",
  "camera",
  "weight",
  "value",
  "display",
  "performance",
  "storage",
  "ease_of_use",
] as const;

type Priority = (typeof ALLOWED_PRIORITIES)[number];

const CATEGORY_WORDS: Record<ProductCategory, RegExp> = {
  laptops: /\b(laptop|laptops|macbook|notebook|ultrabook|chromebook|computer)\b/i,
  headphones: /\b(headphone|headphones|headset|earbuds?|over-ear|noise[- ]?cancell?ing)\b/i,
  smartphones: /\b(phone|phones|smartphone|smartphones|iphone|android|pixel|mobile)\b/i,
};

const CATEGORY_LABELS: Record<SearchTarget, string> = {
  laptops: "laptop",
  headphones: "headphones",
  smartphones: "smartphone",
  bundle: "laptop + headphones bundle",
  all: "catalog",
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function detectCategories(prompt: string): ProductCategory[] {
  return (Object.keys(CATEGORY_WORDS) as ProductCategory[]).filter((category) =>
    CATEGORY_WORDS[category].test(prompt),
  );
}

function parseBudget(prompt: string): { value: number | null; explicit: boolean } {
  const explicitPatterns = [
    /(?:under|below|less than|up to|max(?:imum)?|budget(?: of)?|within|cap(?:ped)? at|no more than|≤|<)\s*\$?\s*(\d{1,5}(?:\.\d{1,2})?)/i,
    /\$\s?(\d{1,5}(?:\.\d{1,2})?)\s*(?:budget|max|cap|total)/i,
    /(\d{1,5}(?:\.\d{1,2})?)\s*(?:dollars|usd)\s*(?:budget|max|cap|total)/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = prompt.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) return { value, explicit: true };
    }
  }

  const dollarAmounts = [...prompt.matchAll(/\$\s?(\d{1,5}(?:\.\d{1,2})?)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (dollarAmounts.length === 1) return { value: dollarAmounts[0], explicit: false };

  return { value: null, explicit: false };
}

function parseHardFilters(prompt: string, categories: ProductCategory[]): HardFilters {
  const filters: HardFilters = {};
  const hasLaptop = categories.includes("laptops");
  const hasHeadphones = categories.includes("headphones");
  const hasPhone = categories.includes("smartphones");

  const ramMatch =
    prompt.match(/(\d{1,3})\s*gb\s*(?:of\s*)?(?:ram|memory)/i) ??
    prompt.match(/(?:ram|memory)\s*(?:of|:|=|>=|at least|min(?:imum)?)?\s*(\d{1,3})\s*gb/i);
  if (ramMatch) filters.min_ram_gb = clampNumber(Number(ramMatch[1]), 2, 128);

  const storageGb = prompt.match(/(\d{3,4})\s*gb\s*(?:ssd|storage|rom)/i);
  const storageTb = prompt.match(/(\d{1,2})\s*tb\s*(?:ssd|storage)?/i);
  if (storageGb) filters.min_storage_gb = clampNumber(Number(storageGb[1]), 64, 8192);
  else if (storageTb) filters.min_storage_gb = clampNumber(Number(storageTb[1]) * 1024, 128, 8192);

  const explicitBattery =
    prompt.match(/(\d{1,2})\s*(?:h|hr|hrs|hours)\s*(?:of\s*)?battery/i) ??
    prompt.match(/battery\s*(?:life)?\s*(?:of|at least|>=|:)?\s*(\d{1,2})\s*(?:h|hours)/i);
  if (explicitBattery) {
    filters.min_battery_hours = clampNumber(Number(explicitBattery[1]), 2, 48);
  } else if (hasPhone && /\b(big|large|long|monster|all[- ]day)\s+battery\b/i.test(prompt)) {
    filters.min_battery_hours = 20;
  } else if (hasLaptop && /\b(strong|long|all[- ]day|great)\s+battery\b/i.test(prompt)) {
    filters.min_battery_hours = 10;
  }

  const weightMatch = prompt.match(
    /(?:under|below|less than|max(?:imum)?)\s*([\d.]+)\s*kg/i,
  );
  if (weightMatch) filters.max_weight_kg = clampNumber(Number(weightMatch[1]), 0.4, 5);
  else if (/\b(light|lightweight|portable)\b/i.test(prompt)) {
    filters.max_weight_kg = 1.5;
  }

  if (hasHeadphones) {
    if (/\b(anc|noise[- ]?cancell?ing|active noise)\b/i.test(prompt)) filters.anc = true;
    if (/\b(wireless|bluetooth|bt)\b/i.test(prompt)) filters.wireless = true;
    if (/\b(comfort|comfortable|top comfort)\b/i.test(prompt)) {
      filters.min_comfort_rating = 4;
    }
  }

  if (hasPhone && /\b(camera)\b/i.test(prompt)) {
    if (/\b(great|good|best|strong|top|excellent|sharp)\b/i.test(prompt)) {
      filters.min_camera_mp = 48;
    }
  }

  return filters;
}

function detectUseCase(prompt: string, categories: ProductCategory[]): string {
  if (/\b(programm?ing|coding|code|vscode|developer|software)\b/i.test(prompt)) return "programming";
  if (/\b(parent|mother|mom|mum|dad|father|grandma|grandpa|elderly|senior)\b/i.test(prompt)) {
    return "parents";
  }
  if (/\b(study|studying|student|school|college|university|lecture)\b/i.test(prompt)) {
    return "studying";
  }
  if (/\b(photo|photography|camera|vlog)\b/i.test(prompt)) return "photography";
  if (/\b(travel|flight|commute|commuting)\b/i.test(prompt)) return "travel";
  if (/\b(work|office|business|meeting)\b/i.test(prompt)) return "work";
  if (categories.length > 0) return "everyday";
  return "everyday";
}

function detectPriorities(prompt: string, categories: ProductCategory[]): Priority[] {
  const found: Priority[] = [];
  const add = (priority: Priority) => {
    if (!found.includes(priority)) found.push(priority);
  };

  if (/\b(battery|charge|all[- ]day|unplugged)\b/i.test(prompt)) add("battery");
  if (/\b(comfort|comfortable|long session|study|studying)\b/i.test(prompt)) add("comfort");
  if (/\b(anc|noise[- ]?cancel|quiet)\b/i.test(prompt)) add("anc");
  if (/\b(camera|photo|photography)\b/i.test(prompt)) add("camera");
  if (/\b(light|lightweight|portable|travel)\b/i.test(prompt)) add("weight");
  if (/\b(cheap|affordable|value|budget|under)\b/i.test(prompt)) add("value");
  if (/\b(display|screen|oled|bright|retina)\b/i.test(prompt)) add("display");
  if (/\b(fast|performance|snappy|vscode|programm?ing|code|compile)\b/i.test(prompt)) {
    add("performance");
  }
  if (/\b(storage|ssd|space)\b/i.test(prompt)) add("storage");
  if (/\b(simple|easy|ease of use|intuitive)\b/i.test(prompt)) add("ease_of_use");

  if (found.length === 0) {
    if (categories.includes("laptops")) add("performance");
    if (categories.includes("headphones")) add("comfort");
    if (categories.includes("smartphones")) add("battery");
  }

  return found.slice(0, 4);
}

function buildInterpretation(req: Omit<Requirements, "interpretation">): string {
  const parts: string[] = [];
  parts.push(`A ${CATEGORY_LABELS[req.category]}`);
  if (req.budget_max !== null) parts.push(`under $${req.budget_max}`);
  if (req.hard_filters.min_ram_gb) parts.push(`with at least ${req.hard_filters.min_ram_gb} GB RAM`);
  if (req.hard_filters.anc) parts.push("with active noise cancelling");
  if (req.hard_filters.min_comfort_rating) parts.push("comfort rated 4.0+");
  if (req.hard_filters.min_camera_mp) parts.push(`a ${req.hard_filters.min_camera_mp} MP+ camera`);
  if (req.hard_filters.min_battery_hours) {
    parts.push(`battery rated ${req.hard_filters.min_battery_hours} h+`);
  }
  const base = parts.join(" ");
  if (req.priorities.length === 0) return `${base}.`;
  return `${base}. Scored for ${req.priorities.map((p) => p.replace(/_/g, " ")).join(", ")}.`;
}

export function extractWithRules(prompt: string): Requirements {
  const categories = detectCategories(prompt);
  const bundleSignal = /\b(bundle|both|together|total)\b/i.test(prompt);
  const isBundle = bundleSignal && categories.length >= 2;
  const budget = parseBudget(prompt);
  const hardFilters = parseHardFilters(prompt, categories);
  const priorities = detectPriorities(prompt, categories);

  let category: SearchTarget = categories[0] ?? "all";
  let bundleCategories: ProductCategory[] = categories.length ? categories : [];
  if (isBundle) {
    category = "bundle";
    bundleCategories = categories.slice(0, 3);
  }

  const useCase = detectUseCase(prompt, categories);
  const partial = {
    category,
    bundle_categories: bundleCategories,
    budget_max: budget.value,
    budget_was_explicit: budget.explicit,
    hard_filters: hardFilters,
    use_case: useCase,
    priorities,
    source: "rules" as const,
  };

  return { ...partial, interpretation: buildInterpretation(partial) };
}

export function normalizeRequirements(
  input: Partial<Requirements>,
  fallback: Requirements,
): Requirements {
  const rawCategory = typeof input.category === "string" ? input.category : fallback.category;
  const validCategory: SearchTarget = ["laptops", "headphones", "smartphones", "bundle", "all"].includes(
    rawCategory,
  )
    ? (rawCategory as SearchTarget)
    : fallback.category;

  const rawBundle = Array.isArray(input.bundle_categories) ? input.bundle_categories : [];
  const validBundle = rawBundle.filter((category): category is ProductCategory =>
    ["laptops", "headphones", "smartphones"].includes(category),
  );

  const filtersIn = (input.hard_filters ?? {}) as HardFilters;
  const filters: HardFilters = {};
  if (typeof filtersIn.min_ram_gb === "number") filters.min_ram_gb = clampNumber(filtersIn.min_ram_gb, 2, 128);
  if (typeof filtersIn.min_storage_gb === "number") filters.min_storage_gb = clampNumber(filtersIn.min_storage_gb, 64, 8192);
  if (typeof filtersIn.min_battery_hours === "number") filters.min_battery_hours = clampNumber(filtersIn.min_battery_hours, 2, 48);
  if (typeof filtersIn.max_weight_kg === "number") filters.max_weight_kg = clampNumber(filtersIn.max_weight_kg, 0.4, 5);
  if (typeof filtersIn.min_comfort_rating === "number") filters.min_comfort_rating = clampNumber(filtersIn.min_comfort_rating, 1, 5);
  if (typeof filtersIn.min_camera_mp === "number") filters.min_camera_mp = clampNumber(filtersIn.min_camera_mp, 8, 200);
  if (typeof filtersIn.wireless === "boolean") filters.wireless = filtersIn.wireless;
  if (typeof filtersIn.anc === "boolean") filters.anc = filtersIn.anc;

  const inputPriorities = Array.isArray(input.priorities) ? input.priorities : [];
  const priorities = inputPriorities
    .map((priority) => String(priority).toLowerCase().replace(/[\s-]+/g, "_"))
    .filter((priority): priority is Priority =>
      (ALLOWED_PRIORITIES as readonly string[]).includes(priority),
    )
    .filter((priority, index, all) => all.indexOf(priority) === index)
    .slice(0, 5);

  const budget =
    typeof input.budget_max === "number" && Number.isFinite(input.budget_max) && input.budget_max > 0
      ? clampNumber(input.budget_max, 10, 100000)
      : input.budget_max === null
        ? null
        : fallback.budget_max;

  const bundleCategories =
    validBundle.length > 0
      ? validBundle
      : validCategory === "bundle"
        ? fallback.bundle_categories
        : validCategory === "all"
          ? []
          : [validCategory];

  const partial = {
    category: validCategory,
    bundle_categories: bundleCategories,
    budget_max: budget,
    budget_was_explicit: input.budget_was_explicit ?? fallback.budget_was_explicit,
    hard_filters: { ...fallback.hard_filters, ...filters },
    use_case:
      typeof input.use_case === "string" && input.use_case.trim()
        ? input.use_case.trim().toLowerCase()
        : fallback.use_case,
    priorities: priorities.length > 0 ? priorities : fallback.priorities,
    source: "llm" as const,
  };

  return { ...partial, interpretation: buildInterpretation(partial) };
}

/* ── Optional LLM path ─────────────────────────────────────────────
   The deterministic parser above is the source of truth for the demo.
   When a key exists, the model is used only to read messier phrasing;
   its output is validated and clamped before it reaches the filter.  */

function buildLlmPrompt(prompt: string) {
  return `Extract shopping constraints from the request below.

Return ONLY a JSON object with this exact shape:
{
  "category": "laptops" | "headphones" | "smartphones" | "bundle" | "all",
  "bundle_categories": ["laptops", "headphones"],
  "budget_max": number | null,
  "hard_filters": {
    "min_ram_gb": number,
    "min_storage_gb": number,
    "min_battery_hours": number,
    "max_weight_kg": number,
    "wireless": boolean,
    "anc": boolean,
    "min_comfort_rating": number,
    "min_camera_mp": number
  },
  "use_case": "programming" | "studying" | "parents" | "photography" | "travel" | "work" | "everyday",
  "priorities": ["battery" | "comfort" | "anc" | "camera" | "weight" | "value" | "display" | "performance" | "storage" | "ease_of_use"]
}

Rules:
- budget_max is the TOTAL budget in USD for the whole request or bundle.
- Only include hard_filters the user actually stated. Omit keys that were not stated.
- "under $700" means budget_max: 700, not a hard_filter.
- For a laptop + headphones bundle, set category to "bundle" and list both categories.
- Use the user's language. Never invent a product, price, brand or requirement.

Request: "${prompt}"`;
}

async function callOpenAI(prompt: string): Promise<Partial<Requirements>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You turn shopping requests into strict JSON constraints. You never invent products or prices.",
        },
        { role: "user", content: buildLlmPrompt(prompt) },
      ],
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");
  return JSON.parse(content) as Partial<Requirements>;
}

async function callAnthropic(prompt: string): Promise<Partial<Requirements>> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest",
      max_tokens: 700,
      temperature: 0,
      messages: [{ role: "user", content: buildLlmPrompt(prompt) }],
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) throw new Error(`Anthropic ${response.status}`);
  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Empty LLM response");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in LLM response");
  return JSON.parse(match[0]) as Partial<Requirements>;
}

export async function extractRequirements(prompt: string): Promise<Requirements> {
  const fallback = extractWithRules(prompt);
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasOpenAI && !hasAnthropic) return fallback;

  try {
    const raw = hasOpenAI ? await callOpenAI(prompt) : await callAnthropic(prompt);
    return normalizeRequirements(raw, fallback);
  } catch (error) {
    console.warn(
      "[intent] LLM extraction unavailable, using deterministic parser:",
      error instanceof Error ? error.message : error,
    );
    return { ...fallback, source: "rules" };
  }
}
