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
  .description('A tiny AI-powered terminal assistant')
  .version(pkg.version);

program
  .command('do')
  .description('Do Something')
  .argument('<request...>', 'Your request from NLC')
  .option('--file <path>', 'A file to be passed with request')
  .action(async (request, { file }: { file: string }) => {
    const API_KEY = config.get('OPENAI_API_KEY');

    if (!API_KEY) {
      console.error('Please set an OpenAI API key');
      return;
    }

    const MODEL_NAME = config.get('MODEL_NAME', 'gpt-4o-mini');

    if (!MODEL_NAME) {
      console.error('Please first set the model name');
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
        console.error('ERROR', "File doesn't exist");
        return;
      }
    }

    const processPrompt = async (prompt: string) => {
      const { text } = await generateText({
        messages: [
          {
            role: 'system',
            content: `
You are NLC, a smart and efficient command-line assistant operating in a terminal environment.
Interpret natural language requests and respond with shell commands, scripts, or concise command-line outputs to help users automate tasks and interact with their system.
Be direct and concise. Avoid small talk unless explicitly asked.
`,
          },
          {
            role: 'assistant',
            content:
              'NLC is ready. What task would you like to execute via the terminal?',
          },
          {
            role: 'user',
            content: fileContent
              ? `I have this script \`${file}\`:\n\n${fileContent}\n\n---\n\nPlease help me with: ${prompt}`
              : `Please help me with: ${prompt}`,
          },
        ],
        tools: {
          suggestCommand: {
            description:
              "Suggest a command based on user's request, only if the user implicitly or explicitly needed a command",
            parameters: z.object({
              command: z
                .string()
                .describe('Your suggest command based on user prompt'),
            }),
            execute: async ({ command }) => {
              console.log(highlight(`$ ${command}`));

              const action = await select({
                message: 'What should I do?',
                choices: [
                  { value: 'confirm', name: 'Run the command' },
                  { value: 'modify', name: 'Modify the command' },
                  { value: 'cancel', name: 'Cancel the command' },
                  { value: 'revise', name: 'Revise the prompt' },
                ],
              });

              if (action === 'confirm') {
                await runCommand(command);
              }

              if (action === 'modify') {
                const modified = await input({
                  message: 'Modified Command:',
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
              "Write a shell script based on the user's request only if explicitly asked for writing a shell script. DO THIS ONLY FOR SHELL AND BASH SCRIPTS AND NOT ANY OTHER LANGUAGES.",
            parameters: z.object({
              script: z
                .string()
                .describe('A shell script with very well documented comments'),
              suggestedName: z
                .string()
                .describe('Suggested file name for saving the script'),
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
              "Use this when no other tool was fitting which means the user's request is outside of the scope of this project.",
            parameters: z.object({
              errorMessage: z.string().describe('The error message'),
            }),
            execute: async ({ errorMessage }) => {
              console.error('ERROR', errorMessage);
            },
          },
          modifyScript: {
            description:
              'If user is asking for a modification or fixing a problem of a shell script and they have also provided you with the script, use this tool to modify or fix the script based on their needs. DO THIS ONLY FOR SHELL AND BASH SCRIPTS AND NOT ANY OTHER LANGUAGES.',
            parameters: z.object({
              modifiedScript: z
                .string()
                .describe(
                  'The modified shell script with very well document comments',
                ),
            }),
            execute: async ({ modifiedScript }) => {
              console.log('The Modified Script:\n');
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
  .description('Commands related to configuring NLC');

configCommand
  .command('key')
  .description('Set OpenAI API Key')
  .argument('<key>', 'Your API Key')
  .action((key: string) => {
    if (!key.trim()) return;

    config.set('OPENAI_API_KEY', key);

    console.log('API key set successfully.');
  });

configCommand
  .command('model')
  .description('Set the OpenAI model name')
  .argument('<model>', 'Your desired model (gpt-4o-mini, gpt-3.5-turbo)')
  .action((model: string) => {
    if (!['gpt-3.5-turbo', 'gpt-4o-mini'].includes(model)) {
      console.error('Invalid model name');
      return;
    }

    config.set('MODEL_NAME', model);

    console.log('Model name set successfully.');
  });

export { program };
