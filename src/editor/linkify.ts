const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}"'»]+$/;

export function renderInto(root: HTMLElement, text: string): void {
  root.replaceChildren();

  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (index > 0) {
      root.append(document.createElement("br"));
    }
    appendLine(root, line);
  });
}

function appendLine(root: HTMLElement, line: string): void {
  if (line.length === 0) {
    return;
  }

  URL_PATTERN.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null = URL_PATTERN.exec(line);

  while (match !== null) {
    const raw = match[0];
    const start = match.index;
    const url = raw.replace(TRAILING_PUNCTUATION, "");

    if (url.length === 0) {
      URL_PATTERN.lastIndex = start + raw.length;
      match = URL_PATTERN.exec(line);
      continue;
    }

    if (start > cursor) {
      root.append(document.createTextNode(line.slice(cursor, start)));
    }

    root.append(createLink(url));
    cursor = start + url.length;
    URL_PATTERN.lastIndex = cursor;
    match = URL_PATTERN.exec(line);
  }

  if (cursor < line.length) {
    root.append(document.createTextNode(line.slice(cursor)));
  }
}

function createLink(value: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "note-link";
  link.href = value.startsWith("www.") ? "https://" + value : value;
  link.textContent = value;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}
