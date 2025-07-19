import type { Command } from 'commander';

import { config } from '@/lib/config';
import { error, success } from '@/lib/logger';

export function registerConfigCommands(program: Command) {
  const configCommand = program
    .command('config')
    .description('Manage configuration settings for NLC (OpenAI or LM Studio)');

  configCommand
    .command('key')
    .description('Set your OpenAI API key (not required for LM Studio)')
    .argument('<key>', 'Your OpenAI API key')
    .action((key: string) => {
      if (!key.trim()) {
        error('API key cannot be empty.');
        return;
      }

      config.set('OPENAI_API_KEY', key);
      success('OpenAI API key saved successfully.');
    });

  configCommand
    .command('model')
    .description('Set the model name (OpenAI or LM Studio)')
    .argument(
      '<model>',
      'Model name (e.g., gpt-4o, gpt-3.5-turbo, llama3:8b-instruct-q4)',
    )
    .action((model: string) => {
      config.set('MODEL_NAME', model);

      success(`Model set to: ${model}`);
    });

  configCommand
    .command('provider')
    .description('Choose which provider to use: openai or lmstudio')
    .argument('<provider>', 'Either "openai" or "lmstudio"')
    .action((provider: string) => {
      const valid = ['openai', 'lmstudio'];

      if (!valid.includes(provider)) {
        error('Invalid provider. Supported: openai, lmstudio');

        return;
      }

      config.set('PROVIDER', provider);

      if (provider === 'openai') {
        success('Switched to OpenAI.');
      } else {
        success('Switched to LM Studio. Be sure to set the base_url.');
      }
    });
}
