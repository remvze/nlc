import fs from "node:fs";
import { tool } from "ai";
import { z } from "zod";
import chalk from "chalk";

import { box } from "@/utils/box";

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

    box("📁 list_files", [`${chalk.dim("path:")} ${chalk.yellow(path)}`]);

    try {
      const files = fs.readdirSync(path, { recursive: false });

      return { path, files };
    } catch (error) {
      return { error };
    }
  },
});
