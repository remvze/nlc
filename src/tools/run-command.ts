import { tool } from "ai";
import { z } from "zod";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";

import { runCommand } from "@/lib/command";
import { box } from "@/utils/box";
import { getAutoAcceptChanges } from "@/state/runtime";

export const run_command = tool({
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

    const shouldExecute = getAutoAcceptChanges()
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
});
