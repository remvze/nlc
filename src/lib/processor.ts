import { writeFileSync } from 'node:fs';

import { confirm, input, select } from '@inquirer/prompts';
import { generateText } from 'ai';
import z from 'zod';
import type { createOpenAI } from '@ai-sdk/openai';
import type { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { runCommand } from '@/lib/command';
import { error, logCommand, logScript } from './logger';

export interface PromptOptions {
  prompt: string;
  fileContent: string | null;
  filePath: string | undefined;
  client:
    | ReturnType<typeof createOpenAI>
    | ReturnType<typeof createOpenAICompatible>;
  modelName: string;
  runCommand: typeof runCommand;
  originalPromptRef: { current: string };
}

export async function processPrompt(opts: PromptOptions): Promise<void> {
  const {
    prompt,
    fileContent,
    filePath,
    client,
    modelName,
    runCommand,
    originalPromptRef,
  } = opts;

  const { text } = await generateText({
    messages: [
      {
        role: 'system',
        content: `
You are NLC, an intelligent and efficient command-line assistant running in a terminal environment.
Interpret natural language requests and respond with shell commands, scripts, or succinct CLI outputs.
Stay concise and pragmatic. Avoid small talk unless explicitly requested.
`,
      },
      {
        role: 'assistant',
        content: 'NLC is ready. What would you like to do?',
      },
      {
        role: 'user',
        content: fileContent
          ? `Here is the script \`${filePath}\`:\n\n${fileContent}\n\n---\n\nTask: ${prompt}`
          : `Task: ${prompt}`,
      },
    ],
    tools: {
      suggestCommand: {
        description:
          "Suggest a command based on the user's natural language input — only when a command is clearly implied or requested.",
        parameters: z.object({
          command: z
            .string()
            .describe("A suggested shell command based on the user's request"),
        }),
        execute: async ({ command }) => {
          console.log();
          logCommand(`$ ${command}`);
          console.log();

          const action = await select({
            message: 'What would you like to do with this command?',
            choices: [
              { value: 'confirm', name: 'Run the command' },
              { value: 'modify', name: 'Modify the command' },
              { value: 'revise', name: 'Revise the original request' },
              { value: 'cancel', name: 'Cancel' },
            ],
          });

          if (action === 'confirm') await runCommand(command);

          if (action === 'modify') {
            const modified = await input({
              message: 'Edit the command:',
              default: command,
              prefill: 'editable',
            });
            await runCommand(modified);
          }

          if (action === 'revise') {
            const revision = await input({
              message: 'Add to or revise your original request:',
            });
            originalPromptRef.current += ` // Revision: ${revision}`;
            await processPrompt({ ...opts, prompt: originalPromptRef.current });
          }
        },
      },

      writeScript: {
        description:
          "Generates and saves a shell or Bash script based on the user's explicit request. Only create scripts written in shell or Bash—do **not** generate scripts in any other programming language.",
        parameters: z.object({
          script: z
            .string()
            .describe(
              'The complete shell script, with clear and thorough inline comments for readability and explanation.',
            ),
          suggestedName: z
            .string()
            .describe(
              'A recommended filename under which the script can be saved.',
            ),
        }),
        execute: async ({ script, suggestedName }) => {
          console.log();
          logScript(script);
          console.log();

          const filename = await input({
            message: 'Where should I save it?',
            default: suggestedName,
          });

          writeFileSync(filename, script);

          const shouldRun = await confirm({
            message: 'Should I run the script?',
          });

          if (shouldRun) await runCommand(`bash ${filename}`);
        },
      },

      error: {
        description:
          "Use this as a fallback when no other tool is appropriate—specifically when the user's request falls outside the defined scope or capabilities of this project.",
        parameters: z.object({
          errorMessage: z
            .string()
            .describe(
              'A clear and informative message explaining why the request cannot be fulfilled.',
            ),
        }),
        execute: async ({ errorMessage }) => {
          error(errorMessage);
        },
      },

      modifyScript: {
        description:
          'Use this tool when the user requests a modification or bug fix for a **shell** or **Bash** script **and** has provided the original script. This tool should only be used for shell/Bash scripts—**not** for scripts in other programming languages.',
        parameters: z.object({
          modifiedScript: z
            .string()
            .describe(
              'The updated shell script with clear and well-documented inline comments explaining the changes.',
            ),
        }),
        execute: async ({ modifiedScript }) => {
          console.log();
          logScript(modifiedScript);
          console.log();

          const filename = await input({
            message: 'Where should I save it?',
            default: filePath,
          });

          writeFileSync(filename, modifiedScript);

          const shouldRun = await confirm({
            message: 'Should I run the script?',
          });

          if (shouldRun) await runCommand(`bash ${filename}`);
        },
      },
    },
    model: client(modelName),
  });

  if (text) console.log(text);
}
