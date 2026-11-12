import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Headphones,
  Laptop,
  Layers,
  LayoutGrid,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Table2,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { CartSummaryBar } from "../components/cart/CartSummaryBar";
import { AgentPanel } from "../components/workspace/AgentPanel";
import { ProductCard } from "../components/workspace/ProductCard";
import { RequirementPills } from "../components/workspace/RequirementPills";
import { SpecTable } from "../components/workspace/SpecTable";
import { useCart } from "../context/CartContext";
import { api, ApiError } from "../lib/api";
import { BUNDLE_PROMPT, DEMO_PROMPTS, promptFromUrl } from "../lib/demo";
import { categoryLabel, money, shortId } from "../lib/format";
import type {
  AgentResult,
  AppConfig,
  BundleOption,
  ChatMessage,
  Match,
  PipelineStep,
  Recommendation,
  Requirements,
} from "../lib/types";

const PROMPT_ICONS = {
  laptop: Laptop,
  headphones: Headphones,
  smartphone: Smartphone,
  bundle: Layers,
} as const;

const CONSTRAINT_LABELS: Record<string, string> = {
  category: "category",
  budget_max: "max budget",
  min_ram_gb: "RAM minimum",
  min_storage_gb: "storage minimum",
  min_battery_hours: "battery minimum",
  max_weight_kg: "weight limit",
  wireless: "wireless requirement",
  anc: "ANC requirement",
  min_comfort_rating: "comfort minimum",
  min_camera_mp: "camera minimum",
  use_case: "use case",
  priorities: "priorities",
};

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function greeting(): ChatMessage {
  return {
    id: "m0",
    role: "agent",
    text: "I only recommend from a verified catalog. Tell me the job, a budget, and the trade-offs you will accept. I will show the honest costs before checkout.",
    bullets: [
      {
        label: "24 SKUs.",
        text: "Laptops, headphones and smartphones — every price read server-side.",
      },
      {
        label: "No invented stock.",
        text: "If the catalog cannot prove it, I will not claim it.",
      },
      {
        label: "You approve.",
        text: "PayPal capture waits for your explicit click.",
      },
    ],
    meta: "deterministic fallback ready · optional LLM extraction",
  };
}

function cloneRequirements(source: Requirements): Requirements {
  return {
    ...source,
    hard_filters: { ...source.hard_filters },
    priorities: [...source.priorities],
    bundle_categories: [...source.bundle_categories],
  };
}

function resultMessage(result: AgentResult, id: string): ChatMessage {
  const recommendation = result.recommendation;
  const meta = `${result.meta.catalog_size} SKUs scanned · ${result.meta.strict_matches} strict · ${result.meta.elapsed_ms} ms${
    result.meta.stretch_applied ? " · +15% stretch lane" : ""
  }`;

  if (!recommendation) {
    return {
      id,
      role: "agent",
      text: "No verified product clears all of those constraints. I will not invent one to fill the gap. Remove a pill or widen the budget and I will search the labelled stretch lane.",
      bullets: [
        {
          label: "Nothing charged.",
          text: "The catalog filter returned zero candidates.",
          tone: "amber",
        },
      ],
      meta,
    };
  }

  const bullets: NonNullable<ChatMessage["bullets"]> = recommendation.why
    .slice(0, 3)
    .map((item) => ({
      label: `${item.label}:`,
      text: item.detail,
      tone: "emerald" as const,
    }));

  if (recommendation.compromises[0]) {
    bullets.push({
      label: "Honest cost:",
      text: recommendation.compromises[0].detail,
      tone: "amber" as const,
    });
  }

  return {
    id,
    role: "agent",
    text: `${recommendation.headline} ${recommendation.summary}`,
    bullets,
    meta,
  };
}

interface BundlePanelProps {
  bundle: BundleOption;
  bundles: BundleOption[];
  recommendation: Recommendation | null;
  selected: Record<string, Match>;
  onAdd: (bundle: BundleOption) => void;
  onSelect: (id: string) => void;
}

function BundlePanel({
  bundle,
  bundles,
  recommendation,
  selected,
  onAdd,
  onSelect,
}: BundlePanelProps) {
  const isRecommended =
    recommendation?.kind === "bundle" && recommendation.bundle_id === bundle.id;
  const copy = isRecommended ? recommendation : null;
  const inCart = bundle.items.every((item) => Boolean(selected[item.id]));

  return (
    <div className="reco-bundle">
      <div className="reco-bundle-head">
        <span className="reco-bundle-badge">
          <Layers size={10} strokeWidth={1.8} />
          {bundle.is_stretch_option
            ? "Stretch bundle · +15% lane"
            : "Strict bundle · inside the cap"}
        </span>
        <span className="result-count">
          {bundle.items.length} SKUs · {bundle.score.toFixed(1)} fit score
        </span>
      </div>

      <div className="reco-bundle-body">
        <div className="bundle-items">
          {bundle.items.map((item) => (
            <div className="bundle-item" key={item.id}>
              <img src={item.image_url} alt={item.name} loading="lazy" />
              <div>
                <div className="bundle-item-name">{item.name}</div>
                <div className="bundle-item-meta">
                  {item.brand} · {item.sku}
                </div>
              </div>
              <span className="bundle-item-price">{money(item.price_usd)}</span>
            </div>
          ))}

          <div className="bundle-total">
            <div>
              <div className="bundle-total-label">Bundle total · USD</div>
              <div className="bundle-total-value">{money(bundle.total)}</div>
              {bundle.remaining !== null && bundle.remaining >= 0 ? (
                <div className="bundle-total-remaining">
                  {money(bundle.remaining)} under your {money(bundle.budget_max ?? 0)} cap
                </div>
              ) : bundle.remaining !== null ? (
                <div className="bundle-total-remaining" style={{ color: "var(--color-amber)" }}>
                  {money(Math.abs(bundle.remaining))} over your {money(bundle.budget_max ?? 0)} cap
                </div>
              ) : (
                <div
                  className="bundle-total-remaining"
                  style={{ color: "var(--color-slate)" }}
                >
                  No total cap set
                </div>
              )}
            </div>

            <button
              type="button"
              className={`btn btn-sm ${inCart ? "btn-ghost" : "btn-paypal"}`}
              onClick={() => onAdd(bundle)}
              disabled={inCart}
              aria-pressed={inCart}
            >
              {inCart ? (
                <>
                  <Check size={12} strokeWidth={2.2} /> Both in cart
                </>
              ) : (
                <>
                  <ShoppingBag size={12} strokeWidth={1.9} /> Add both
                </>
              )}
            </button>
          </div>
        </div>

        <div className="reco-bundle-copy">
          <h3>
            {copy?.headline ??
              `${bundle.items.map((item) => item.name).join(" + ")} totals ${money(bundle.total)}.`}
          </h3>
          <p>
            {copy?.summary ??
              `Every line is read from the verified catalog. ${
                bundle.remaining !== null && bundle.remaining >= 0
                  ? `${money(bundle.remaining)} remains under the total cap.`
                  : "This is the closest complete alternative in the filtered lane."
              }`}
          </p>

          {copy?.why.length ? (
            <ul className="fit-list" style={{ marginTop: 12 }}>
              {copy.why.slice(0, 3).map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <Check className="check" size={10} strokeWidth={2.3} />
                  <span>
                    <strong>{item.label}:</strong> {item.detail}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="bundle-alternatives">
            {bundles.slice(0, 2).map((alternative) => (
              <button
                type="button"
                className="bundle-alt"
                data-selected={alternative.id === bundle.id}
                key={alternative.id}
                onClick={() => onSelect(alternative.id)}
              >
                <span className="bundle-alt-top">
                  <span>{alternative.is_stretch_option ? "Stretch lane" : "Inside cap"}</span>
                  <span>{money(alternative.total)}</span>
                </span>
                <strong>{alternative.items.map((item) => item.name).join(" + ")}</strong>
                <span>
                  {alternative.remaining !== null && alternative.remaining >= 0
                    ? `${money(alternative.remaining)} left`
                    : alternative.remaining !== null
                      ? `${money(Math.abs(alternative.remaining))} over`
                      : "No cap"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EmptyCanvasProps {
  config: AppConfig | null;
  configError: boolean;
  onPrompt: (prompt: string) => void;
}

function EmptyCanvas({ config, configError, onPrompt }: EmptyCanvasProps) {
  return (
    <div className="canvas-empty">
      <div className="canvas-empty-inner">
        <span className="eyebrow">
          <Sparkles size={12} strokeWidth={1.8} />
          Decision canvas
        </span>
        <h2>
          Tell the agent the job.
          <br />
          <span>Watch it show the trade-offs.</span>
        </h2>
        <p>
          Start with a messy brief. ShopMate turns it into typed constraints, filters a verified
          catalog of {config?.catalog.products ?? 24} SKUs, and shows the honest compromises before
          checkout.
        </p>

        {configError ? (
          <div className="checkout-error" style={{ maxWidth: 520, marginTop: 16 }}>
            <TriangleAlert size={10} style={{ display: "inline", marginRight: 4 }} />
            The API is offline. Start the Express server with <code>npm run dev</code> and refresh.
          </div>
        ) : null}

        <div className="empty-prompts">
          {DEMO_PROMPTS.map((item) => {
            const Icon = PROMPT_ICONS[item.icon];
            return (
              <button
                type="button"
                className="empty-prompt"
                key={item.id}
                onClick={() => onPrompt(item.prompt)}
              >
                <span className="empty-prompt-top">
                  <Icon size={14} strokeWidth={1.7} />
                  <span>{item.badge ?? "verified brief"}</span>
                </span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </button>
            );
          })}
        </div>

        <div className="empty-audit">
          <span>
            <ShieldCheck size={10} strokeWidth={2} /> {config?.catalog.products ?? 24} verified SKUs
          </span>
          <span>
            <Check size={10} strokeWidth={2.2} /> Prices recomputed on server
          </span>
          <span>
            <UserCheck size={10} strokeWidth={2} /> Capture needs your approval
          </span>
        </div>
      </div>
    </div>
  );
}

function LoadingCanvas() {
  return (
    <div className="canvas-empty">
      <div className="canvas-empty-inner">
        <span className="eyebrow">
          <i className="live-dot" />
          Agent working
        </span>
        <h2>
          Reading the brief.
          <br />
          <span>Filtering the verified catalog.</span>
        </h2>
        <p>
          The model is extracting typed constraints. It cannot write a price, invent stock or reach
          the checkout.
        </p>
        <div className="typing" style={{ marginTop: 20 }} aria-label="Agent is filtering">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

interface NoResultsProps {
  result: AgentResult;
  onWidenBudget: () => void;
  onRemoveBudget: () => void;
  onReset: () => void;
}

function NoResults({ result, onWidenBudget, onRemoveBudget, onReset }: NoResultsProps) {
  const hasBudget = result.requirements.budget_max !== null;

  return (
    <div className="canvas-empty" style={{ minHeight: 380 }}>
      <div className="canvas-empty-inner">
        <span className="eyebrow">
          <CircleAlert size={12} strokeWidth={1.9} />
          No verified match
        </span>
        <h2>Nothing in the catalog clears every constraint.</h2>
        <p>
          I will not invent a product to fill the gap. Remove a pill above, widen the budget, or
          start a different brief.
        </p>

        <div className="hero-actions" style={{ marginTop: 20 }}>
          {hasBudget ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={onWidenBudget}>
              Widen budget +15%
            </button>
          ) : null}
          {hasBudget ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRemoveBudget}>
              Remove budget
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
            Start over
          </button>
        </div>

        <div className="empty-audit">
          <span>
            <ShieldCheck size={10} strokeWidth={2} /> {result.meta.strict_matches} strict matches
          </span>
          <span>
            <Sparkles size={10} strokeWidth={2} />{" "}
            {result.meta.stretch_applied ? "Stretch lane opened" : "No stretch lane"}
          </span>
          <span>
            <CircleAlert size={10} strokeWidth={2} /> No invented products
          </span>
        </div>
      </div>
    </div>
  );
}

export function Workspace() {
  const navigate = useNavigate();
  const {
    items: selected,
    sessionId,
    toggle: toggleProduct,
    addBundle,
    clear: clearCart,
  } = useCart();

  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greeting()]);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[] | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const stepTimer = useRef<number | null>(null);
  const messageCounter = useRef(0);
  const autoRan = useRef(false);
  const busyRef = useRef(false);

  const nextId = () => {
    messageCounter.current += 1;
    return `m${messageCounter.current}`;
  };

  const stopTimer = () => {
    if (stepTimer.current !== null) {
      window.clearInterval(stepTimer.current);
      stepTimer.current = null;
    }
  };

  const startPipeline = () => {
    stopTimer();
    setPipeline(null);
    setActiveStep(0);
    stepTimer.current = window.setInterval(() => {
      setActiveStep((step) => Math.min(step + 1, 3));
    }, 340);
  };

  const finishPipeline = (steps: PipelineStep[]) => {
    stopTimer();
    setActiveStep(4);
    setPipeline(steps);
  };

  const beginRequest = () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setLoading(true);
    return true;
  };

  const endRequest = () => {
    busyRef.current = false;
    setLoading(false);
    stopTimer();
  };

  const pushMessage = (message: ChatMessage) => {
    setMessages((current) => [...current, message]);
  };

  const pushAgentResult = (data: AgentResult) => {
    pushMessage(resultMessage(data, nextId()));
  };

  const pushFailure = (cause: unknown) => {
    const message =
      cause instanceof ApiError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : "The request failed.";
    pushMessage({
      id: nextId(),
      role: "agent",
      text: `I could not finish that request. ${message}`,
      bullets: [
        {
          label: "Nothing charged.",
          text: "No order was created and no price left the server.",
          tone: "amber",
        },
      ],
      meta: "request failed · cart untouched",
    });
  };

  const applyResult = (data: AgentResult, resetView: boolean) => {
    setResult(data);
    setActiveBundleId(null);
    if (resetView || data.results.length < 2) setView("cards");
    finishPipeline(data.meta.steps);
    pushAgentResult(data);
    window.requestAnimationFrame(() => {
      canvasScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const submitPrompt = async (raw: string) => {
    const prompt = raw.trim();
    if (!prompt || !beginRequest()) return;

    setInput("");
    startPipeline();
    pushMessage({ id: nextId(), role: "user", text: prompt });

    try {
      const [data] = await Promise.all([api.query(prompt), delay(1050)]);
      applyResult(data, true);
    } catch (cause) {
      pushFailure(cause);
    } finally {
      endRequest();
    }
  };

  const runRequirements = async (requirements: Requirements, userText: string) => {
    if (!beginRequest()) return;

    setInput("");
    startPipeline();
    pushMessage({ id: nextId(), role: "user", text: userText });

    try {
      const [data] = await Promise.all([api.search(requirements), delay(850)]);
      applyResult(data, false);
    } catch (cause) {
      pushFailure(cause);
    } finally {
      endRequest();
    }
  };

  const refineConstraint = async (key: string) => {
    if (!result || !beginRequest()) return;

    const label = CONSTRAINT_LABELS[key] ?? key;
    setInput("");
    startPipeline();
    pushMessage({
      id: nextId(),
      role: "user",
      text: `Remove the ${label} constraint and re-filter the verified catalog.`,
    });

    try {
      const [data] = await Promise.all([api.refine(result.requirements, [key]), delay(800)]);
      applyResult(data, false);
    } catch (cause) {
      pushFailure(cause);
    } finally {
      endRequest();
    }
  };

  const reset = () => {
    if (busyRef.current) return;
    setMessages([greeting()]);
    setResult(null);
    setPipeline(null);
    setActiveStep(0);
    clearCart();
    setInput("");
    setView("cards");
    setActiveBundleId(null);
    autoRan.current = true;
    navigate("/app", { replace: true });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const runBundleDemo = () => {
    void submitPrompt(BUNDLE_PROMPT);
  };

  const cheaper = () => {
    if (!result) return;
    const next = cloneRequirements(result.requirements);
    if (next.budget_max !== null) {
      const reduced = Math.max(10, Math.round((next.budget_max * 0.9) / 5) * 5);
      next.budget_max = reduced;
      next.budget_was_explicit = true;
      void runRequirements(next, `Tighten the cap to ${money(reduced)} and re-rank.`);
      return;
    }
    if (!next.priorities.includes("value")) {
      next.priorities = [...next.priorities, "value"].slice(0, 5);
    }
    void runRequirements(next, "Put value first and re-rank the verified catalog.");
  };

  const lightest = () => {
    if (!result) return;
    const next = cloneRequirements(result.requirements);
    if (!next.priorities.includes("weight")) {
      next.priorities = [...next.priorities, "weight"].slice(0, 5);
    }
    void runRequirements(next, "Put weight first and re-rank the verified catalog.");
  };

  const loosenBudget = () => {
    if (!result) return;
    const next = cloneRequirements(result.requirements);
    if (next.budget_max === null) {
      reset();
      return;
    }
    const widened = Math.round(next.budget_max * 1.15);
    next.budget_max = widened;
    next.budget_was_explicit = true;
    void runRequirements(next, `Widen the cap by 15% to ${money(widened)} and re-rank.`);
  };

  const recommendation = result?.recommendation ?? null;

  const bestMatch = useMemo(() => {
    if (!result || result.recommendation?.kind === "bundle") return null;
    const productId = result.recommendation?.product_id;
    return result.results.find((product) => product.id === productId) ?? result.results[0] ?? null;
  }, [result]);

  const activeBundle = useMemo(() => {
    if (!result || result.bundles.length === 0) return null;
    return (
      result.bundles.find((bundle) => bundle.id === activeBundleId) ??
      result.bundles.find((bundle) => bundle.id === result.recommendation?.bundle_id) ??
      result.bundles[0]
    );
  }, [result, activeBundleId]);

  const alsoVerified = useMemo(() => {
    if (!result) return [];
    const excluded = new Set<string>();
    if (bestMatch) excluded.add(bestMatch.id);
    if (activeBundle) {
      for (const item of activeBundle.items) excluded.add(item.id);
    }
    return result.results.filter((product) => !excluded.has(product.id)).slice(0, 6);
  }, [result, bestMatch, activeBundle]);

  const hasResults = Boolean(result && (result.results.length > 0 || result.bundles.length > 0));

  const quickActions = result
    ? [
        { label: "Cheaper", onClick: cheaper },
        { label: "Lightest", onClick: lightest },
        { label: "Bundle demo", onClick: runBundleDemo },
        {
          label: view === "cards" ? "Compare table" : "Card view",
          onClick: () => setView(view === "cards" ? "table" : "cards"),
          disabled: result.results.length < 2,
        },
        { label: "Start over", onClick: reset },
      ]
    : DEMO_PROMPTS.map((item) => ({
        label: item.title,
        onClick: () => void submitPrompt(item.prompt),
      }));

  useEffect(() => {
    let alive = true;
    api
      .config()
      .then((loaded) => {
        if (!alive) return;
        setConfig(loaded);
        setConfigError(false);
      })
      .catch(() => {
        if (alive) setConfigError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const prompt = promptFromUrl(window.location.search);
    if (prompt) void submitPrompt(prompt);
    // The first-render submitPrompt only reads refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = "ShopMate AI — Decision canvas";
    return () => {
      document.title = "ShopMate AI — the shopping agent that cannot charge you";
    };
  }, []);

  useEffect(
    () => () => {
      if (stepTimer.current !== null) window.clearInterval(stepTimer.current);
    },
    [],
  );

  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <div className="workspace-header-left">
          <Link to="/" aria-label="ShopMate AI home">
            <Brand compact />
          </Link>
          <span className="workspace-crumb">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <b>Decision canvas</b>
          </span>
        </div>

        <div className="workspace-header-right">
          <span className="pill pill-emerald hide-mobile">
            <ShieldCheck size={9} strokeWidth={2} />
            {config ? `${config.catalog.products} verified SKUs` : "verified catalog"}
          </span>
          <span className="pill hide-mobile">session {shortId(sessionId, 8, 4)}</span>
          {configError ? (
            <span className="pill pill-amber">
              <TriangleAlert size={9} strokeWidth={2} />
              API offline
            </span>
          ) : null}
          <Link className="btn btn-ghost btn-sm" to="/">
            <ArrowLeft size={13} strokeWidth={2} />
            Overview
          </Link>
          <Link className="btn btn-ghost btn-sm workspace-live-link" to="/discover">
            <Sparkles size={12} strokeWidth={1.9} />
            Live products
          </Link>
        </div>
      </header>

      <div className="workspace-body">
        <AgentPanel
          messages={messages}
          pipeline={pipeline}
          activeStep={activeStep}
          loading={loading}
          input={input}
          onInputChange={(value) => setInput(value)}
          onSubmit={() => void submitPrompt(input)}
          quickActions={quickActions}
          inputRef={inputRef}
        />

        <section className="canvas-panel" aria-label="Decision canvas">
          <div className="canvas-toolbar">
            <div className="canvas-title">
              Decision canvas
              {result ? (
                <span className="pill">{categoryLabel(result.requirements.category)}</span>
              ) : null}
              {result ? (
                <span className="pill pill-emerald">
                  <ShieldCheck size={9} strokeWidth={2} />
                  grounded
                </span>
              ) : null}
            </div>

            <div className="canvas-toolbar-right">
              {result ? (
                <>
                  <span className="result-count">
                    {result.results.length} verified · {result.meta.catalog_size} scanned
                  </span>
                  <div className="view-toggle" role="group" aria-label="Result view">
                    <button
                      type="button"
                      data-active={view === "cards"}
                      aria-pressed={view === "cards"}
                      onClick={() => setView("cards")}
                      disabled={!hasResults}
                    >
                      <LayoutGrid size={11} strokeWidth={1.8} />
                      <span>Cards</span>
                    </button>
                    <button
                      type="button"
                      data-active={view === "table"}
                      aria-pressed={view === "table"}
                      onClick={() => setView("table")}
                      disabled={result.results.length < 2}
                    >
                      <Table2 size={11} strokeWidth={1.8} />
                      <span>Table</span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="canvas-scroll" ref={canvasScrollRef}>
            {!result ? (
              loading ? (
                <LoadingCanvas />
              ) : (
                <EmptyCanvas
                  config={config}
                  configError={configError}
                  onPrompt={(prompt) => void submitPrompt(prompt)}
                />
              )
            ) : (
              <>
                <RequirementPills
                  requirements={result.requirements}
                  onRemove={(key) => void refineConstraint(key)}
                  onAdd={() => inputRef.current?.focus()}
                  disabled={loading}
                  stretch={{
                    applied: result.meta.stretch_applied,
                    relaxedBudget: result.meta.relaxed_budget,
                  }}
                />

                {!hasResults ? (
                  <NoResults
                    result={result}
                    onWidenBudget={loosenBudget}
                    onRemoveBudget={() => void refineConstraint("budget_max")}
                    onReset={reset}
                  />
                ) : view === "table" ? (
                  <div className="canvas-content">
                    <div className="canvas-section-title">
                      Side-by-side · top {Math.min(3, result.results.length)}
                    </div>
                    <SpecTable
                      products={result.results}
                      selected={selected}
                      onToggle={toggleProduct}
                    />
                    <p className="reco-note">
                      Winners are computed from the catalog record. The checkout re-prices every
                      line on the server before capture.
                    </p>
                  </div>
                ) : (
                  <div className="canvas-content">
                    {activeBundle ? (
                      <>
                        <div className="canvas-section-title">
                          Recommended bundle · verified pieces
                        </div>
                        <BundlePanel
                          bundle={activeBundle}
                          bundles={result.bundles}
                          recommendation={recommendation}
                          selected={selected}
                          onAdd={addBundle}
                          onSelect={setActiveBundleId}
                        />
                      </>
                    ) : null}

                    {bestMatch ? (
                      <section
                        style={{ marginTop: activeBundle ? 20 : 0 }}
                        aria-label="Best match"
                      >
                        <div className="canvas-section-title">
                          Best match · closest verified fit
                        </div>
                        <ProductCard
                          product={bestMatch}
                          selected={Boolean(selected[bestMatch.id])}
                          onToggle={toggleProduct}
                          variant="best"
                        />
                        {recommendation?.runner_up_note ? (
                          <p className="reco-note">{recommendation.runner_up_note}</p>
                        ) : null}
                      </section>
                    ) : null}

                    {alsoVerified.length > 0 ? (
                      <section style={{ marginTop: 20 }} aria-label="Also verified">
                        <div className="canvas-section-title">
                          Also verified · {alsoVerified.length} alternatives
                        </div>
                        <div className="also-grid">
                          {alsoVerified.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              selected={Boolean(selected[product.id])}
                              onToggle={toggleProduct}
                            />
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>

          <CartSummaryBar />
        </section>
      </div>
    </div>
  );
}
