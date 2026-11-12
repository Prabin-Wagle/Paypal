import type { BundleOption, Match, Recommendation, Requirements } from "../types.js";
import { formatUsd } from "./catalogSearch.js";

const USE_CASE_LABEL: Record<string, string> = {
  programming: "programming",
  studying: "study sessions",
  parents: "everyday family use",
  photography: "photography",
  travel: "travel",
  work: "work",
  everyday: "everyday use",
};

function meetLabel(detail: string): string {
  if (detail.startsWith("$")) return "Budget";
  if (/GB RAM/i.test(detail)) return "Memory";
  if (/battery/i.test(detail)) return "Battery";
  if (/ANC/i.test(detail)) return "ANC";
  if (/Comfort/i.test(detail)) return "Comfort";
  if (/MP/i.test(detail)) return "Camera";
  if (/kg/i.test(detail)) return "Weight";
  if (/SSD/i.test(detail)) return "Storage";
  if (/Catalog-tagged/i.test(detail)) return "Use case";
  return "Requirement";
}

function productRecommendation(
  req: Requirements,
  results: Match[],
): Recommendation | null {
  const best = results.find((product) => !product.is_stretch_option) ?? results[0];
  if (!best) return null;
  const runnerUp = results.find((product) => product.id !== best.id);
  const useCase = USE_CASE_LABEL[req.use_case] ?? req.use_case;

  const why: { label: string; detail: string }[] = [];
  if (best.is_stretch_option) {
    why.push({
      label: "Stretch lane",
      detail: `${formatUsd(best.over_budget_by)} over your original cap — shown because strict matches were thin.`,
    });
  }
  for (const detail of best.meets) {
    why.push({ label: meetLabel(detail), detail });
  }
  for (const detail of best.verified_pros.slice(0, 2)) {
    why.push({ label: "Verified strength", detail });
  }

  const compromises = best.compromises.map((tradeoff) => ({
    label: tradeoff.label,
    detail: tradeoff.detail,
  }));

  const headline =
    req.category === "bundle"
      ? `${best.name} is the strongest single match in this bundle.`
      : `${best.name} is the closest verified fit for ${useCase}.`;

  const summary = `${best.name} at ${formatUsd(best.price_usd)}. ${best.verified_pros[0]}. The honest cost: ${best.known_tradeoffs[0].toLowerCase()}.`;

  let runnerUpNote: string | undefined;
  if (runnerUp) {
    const comparisons: string[] = [];
    const priceDifference = runnerUp.price_usd - best.price_usd;
    if (priceDifference !== 0) {
      comparisons.push(
        `${formatUsd(Math.abs(priceDifference))} ${priceDifference < 0 ? "cheaper" : "more expensive"}`,
      );
    }
    if (runnerUp.specs.battery_hours !== best.specs.battery_hours) {
      comparisons.push(
        `${runnerUp.specs.battery_hours} h vs ${best.specs.battery_hours} h battery`,
      );
    }
    if (runnerUp.specs.weight_kg !== best.specs.weight_kg) {
      comparisons.push(`${runnerUp.specs.weight_kg} kg vs ${best.specs.weight_kg} kg`);
    }
    if (comparisons.length > 0) {
      runnerUpNote = `The ${runnerUp.name} is ${comparisons.slice(0, 2).join(" and ")}, but ranks second on your stated priorities.`;
    }
  }

  return {
    kind: "product",
    product_id: best.id,
    headline,
    summary,
    why: why.slice(0, 6),
    compromises: compromises.slice(0, 4),
    runner_up_note: runnerUpNote,
  };
}

function bundleRecommendation(bundle: BundleOption, req: Requirements): Recommendation {
  const names = bundle.items.map((item) => item.name).join(" + ");
  const remaining = bundle.remaining;
  const why: { label: string; detail: string }[] = [];

  if (remaining !== null && remaining >= 0) {
    why.push({
      label: "Budget",
      detail: `${formatUsd(bundle.total)} total sits ${formatUsd(remaining)} under your ${formatUsd(bundle.budget_max ?? 0)} cap`,
    });
  } else if (bundle.is_stretch_option) {
    why.push({
      label: "Stretch lane",
      detail: `${formatUsd(bundle.over_budget_by)} over the original cap — the closest complete bundle in the relaxed lane`,
    });
  }

  for (const item of bundle.items) {
    for (const detail of item.meets.slice(0, 2)) {
      why.push({ label: meetLabel(detail), detail: `${item.name}: ${detail}` });
    }
  }

  const compromises = bundle.items
    .flatMap((item) =>
      item.compromises.slice(0, 2).map((tradeoff) => ({
        label: `${item.brand} ${tradeoff.label}`,
        detail: tradeoff.detail,
      })),
    )
    .filter(
      (tradeoff, index, all) =>
        all.findIndex((item) => item.detail === tradeoff.detail) === index,
    )
    .slice(0, 4);

  const totalLine =
    remaining !== null && remaining >= 0
      ? `${formatUsd(bundle.total)} for both, leaving ${formatUsd(remaining)} of the ${formatUsd(bundle.budget_max ?? 0)} total.`
      : `${formatUsd(bundle.total)} for both.`;

  return {
    kind: "bundle",
    bundle_id: bundle.id,
    headline: `${names} is the tightest two-item bundle.`,
    summary: `${totalLine} Every line is priced from the verified catalog, and both items clear the stated hard filters.`,
    why: why.slice(0, 6),
    compromises,
  };
}

export function recommend(
  req: Requirements,
  results: Match[],
  bundles: BundleOption[],
): Recommendation | null {
  if (req.category === "bundle") {
    const bestBundle = bundles.find((bundle) => !bundle.is_stretch_option) ?? bundles[0];
    if (!bestBundle) return productRecommendation(req, results);
    const recommendation = bundleRecommendation(bestBundle, req);
    const runnerUp = bundles.find((bundle) => bundle.id !== bestBundle.id);
    if (runnerUp) {
      const difference = runnerUp.total - bestBundle.total;
      recommendation.runner_up_note = `The ${runnerUp.items
        .map((item) => item.name)
        .join(" + ")} alternative totals ${formatUsd(runnerUp.total)} (${formatUsd(
        Math.abs(difference),
      )} ${difference >= 0 ? "more" : "less"}) and ranks second on your priorities.`;
    }
    return recommendation;
  }
  return productRecommendation(req, results);
}
