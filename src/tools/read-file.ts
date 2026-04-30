import fs from "node:fs";
import { tool } from "ai";
import { z } from "zod";
import chalk from "chalk";

import { box } from "@/utils/box";
import { getRuntimeLogger } from "@/state/runtime";

export const read_file = tool({
  description:
    "Read the content of a file at the given path. This should be used only to view the content of a file, not a directory.",
  inputSchema: z.object({
    path: z.string().describe("The path of the file you want to read."),
  }),
  execute: ({ path }) => {
    const logger = getRuntimeLogger();
    const toolLog = logger?.startTool("read_file", { path });
    box("read_file", [`${chalk.dim("path:")} ${chalk.yellow(path)}`]);

    try {
      const content = fs.readFileSync(path, "utf-8");
      const numbered = content.split("\n").map((line, i) => `[${i + 1}] ${line}`);
      toolLog?.finish({
        success: true,
        output: { path, lines: numbered.length, chars: content.length },
      });

      return {
        path,
        content: numbered,
        note: "Each line is numbered for you inside brackets.",
      };
    } catch (error) {
      toolLog?.finish({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return { error };
    }
  },
});
