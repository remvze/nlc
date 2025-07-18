import { createOpenAI } from '@ai-sdk/openai';
import { config } from '@/lib/config';

export function getOpenAIClient() {
  const apiKey = config.get('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error(
      'OpenAI API key not found. Please set it using: nlc config key <your-api-key>',
    );
  }

  return createOpenAI({ apiKey: apiKey as string });
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
