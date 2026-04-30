import { input, password, select } from "@inquirer/prompts";
import chalk from "chalk";
import type { Command } from "commander";

import { box } from "@/utils/box";
import {
  clearConfiguredApiKey,
  getConfigPath,
  getConfiguredApiKey,
  getConfiguredModel,
  getDefaultModel,
  maskApiKey,
  setConfiguredApiKey,
  setConfiguredModel,
} from "@/state/config";

const suggestedModels = [
  {
    value: "gpt-5.3-codex",
    name: "gpt-5.3-codex (coding-focused, current default)",
  },
  { value: "gpt-5.2", name: "gpt-5.2" },
  { value: "gpt-5.5", name: "gpt-5.5" },
  { value: "__custom", name: "Custom model ID..." },
];

function validateOpenAiKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "API key cannot be empty.";
  if (!trimmed.startsWith("sk-")) {
    return "OpenAI keys usually start with 'sk-'.";
  }
  return true;
}

async function setApiKeyInteractive() {
  const entered = await password({
    message: "OpenAI API key:",
    mask: "*",
    validate: validateOpenAiKey,
  });

  setConfiguredApiKey(entered);
  box("Config Updated", [
    `${chalk.dim("openaiApiKey:")} ${chalk.green(maskApiKey(getConfiguredApiKey()))}`,
  ]);
}

async function setModelInteractive() {
  const current = getConfiguredModel();
  const selected = await select({
    message: `Select default model (${chalk.yellow(current)})`,
    choices: suggestedModels,
    default: suggestedModels.some((m) => m.value === current)
      ? current
      : "__custom",
  });

  const model =
    selected === "__custom"
      ? await input({
          message: "Custom model ID:",
          default: current,
          validate: (value) =>
            value.trim().length > 0 || "Model ID cannot be empty.",
        })
      : selected;

  setConfiguredModel(model);
  box("Config Updated", [
    `${chalk.dim("openaiModel:")} ${chalk.green(getConfiguredModel())}`,
  ]);
}

async function runInteractiveSetup() {
  box("NLC Config", [
    `${chalk.dim("Config file:")} ${chalk.yellow(getConfigPath())}`,
    `${chalk.dim("Current key:")} ${chalk.yellow(maskApiKey(getConfiguredApiKey()))}`,
    `${chalk.dim("Current model:")} ${chalk.yellow(getConfiguredModel())}`,
  ]);

  const step = await select({
    message: "What do you want to configure?",
    choices: [
      { value: "key", name: "Set OpenAI API key" },
      { value: "model", name: "Set default model" },
      { value: "both", name: "Set both" },
    ],
    default: "both",
  });

  if (step === "key" || step === "both") {
    await setApiKeyInteractive();
  }

  if (step === "model" || step === "both") {
    await setModelInteractive();
  }
}

export function registerConfigCommand(program: Command) {
  const config = program
    .command("config")
    .description("Configure NLC defaults (API key and model)")
    .action(async () => {
      await runInteractiveSetup();
    });

  config
    .command("show")
    .description("Show current configuration")
    .action(() => {
      box("NLC Config", [
        `${chalk.dim("Config file:")} ${chalk.yellow(getConfigPath())}`,
        `${chalk.dim("OpenAI API key:")} ${chalk.yellow(maskApiKey(getConfiguredApiKey()))}`,
        `${chalk.dim("Model:")} ${chalk.yellow(getConfiguredModel())}`,
      ]);
    });

  config
    .command("key")
    .description("Set or clear OpenAI API key")
    .argument("[apiKey]", "OpenAI API key (starts with sk-)")
    .option("--clear", "Remove configured API key")
    .action(
      async (apiKey: string | undefined, options: { clear?: boolean }) => {
        if (options.clear) {
          clearConfiguredApiKey();
          box("Config Updated", [
            `${chalk.dim("openaiApiKey:")} ${chalk.green("(cleared)")}`,
          ]);
          return;
        }

        if (apiKey?.trim()) {
          const verdict = validateOpenAiKey(apiKey);
          if (verdict !== true) {
            throw new Error(verdict);
          }
          setConfiguredApiKey(apiKey);
          box("Config Updated", [
            `${chalk.dim("openaiApiKey:")} ${chalk.green(maskApiKey(getConfiguredApiKey()))}`,
          ]);
          return;
        }

        await setApiKeyInteractive();
      },
    );

  config
    .command("model")
    .description("Set default model")
    .argument("[modelId]", "Model ID, e.g. gpt-5.3-codex")
    .action(async (modelId: string | undefined) => {
      if (modelId?.trim()) {
        setConfiguredModel(modelId);
        box("Config Updated", [
          `${chalk.dim("openaiModel:")} ${chalk.green(getConfiguredModel())}`,
        ]);
        return;
      }

      await setModelInteractive();
    });

  config
    .command("reset")
    .description("Reset model to default")
    .action(() => {
      setConfiguredModel(getDefaultModel());
      box("Config Updated", [
        `${chalk.dim("openaiModel:")} ${chalk.green(getConfiguredModel())}`,
      ]);
    });
}
