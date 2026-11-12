import { catalog } from "../data/catalog.js";
import type {
  BundleOption,
  HardFilters,
  Match,
  Product,
  ProductCategory,
  Requirements,
} from "../types.js";

export interface SearchOutcome {
  results: Match[];
  bundles: BundleOption[];
  strictMatches: number;
  stretchApplied: boolean;
  relaxedBudget: number | null;
}

const formatUsd = (value: number) =>
  Number.isInteger(value)
    ? `$${value.toLocaleString("en-US")}`
    : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const round = (value: number, places = 1) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const maxOf = (products: Product[], read: (product: Product) => number | undefined) =>
  Math.max(0, ...products.map((product) => read(product) ?? 0));

const minOf = (products: Product[], read: (product: Product) => number | undefined) => {
  const values = products.map(read).filter((value): value is number => typeof value === "number");
  return values.length ? Math.min(...values) : 0;
};

function categoryPool(category: ProductCategory): Product[] {
  return catalog.filter((product) => product.category === category);
}

function scoreProduct(product: Product, req: Requirements): number {
  const pool = categoryPool(product.category);
  const priorities = new Set(req.priorities);
  let score = 50;

  if (product.in_stock) score += 3;
  if (product.ideal_for.includes(req.use_case)) score += 8;
  else if (product.ideal_for.some((tag) => req.use_case.includes(tag))) score += 4;

  if (priorities.has("battery")) {
    const maxBattery = maxOf(pool, (item) => item.specs.battery_hours);
    score += (product.specs.battery_hours / Math.max(maxBattery, 1)) * 14;
  }

  if (priorities.has("comfort") && product.specs.comfort_rating) {
    score += (product.specs.comfort_rating / 5) * 14;
  }

  if (priorities.has("anc") && product.specs.anc_level) {
    score += (product.specs.anc_level / 5) * 14;
  }

  if (priorities.has("camera")) {
    const maxCamera = maxOf(pool, (item) => item.specs.camera_mp);
    score += ((product.specs.camera_mp ?? 0) / Math.max(maxCamera, 1)) * 12;
  }

  if (priorities.has("weight")) {
    const lightest = minOf(pool, (item) => item.specs.weight_kg);
    const heaviest = maxOf(pool, (item) => item.specs.weight_kg);
    const span = Math.max(heaviest - lightest, 0.01);
    score += (1 - (product.specs.weight_kg - lightest) / span) * 10;
  }

  if (priorities.has("value")) {
    const priciest = maxOf(pool, (item) => item.price_usd);
    score += (1 - product.price_usd / Math.max(priciest, 1)) * 9;
  }

  if (priorities.has("display")) {
    const nits = Number(product.specs.display.match(/(\d{3})\s*nit/i)?.[1] ?? 0);
    score += (nits / 450) * 6;
    if (/oled/i.test(product.specs.display)) score += 3;
  }

  if (priorities.has("performance")) {
    if ((product.specs.ram_gb ?? 0) >= 16) score += 4;
    if ((product.specs.storage_gb ?? 0) >= 512) score += 2;
    if (/i5|i7|ryzen 5|ryzen 7|m1|m2|tensor|a15/i.test(product.specs.processor ?? "")) score += 4;
  }

  if (priorities.has("storage")) {
    score += ((product.specs.storage_gb ?? 0) / 1024) * 8;
  }

  if (priorities.has("ease_of_use") && product.ideal_for.includes("parents")) score += 6;

  // A gentle value tiebreak keeps equal-scoring options honest.
  score += (1 - product.price_usd / 2000) * 2;

  return round(score);
}

function passesHardFilters(product: Product, filters: HardFilters): boolean {
  const specs = product.specs;
  const isLaptop = product.category === "laptops";
  const isHeadphones = product.category === "headphones";
  const isPhone = product.category === "smartphones";

  // Category-specific constraints must not disqualify an unrelated item in a
  // bundle. ANC belongs to headphones; RAM belongs to laptops; a camera
  // minimum belongs to phones.
  if (isLaptop && filters.min_ram_gb && (specs.ram_gb ?? 0) < filters.min_ram_gb) return false;
  if (
    (isLaptop || isPhone) &&
    filters.min_storage_gb &&
    (specs.storage_gb ?? 0) < filters.min_storage_gb
  ) {
    return false;
  }
  if (filters.min_battery_hours && specs.battery_hours < filters.min_battery_hours) return false;
  if (filters.max_weight_kg && specs.weight_kg > filters.max_weight_kg) return false;
  if (isHeadphones && filters.wireless === true && specs.wireless !== true) return false;
  if (isHeadphones && filters.anc === true && (specs.anc_level ?? 0) < 3) return false;
  if (
    isHeadphones &&
    filters.min_comfort_rating &&
    (specs.comfort_rating ?? 0) < filters.min_comfort_rating
  ) {
    return false;
  }
  if (isPhone && filters.min_camera_mp && (specs.camera_mp ?? 0) < filters.min_camera_mp) {
    return false;
  }
  return true;
}

function compromiseLabel(text: string): string {
  if (/display|nit|oled|screen|reflect/i.test(text)) return "Display";
  if (/battery|charge|hour/i.test(text)) return "Battery";
  if (/kg|heavy|weight/i.test(text)) return "Weight";
  if (/plastic|chassis|frame|hinge|creak|build|flex/i.test(text)) return "Build";
  if (/ram|memory/i.test(text)) return "Memory";
  if (/storage|ssd|gb/i.test(text)) return "Storage";
  if (/camera|photo|low-light/i.test(text)) return "Camera";
  if (/anc|noise|voice/i.test(text)) return "ANC";
  if (/comfort|clamp|pad|ear|fit/i.test(text)) return "Comfort";
  if (/price|cost|over/i.test(text)) return "Price";
  if (/charg|watt|adapter/i.test(text)) return "Charging";
  return "Trade-off";
}

function buildMeets(product: Product, req: Requirements, includeBudget: boolean): string[] {
  const meets: string[] = [];
  const specs = product.specs;
  const add = (text: string) => {
    if (!meets.includes(text)) meets.push(text);
  };

  if (includeBudget && req.budget_max !== null) {
    const difference = req.budget_max - product.price_usd;
    if (difference >= 0) {
      add(`${formatUsd(product.price_usd)} sits ${formatUsd(difference)} under your ${formatUsd(req.budget_max)} cap`);
    } else {
      add(`${formatUsd(product.price_usd)} is ${formatUsd(Math.abs(difference))} over the ${formatUsd(req.budget_max)} stretch cap`);
    }
  }
  if (req.hard_filters.min_ram_gb && (specs.ram_gb ?? 0) >= req.hard_filters.min_ram_gb) {
    add(`${specs.ram_gb} GB RAM clears your ${req.hard_filters.min_ram_gb} GB minimum`);
  }
  if (
    req.hard_filters.min_battery_hours &&
    specs.battery_hours >= req.hard_filters.min_battery_hours
  ) {
    add(`${specs.battery_hours} h battery clears your ${req.hard_filters.min_battery_hours} h minimum`);
  } else if (req.priorities.includes("battery")) {
    add(`${specs.battery_hours} h rated battery`);
  }
  if (req.hard_filters.anc && (specs.anc_level ?? 0) >= 3) {
    add(`ANC rated ${specs.anc_level}/5`);
  } else if (req.priorities.includes("anc") && specs.anc_level) {
    add(`ANC rated ${specs.anc_level}/5`);
  }
  if (req.hard_filters.min_comfort_rating && (specs.comfort_rating ?? 0) >= 4) {
    add(`Comfort rated ${specs.comfort_rating}/5`);
  } else if (req.priorities.includes("comfort") && specs.comfort_rating) {
    add(`Comfort rated ${specs.comfort_rating}/5`);
  }
  if (req.hard_filters.min_camera_mp && (specs.camera_mp ?? 0) >= req.hard_filters.min_camera_mp) {
    add(`${specs.camera_mp} MP main camera`);
  } else if (req.priorities.includes("camera") && specs.camera_mp) {
    add(`${specs.camera_mp} MP main camera`);
  }
  if (req.priorities.includes("weight")) add(`${specs.weight_kg} kg`);
  if (req.priorities.includes("storage") && specs.storage_gb) add(`${specs.storage_gb} GB SSD`);
  if (req.hard_filters.max_weight_kg && specs.weight_kg <= req.hard_filters.max_weight_kg) {
    add(`${specs.weight_kg} kg is under your ${req.hard_filters.max_weight_kg} kg limit`);
  }
  if (product.ideal_for.includes(req.use_case)) {
    add(`Catalog-tagged for ${req.use_case}`);
  }

  return meets.slice(0, 4);
}

function toMatch(
  product: Product,
  req: Requirements,
  options: { includeBudget: boolean; isStretch?: boolean; overBudgetBy?: number },
): Match {
  const compromises = product.known_tradeoffs.slice(0, 3).map((detail) => ({
    label: compromiseLabel(detail),
    detail,
  }));

  if (options.overBudgetBy && options.overBudgetBy > 0 && req.budget_max !== null) {
    compromises.unshift({
      label: "Budget",
      detail: `Costs ${formatUsd(options.overBudgetBy)} over your ${formatUsd(req.budget_max)} cap`,
    });
  }

  return {
    ...product,
    match_score: scoreProduct(product, req),
    meets: buildMeets(product, req, options.includeBudget),
    compromises: compromises.slice(0, 4),
    is_stretch_option: options.isStretch ?? false,
    over_budget_by: options.overBudgetBy ?? 0,
  };
}

export function applyRemovals(source: Requirements, removed: string[]): Requirements {
  const req: Requirements = {
    ...source,
    hard_filters: { ...source.hard_filters },
    priorities: [...source.priorities],
    bundle_categories: [...source.bundle_categories],
  };

  for (const key of removed) {
    if (key === "budget_max") {
      req.budget_max = null;
      req.budget_was_explicit = false;
      continue;
    }
    if (key === "category") {
      req.category = "all";
      req.bundle_categories = [];
      continue;
    }
    if (key === "use_case") {
      req.use_case = "everyday";
      continue;
    }
    if (key === "priorities") {
      req.priorities = [];
      continue;
    }
    if (key in req.hard_filters) {
      delete req.hard_filters[key as keyof HardFilters];
    }
  }

  return req;
}

function pickCategory(req: Requirements): ProductCategory[] {
  if (req.bundle_categories.length > 0) return req.bundle_categories;
  if (req.category === "bundle") return ["laptops", "headphones"];
  if (req.category === "all") return ["laptops", "headphones", "smartphones"];
  return [req.category];
}

function buildBundles(
  req: Requirements,
  categories: ProductCategory[],
  relaxedBudget: number | null,
): { bundles: BundleOption[]; relaxed: boolean } {
  if (categories.length < 2) return { bundles: [], relaxed: false };

  const shortlist = categories.map((category) =>
    categoryPool(category)
      .filter((product) => product.in_stock && passesHardFilters(product, req.hard_filters))
      .map((product) => toMatch(product, req, { includeBudget: false }))
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 7),
  );

  const combos: Match[][] = [];
  const walk = (index: number, current: Match[]) => {
    if (index === shortlist.length) {
      combos.push([...current]);
      return;
    }
    for (const item of shortlist[index]) walk(index + 1, [...current, item]);
  };
  walk(0, []);

  const budgetCap = req.budget_max;
  const strictCap = budgetCap ?? Number.POSITIVE_INFINITY;
  const stretchCap =
    budgetCap !== null && relaxedBudget !== null ? relaxedBudget : strictCap;

  const build = (items: Match[], stretch: boolean): BundleOption => {
    const total = items.reduce((sum, item) => sum + item.price_usd, 0);
    const remaining = budgetCap === null ? null : round(budgetCap - total, 2);
    const averageScore = items.reduce((sum, item) => sum + item.match_score, 0) / items.length;
    const budgetBonus =
      budgetCap === null ? 0 : Math.max(0, (budgetCap - total) / Math.max(budgetCap, 1)) * 8;
    return {
      id: items.map((item) => item.id).sort().join("+"),
      items: items.map((item) => {
        const difference = budgetCap === null ? 0 : Math.max(0, round(total - budgetCap, 2));
        return difference > 0
          ? { ...item, is_stretch_option: true, over_budget_by: difference }
          : item;
      }),
      total,
      budget_max: budgetCap,
      remaining,
      score: round(averageScore + budgetBonus),
      is_stretch_option: stretch,
      over_budget_by: budgetCap === null ? 0 : Math.max(0, round(total - budgetCap, 2)),
    };
  };

  const seen = new Set<string>();
  const strict: BundleOption[] = [];
  const stretch: BundleOption[] = [];

  for (const items of combos) {
    const total = items.reduce((sum, item) => sum + item.price_usd, 0);
    if (total > stretchCap) continue;
    const bundle = build(items, total > strictCap);
    if (seen.has(bundle.id)) continue;
    seen.add(bundle.id);
    if (total <= strictCap + 0.001) strict.push(bundle);
    else stretch.push(bundle);
  }

  strict.sort((a, b) => b.score - a.score);
  stretch.sort((a, b) => b.score - a.score);

  const shouldShowStretch = strict.length < 2 && stretch.length > 0;
  const bundles = [...strict.slice(0, 3), ...(shouldShowStretch ? stretch.slice(0, 2) : [])];
  return { bundles, relaxed: shouldShowStretch };
}

export function searchCatalog(req: Requirements): SearchOutcome {
  const categories = pickCategory(req);
  let results: Match[] = [];
  let strictMatches = 0;
  let stretchApplied = false;
  const relaxedBudget = req.budget_max !== null ? round(req.budget_max * 1.15, 2) : null;

  const pool = catalog.filter((product) => {
    if (!product.in_stock) return false;
    if (req.category === "all") return true;
    return categories.includes(product.category);
  });

  const hardFiltered = pool.filter((product) => passesHardFilters(product, req.hard_filters));

  if (req.category !== "bundle") {
    const strict = hardFiltered
      .filter((product) => req.budget_max === null || product.price_usd <= req.budget_max)
      .map((product) => toMatch(product, req, { includeBudget: true }))
      .sort((a, b) => b.match_score - a.match_score);

    strictMatches = strict.length;

    if (strict.length < 2 && req.budget_max !== null && relaxedBudget !== null) {
      const strictIds = new Set(strict.map((product) => product.id));
      const stretch = hardFiltered
        .filter(
          (product) =>
            !strictIds.has(product.id) &&
            product.price_usd > req.budget_max! &&
            product.price_usd <= relaxedBudget,
        )
        .map((product) =>
          toMatch(product, req, {
            includeBudget: true,
            isStretch: true,
            overBudgetBy: round(product.price_usd - req.budget_max!, 2),
          }),
        )
        .sort((a, b) => b.match_score - a.match_score);

      stretchApplied = stretch.length > 0;
      results = [...strict, ...stretch].slice(0, 6);
    } else {
      results = strict.slice(0, 6);
    }
  }

  const bundleOutcome = buildBundles(req, categories, relaxedBudget);

  if (req.category === "bundle") {
    const bundleIds = new Set(
      bundleOutcome.bundles.flatMap((bundle) => bundle.items.map((item) => item.id)),
    );
    const fallback = hardFiltered
      .filter((product) => bundleIds.has(product.id))
      .map((product) => toMatch(product, req, { includeBudget: false }));
    results = fallback
      .filter((product, index, all) => all.findIndex((item) => item.id === product.id) === index)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 6);
    strictMatches = bundleOutcome.bundles.filter((bundle) => !bundle.is_stretch_option).length;
    stretchApplied = bundleOutcome.relaxed;
  }

  return {
    results,
    bundles: bundleOutcome.bundles,
    strictMatches,
    stretchApplied,
    relaxedBudget: stretchApplied || bundleOutcome.relaxed ? relaxedBudget : null,
  };
}

export { formatUsd };
