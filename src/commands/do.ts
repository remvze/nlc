import type { Command } from 'commander';

import { runCommand } from '@/lib/command';
import { loadFileWithLineNumbers } from '@/helpers/file';
import { processPrompt } from '@/lib/processor';
import { error } from '@/lib/logger';
import { getClient, getModelName } from '@/lib/llm';

export function registerDoCommands(program: Command) {
  program
    .command('do')
    .description('Execute a natural language request using NLC')
    .argument('<request...>', 'The action or query you want NLC to perform')
    .option(
      '--file <path>',
      'Optional file to include with your request (e.g., for context or input data)',
    )
    .action(async (request: string[], { file }: { file: string }) => {
      const client = getClient();
      const modelName = getModelName();

      const originalPromptRef = { current: request.join(' ') };
      const fileContent = file ? loadFileWithLineNumbers(file) : null;

      if (file && !fileContent) {
        error(
          `File not found: "${file}". Please check the path and try again.`,
        );
        return;
      }

      await processPrompt({
        prompt: originalPromptRef.current,
        fileContent,
        filePath: file,
        client,
        modelName,
        runCommand,
        originalPromptRef,
      });
    });
}
