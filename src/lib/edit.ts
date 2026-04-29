export type EditOperation =
  | {
      type: "find_replace";
      find: string;
      replace: string;
      all?: boolean;
    }
  | {
      type: "insert_at_line";
      line: number;
      content: string;
    }
  | {
      type: "delete_range";
      startLine: number;
      endLine: number;
    };

export function applyEditOperation(
  content: string,
  operation: EditOperation,
): string {
  switch (operation.type) {
    case "find_replace": {
      if (!operation.find) {
        throw new Error("find_replace requires a non-empty 'find' string.");
      }

      if (operation.all) {
        return content.split(operation.find).join(operation.replace);
      }

      const index = content.indexOf(operation.find);
      if (index === -1) {
        throw new Error("find_replace could not find the target text.");
      }

      return (
        content.slice(0, index) +
        operation.replace +
        content.slice(index + operation.find.length)
      );
    }

    case "insert_at_line": {
      if (!Number.isInteger(operation.line) || operation.line < 1) {
        throw new Error("insert_at_line requires line >= 1.");
      }

      const lines = content.split(/\r?\n/);
      const insertIndex = operation.line - 1;

      if (insertIndex > lines.length) {
        throw new Error(
          `insert_at_line line ${operation.line} is out of range (max ${lines.length + 1}).`,
        );
      }

      lines.splice(insertIndex, 0, operation.content);
      return lines.join("\n");
    }

    case "delete_range": {
      const { startLine, endLine } = operation;
      if (
        !Number.isInteger(startLine) ||
        !Number.isInteger(endLine) ||
        startLine < 1 ||
        endLine < startLine
      ) {
        throw new Error(
          "delete_range requires integer startLine/endLine with 1 <= startLine <= endLine.",
        );
      }

      const lines = content.split(/\r?\n/);

      if (endLine > lines.length) {
        throw new Error(
          `delete_range endLine ${endLine} is out of range (max ${lines.length}).`,
        );
      }

      lines.splice(startLine - 1, endLine - startLine + 1);
      return lines.join("\n");
    }
  }
}
