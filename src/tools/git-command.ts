import { tool } from "ai";
import { z } from "zod";
import { execa } from "execa";
import chalk from "chalk";
import { confirm } from "@inquirer/prompts";

import { getAutoAcceptChanges, getRuntimeLogger } from "@/state/runtime";
import { box } from "@/utils/box";
import { previewText } from "@/utils/preview";

export const git_command = tool({
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
    const logger = getRuntimeLogger();

    const normalized = args.map((a) => a.trim()).filter((a) => a.length > 0);
    if (normalized.length === 0) {
      return { error: "No git arguments provided." };
    }

    const command = `git ${normalized.join(" ")}`;
    const toolLog = logger?.startTool("git_command", {
      command,
      cwd: workingDir,
    });

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
      const error =
        "Blocked potentially destructive git command. If you explicitly want this, use run_command with a clear user request.";
      toolLog?.finish({ success: false, error });
      return {
        error,
        command,
        cwd: workingDir,
      };
    }

    box("git_command", [
      chalk.yellow(command),
      `${chalk.dim("Directory:")} ${chalk.yellow(workingDir)}`,
    ]);

    const shouldExecute = getAutoAcceptChanges()
      ? true
      : await confirm({
          message: "Should I do it?",
        });

    if (!shouldExecute) {
      toolLog?.finish({
        success: false,
        error: "User denied the git command execution.",
      });
      return {
        error: "User denied the git command execution.",
      };
    }

    try {
      const result = await execa("git", normalized, {
        cwd: workingDir,
        shell: false,
        stdio: "pipe",
      });

      toolLog?.finish({
        success: true,
        output: {
          command,
          exitCode: result.exitCode ?? 0,
          stdout: previewText(result.stdout ?? "", 8, 120),
          stderr: previewText(result.stderr ?? "", 8, 120),
        },
      });

      return {
        command,
        cwd: workingDir,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        exitCode: result.exitCode ?? 0,
      };
    } catch (error: unknown) {
      const execaError = error as {
        stdout?: string;
        stderr?: string;
        exitCode?: number;
      };
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toolLog?.finish({
        success: false,
        error: errorMessage,
        output: {
          command,
          exitCode:
            typeof execaError.exitCode === "number" ? execaError.exitCode : 1,
          stdout: previewText(execaError.stdout ?? "", 8, 120),
          stderr: previewText(execaError.stderr ?? "", 8, 120),
        },
      });

      return {
        command,
        cwd: workingDir,
        error: errorMessage,
        stdout: execaError.stdout ?? "",
        stderr: execaError.stderr ?? "",
        exitCode:
          typeof execaError.exitCode === "number" ? execaError.exitCode : 1,
      };
    }
  },
});
