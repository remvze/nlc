import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { Command } from 'commander';
import { confirm, input, select } from '@inquirer/prompts';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { highlight } from 'cli-highlight';
import execSh from 'exec-sh';
import z from 'zod';
import Conf from 'conf';

import pkg from '../package.json';

const program = new Command();
const config = new Conf({ projectName: 'nlc' });

program
  .name('nlc')
  .description(
    'A lightweight, AI-powered terminal assistant for natural language commands',
  )
  .version(pkg.version);

program
  .command('do')
  .description('Execute a natural language request using NLC')
  .argument('<request...>', 'The action or query you want NLC to perform')
  .option(
    '--file <path>',
    'Optional file to include with your request (e.g., for context or input data)',
  )
  .action(async (request, { file }: { file: string }) => {
    const API_KEY = config.get('OPENAI_API_KEY');

    if (!API_KEY) {
      console.error(
        'OpenAI API key not found. Please set it using: nlc config key <your-api-key>',
      );
      return;
    }

    const MODEL_NAME = config.get('MODEL_NAME', 'gpt-4o-mini');

    if (!MODEL_NAME) {
      console.error(
        'No model configured. Set one using: nlc config model <model-name>',
      );
      return;
    }

    const openai = createOpenAI({ apiKey: API_KEY as string });
    let originalPrompt = request.join(' ');
    let fileContent: string | null;

    if (file) {
      if (existsSync(file)) {
        fileContent = readFileSync(file, 'utf-8')
          .split('\n')
          .map((line, index) => `${index + 1}> ${line}`)
          .join('\n');
      } else {
        console.error(
          `File not found: "${file}". Please check the path and try again.`,
        );
        return;
      }
    }

    const processPrompt = async (prompt: string) => {
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
              ? `Here is the script \`${file}\`:\n\n${fileContent}\n\n---\n\nTask: ${prompt}`
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
                .describe(
                  "A suggested shell command based on the user's request",
                ),
            }),
            execute: async ({ command }) => {
              console.log(highlight(`$ ${command}`));

              const action = await select({
                message: 'What would you like to do with this command?',
                choices: [
                  { value: 'confirm', name: 'Run the command' },
                  { value: 'modify', name: 'Modify the command' },
                  { value: 'revise', name: 'Revise the original request' },
                  { value: 'cancel', name: 'Cancel' },
                ],
              });

              if (action === 'confirm') {
                await runCommand(command);
              }

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

                originalPrompt += ` // Revision: ${revision}`;

                await processPrompt(originalPrompt);
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
              console.log('The Script:\n');
              console.log(highlight(script));

              const filename = await input({
                message: 'Where should I save it?',
                default: suggestedName,
              });

              writeFileSync(filename, script);

              const shouldRun = await confirm({
                message: 'Should I run the script?',
              });

              if (shouldRun) {
                runCommand(`bash ${filename}`);
              }
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
              console.error('ERROR', errorMessage);
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
              console.log('The modified script:\n');
              console.log(highlight(modifiedScript));

              const filename = await input({
                message: 'Where should I save it?',
                default: file,
              });

              writeFileSync(filename, modifiedScript);

              const shouldRun = await confirm({
                message: 'Should I run the script?',
              });

              if (shouldRun) {
                runCommand(`bash ${filename}`);
              }
            },
          },
        },
        model: openai(MODEL_NAME as string),
      });

      if (text) console.log(text);
    };

    processPrompt(originalPrompt);
  });

async function runCommand(command: string) {
  console.log();

  return new Promise(resolve => {
    execSh(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) console.error(error.message);
      if (stdout) console.log(stdout.trim());
      if (stderr) console.error(stderr.trim());

      resolve(null);
    });
  });
}

const configCommand = program
  .command('config')
  .description('Manage configuration settings for NLC');

configCommand
  .command('key')
  .description('Set your OpenAI API key for authentication')
  .argument('<key>', 'Your OpenAI API key')
  .action((key: string) => {
    if (!key.trim()) return;

    config.set('OPENAI_API_KEY', key);

    console.log('OpenAI API key saved successfully.');
  });

configCommand
  .command('model')
  .description('Choose which OpenAI model NLC should use')
  .argument('<model>', 'Model name (e.g., gpt-4o-mini or gpt-3.5-turbo)')
  .action((model: string) => {
    if (!['gpt-3.5-turbo', 'gpt-4o-mini'].includes(model)) {
      console.error(
        'Invalid model name. Supported models: gpt-3.5-turbo, gpt-4o-mini',
      );
      return;
    }

    config.set('MODEL_NAME', model);

    console.log('Model set successfully.');
  });

export { program };
