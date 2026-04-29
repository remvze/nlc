import fs from "node:fs";
import { execa } from "execa";
import { Command } from "commander";
import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { openai } from "@ai-sdk/openai";
import { config } from "dotenv";
import { z } from "zod";
import { rgPath } from "@vscode/ripgrep";
import { confirm, input } from "@inquirer/prompts";
import boxen from "boxen";
import chalk from "chalk";

let autoAcceptChanges = false;

function box(title: string, bodyLines: string[] = []) {
  const body = bodyLines.length > 0 ? `${bodyLines.join("\n").trim()}` : "";

  console.log(
    boxen(body, {
      title,
      titleAlignment: "left",
      borderStyle: "round",
      borderColor: "cyan",
      padding: { left: 1, right: 1 },
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
    }),
  );
}

import pkg from "../package.json";

config({ quiet: true });

const program = new Command();

program
  .name("nlc")
  .description(
    "A lightweight, AI-powered terminal assistant for executing tasks via natural language commands",
  )
  .version(pkg.version);

type EditOperation =
  | {
      type: "find_replace";
      find: string;
      replace: string;
      all?: boolean;
    }
  | {
      type: "insert_at_line";
      line: number;
      content: string;
    }
  | {
      type: "delete_range";
      startLine: number;
      endLine: number;
    };

function applyEditOperation(content: string, operation: EditOperation): string {
  switch (operation.type) {
    case "find_replace": {
      if (!operation.find) {
        throw new Error("find_replace requires a non-empty 'find' string.");
      }

      if (operation.all) {
        return content.split(operation.find).join(operation.replace);
      }

      const index = content.indexOf(operation.find);
      if (index === -1) {
        throw new Error("find_replace could not find the target text.");
      }

      return (
        content.slice(0, index) +
        operation.replace +
        content.slice(index + operation.find.length)
      );
    }

    case "insert_at_line": {
      if (!Number.isInteger(operation.line) || operation.line < 1) {
        throw new Error("insert_at_line requires line >= 1.");
      }

      const lines = content.split(/\r?\n/);
      const insertIndex = operation.line - 1;

      if (insertIndex > lines.length) {
        throw new Error(
          `insert_at_line line ${operation.line} is out of range (max ${lines.length + 1}).`,
        );
      }

      lines.splice(insertIndex, 0, operation.content);
      return lines.join("\n");
    }

    case "delete_range": {
      const { startLine, endLine } = operation;
      if (
        !Number.isInteger(startLine) ||
        !Number.isInteger(endLine) ||
        startLine < 1 ||
        endLine < startLine
      ) {
        throw new Error(
          "delete_range requires integer startLine/endLine with 1 <= startLine <= endLine.",
        );
      }

      const lines = content.split(/\r?\n/);

      if (endLine > lines.length) {
        throw new Error(
          `delete_range endLine ${endLine} is out of range (max ${lines.length}).`,
        );
      }

      lines.splice(startLine - 1, endLine - startLine + 1);
      return lines.join("\n");
    }
  }
}

const tools: ToolSet = {
  list_files: tool({
    description:
      "List files and directories in a given path. If no path is provided, the current working directory will be used.",
    inputSchema: z.object({
      path: z
        .string()
        .nullable()
        .describe(
          "Optional relative path to list the files from. If omitted, the current working directory will be used.",
        ),
    }),
    execute: ({ path: _path }) => {
      const path = _path?.trim() ? _path : ".";

      box("📁 list_files", [`${chalk.dim("path:")} ${chalk.yellow(path)}`]);

      try {
        const files = fs.readdirSync(path, { recursive: false });

        return { path, files };
      } catch (error) {
        return { error };
      }
    },
  }),

  read_file: tool({
    description:
      "Read the content of a file at the given path. This should be used only to view the content of a file, not a directory.",
    inputSchema: z.object({
      path: z.string().describe("The path of the file you want to read."),
    }),
    execute: ({ path }) => {
      box("📄 read_file", [`${chalk.dim("path:")} ${chalk.yellow(path)}`]);

      try {
        const content = fs.readFileSync(path, "utf-8");
        const numbered = content
          .split("\n")
          .map((line, i) => `[${i + 1}] ${line}`);

        return {
          path,
          content: numbered,
          note: "Each line is numbered for you inside brackets.",
        };
      } catch (error) {
        return { error };
      }
    },
  }),

  create_or_replace_file: tool({
    description:
      "Create or replace a file with new content. If the file doesn't exist, a new file will be created using the content provided; otherwise, the previous content will be replaced with the new content.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("The path to the file you want to create or replace."),
      new_content: z
        .string()
        .describe(
          "The new content of the file. If the file already exists, this content will replace the previous content.",
        ),
    }),
    execute: async ({ path, new_content }) => {
      box("📝 create_or_replace_file", [
        `${chalk.dim("path:")} ${chalk.yellow(path)}`,
        `${chalk.dim("new_content:")} ${chalk.yellow(`${new_content.length} chars`)}`,
      ]);

      box("New Content", [chalk.greenBright(new_content)]);

      const shouldExecute = autoAcceptChanges
        ? true
        : await confirm({ message: "Should I do it?" });

      if (!shouldExecute) {
        return { error: `User denied the request to write to this file.` };
      }

      try {
        fs.writeFileSync(path, new_content);

        const numbered = new_content
          .split("\n")
          .map((line, i) => `[${i + 1}] ${line}`);

        return {
          success: "File has been written.",
          path,
          content: numbered,
          note: "Each line is numbered for you inside brackets.",
        };
      } catch (error) {
        return { error };
      }
    },
  }),

  edit_file: tool({
    description:
      "Edit part of an existing file with focused operations instead of replacing whole content. Supports find/replace, insert at line, and delete line ranges.",
    inputSchema: z.object({
      path: z.string().describe("The path of the file to edit."),
      operation: z.discriminatedUnion("type", [
        z.object({
          type: z.literal("find_replace"),
          find: z.string().describe("The text to find."),
          replace: z.string().describe("The replacement text."),
          all: z
            .boolean()
            .optional()
            .describe("If true, replace all matches; otherwise replace first."),
        }),
        z.object({
          type: z.literal("insert_at_line"),
          line: z
            .number()
            .int()
            .describe("1-based line number before which to insert content."),
          content: z.string().describe("The content to insert as a new line."),
        }),
        z.object({
          type: z.literal("delete_range"),
          startLine: z.number().int().describe("1-based start line to delete."),
          endLine: z.number().int().describe("1-based end line to delete."),
        }),
      ]),
    }),
    execute: async ({ path, operation }) => {
      box("📝 edit_file", [
        `${chalk.dim("path:")} ${chalk.yellow(path)}`,
        `${chalk.dim("operation:")} ${chalk.yellow(operation)}`,
      ]);

      if (operation.type === "find_replace") {
        box("Replace", [chalk.redBright(operation.find)]);
        box("With", [chalk.greenBright(operation.replace)]);
      }

      if (operation.type === "insert_at_line") {
        box(`Insert at ${operation.line}`, [
          chalk.greenBright(operation.content),
        ]);
      }

      if (operation.type === "delete_range") {
        box(`Delete`, [
          chalk.red(`From line ${operation.startLine} to ${operation.endLine}`),
        ]);
      }

      const shouldExecute = autoAcceptChanges
        ? true
        : await confirm({ message: "Should I do it?" });

      if (!shouldExecute) {
        return { error: `User denied the request to edit this file.` };
      }

      try {
        const original = fs.readFileSync(path, "utf-8");
        const updated = applyEditOperation(
          original,
          operation as EditOperation,
        );

        if (updated === original) {
          return { success: "No changes applied (content unchanged)." };
        }

        fs.writeFileSync(path, updated);

        const numbered = updated
          .split("\n")
          .map((line, i) => `[${i + 1}] ${line}`);

        return {
          success: "File has been edited.",
          path,
          operation,
          content: numbered,
          note: "Each line is numbered for you inside brackets.",
        };
      } catch (error) {
        return { error };
      }
    },
  }),

  search_files: tool({
    description:
      "Search text in files using ripgrep and return structured matches with file path, line, column, and text.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe("The text or regex pattern to search for."),
      path: z
        .string()
        .optional()
        .describe(
          "Optional relative path to search in. Defaults to current working directory.",
        ),
      glob: z
        .string()
        .optional()
        .describe("Optional include glob pattern (ripgrep -g), e.g. **/*.ts"),
      caseSensitive: z
        .boolean()
        .optional()
        .describe(
          "Whether search is case-sensitive. If omitted, ripgrep smart-case behavior is used.",
        ),
      maxResults: z
        .number()
        .int()
        .positive()
        .max(1000)
        .optional()
        .describe("Maximum number of matches to return (default 200)."),
    }),
    execute: async ({ query, path, glob, caseSensitive, maxResults }) => {
      const searchPath = path?.trim() ? path : ".";
      const limit = maxResults ?? 200;

      box("🔎 search_files", [`For \"${query}\" in \"${searchPath}\"`]);

      const args = [
        "--json",
        "--line-number",
        "--column",
        "--with-filename",
        "--max-count",
        String(limit),
      ];

      if (caseSensitive === undefined) {
        args.push("--smart-case");
      } else if (caseSensitive) {
        args.push("--case-sensitive");
      } else {
        args.push("--ignore-case");
      }

      if (glob?.trim()) {
        args.push("-g", glob);
      }

      args.push(query, searchPath);

      try {
        const { stdout, stderr, exitCode } = await execa(rgPath, args, {
          cwd: process.cwd(),
          shell: false,
        });

        const matches: Array<{
          path: string;
          line: number;
          column: number;
          text: string;
        }> = [];

        for (const line of stdout.split(/\r?\n/)) {
          if (!line.trim()) continue;

          let event: any;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event?.type !== "match") continue;

          const data = event.data;
          const filePath = data?.path?.text;
          const lineNumber = data?.line_number;
          const submatch = data?.submatches?.[0];
          const column =
            typeof submatch?.start === "number" ? submatch.start + 1 : 1;
          const text = data?.lines?.text ?? "";

          if (typeof filePath !== "string" || typeof lineNumber !== "number") {
            continue;
          }

          matches.push({
            path: filePath,
            line: lineNumber,
            column,
            text: text.replace(/\r?\n$/, ""),
          });

          if (matches.length >= limit) break;
        }

        return {
          query,
          path: searchPath,
          glob: glob ?? null,
          caseSensitive: caseSensitive ?? null,
          maxResults: limit,
          count: matches.length,
          truncated: matches.length >= limit,
          exitCode,
          stderr,
          matches,
        };
      } catch (error: any) {
        const stdout = error?.stdout ?? "";
        const stderr = error?.stderr ?? "";
        const exitCode =
          typeof error?.exitCode === "number" ? error.exitCode : 1;

        // ripgrep exit code 1 means "no matches", not a runtime failure.
        if (exitCode === 1) {
          return {
            query,
            path: searchPath,
            glob: glob ?? null,
            caseSensitive: caseSensitive ?? null,
            maxResults: limit,
            count: 0,
            truncated: false,
            exitCode,
            stderr,
            matches: [],
          };
        }

        return {
          error: error instanceof Error ? error.message : String(error),
          query,
          path: searchPath,
          glob: glob ?? null,
          caseSensitive: caseSensitive ?? null,
          maxResults: limit,
          exitCode,
          stderr,
          stdout,
        };
      }
    },
  }),

  git_command: tool({
    description:
      "Run a git command in the user's environment with basic safety checks. It prompts for confirmation unless dangerously-accept is enabled, then executes git with the provided args and returns { command, cwd, stdout, stderr, exitCode }.",
    inputSchema: z.object({
      args: z
        .array(z.string())
        .min(1)
        .describe("Git arguments to execute, without the leading 'git'."),
      cwd: z.string().optional().describe("Optional working directory."),
    }),
    execute: async ({ args, cwd }) => {
      const workingDir = cwd?.trim() ? cwd : process.cwd();

      const normalized = args.map((a) => a.trim()).filter((a) => a.length > 0);
      if (normalized.length === 0) {
        return { error: "No git arguments provided." };
      }

      const cmdLower = normalized.join(" ").toLowerCase();
      const isBlocked =
        cmdLower.includes("reset --hard") ||
        cmdLower.includes("clean -fd") ||
        cmdLower.includes("clean -df") ||
        cmdLower.includes("clean -fdx") ||
        cmdLower.includes("clean -xdf") ||
        cmdLower.includes("push --force") ||
        cmdLower.includes("push -f") ||
        cmdLower.includes("branch -d -d") ||
        cmdLower.includes("branch -d");

      if (isBlocked) {
        return {
          error:
            "Blocked potentially destructive git command. If you explicitly want this, use run_command with a clear user request.",
          command: `git ${normalized.join(" ")}`,
          cwd: workingDir,
        };
      }

      box("🌿 git_command", [
        chalk.yellow(`git ${normalized.join(" ")}`),
        `${chalk.dim("Directory:")} ${chalk.yellow(workingDir)}`,
      ]);

      const shouldExecute = autoAcceptChanges
        ? true
        : await confirm({
            message: `Should I do it?`,
          });

      if (!shouldExecute) {
        return {
          error: `User denied the git command execution. You may not ask to run the same or a very similar command again.`,
        };
      }

      try {
        const subprocess = execa("git", normalized, {
          cwd: workingDir,
          shell: false,
          stdio: "pipe",
        });

        subprocess.stdout?.on("data", (data) => {
          process.stdout.write(data);
        });

        subprocess.stderr?.on("data", (data) => {
          process.stderr.write(data);
        });

        const result = await subprocess;

        return {
          command: `git ${normalized.join(" ")}`,
          cwd: workingDir,
          stdout: result.stdout ?? "",
          stderr: result.stderr ?? "",
          exitCode: result.exitCode ?? 0,
        };
      } catch (error: any) {
        return {
          command: `git ${normalized.join(" ")}`,
          cwd: workingDir,
          error: error instanceof Error ? error.message : String(error),
          stdout: error?.stdout ?? "",
          stderr: error?.stderr ?? "",
          exitCode: typeof error?.exitCode === "number" ? error.exitCode : 1,
        };
      }
    },
  }),

  run_command: tool({
    description:
      "Run a command in the user's environment. It prompts for confirmation unless dangerously-accept is enabled, then executes the command using node:child_process, streaming stdout and stderr to the terminal as data arrives, and finally returns { stdout, stderr, exitCode }.",
    inputSchema: z.object({
      command: z.string().describe("The command to execute."),
      cwd: z.string().optional().describe("Optional working directory."),
    }),
    execute: async ({ command, cwd }) => {
      const workingDir = cwd?.trim() ? cwd : process.cwd();

      box("⚙️ run_command", [
        chalk.yellow(command),
        `${chalk.dim("Directory:")} ${chalk.yellow(workingDir)}`,
      ]);

      const shouldExecute = autoAcceptChanges
        ? true
        : await confirm({
            message: `Should I do it?`,
          });

      if (!shouldExecute) {
        return {
          error: `User denied the command execution. You may not ask to run the same or a very similar command again.`,
        };
      }

      const { error, stdout, stderr, exitCode } = await runCommand(
        command,
        workingDir,
      );

      return { error, stdout, stderr, exitCode };
    },
  }),
};

async function runCommand(
  command: string,
  cwd: string,
): Promise<{
  error: string | undefined | null;
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  try {
    const subprocess = execa(command, {
      cwd,
      shell: true,
      stdio: "pipe",
    });

    subprocess.stdout?.on("data", (data) => {
      process.stdout.write(data);
    });

    subprocess.stderr?.on("data", (data) => {
      process.stderr.write(data);
    });

    const result = await subprocess;

    return {
      error: null,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      exitCode: result.exitCode ?? 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      error: message,
      stdout: "",
      stderr: "",
      exitCode: 1,
    };
  }
}

const shell =
  process.env.SHELL ??
  process.env.ComSpec ??
  (process.platform === "win32" ? "cmd.exe" : "sh");
const getSystemPrompt = (dangerouslyAccept: boolean) => `
You are NLC, a terminal AI assistant for executing tasks in natural language.

Environment:
- Current working directory: "${process.cwd()}"
- Platform: "${process.platform}"
- Shell: "${shell}"
- Prefer commands and syntax appropriate for this environment.

Dangerous mode:
- dangerously-accept is ${dangerouslyAccept ? "ACTIVE" : "NOT active"}.
- When dangerously-accept is ACTIVE, file writes/edits and command executions run without confirmation.
- Do not ask for confirmation for normal development tasks.
- Still avoid clearly destructive or irreversible actions unless explicitly requested.
- When performing risky actions, briefly state the intended impact before executing.

Core behavior:
- Be concise, direct, and action-oriented.
- Default to ACTION, not explanation.
- Do not produce meta-responses like "I will do X" — just do it.
- Explain results after completing actions, or if blocked.

Tool usage:
- Use tools proactively whenever they help make progress.
- Prefer one high-signal command over multiple redundant checks.
- Do not repeat the same or similar command unless there is a clear reason.
- After any tool call:
  - Interpret the result.
  - Decide whether the task is complete.
  - If yes, stop and give a clear conclusion.
  - If not, continue with the next logical step.

Persistence & search:
- Do not assume failure after a single unsuccessful attempt.
- If a file or resource is not found:
  - Explore the directory structure (e.g., list files and folders).
  - Check common locations (e.g., src/, lib/, app/).
  - Use search tools (glob, find, grep) if available.
- Only conclude "not found" after a reasonable search.

Planning:
- For non-trivial tasks, think in multi-step execution.
- You may run multiple commands in sequence without asking for permission when they are part of the same task.
- Prefer completing the task end-to-end rather than stopping after partial progress.
- If a step fails or output is unclear, adapt and try an alternative approach.

Execution rules:
- Do not ask for confirmation for safe or reversible operations.
- Only ask the user for clarification if the request is ambiguous or missing critical information.
- Avoid unnecessary back-and-forth.

Developer heuristics:
- Assume common project structures (e.g., src/, components/, pages/).
- When working in a codebase, explore as needed to understand layout.
- Use directory listing and search as standard steps when locating files.

Failure handling:
- If a command fails:
  - Clearly explain what failed.
  - Propose one meaningful next step.
  - Avoid blind retries unless there is a clear change in approach.

Goal:
- Act like an experienced developer working independently in a terminal.
- Minimize interaction friction.
- Complete tasks efficiently and correctly with minimal user intervention.
`;

program
  .command("chat")
  .description("Start an interactive multi-turn chat session with NLC")
  .option("-m, --max-steps <number>", "Maximum tool/model steps per turn", "15")
  .option(
    "--dangerously-accept",
    "Automatically accept all file edits/creates and command executions without confirmation prompts",
  )
  .action(
    async (options: { maxSteps: string; dangerouslyAccept?: boolean }) => {
      autoAcceptChanges = Boolean(options.dangerouslyAccept);

      const parsedMaxSteps = Number.parseInt(options.maxSteps, 10);
      const maxSteps =
        Number.isNaN(parsedMaxSteps) || parsedMaxSteps < 1
          ? 15
          : parsedMaxSteps;

      const conversation: Array<{
        role: "user" | "assistant";
        content: string;
      }> = [];

      console.log("NLC chat started. Type 'exit' to quit.");

      while (true) {
        const message = (await input({ message: "You:" })).trim();

        if (!message) {
          continue;
        }

        if (["exit", "quit", "q"].includes(message.toLowerCase())) {
          console.log("Goodbye.");
          break;
        }

        conversation.push({ role: "user", content: message });

        const { text } = await generateText({
          model: openai("gpt-5.3-codex"),
          system: getSystemPrompt(autoAcceptChanges),
          messages: conversation,
          stopWhen: stepCountIs(maxSteps),
          tools,
        });

        const reply = text?.trim() || "(No response generated.)";
        conversation.push({ role: "assistant", content: reply });

        box("NLC", [reply]);
      }
    },
  );

program
  .command("do")
  .description("Execute a natural language request using NLC")
  .argument("<request...>", "The action or query you want NLC to perform")
  .option(
    "--dangerously-accept",
    "Automatically accept all file edits/creates and command executions without confirmation prompts",
  )
  .action(
    async (request: string[], options: { dangerouslyAccept: boolean }) => {
      autoAcceptChanges = Boolean(options.dangerouslyAccept);

      const prompt = request.join(" ");
      const { text } = await generateText({
        model: openai("gpt-5.3-codex"),
        prompt,
        system: getSystemPrompt(autoAcceptChanges),
        stopWhen: stepCountIs(15),
        tools,
      });

      box("Response", [text]);
    },
  );

export { program };
