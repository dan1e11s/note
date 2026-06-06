import { renderInto } from "./linkify";
import {
  getCaretOffset,
  insertTextAtCaret,
  placeCaretAtEnd,
  readText,
  setCaretOffset
} from "./text";

const SAVE_DELAY = 400;

export interface EditorOptions {
  body: string;
  onSave: (text: string) => void;
}

export interface EditorHandle {
  element: HTMLElement;
  focus(): void;
  destroy(): void;
}

let currentFlush: (() => void) | null = null;
let lifecycleBound = false;

function bindLifecycle(): void {
  if (lifecycleBound) {
    return;
  }
  lifecycleBound = true;

  const run = (): void => {
    if (currentFlush !== null) {
      currentFlush();
    }
  };

  window.addEventListener("pagehide", run);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      run();
    }
  });
}

function isBoundaryInput(event: InputEvent): boolean {
  if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak") {
    return true;
  }
  return event.data !== null && /\s/.test(event.data);
}

export function createEditor(options: EditorOptions): EditorHandle {
  const element = document.createElement("div");
  element.className = "editor";
  element.contentEditable = "true";
  element.spellcheck = false;
  element.setAttribute("role", "textbox");
  element.setAttribute("aria-multiline", "true");
  element.setAttribute("aria-label", "Текст заметки");
  renderInto(element, options.body);

  let saveTimer = 0;
  let lastSaved = options.body;
  let composing = false;
  let lastPointerType = "mouse";

  const persist = (text: string): void => {
    if (text === lastSaved) {
      return;
    }
    lastSaved = text;
    options.onSave(text);
  };

  const flush = (): void => {
    if (saveTimer !== 0) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
    }
    persist(readText(element));
  };

  const scheduleSave = (): void => {
    if (saveTimer !== 0) {
      window.clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(flush, SAVE_DELAY);
  };

  const relinkify = (): void => {
    const offset = document.activeElement === element ? getCaretOffset(element) : null;
    const text = readText(element);
    renderInto(element, text);
    if (offset !== null) {
      setCaretOffset(element, offset);
    }
  };

  const onInput = (event: Event): void => {
    scheduleSave();
    if (composing) {
      return;
    }
    if (isBoundaryInput(event as InputEvent)) {
      relinkify();
    }
  };

  const onCompositionStart = (): void => {
    composing = true;
  };

  const onCompositionEnd = (): void => {
    composing = false;
    scheduleSave();
    relinkify();
  };

  const onBlur = (): void => {
    relinkify();
    flush();
  };

  const onPaste = (event: ClipboardEvent): void => {
    event.preventDefault();
    const text = event.clipboardData === null ? "" : event.clipboardData.getData("text/plain");
    if (text.length === 0) {
      return;
    }
    insertTextAtCaret(text);
    scheduleSave();
    relinkify();
  };

  const onPointerDown = (event: PointerEvent): void => {
    lastPointerType = event.pointerType;
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const link = target.closest("a.note-link");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }
    const open =
      event.metaKey ||
      event.ctrlKey ||
      lastPointerType === "touch" ||
      lastPointerType === "pen";
    if (!open) {
      return;
    }
    event.preventDefault();
    window.open(link.href, "_blank", "noopener,noreferrer");
  };

  element.addEventListener("input", onInput);
  element.addEventListener("compositionstart", onCompositionStart);
  element.addEventListener("compositionend", onCompositionEnd);
  element.addEventListener("blur", onBlur);
  element.addEventListener("paste", onPaste);
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("click", onClick);

  currentFlush = flush;
  bindLifecycle();

  return {
    element,
    focus(): void {
      element.focus();
      placeCaretAtEnd(element);
    },
    destroy(): void {
      flush();
      element.removeEventListener("input", onInput);
      element.removeEventListener("compositionstart", onCompositionStart);
      element.removeEventListener("compositionend", onCompositionEnd);
      element.removeEventListener("blur", onBlur);
      element.removeEventListener("paste", onPaste);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("click", onClick);
      if (currentFlush === flush) {
        currentFlush = null;
      }
    }
  };
}
