import boxen from "boxen";

export function box(title: string, bodyLines: string[] = []) {
  const body = bodyLines.length > 0 ? `${bodyLines.join("\n").trim()}` : "";

  console.log(
    boxen(body, {
      title,
      titleAlignment: "left",
      borderStyle: "round",
      borderColor: "cyan",
      padding: { left: 1, right: 1 },
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
    }),
  );
}
