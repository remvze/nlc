import chalk from "chalk";
import cliMd from "cli-markdown";

export function renderMarkdown(title: string, content: string) {
  const rendered = cliMd(content);

  console.log(chalk.cyan.bold(`\n${title}`));
  console.log(rendered.trim() || "(No response generated.)");
  console.log("");
}
