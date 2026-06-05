import { saveNoteBody } from "../store/tree";
import type { FontChoice, NoteNode } from "../store/types";
import { renderInto } from "./linkify";
import {
  getCaretOffset,
  insertTextAtCaret,
  placeCaretAtEnd,
  readText,
  setCaretOffset
} from "./text";
import { History } from "./undo";
import type { Snapshot } from "./undo";

const SAVE_DELAY = 400;
const SEAL_DELAY = 500;

export interface EditorHandle {
  element: HTMLElement;
  setFont(font: FontChoice): void;
  focus(): void;
  undo(): void;
  redo(): void;
  clear(): void;
  getText(): string;
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

export function createEditor(note: NoteNode): EditorHandle {
  const element = document.createElement("div");
  element.className = "editor";
  element.contentEditable = "true";
  element.spellcheck = false;
  element.setAttribute("role", "textbox");
  element.setAttribute("aria-multiline", "true");
  element.setAttribute("aria-label", "Текст заметки");
  element.dataset.font = note.font;
  renderInto(element, note.body);

  const history = new History({ text: note.body, caret: note.body.length });

  let saveTimer = 0;
  let sealTimer = 0;
  let lastSaved = note.body;
  let composing = false;
  let lastPointerType = "mouse";

  const snapshot = (): Snapshot => {
    const text = readText(element);
    const caret = getCaretOffset(element);
    return { text, caret: caret ?? text.length };
  };

  const persist = (text: string): void => {
    if (text === lastSaved) {
      return;
    }
    lastSaved = text;
    void saveNoteBody(note.id, text);
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

  const seal = (): void => {
    if (sealTimer !== 0) {
      window.clearTimeout(sealTimer);
      sealTimer = 0;
    }
    history.record(snapshot());
  };

  const scheduleSeal = (): void => {
    if (sealTimer !== 0) {
      window.clearTimeout(sealTimer);
    }
    sealTimer = window.setTimeout(seal, SEAL_DELAY);
  };

  const relinkify = (): void => {
    const offset = document.activeElement === element ? getCaretOffset(element) : null;
    const text = readText(element);
    renderInto(element, text);
    if (offset !== null) {
      setCaretOffset(element, offset);
    }
  };

  const applySnapshot = (snap: Snapshot): void => {
    renderInto(element, snap.text);
    element.focus();
    setCaretOffset(element, snap.caret);
    persist(snap.text);
  };

  const undo = (): void => {
    seal();
    const snap = history.undo();
    if (snap !== null) {
      applySnapshot(snap);
    }
  };

  const redo = (): void => {
    seal();
    const snap = history.redo();
    if (snap !== null) {
      applySnapshot(snap);
    }
  };

  const clear = (): void => {
    seal();
    renderInto(element, "");
    history.record({ text: "", caret: 0 });
    persist("");
    element.focus();
  };

  const onInput = (event: Event): void => {
    scheduleSave();
    scheduleSeal();
    if (composing) {
      return;
    }
    if (isBoundaryInput(event as InputEvent)) {
      relinkify();
      seal();
    }
  };

  const onCompositionStart = (): void => {
    composing = true;
  };

  const onCompositionEnd = (): void => {
    composing = false;
    scheduleSave();
    relinkify();
    seal();
  };

  const onBlur = (): void => {
    relinkify();
    seal();
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
    seal();
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

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!(event.metaKey || event.ctrlKey)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    } else if (key === "y") {
      event.preventDefault();
      redo();
    }
  };

  element.addEventListener("input", onInput);
  element.addEventListener("compositionstart", onCompositionStart);
  element.addEventListener("compositionend", onCompositionEnd);
  element.addEventListener("blur", onBlur);
  element.addEventListener("paste", onPaste);
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("click", onClick);
  element.addEventListener("keydown", onKeyDown);

  currentFlush = flush;
  bindLifecycle();

  return {
    element,
    setFont(font: FontChoice): void {
      element.dataset.font = font;
    },
    focus(): void {
      element.focus();
      placeCaretAtEnd(element);
    },
    undo,
    redo,
    clear,
    getText(): string {
      return readText(element);
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
      element.removeEventListener("keydown", onKeyDown);
      if (currentFlush === flush) {
        currentFlush = null;
      }
    }
  };
}
