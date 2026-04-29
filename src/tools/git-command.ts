import { tool } from "ai";
import { z } from "zod";
import { execa } from "execa";
import chalk from "chalk";
import { confirm } from "@inquirer/prompts";

import { getAutoAcceptChanges } from "@/state/runtime";
import { box } from "@/utils/box";

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

    const shouldExecute = getAutoAcceptChanges()
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

      // subprocess.stdout?.on("data", (data) => {
      //   process.stdout.write(data);
      // });

      // subprocess.stderr?.on("data", (data) => {
      //   process.stderr.write(data);
      // });

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
});
