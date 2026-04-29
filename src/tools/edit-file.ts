import fs from "node:fs";
import { tool } from "ai";
import { z } from "zod";
import chalk from "chalk";
import { confirm } from "@inquirer/prompts";

import { box } from "@/utils/box";
import { getAutoAcceptChanges } from "@/state/runtime";
import { applyEditOperation, type EditOperation } from "@/lib/edit";

export const edit_file = tool({
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

    const shouldExecute = getAutoAcceptChanges()
      ? true
      : await confirm({ message: "Should I do it?" });

    if (!shouldExecute) {
      return { error: `User denied the request to edit this file.` };
    }

    try {
      const original = fs.readFileSync(path, "utf-8");
      const updated = applyEditOperation(original, operation as EditOperation);

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
});
