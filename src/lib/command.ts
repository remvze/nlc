import { execa } from "execa";
import chalk from "chalk";

function writeStream(prefix: string, chunk: Buffer | string, isError = false) {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);
  const writer = isError ? process.stderr : process.stdout;
  const colorizedPrefix = isError
    ? chalk.red.dim(prefix)
    : chalk.blue.dim(prefix);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line && i === lines.length - 1) continue;
    writer.write(`${colorizedPrefix} ${line}\n`);
  }
}

export async function runCommand(
  command: string,
  cwd: string,
): Promise<{
  error: string | undefined | null;
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  try {
    const subprocess = execa(command, {
      cwd,
      shell: true,
      stdio: "pipe",
    });

    subprocess.stdout?.on("data", (data) => writeStream("stdout>", data, false));
    subprocess.stderr?.on("data", (data) => writeStream("stderr>", data, true));

    const result = await subprocess;

    return {
      error: null,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      exitCode: result.exitCode ?? 0,
    };
  } catch (error: unknown) {
    const execaError = error as {
      stdout?: string;
      stderr?: string;
      exitCode?: number;
    };
    const message = error instanceof Error ? error.message : String(error);

    return {
      error: message,
      stdout: execaError.stdout ?? "",
      stderr: execaError.stderr ?? "",
      exitCode: typeof execaError.exitCode === "number" ? execaError.exitCode : 1,
    };
  }
}
