/**
 * Structured JSON logging with a run_id (CLAUDE.md section 6). Every pipeline and worker run writes
 * one summary line; this is the small local version until workers/ exists and a shared logger
 * package gets its own ADR.
 */

export interface Logger {
  readonly run_id: string;
  info(event: Record<string, unknown>): void;
}

export function jsonLogger(
  run_id: string,
  write: (line: string) => void = (line) => process.stderr.write(line),
): Logger {
  return {
    run_id,
    info(event) {
      write(`${JSON.stringify({ run_id, ...event })}\n`);
    },
  };
}

export function silentLogger(run_id = "test"): Logger {
  return { run_id, info: () => undefined };
}
