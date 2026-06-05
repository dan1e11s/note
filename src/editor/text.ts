const BLOCK_TAGS = new Set([
  "DIV",
  "P",
  "LI",
  "SECTION",
  "ARTICLE",
  "BLOCKQUOTE",
  "PRE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6"
]);

export function readText(root: HTMLElement): string {
  let text = "";

  const visit = (node: Node): void => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent ?? "";
        return;
      }

      if (child instanceof HTMLBRElement) {
        text += "\n";
        return;
      }

      if (child instanceof HTMLElement) {
        if (BLOCK_TAGS.has(child.tagName) && text.length > 0 && !text.endsWith("\n")) {
          text += "\n";
        }
        visit(child);
      }
    });
  };

  visit(root);
  return text;
}

export function placeCaretAtEnd(element: HTMLElement): void {
  const selection = window.getSelection();
  if (selection === null) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function getCaretOffset(root: HTMLElement): number | null {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.endContainer)) {
    return null;
  }

  const prefix = document.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.endContainer, range.endOffset);

  const wrapper = document.createElement("div");
  wrapper.append(prefix.cloneContents());
  return readText(wrapper).length;
}

export function setCaretOffset(root: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (selection === null) {
    return;
  }

  const range = document.createRange();
  let remaining = offset;
  let placed = false;

  const visit = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        range.setStart(node, remaining);
        placed = true;
        return true;
      }
      remaining -= length;
      return false;
    }

    if (node instanceof HTMLBRElement) {
      if (remaining === 0) {
        range.setStartBefore(node);
        placed = true;
        return true;
      }
      remaining -= 1;
      return false;
    }

    const children = node.childNodes;
    for (let i = 0; i < children.length; i += 1) {
      const child = children.item(i);
      if (child !== null && visit(child)) {
        return true;
      }
    }
    return false;
  };

  visit(root);

  if (placed) {
    range.collapse(true);
  } else {
    range.selectNodeContents(root);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

export function insertTextAtCaret(text: string): void {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
