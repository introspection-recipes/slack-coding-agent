const DEFAULT_MAX_CONTINUATIONS = 12;
const TERMINAL_STATES = new Set(["done", "blocked", "awaiting_user"]);

function result(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    details: value,
  };
}

function maxContinuations() {
  const configured = Number.parseInt(process.env.RALPH_MAX_CONTINUATIONS ?? "", 10);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_CONTINUATIONS;
}

function lastAssistantStopReason(messages) {
  return [...messages].reverse().find((message) => message.role === "assistant")
    ?.stopReason;
}

export default function registerRalphLoop(pi) {
  const ceiling = maxContinuations();
  let cycle = 0;
  let continuations = 0;
  let report = null;
  let finalReportRequested = false;

  pi.registerTool({
    name: "ralph_status",
    label: "Report Ralph loop status",
    description:
      "Required end-of-cycle checkpoint. Report continue while work remains, done only after the requested outcome is complete, awaiting_user for a needed decision, or blocked for an evidenced external blocker.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["state", "summary"],
      properties: {
        state: {
          type: "string",
          enum: ["continue", "done", "awaiting_user", "blocked"],
        },
        summary: {
          type: "string",
          minLength: 1,
          description: "Concise, factual progress or terminal outcome.",
        },
        next_step: {
          type: "string",
          description: "Required when state is continue; the next concrete action.",
        },
      },
    },
    async execute(_id, input) {
      const state = String(input.state);
      const summary = String(input.summary ?? "").trim();
      const nextStep = String(input.next_step ?? "").trim();

      if (!summary) throw new Error("summary must not be empty");
      if (state === "continue" && !nextStep) {
        throw new Error("next_step is required when state is continue");
      }

      report = {
        cycle,
        state,
        summary,
        nextStep: nextStep || null,
      };

      return result({
        accepted: true,
        state,
        continuation: state === "continue",
        remaining_continuations: Math.max(ceiling - continuations, 0),
      });
    },
  });

  pi.on("before_agent_start", () => {
    cycle += 1;
  });

  pi.on("agent_end", (event) => {
    if (finalReportRequested) return;

    const stopReason = lastAssistantStopReason(event.messages);
    if (stopReason === "error" || stopReason === "aborted") return;

    const currentReport = report?.cycle === cycle ? report : null;
    if (currentReport && TERMINAL_STATES.has(currentReport.state)) return;

    if (continuations >= ceiling) {
      finalReportRequested = true;
      pi.sendUserMessage(
        "[RALPH SAFETY CEILING] The automatic continuation limit has been reached. Take no new implementation actions. Report the current result or blocker in Slack, call ralph_status with done, blocked, or awaiting_user, and give the user a concise final response.",
        { deliverAs: "followUp" },
      );
      return;
    }

    continuations += 1;
    const context = currentReport
      ? `Progress: ${currentReport.summary}\nNext step: ${currentReport.nextStep}`
      : "No ralph_status checkpoint was recorded for the preceding cycle. Reassess the task before continuing.";

    pi.sendUserMessage(
      `[RALPH CONTINUATION ${continuations}/${ceiling}] The task is still active. Continue working rather than summarizing prematurely.\n${context}`,
      { deliverAs: "followUp" },
    );
  });
}
