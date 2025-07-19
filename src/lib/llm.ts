import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import {
  createOpenAICompatible,
  type OpenAICompatibleProvider,
} from '@ai-sdk/openai-compatible';

import { config } from './config';

export function getClient() {
  const provider = config.get('PROVIDER', 'openai');
  const apiKey = config.get('OPENAI_API_KEY');
  const baseURL = config.get('BASE_URL', 'http://localhost:1234/v1');

  let client: OpenAIProvider | OpenAICompatibleProvider;

  if (provider === 'openai') {
    if (!apiKey) {
      throw new Error(
        'OpenAI API key not found. Please set it using: nlc config key <your-api-key>',
      );
    }

    client = createOpenAI({ apiKey: apiKey as string });
  } else {
    client = createOpenAICompatible({
      baseURL: baseURL as string,
      name: 'lmstudio',
    });
  }

  return client;
}

export function getModelName() {
  const model = config.get('MODEL_NAME', 'gpt-4o-mini');

  if (!model) {
    throw new Error(
      'No model configured. Set one using: nlc config model <model-name>',
    );
  }

  return model as string;
}
