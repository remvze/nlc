import { Command } from 'commander';

import { registerConfigCommands } from './commands/config';
import { registerDoCommands } from './commands/do';

import pkg from '../package.json';

const program = new Command();

program
  .name('nlc')
  .description(
    'A lightweight, AI-powered terminal assistant for natural language commands',
  )
  .version(pkg.version);

registerDoCommands(program);
registerConfigCommands(program);

export { program };
