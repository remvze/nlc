import fs from "node:fs";
import { tool } from "ai";
import { z } from "zod";
import chalk from "chalk";
import { confirm } from "@inquirer/prompts";

import { box } from "@/utils/box";
import { getAutoAcceptChanges } from "@/state/runtime";

export const create_or_replace_file = tool({
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

    const shouldExecute = getAutoAcceptChanges()
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
});
