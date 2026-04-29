import { execa } from "execa";

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

    subprocess.stdout?.on("data", (data) => {
      process.stdout.write(data);
    });

    subprocess.stderr?.on("data", (data) => {
      process.stderr.write(data);
    });

    const result = await subprocess;

    return {
      error: null,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      exitCode: result.exitCode ?? 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      error: message,
      stdout: "",
      stderr: "",
      exitCode: 1,
    };
  }
}
