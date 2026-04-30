import { Command } from "commander";
import { generateText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { config } from "dotenv";
import { input } from "@inquirer/prompts";

import { box } from "./utils/box";
import {
  setAutoAcceptChanges,
  getAutoAcceptChanges,
  setRuntimeLogger,
} from "./state/runtime";
import { CliLogger } from "./utils/logger";

import pkg from "../package.json";

import { tools } from "./tools";
import { getSystemPrompt } from "./ai/system";

config({ quiet: true });

const program = new Command();

program
  .name("nlc")
  .description(
    "A lightweight, AI-powered terminal assistant for executing tasks via natural language commands",
  )
  .version(pkg.version);

program
  .command("chat")
  .description("Start an interactive multi-turn chat session with NLC")
  .option("-m, --max-steps <number>", "Maximum tool/model steps per turn", "15")
  .option(
    "--dangerously-accept",
    "Automatically accept all file edits/creates and command executions without confirmation prompts",
  )
  .action(
    async (options: { maxSteps: string; dangerouslyAccept?: boolean }) => {
      setAutoAcceptChanges(Boolean(options.dangerouslyAccept));
      const logger = new CliLogger("chat");
      setRuntimeLogger(logger);

      const parsedMaxSteps = Number.parseInt(options.maxSteps, 10);
      const maxSteps =
        Number.isNaN(parsedMaxSteps) || parsedMaxSteps < 1
          ? 15
          : parsedMaxSteps;

      const conversation: Array<{
        role: "user" | "assistant";
        content: string;
      }> = [];

      logger.info("NLC chat started. Type 'exit' to quit.");

      try {
        while (true) {
          const message = (await input({ message: "You:" })).trim();

          if (!message) {
            continue;
          }

          if (["exit", "quit", "q"].includes(message.toLowerCase())) {
            logger.info("Goodbye.");
            break;
          }

          conversation.push({ role: "user", content: message });
          logger.info(`User: ${message}`);

          const startedAt = Date.now();
          const { text } = await generateText({
            model: openai("gpt-5.3-codex"),
            system: getSystemPrompt(getAutoAcceptChanges()),
            messages: conversation,
            stopWhen: stepCountIs(maxSteps),
            tools,
          });

          const reply = text?.trim() || "(No response generated.)";
          conversation.push({ role: "assistant", content: reply });

          logger.success(`Assistant responded in ${Date.now() - startedAt}ms`);
          box("NLC", [reply]);
        }
      } finally {
        logger.close();
        setRuntimeLogger(null);
      }
    },
  );

program
  .command("do")
  .description("Execute a natural language request using NLC")
  .argument("<request...>", "The action or query you want NLC to perform")
  .option(
    "--dangerously-accept",
    "Automatically accept all file edits/creates and command executions without confirmation prompts",
  )
  .action(
    async (request: string[], options: { dangerouslyAccept: boolean }) => {
      setAutoAcceptChanges(Boolean(options.dangerouslyAccept));
      const logger = new CliLogger("do");
      setRuntimeLogger(logger);
      try {
        const prompt = request.join(" ");
        logger.info(`Request: ${prompt}`);
        const startedAt = Date.now();
        const { text } = await generateText({
          model: openai("gpt-5.3-codex"),
          prompt,
          system: getSystemPrompt(getAutoAcceptChanges()),
          stopWhen: stepCountIs(15),
          tools,
        });

        logger.success(`Assistant responded in ${Date.now() - startedAt}ms`);

        box("Response", [text]);
      } finally {
        logger.close();
        setRuntimeLogger(null);
      }
    },
  );

export { program };
