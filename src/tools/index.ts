import type { ToolSet } from "ai";

import { list_files } from "./list-files";
import { read_file } from "./read-file";
import { create_or_replace_file } from "./create-or-replace-file";
import { edit_file } from "./edit-file";
import { search_files } from "./search-files";
import { git_command } from "./git-command";
import { run_command } from "./run-command";

export const tools: ToolSet = {
  list_files,
  read_file,
  create_or_replace_file,
  edit_file,
  search_files,
  git_command,
  run_command,
};
