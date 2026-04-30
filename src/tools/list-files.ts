import fs from "node:fs";
import { tool } from "ai";
import { z } from "zod";
import chalk from "chalk";

import { box } from "@/utils/box";
import { getRuntimeLogger } from "@/state/runtime";

export const list_files = tool({
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
    const logger = getRuntimeLogger();
    const toolLog = logger?.startTool("list_files", { path });

    box("list_files", [`${chalk.dim("path:")} ${chalk.yellow(path)}`]);

    try {
      const files = fs.readdirSync(path, { recursive: false });
      toolLog?.finish({ success: true, output: { path, count: files.length } });
      return { path, files };
    } catch (error) {
      toolLog?.finish({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return { error };
    }
  },
});
