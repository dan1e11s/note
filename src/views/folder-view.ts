import type { RouteContext } from "../router";
import type { TreeNode } from "../store/types";
import { ROOT_ID } from "../store/types";
import {
  createFolder,
  createNote,
  deleteNode,
  getAncestors,
  listChildren,
  renameNode
} from "../store/tree";
import { createIconButton, createIconElement, icons } from "../ui/icons";
import { createThemeToggle } from "../ui/theme";

const DEFAULT_FOLDER_TITLE = "Новая папка";
const DEFAULT_NOTE_TITLE = "Новая заметка";

interface Crumb {
  id: string;
  title: string;
}

export function renderFolderView(host: HTMLElement, context: RouteContext): void {
  const folderId = context.params.id ?? ROOT_ID;

  const screen = document.createElement("main");
  screen.className = "screen screen-folder";
  screen.dataset.folderId = folderId;

  const header = document.createElement("header");
  header.className = "screen-header";

  const breadcrumbs = document.createElement("nav");
  breadcrumbs.className = "breadcrumbs";
  breadcrumbs.setAttribute("aria-label", "Навигация по папкам");

  const headerActions = document.createElement("div");
  headerActions.className = "header-actions";

  const newFolderButton = createIconButton(icons.archive, "Новая папка", "icon-button");
  const newNoteButton = createIconButton(icons.filePlus, "Новая заметка", "icon-button primary");

  headerActions.append(createThemeToggle(), newFolderButton, newNoteButton);
  header.append(breadcrumbs, headerActions);

  const list = document.createElement("ul");
  list.className = "node-list";

  screen.append(header, list);
  host.replaceChildren(screen);

  newFolderButton.addEventListener("click", () => {
    void handleCreateFolder(folderId, list);
  });

  newNoteButton.addEventListener("click", () => {
    void handleCreateNote(folderId);
  });

  void renderBreadcrumbs(breadcrumbs, folderId);
  void renderList(list, folderId);
}

async function renderBreadcrumbs(container: HTMLElement, folderId: string): Promise<void> {
  const crumbs: Crumb[] = [{ id: ROOT_ID, title: "NOTE" }];

  if (folderId !== ROOT_ID) {
    const ancestors = await getAncestors(folderId);
    for (const node of ancestors) {
      crumbs.push({ id: node.id, title: node.title });
    }
  }

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

async function renderList(list: HTMLElement, folderId: string): Promise<void> {
  const children = await listChildren(folderId);
  list.replaceChildren();

  if (children.length === 0) {
    const empty = document.createElement("li");
    empty.className = "node-empty";
    empty.textContent = "Пусто";
    list.append(empty);
    return;
  }

  for (const node of children) {
    list.append(createItem(node, list, folderId));
  }
}

function createItem(node: TreeNode, list: HTMLElement, folderId: string): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "node-item";
  item.dataset.id = node.id;
  item.dataset.type = node.type;

  const open = document.createElement("a");
  open.className = "node-open";
  open.href = (node.type === "folder" ? "#/folder/" : "#/note/") + node.id;

  const icon = document.createElement("span");
  icon.className = "node-icon";
  icon.append(createIconElement(node.type === "folder" ? icons.archive : icons.fileText));

  const title = document.createElement("span");
  title.className = "node-title";
  title.textContent = node.title;

  open.append(icon, title);

  const actions = document.createElement("div");
  actions.className = "node-actions";

  const rename = createIconButton(icons.pencil, "Переименовать", "icon-button");
  rename.addEventListener("click", () => {
    startRename(item, open, node, list, folderId);
  });

  const remove = createIconButton(icons.trash, "Удалить", "icon-button danger");
  remove.addEventListener("click", () => {
    void handleDelete(node, list, folderId);
  });

  actions.append(rename, remove);
  item.append(open, actions);
  return item;
}

async function handleCreateFolder(parentId: string, list: HTMLElement): Promise<void> {
  const folder = await createFolder(parentId, DEFAULT_FOLDER_TITLE);
  await renderList(list, parentId);
  focusRename(list, parentId, folder);
}

async function handleCreateNote(parentId: string): Promise<void> {
  const note = await createNote(parentId, DEFAULT_NOTE_TITLE);
  window.location.hash = "#/note/" + note.id;
}

async function handleDelete(node: TreeNode, list: HTMLElement, folderId: string): Promise<void> {
  const message = node.type === "folder" ? "Удалить папку и всё внутри?" : "Удалить заметку?";
  if (!window.confirm(message)) {
    return;
  }
  await deleteNode(node.id);
  await renderList(list, folderId);
}

function focusRename(list: HTMLElement, folderId: string, node: TreeNode): void {
  const item = list.querySelector('.node-item[data-id="' + node.id + '"]');
  if (!(item instanceof HTMLElement)) {
    return;
  }
  const open = item.querySelector(".node-open");
  if (!(open instanceof HTMLElement)) {
    return;
  }
  startRename(item, open, node, list, folderId);
}

function startRename(
  item: HTMLElement,
  open: HTMLElement,
  node: TreeNode,
  list: HTMLElement,
  folderId: string
): void {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "node-rename-input";
  input.value = node.title;

  item.classList.add("renaming");
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
      if (value.length > 0 && value !== node.title) {
        await renameNode(node.id, value);
      }
    }

    await renderList(list, folderId);
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
