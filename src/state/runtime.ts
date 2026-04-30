let autoAcceptChanges = false;
let runtimeLogger: {
  startTool: (name: string, input?: Record<string, unknown>) => {
    finish: (payload: {
      success: boolean;
      output?: Record<string, unknown>;
      error?: string;
    }) => void;
  };
  info: (message: string) => void;
  success: (message: string) => void;
  warn: (message: string) => void;
} | null = null;

export function setAutoAcceptChanges(value: boolean) {
  autoAcceptChanges = value;
}

export function getAutoAcceptChanges() {
  return autoAcceptChanges;
}

export function setRuntimeLogger(
  logger:
    | {
        startTool: (name: string, input?: Record<string, unknown>) => {
          finish: (payload: {
            success: boolean;
            output?: Record<string, unknown>;
            error?: string;
          }) => void;
        };
        info: (message: string) => void;
        success: (message: string) => void;
        warn: (message: string) => void;
      }
    | null,
) {
  runtimeLogger = logger;
}

export function getRuntimeLogger() {
  return runtimeLogger;
}
