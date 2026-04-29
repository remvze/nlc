export const shell =
  process.env.SHELL ??
  process.env.ComSpec ??
  (process.platform === "win32" ? "cmd.exe" : "sh");
