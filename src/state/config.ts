import Conf from "conf";

const DEFAULT_MODEL = "gpt-5.3-codex";

type NlcConfig = {
  openaiApiKey?: string;
  openaiModel: string;
};

const store = new Conf<NlcConfig>({
  projectName: "nlc",
  configName: "config",
  defaults: {
    openaiModel: DEFAULT_MODEL,
  },
});

export function getConfigPath() {
  return store.path;
}

export function getConfiguredApiKey() {
  return store.get("openaiApiKey");
}

export function setConfiguredApiKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("API key cannot be empty.");
  }
  store.set("openaiApiKey", trimmed);
}

export function clearConfiguredApiKey() {
  store.delete("openaiApiKey");
}

export function getConfiguredModel() {
  return store.get("openaiModel") ?? DEFAULT_MODEL;
}

export function setConfiguredModel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Model cannot be empty.");
  }
  store.set("openaiModel", trimmed);
}

export function getDefaultModel() {
  return DEFAULT_MODEL;
}

export function maskApiKey(value: string | undefined) {
  if (!value) return "(not set)";
  if (value.length <= 10) return "********";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
