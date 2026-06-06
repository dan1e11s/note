import type { RouteContext } from "../router";
import type { FolderNode, TreeNode } from "../store/types";
import { ROOT_ID } from "../store/types";
import { deleteNode, getAncestors, getNode, listChildren } from "../store/tree";
import { exportBackup, importBackup } from "../store/backup";
import {
  contentsProtectorId,
  createFolderIn,
  createNoteIn,
  createProtectedFolder,
  displayTitle,
  isProtectedRoot,
  isUnlocked,
  lock,
  lockAllExcept,
  renameNode,
  unlock
} from "../store/vault";
import { createIconButton, createIconElement, icons } from "../ui/icons";
import { askPassword } from "../ui/password";

const DEFAULT_FOLDER_TITLE = "Новая папка";
const DEFAULT_NOTE_TITLE = "Новая заметка";

interface Crumb {
  id: string;
  title: string;
}

let renderToken = 0;

export function renderFolderView(host: HTMLElement, context: RouteContext): void {
  const folderId = context.params.id ?? ROOT_ID;
  const token = ++renderToken;
  void mount(host, folderId, token);
}

function reload(host: HTMLElement, folderId: string): Promise<void> {
  const token = ++renderToken;
  return mount(host, folderId, token);
}

async function mount(host: HTMLElement, folderId: string, token: number): Promise<void> {
  const folder = folderId === ROOT_ID ? null : (await getNode(folderId)) ?? null;

  if (token !== renderToken) {
    return;
  }

  if (folderId !== ROOT_ID && folder === null) {
    window.location.hash = "#/";
    return;
  }

  const protectorId = contentsProtectorId(folder);
  lockAllExcept(protectorId);

  if (protectorId !== null && folder !== null && folder.type === "folder" && !isUnlocked(protectorId)) {
    renderLockScreen(host, folder, protectorId);
    return;
  }

  await renderContents(host, folderId, protectorId, token);
}

async function renderContents(
  host: HTMLElement,
  folderId: string,
  protectorId: string | null,
  token: number
): Promise<void> {
  const children = await listChildren(folderId);
  const crumbs = await buildCrumbs(folderId);

  const titled: { node: TreeNode; title: string }[] = [];
  for (const node of children) {
    titled.push({ node, title: await displayTitle(node) });
  }

  if (token !== renderToken) {
    return;
  }

  const screen = document.createElement("main");
  screen.className = "screen screen-folder";
  screen.dataset.folderId = folderId;

  const header = document.createElement("header");
  header.className = "screen-header";

  const breadcrumbs = document.createElement("nav");
  breadcrumbs.className = "breadcrumbs";
  breadcrumbs.setAttribute("aria-label", "Навигация по папкам");
  renderCrumbs(breadcrumbs, crumbs);

  const headerActions = document.createElement("div");
  headerActions.className = "header-actions";

  const importButton = createIconButton(icons.upload, "Импорт заметок", "icon-button");
  const exportButton = createIconButton(icons.download, "Экспорт заметок", "icon-button");
  const newFolderButton = createIconButton(icons.archive, "Новая папка", "icon-button");
  const newNoteButton = createIconButton(icons.filePlus, "Новая заметка", "icon-button primary");

  headerActions.append(importButton, exportButton);

  if (protectorId === null) {
    const newProtectedButton = createIconButton(icons.lockClosed, "Защищённая папка", "icon-button");
    newProtectedButton.addEventListener("click", () => {
      void handleCreateProtected(host, folderId);
    });
    headerActions.append(newProtectedButton);
  } else {
    const lockButton = createIconButton(icons.lockOpen, "Заблокировать", "icon-button");
    lockButton.addEventListener("click", () => {
      lock(protectorId);
      void reload(host, folderId);
    });
    headerActions.append(lockButton);
  }

  headerActions.append(newFolderButton, newNoteButton);
  header.append(breadcrumbs, headerActions);

  const list = document.createElement("ul");
  list.className = "node-list";

  if (titled.length === 0) {
    const empty = document.createElement("li");
    empty.className = "node-empty";
    empty.textContent = "Пусто";
    list.append(empty);
  } else {
    for (const entry of titled) {
      list.append(createItem(host, entry.node, entry.title, folderId));
    }
  }

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json,.json";
  fileInput.hidden = true;

  screen.append(header, list, fileInput);
  host.replaceChildren(screen);

  newFolderButton.addEventListener("click", () => {
    void handleCreateFolder(host, folderId, protectorId);
  });
  newNoteButton.addEventListener("click", () => {
    void handleCreateNote(folderId, protectorId);
  });
  exportButton.addEventListener("click", () => {
    void exportBackup();
  });
  importButton.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    void handleImport(host, fileInput, folderId);
  });
}

function renderLockScreen(host: HTMLElement, folder: FolderNode, protectorId: string): void {
  const screen = document.createElement("main");
  screen.className = "screen screen-locked";

  const header = document.createElement("header");
  header.className = "screen-header";

  const back = document.createElement("a");
  back.className = "icon-button";
  back.href = folder.parentId === ROOT_ID ? "#/" : "#/folder/" + folder.parentId;
  back.title = "Назад";
  back.setAttribute("aria-label", "Назад");
  back.append(createIconElement(icons.chevronLeft));
  header.append(back);

  const card = document.createElement("form");
  card.className = "lock-card";

  const badge = document.createElement("div");
  badge.className = "lock-badge";
  badge.append(createIconElement(icons.lockClosed));

  const heading = document.createElement("h2");
  heading.className = "lock-title";
  heading.textContent = folder.title;

  const hint = document.createElement("p");
  hint.className = "lock-hint";
  hint.textContent = "Папка защищена паролем";

  const password = document.createElement("input");
  password.type = "password";
  password.className = "field";
  password.placeholder = "Пароль";
  password.autocomplete = "current-password";
  password.setAttribute("aria-label", "Пароль");

  const error = document.createElement("span");
  error.className = "modal-error";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "action action-primary";
  submit.textContent = "Открыть";

  card.append(badge, heading, hint, password, error, submit);

  card.addEventListener("submit", (event) => {
    event.preventDefault();
    void attemptUnlock();
  });

  const attemptUnlock = async (): Promise<void> => {
    if (password.value.length === 0) {
      return;
    }
    submit.disabled = true;
    const ok = await unlock(protectorId, password.value);
    submit.disabled = false;
    if (ok) {
      void reload(host, folder.id);
      return;
    }
    error.textContent = "Неверный пароль";
    password.value = "";
    password.focus();
  };

  screen.append(header, card);
  host.replaceChildren(screen);
  password.focus();
}

async function buildCrumbs(folderId: string): Promise<Crumb[]> {
  const crumbs: Crumb[] = [{ id: ROOT_ID, title: "NOTE" }];

  if (folderId !== ROOT_ID) {
    const ancestors = await getAncestors(folderId);
    for (const node of ancestors) {
      crumbs.push({ id: node.id, title: await displayTitle(node) });
    }
  }

  return crumbs;
}

function renderCrumbs(container: HTMLElement, crumbs: Crumb[]): void {
  container.replaceChildren();

  crumbs.forEach((crumb, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "crumb-separator";
      separator.textContent = "/";
      container.append(separator);
    }

    if (index === crumbs.length - 1) {
      const current = document.createElement("span");
      current.className = "crumb crumb-current";
      current.textContent = crumb.title;
      container.append(current);
      return;
    }

    const link = document.createElement("a");
    link.className = "crumb";
    link.href = crumb.id === ROOT_ID ? "#/" : "#/folder/" + crumb.id;
    link.textContent = crumb.title;
    container.append(link);
  });
}

function createItem(
  host: HTMLElement,
  node: TreeNode,
  title: string,
  folderId: string
): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "node-item";
  item.dataset.id = node.id;
  item.dataset.type = node.type;

  const protectedRoot = isProtectedRoot(node);
  if (protectedRoot) {
    item.dataset.protected = "true";
  }

  const open = document.createElement("a");
  open.className = "node-open";
  open.href = (node.type === "folder" ? "#/folder/" : "#/note/") + node.id;

  const icon = document.createElement("span");
  icon.className = "node-icon";
  const glyph = node.type === "folder" ? (protectedRoot ? icons.lockClosed : icons.archive) : icons.fileText;
  icon.append(createIconElement(glyph));

  const titleEl = document.createElement("span");
  titleEl.className = "node-title";
  titleEl.textContent = title;

  open.append(icon, titleEl);

  const actions = document.createElement("div");
  actions.className = "node-actions";

  const rename = createIconButton(icons.pencil, "Переименовать", "icon-button");
  rename.addEventListener("click", () => {
    startRename(host, open, node, title, folderId);
  });

  const remove = createIconButton(icons.trash, "Удалить", "icon-button danger");
  remove.addEventListener("click", () => {
    void handleDelete(host, node, folderId);
  });

  actions.append(rename, remove);
  item.append(open, actions);
  return item;
}

async function handleCreateFolder(
  host: HTMLElement,
  parentId: string,
  protectorId: string | null
): Promise<void> {
  const folder = await createFolderIn(parentId, protectorId, DEFAULT_FOLDER_TITLE);
  await reload(host, parentId);
  focusRename(host, folder, DEFAULT_FOLDER_TITLE, parentId);
}

async function handleCreateNote(parentId: string, protectorId: string | null): Promise<void> {
  const note = await createNoteIn(parentId, protectorId, DEFAULT_NOTE_TITLE);
  window.location.hash = "#/note/" + note.id;
}

async function handleCreateProtected(host: HTMLElement, parentId: string): Promise<void> {
  const password = await askPassword({
    title: "Защищённая папка",
    message: "Содержимое будет зашифровано. Пароль нельзя восстановить — если забудете, данные не вернуть.",
    confirm: true,
    submitLabel: "Создать"
  });
  if (password === null) {
    return;
  }

  const folder = await createProtectedFolder(parentId, DEFAULT_FOLDER_TITLE, password);
  await reload(host, parentId);
  focusRename(host, folder, DEFAULT_FOLDER_TITLE, parentId);
}

async function handleDelete(host: HTMLElement, node: TreeNode, folderId: string): Promise<void> {
  const message = node.type === "folder" ? "Удалить папку и всё внутри?" : "Удалить заметку?";
  if (!window.confirm(message)) {
    return;
  }
  await deleteNode(node.id);
  await reload(host, folderId);
}

async function handleImport(host: HTMLElement, input: HTMLInputElement, folderId: string): Promise<void> {
  const file = input.files?.[0];
  if (file === undefined) {
    return;
  }

  try {
    const count = await importBackup(file);
    if (count === 0) {
      window.alert("В файле нет заметок для импорта");
      return;
    }
    await reload(host, folderId);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "Не удалось импортировать файл");
  }
}

function focusRename(host: HTMLElement, node: TreeNode, title: string, folderId: string): void {
  const item = document.querySelector('.node-item[data-id="' + node.id + '"]');
  if (!(item instanceof HTMLElement)) {
    return;
  }
  const open = item.querySelector(".node-open");
  if (!(open instanceof HTMLElement)) {
    return;
  }
  startRename(host, open, node, title, folderId);
}

function startRename(
  host: HTMLElement,
  open: HTMLElement,
  node: TreeNode,
  title: string,
  folderId: string
): void {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "node-rename-input";
  input.value = title;

  open.replaceWith(input);
  input.focus();
  input.select();

  let settled = false;

  const finish = async (save: boolean): Promise<void> => {
    if (settled) {
      return;
    }
    settled = true;

    if (save) {
      const value = input.value.trim();
      if (value.length > 0 && value !== title) {
        await renameNode(node, value);
      }
    }

    await reload(host, folderId);
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      void finish(false);
    }
  });

  input.addEventListener("blur", () => {
    void finish(true);
  });
}
