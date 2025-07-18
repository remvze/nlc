import boxen from 'boxen';
import { highlight } from 'cli-highlight';
import logSymbols from 'log-symbols';
import chalk from 'chalk';

export function info(message: string) {
  console.log(logSymbols.info, message);
}

export function success(message: string) {
  console.log(logSymbols.success, message);
}

export function error(message: string) {
  console.error(logSymbols.error, message);
}

function commandBox(command: string, title: string) {
  console.log(
    boxen(highlight(command), { title: chalk.bold.white(title), padding: 1 }),
  );
}

export function logCommand(command: string) {
  commandBox(command, 'Proposed Command');
}

export function logScript(script: string) {
  commandBox(script, 'Generated Script');
}
