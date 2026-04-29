import fs from "node:fs";
import { tool } from "ai";
import { z } from "zod";
import chalk from "chalk";

import { box } from "@/utils/box";

export const read_file = tool({
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
});
