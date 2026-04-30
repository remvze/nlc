import chalk from "chalk";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

marked.setOptions({
  renderer: new TerminalRenderer({
    reflowText: true,
  }),
});

export function renderMarkdown(title: string, content: string) {
  const rendered = marked.parse(content || "", {
    async: false,
  }) as string;

  console.log(chalk.cyan.bold(`\n${title}`));
  console.log(rendered.trim() || "(No response generated.)");
  console.log("");
}
