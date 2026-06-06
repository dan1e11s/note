import archive from "~icons/radix-icons/archive";
import fileText from "~icons/radix-icons/file-text";
import filePlus from "~icons/radix-icons/file-plus";
import pencil from "~icons/radix-icons/pencil-1";
import trash from "~icons/radix-icons/trash";
import chevronLeft from "~icons/radix-icons/chevron-left";
import download from "~icons/radix-icons/download";
import upload from "~icons/radix-icons/upload";
import lockClosed from "~icons/radix-icons/lock-closed";
import lockOpen from "~icons/radix-icons/lock-open-1";

export const icons = {
  archive,
  fileText,
  filePlus,
  pencil,
  trash,
  chevronLeft,
  download,
  upload,
  lockClosed,
  lockOpen
} as const;

export function createIconElement(svg: string): SVGElement {
  const template = document.createElement("template");
  template.innerHTML = svg.trim();
  const node = template.content.firstElementChild;
  if (!(node instanceof SVGElement)) {
    throw new Error("Invalid icon markup");
  }
  node.classList.add("icon");
  node.setAttribute("aria-hidden", "true");
  node.setAttribute("focusable", "false");
  return node;
}

export function setIcon(target: HTMLElement, svg: string): void {
  target.replaceChildren(createIconElement(svg));
}

export function createIconButton(svg: string, label: string, className: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(createIconElement(svg));
  return button;
}
