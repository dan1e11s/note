import type { RouteContext } from "../router";
import { createEditor } from "../editor/editor";
import type { EditorHandle } from "../editor/editor";
import { getNode, renameNode, setNoteFont } from "../store/tree";
import type { FontChoice, NoteNode } from "../store/types";
import { ROOT_ID } from "../store/types";
import { createIconButton, createIconElement, icons, setIcon } from "../ui/icons";
import { createThemeToggle } from "../ui/theme";

const TITLE_SAVE_DELAY = 400;
const FLASH_DURATION = 1200;

const FONT_OPTIONS: ReadonlyArray<{ value: FontChoice; label: string }> = [
  { value: "system", label: "Системный шрифт" },
  { value: "serif", label: "Шрифт с засечками" },
  { value: "mono", label: "Моноширинный шрифт" }
];

let renderToken = 0;

export function renderNoteView(host: HTMLElement, context: RouteContext): void {
  const noteId = context.params.id ?? "";
  const token = ++renderToken;
  void mount(host, noteId, token);
}

async function mount(host: HTMLElement, noteId: string, token: number): Promise<void> {
  const node = await getNode(noteId);

  if (token !== renderToken) {
    return;
  }

  if (node === undefined || node.type !== "note") {
    window.location.hash = "#/";
    return;
  }

  const note = node;

  const screen = document.createElement("main");
  screen.className = "screen screen-note";
  screen.dataset.noteId = note.id;

  const toolbar = document.createElement("header");
  toolbar.className = "screen-header editor-toolbar";

  const back = document.createElement("a");
  back.className = "icon-button";
  back.href = note.parentId === ROOT_ID ? "#/" : "#/folder/" + note.parentId;
  back.title = "Назад";
  back.setAttribute("aria-label", "Назад к папке");
  back.append(createIconElement(icons.chevronLeft));

  const editor = createEditor(note);

  const title = createTitleInput(note);
  const actions = createActions(note, editor);
  const fontControl = createFontControl(note, editor);

  toolbar.append(back, title, fontControl, actions);
  screen.append(toolbar, editor.element);

  host.replaceChildren(screen);
  editor.focus();
}

function createTitleInput(note: NoteNode): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "note-title-input";
  input.value = note.title;
  input.setAttribute("aria-label", "Название заметки");

  let timer = 0;

  const save = (): void => {
    const value = input.value.trim();
    if (value.length === 0 || value === note.title) {
      return;
    }
    note.title = value;
    void renameNode(note.id, value);
  };

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(save, TITLE_SAVE_DELAY);
  });

  input.addEventListener("blur", () => {
    window.clearTimeout(timer);
    if (input.value.trim().length === 0) {
      input.value = note.title;
      return;
    }
    save();
  });

  return input;
}

function createActions(note: NoteNode, editor: EditorHandle): HTMLElement {
  const group = document.createElement("div");
  group.className = "editor-actions";

  const undoButton = createIconButton(icons.reset, "Отменить", "icon-button");
  undoButton.addEventListener("click", () => {
    editor.undo();
  });

  const shareButton = createIconButton(icons.share, "Поделиться", "icon-button");
  shareButton.addEventListener("click", () => {
    void shareNote(note, editor.getText(), shareButton);
  });

  const clearButton = createIconButton(icons.cross, "Очистить заметку", "icon-button danger");
  clearButton.addEventListener("click", () => {
    editor.clear();
  });

  group.append(createThemeToggle(), undoButton, shareButton, clearButton);
  return group;
}

function createFontControl(note: NoteNode, editor: EditorHandle): HTMLElement {
  const control = document.createElement("div");
  control.className = "font-control";
  control.setAttribute("role", "group");
  control.setAttribute("aria-label", "Шрифт");

  const buttons = new Map<FontChoice, HTMLButtonElement>();

  const apply = (font: FontChoice, persist: boolean): void => {
    editor.setFont(font);
    buttons.forEach((button, value) => {
      const active = value === font;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (persist) {
      void setNoteFont(note.id, font);
    }
  };

  for (const option of FONT_OPTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "font-option";
    button.dataset.font = option.value;
    button.textContent = "Aa";
    button.setAttribute("aria-label", option.label);
    button.addEventListener("click", () => {
      apply(option.value, true);
    });
    buttons.set(option.value, button);
    control.append(button);
  }

  apply(note.font, false);
  return control;
}

async function shareNote(note: NoteNode, text: string, button: HTMLButtonElement): Promise<void> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: note.title, text });
    } catch {
      return;
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    flashIcon(button, icons.check);
  } catch {
    flashIcon(button, icons.cross);
  }
}

function flashIcon(button: HTMLButtonElement, svg: string): void {
  setIcon(button, svg);
  button.disabled = true;
  window.setTimeout(() => {
    button.disabled = false;
    setIcon(button, icons.share);
  }, FLASH_DURATION);
}
