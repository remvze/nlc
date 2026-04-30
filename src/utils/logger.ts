import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import chalk from "chalk";

type ToolFinishPayload = {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
};

type LogEvent = {
  timestamp: string;
  level: "info" | "success" | "warn" | "error" | "tool_start" | "tool_end";
  message: string;
  meta?: Record<string, unknown>;
};

function nowClock() {
  return new Date().toLocaleTimeString([], { hour12: false });
}

function shortJson(input: Record<string, unknown> | undefined) {
  if (!input) return "";
  const serialized = JSON.stringify(input);
  return serialized.length > 220
    ? `${serialized.slice(0, 217).trimEnd()}...`
    : serialized;
}

export class CliLogger {
  private readonly startedAt = Date.now();
  private readonly logPath: string | null;

  constructor(mode: "chat" | "do") {
    const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const logsDir = path.join(os.homedir(), ".nlc", "logs");
    let resolvedPath: string | null = null;

    try {
      fs.mkdirSync(logsDir, { recursive: true });
      resolvedPath = path.join(logsDir, `${mode}-${sessionId}.jsonl`);
      fs.writeFileSync(
        resolvedPath,
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          message: "session_start",
          meta: { mode, pid: process.pid, cwd: process.cwd() },
        })}\n`,
      );
    } catch {
      resolvedPath = null;
    }

    this.logPath = resolvedPath;
    this.info(`Session started (${mode})`);
    if (this.logPath) {
      this.info(`Log file: ${this.logPath}`);
    }
  }

  info(message: string) {
    this.print("info", message);
  }

  success(message: string) {
    this.print("success", message);
  }

  warn(message: string) {
    this.print("warn", message);
  }

  error(message: string) {
    this.print("error", message);
  }

  startTool(name: string, input?: Record<string, unknown>) {
    const toolStartedAt = Date.now();
    const summary = shortJson(input);
    this.print(
      "tool_start",
      `tool:${name}${summary ? ` input=${summary}` : ""}`,
      input,
    );

    return {
      finish: ({ success, output, error }: ToolFinishPayload) => {
        const elapsed = Date.now() - toolStartedAt;
        const meta = { elapsedMs: elapsed, output, error };
        if (success) {
          const outSummary = shortJson(output);
          this.print(
            "tool_end",
            `tool:${name} completed in ${elapsed}ms${outSummary ? ` output=${outSummary}` : ""}`,
            meta,
          );
          return;
        }

        this.print(
          "tool_end",
          `tool:${name} failed in ${elapsed}ms${error ? ` error=${error}` : ""}`,
          meta,
        );
      },
    };
  }

  close() {
    const elapsed = Date.now() - this.startedAt;
    this.info(`Session finished (${elapsed}ms)`);
  }

  private print(
    level: LogEvent["level"],
    message: string,
    meta?: Record<string, unknown>,
  ) {
    const ts = nowClock();
    const prefix = chalk.gray(`[${ts}]`);
    let body = message;

    if (level === "success") {
      body = chalk.green(message);
    } else if (level === "warn") {
      body = chalk.yellow(message);
    } else if (level === "error") {
      body = chalk.red(message);
    } else if (level === "tool_start") {
      body = chalk.cyan(message);
    } else if (level === "tool_end") {
      body = chalk.magenta(message);
    }

    console.log(`${prefix} ${body}`);
    this.append({
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    });
  }

  private append(event: LogEvent) {
    if (!this.logPath) return;
    try {
      fs.appendFileSync(this.logPath, `${JSON.stringify(event)}\n`);
    } catch {
      // Best-effort logging only.
    }
  }
}
