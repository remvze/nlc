import { tool } from "ai";
import { z } from "zod";
import { execa } from "execa";
import { rgPath } from "@vscode/ripgrep";

import { box } from "@/utils/box";

export const search_files = tool({
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
      const exitCode = typeof error?.exitCode === "number" ? error.exitCode : 1;

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
});
