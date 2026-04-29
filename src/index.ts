import { Command } from "commander";
import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { openai } from "@ai-sdk/openai";
import { config } from "dotenv";
import { input } from "@inquirer/prompts";

import { box } from "./utils/box";
import { setAutoAcceptChanges, getAutoAcceptChanges } from "./state/runtime";

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

      const parsedMaxSteps = Number.parseInt(options.maxSteps, 10);
      const maxSteps =
        Number.isNaN(parsedMaxSteps) || parsedMaxSteps < 1
          ? 15
          : parsedMaxSteps;

      const conversation: Array<{
        role: "user" | "assistant";
        content: string;
      }> = [];

      console.log("NLC chat started. Type 'exit' to quit.");

      while (true) {
        const message = (await input({ message: "You:" })).trim();

        if (!message) {
          continue;
        }

        if (["exit", "quit", "q"].includes(message.toLowerCase())) {
          console.log("Goodbye.");
          break;
        }

        conversation.push({ role: "user", content: message });

        const { text } = await generateText({
          model: openai("gpt-5.3-codex"),
          system: getSystemPrompt(getAutoAcceptChanges()),
          messages: conversation,
          stopWhen: stepCountIs(maxSteps),
          tools,
        });

        const reply = text?.trim() || "(No response generated.)";
        conversation.push({ role: "assistant", content: reply });

        box("NLC", [reply]);
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

      const prompt = request.join(" ");
      const { text } = await generateText({
        model: openai("gpt-5.3-codex"),
        prompt,
        system: getSystemPrompt(getAutoAcceptChanges()),
        stopWhen: stepCountIs(15),
        tools,
      });

      box("Response", [text]);
    },
  );

export { program };
