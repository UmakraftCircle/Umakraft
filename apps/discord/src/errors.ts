import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ErrorMessages');

/**
 * Classify a thrown error from `/ask` / `/agent` / `/chat` into a safe,
 * in-character, human-readable Discord reply. Never echo secrets, keys, or raw stack traces.
 *
 * Persona: Calm, reserved, dependable Umamusume assistant dedicated to her Trainer.
 * Soft, polite, composed, subtly warm, framing difficulties through athletic
 * training and track preparation.
 */
export function failureMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  // Missing / invalid AI credentials (blocking/config)
  if (/no api key|api key configured|requires at least one api key|invalid.*(api key|token)/i.test(msg)) {
    return "Trainer, I apologize, but my connection to the training track is currently unavailable.\n\nPlease have a server admin configure `GROQ_API_KEY` (or `OPENAI_API_KEY`) so we may resume our sessions.";
  }

  // Missing / invalid Turso database config (blocking/config)
  if (/turso/i.test(msg)) {
    return "Trainer, our training logs seem temporarily inaccessible.\n\nPlease have a server admin check the `TURSO_URL` and `TURSO_AUTH_TOKEN` settings so I can review our past notes.";
  }

  // Tool-call configuration mismatch (blocking/config)
  if (/tool_use_failed|tool choice is none|json_validate_failed|model called a tool/i.test(msg)) {
    return "Trainer, I encountered an unexpected obstacle during my routine.\n\nThis appears to be a setup issue on the track. Please have a server admin review my model and tool configuration.";
  }

  // 401 / 403 — invalid or expired key (blocking/config)
  if (/(401|403|unauthorized|invalid api)/i.test(msg)) {
    return "Trainer, gate clearance was declined by the officials.\n\nPlease have a server admin verify that `GROQ_API_KEY` remains active and valid.";
  }

  // model_not_found — deprecated / renamed model (blocking/config)
  if (/model_not_found|does not exist|unknown model|invalid model/i.test(msg)) {
    return "Trainer, the assigned training regimen model is no longer recognized on the track.\n\nPlease have a server admin update `GROQ_MODEL` to an active model.";
  }

  // 429 rate-limit (transient)
  if (/429|rate.?limit|too many requests/i.test(msg)) {
    return "Trainer, my breath is a little uneven from sprinting just now. Please give me a quiet moment to recover my pace, and then ask again.";
  }

  // Timeouts (transient)
  if (/timed out|timeout/gi.test(lower)) {
    return "Trainer, I lost my stride during that lap and could not complete the stretch in time. Please try asking again shortly; I will stay focused.";
  }

  // Tool not found / not registered (blocking/config)
  if (/tool not found|no tool registered/i.test(msg)) {
    return "Trainer, the gear needed for this routine was not found in my locker. Please have a server admin verify the tool registry.";
  }

  // Code bugs (ReferenceError / TypeError / etc.) — log LOUDLY with stack, but
  // keep the user-facing message generic so no internals leak.
  if (err instanceof ReferenceError || err instanceof TypeError) {
    logger.error(
      `Code bug in /ask: ${err.name}: ${err.message}\n${err.stack ?? 'no stack'}`
    );
    return "Trainer, I stumbled unexpectedly during that drill. Please allow me a brief moment to steady myself and try again.";
  }

  // Fallback: keep it generic to avoid leaking internals, but log the real error.
  logger.error(`Unclassified error: ${msg}`);
  return "Trainer, something unexpected threw off my pace. Please ask once more, and if it continues, let an admin know so they may inspect the grounds.";
}
