import { catalog } from "../data/catalog.js";
import type { AgentResult, PipelineMeta, Requirements } from "../types.js";
import { applyRemovals, searchCatalog } from "./catalogSearch.js";
import { extractRequirements } from "./intentExtractor.js";
import { recommend } from "./recommendation.js";

function countConstraints(requirements: Requirements): number {
  let count = 1; // category
  if (requirements.budget_max !== null) count += 1;
  count += Object.keys(requirements.hard_filters).length;
  if (requirements.use_case !== "everyday") count += 1;
  return count;
}

function buildMeta(
  req: Requirements,
  outcome: ReturnType<typeof searchCatalog>,
  elapsedMs: number,
): PipelineMeta {
  const strictLabel = req.category === "bundle" ? "bundle" : "product";
  return {
    catalog_size: catalog.length,
    strict_matches: outcome.strictMatches,
    stretch_applied: outcome.stretchApplied,
    relaxed_budget: outcome.relaxedBudget,
    elapsed_ms: elapsedMs,
    grounded: true,
    steps: [
      {
        id: "extract",
        label: "Extracting requirements",
        status: "complete",
        detail: `${countConstraints(req)} constraints · ${req.source === "llm" ? "LLM" : "deterministic"} parser`,
      },
      {
        id: "filter",
        label: "Filtering verified catalog",
        status: "complete",
        detail: `${outcome.strictMatches} strict ${strictLabel}${outcome.strictMatches === 1 ? "" : "s"} in ${catalog.length} SKUs`,
      },
      {
        id: "evaluate",
        label: "Evaluating trade-offs",
        status: "complete",
        detail: `${outcome.results.length} ranked · ${outcome.bundles.length} bundle${outcome.bundles.length === 1 ? "" : "s"}`,
      },
      {
        id: "approve",
        label: "Ready for checkout approval",
        status: "complete",
        detail: "Prices locked to catalog · no auto-charge",
      },
    ],
  };
}

export async function runAgent(prompt: string): Promise<AgentResult> {
  const started = performance.now();
  const requirements = await extractRequirements(prompt);
  const outcome = searchCatalog(requirements);
  const recommendation = recommend(requirements, outcome.results, outcome.bundles);
  const elapsed = Math.round(performance.now() - started);

  return {
    requirements,
    results: outcome.results,
    bundles: outcome.bundles,
    recommendation,
    meta: buildMeta(requirements, outcome, elapsed),
  };
}

export function refineAgent(requirements: Requirements, removed: string[]): AgentResult {
  const started = performance.now();
  const refined = applyRemovals(requirements, removed);
  const outcome = searchCatalog(refined);
  const recommendation = recommend(refined, outcome.results, outcome.bundles);
  const elapsed = Math.round(performance.now() - started);

  return {
    requirements: refined,
    results: outcome.results,
    bundles: outcome.bundles,
    recommendation,
    meta: buildMeta(refined, outcome, elapsed),
  };
}

export function rerunWithRequirements(requirements: Requirements): AgentResult {
  const started = performance.now();
  const outcome = searchCatalog(requirements);
  const recommendation = recommend(requirements, outcome.results, outcome.bundles);
  const elapsed = Math.round(performance.now() - started);
  return {
    requirements,
    results: outcome.results,
    bundles: outcome.bundles,
    recommendation,
    meta: buildMeta(requirements, outcome, elapsed),
  };
}
