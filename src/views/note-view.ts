import type { RouteContext } from "../router";
import { createEditor } from "../editor/editor";
import { openNote, renameNode, saveNoteBody } from "../store/vault";
import type { NoteNode } from "../store/types";
import { ROOT_ID } from "../store/types";
import { createIconElement, icons } from "../ui/icons";

const TITLE_SAVE_DELAY = 400;

let renderToken = 0;

export function renderNoteView(host: HTMLElement, context: RouteContext): void {
  const noteId = context.params.id ?? "";
  const token = ++renderToken;
  void mount(host, noteId, token);
}

async function mount(host: HTMLElement, noteId: string, token: number): Promise<void> {
  const access = await openNote(noteId);

  if (token !== renderToken) {
    return;
  }

  if (access.status === "missing") {
    window.location.hash = "#/";
    return;
  }

  if (access.status === "locked") {
    window.location.hash = "#/folder/" + access.redirectTo;
    return;
  }

  const note = access.note;

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

  const editor = createEditor({
    body: access.body,
    onSave: (text) => {
      void saveNoteBody(note, text);
    }
  });

  const title = createTitleInput(note, access.title);

  toolbar.append(back, title);
  screen.append(toolbar, editor.element);

  host.replaceChildren(screen);
  editor.focus();
}

function createTitleInput(note: NoteNode, initialTitle: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "note-title-input";
  input.value = initialTitle;
  input.setAttribute("aria-label", "Название заметки");

  let currentTitle = initialTitle;
  let timer = 0;

  const save = (): void => {
    const value = input.value.trim();
    if (value.length === 0 || value === currentTitle) {
      return;
    }
    currentTitle = value;
    void renameNode(note, value);
  };

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(save, TITLE_SAVE_DELAY);
  });

  input.addEventListener("blur", () => {
    window.clearTimeout(timer);
    if (input.value.trim().length === 0) {
      input.value = currentTitle;
      return;
    }
    save();
  });

  return input;
}
