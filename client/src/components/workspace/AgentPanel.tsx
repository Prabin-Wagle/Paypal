import { useEffect, useRef } from "react";
import {
  ArrowUp,
  Check,
  CheckCircle2,
  CircleAlert,
  Info,
  Sparkles,
} from "lucide-react";
import type { ChatMessage, PipelineStep } from "../../lib/types";

const STEP_LABELS = [
  "Extracting requirements",
  "Filtering verified catalog",
  "Evaluating trade-offs",
  "Ready for checkout approval",
];

interface QuickAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface AgentPanelProps {
  messages: ChatMessage[];
  pipeline: PipelineStep[] | null;
  activeStep: number;
  loading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  quickActions: QuickAction[];
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

function BulletIcon({ tone }: { tone?: "emerald" | "amber" | "neutral" }) {
  if (tone === "amber") return <CircleAlert size={11} strokeWidth={2} />;
  if (tone === "neutral") return <Info size={11} strokeWidth={2} />;
  return <CheckCircle2 size={11} strokeWidth={2} />;
}

export function AgentPanel({
  messages,
  pipeline,
  activeStep,
  loading,
  input,
  onInputChange,
  onSubmit,
  quickActions,
  inputRef,
}: AgentPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    if (!loading && messages.length > 1) {
      const replies = element.querySelectorAll<HTMLElement>(".chat-message.agent");
      const latest = replies[replies.length - 1];
      const prompts = element.querySelectorAll<HTMLElement>(".chat-message.user");
      const lastPrompt = prompts[prompts.length - 1];

      if (latest) {
        // A long answer starts above the fold if we pin its tail. Anchor the
        // turn at the prompt so the headline and first bullets are readable.
        const hasFitList = Boolean(latest.querySelector(".agent-bullets"));
        const anchor = hasFitList && lastPrompt ? lastPrompt : latest;
        const offset =
          element.scrollTop +
          anchor.getBoundingClientRect().top -
          element.getBoundingClientRect().top -
          10;
        element.scrollTop = Math.max(0, offset);
        console.log(
          `chat-fx anchor loading=${loading} count=${messages.length} latest="${latest.innerText.slice(0, 28)}" prompt="${lastPrompt?.innerText.slice(0, 22)}" scroll=${element.scrollTop}`,
        );
        return;
      }
    }

    element.scrollTo({ top: element.scrollHeight, behavior: "auto" });
    console.log(`chat-fx bottom loading=${loading} count=${messages.length} scroll=${element.scrollTop}`);
  }, [messages, loading]);

  const stepState = (index: number) => {
    if (pipeline) return "done";
    if (loading) {
      if (index < activeStep) return "done";
      if (index === activeStep) return "active";
    }
    return "pending";
  };

  return (
    <aside className="agent-panel" aria-label="Shopping agent console">
      <div className="panel-head">
        <div className="panel-head-title">
          <Sparkles size={14} strokeWidth={1.8} />
          Agent console
        </div>
        <span className="panel-head-status">
          <i className="live-dot" />
          grounded
        </span>
      </div>

      <div className="pipeline" aria-label="Agent pipeline status">
        <div className="pipeline-head">
          <span>Agent pipeline</span>
          <span>{pipeline ? `${pipeline.length}/4 complete` : loading ? "running" : "idle"}</span>
        </div>
        {STEP_LABELS.map((label, index) => {
          const state = stepState(index);
          const detail = pipeline?.[index]?.detail;
          return (
            <div className="pipeline-step" data-state={state} key={label}>
              <span className="step-marker">
                {state === "done" ? <Check size={9} strokeWidth={2.6} /> : index + 1}
              </span>
              <span className="step-label">{label}</span>
              <span className="step-time">{state === "done" ? "ok" : state === "active" ? "…" : ""}</span>
              {detail ? <span className="step-detail">{detail}</span> : null}
            </div>
          );
        })}
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-day">today · sandbox session</div>

        {messages.map((message) =>
          message.role === "user" ? (
            <div className="chat-message user" key={message.id}>
              {message.text}
            </div>
          ) : (
            <div className="chat-message agent" key={message.id}>
              <div className="agent-label">
                <i />
                ShopMate
              </div>
              {message.text ? <div className="agent-text">{message.text}</div> : null}
              {message.bullets?.length ? (
                <div className="agent-bullets">
                  {message.bullets.map((bullet, index) => (
                    <div
                      className="agent-bullet"
                      data-tone={bullet.tone ?? "emerald"}
                      key={`${message.id}-${index}`}
                    >
                      <BulletIcon tone={bullet.tone} />
                      <span>
                        <strong>{bullet.label}</strong> {bullet.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {message.meta ? <div className="agent-meta">{message.meta}</div> : null}
            </div>
          ),
        )}

        {loading ? (
          <div className="chat-message agent">
            <div className="agent-label">
              <i />
              ShopMate
            </div>
            <div className="typing" aria-label="Agent is working">
              <i />
              <i />
              <i />
            </div>
          </div>
        ) : null}
      </div>

      <div className="chat-input-area">
        <div className="quick-chips">
          {quickActions.map((action) => (
            <button
              type="button"
              className="quick-chip"
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled || loading}
            >
              {action.label}
            </button>
          ))}
        </div>
        <form
          className="chat-input-row"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            placeholder="Describe what you need, the budget, and the trade-offs that matter…"
            aria-label="Message the shopping agent"
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
          <button
            type="submit"
            className="send-btn"
            aria-label="Send request"
            disabled={loading || input.trim().length === 0}
          >
            <ArrowUp size={14} strokeWidth={2.2} />
          </button>
        </form>
        <div className="input-foot">
          <span>enter to send · shift + enter for a line</span>
          <span>prices stay server-side</span>
        </div>
      </div>
    </aside>
  );
}
