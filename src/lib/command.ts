import execSh from 'exec-sh';

import { error } from './logger';

export async function runCommand(command: string) {
  console.log();

  return new Promise(resolve => {
    execSh(command, { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) error(err.message);
      if (stdout) console.log(stdout.trim());
      if (stderr) console.error(stderr.trim());

      resolve(null);
    });
  });
}
