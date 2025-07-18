import type { Command } from 'commander';

import { config } from '@/lib/config';
import { error, success } from '@/lib/logger';

export function registerConfigCommands(program: Command) {
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

      success('OpenAI API key saved successfully.');
    });

  configCommand
    .command('model')
    .description('Choose which OpenAI model NLC should use')
    .argument('<model>', 'Model name (e.g., gpt-4o-mini or gpt-3.5-turbo)')
    .action((model: string) => {
      if (!['gpt-3.5-turbo', 'gpt-4o-mini'].includes(model)) {
        error(
          'Invalid model name. Supported models: gpt-3.5-turbo, gpt-4o-mini',
        );

        return;
      }

      config.set('MODEL_NAME', model);

      success('Model set successfully.');
    });
}
