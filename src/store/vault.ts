import * as tree from "./tree";
import type { FolderNode, NoteNode, TreeNode } from "./types";
import { decryptString, deriveKey, encryptString, fromBase64, randomSalt, toBase64 } from "./crypto";

const MASK = "•••";

const sessionKeys = new Map<string, CryptoKey>();

export type NoteAccess =
  | { status: "missing" }
  | { status: "locked"; redirectTo: string }
  | { status: "ok"; note: NoteNode; title: string; body: string };

export function isUnlocked(protectorId: string): boolean {
  return sessionKeys.has(protectorId);
}

export function lock(protectorId: string): void {
  sessionKeys.delete(protectorId);
}

export function lockAllExcept(activeId: string | null): void {
  for (const id of [...sessionKeys.keys()]) {
    if (id !== activeId) {
      sessionKeys.delete(id);
    }
  }
}

export function isProtectedRoot(node: TreeNode): boolean {
  return node.type === "folder" && node.salt !== undefined;
}

export function contentsProtectorId(folder: TreeNode | null): string | null {
  if (folder === null) {
    return null;
  }
  if (folder.type === "folder" && folder.salt !== undefined) {
    return folder.id;
  }
  return folder.protectorId ?? null;
}

function requireKey(protectorId: string): CryptoKey {
  const key = sessionKeys.get(protectorId);
  if (key === undefined) {
    throw new Error("Папка заблокирована");
  }
  return key;
}

export async function unlock(protectorId: string, password: string): Promise<boolean> {
  const folder = await tree.getNode(protectorId);
  if (
    folder === undefined ||
    folder.type !== "folder" ||
    folder.salt === undefined ||
    folder.check === undefined
  ) {
    return false;
  }

  const key = await deriveKey(password, fromBase64(folder.salt));
  try {
    const token = await decryptString(key, folder.check);
    if (token !== protectorId) {
      return false;
    }
  } catch {
    return false;
  }

  sessionKeys.set(protectorId, key);
  return true;
}

export async function createProtectedFolder(
  parentId: string,
  title: string,
  password: string
): Promise<FolderNode> {
  const id = crypto.randomUUID();
  const salt = randomSalt();
  const key = await deriveKey(password, salt);
  const check = await encryptString(key, id);
  const now = Date.now();

  const node: FolderNode = {
    id,
    type: "folder",
    title,
    parentId,
    order: now,
    createdAt: now,
    updatedAt: now,
    salt: toBase64(salt),
    check
  };

  await tree.putNode(node);
  sessionKeys.set(id, key);
  return node;
}

export async function createFolderIn(
  parentId: string,
  protectorId: string | null,
  title: string
): Promise<FolderNode> {
  if (protectorId === null) {
    return tree.createFolder(parentId, title);
  }

  const key = requireKey(protectorId);
  const now = Date.now();
  const node: FolderNode = {
    id: crypto.randomUUID(),
    type: "folder",
    title: await encryptString(key, title),
    parentId,
    order: now,
    createdAt: now,
    updatedAt: now,
    protectorId,
    encrypted: true
  };

  await tree.putNode(node);
  return node;
}

export async function createNoteIn(
  parentId: string,
  protectorId: string | null,
  title: string
): Promise<NoteNode> {
  if (protectorId === null) {
    return tree.createNote(parentId, title);
  }

  const key = requireKey(protectorId);
  const now = Date.now();
  const node: NoteNode = {
    id: crypto.randomUUID(),
    type: "note",
    title: await encryptString(key, title),
    parentId,
    order: now,
    createdAt: now,
    updatedAt: now,
    body: await encryptString(key, ""),
    protectorId,
    encrypted: true
  };

  await tree.putNode(node);
  return node;
}

export async function displayTitle(node: TreeNode): Promise<string> {
  if (node.encrypted !== true || node.protectorId === undefined) {
    return node.title;
  }
  const key = sessionKeys.get(node.protectorId);
  if (key === undefined) {
    return MASK;
  }
  try {
    return await decryptString(key, node.title);
  } catch {
    return MASK;
  }
}

export async function renameNode(node: TreeNode, title: string): Promise<void> {
  if (node.encrypted === true && node.protectorId !== undefined) {
    const key = requireKey(node.protectorId);
    await tree.renameNode(node.id, await encryptString(key, title));
    return;
  }
  await tree.renameNode(node.id, title);
}

export async function saveNoteBody(note: NoteNode, text: string): Promise<void> {
  if (note.encrypted === true && note.protectorId !== undefined) {
    const key = requireKey(note.protectorId);
    await tree.saveNoteBody(note.id, await encryptString(key, text));
    return;
  }
  await tree.saveNoteBody(note.id, text);
}

export async function openNote(noteId: string): Promise<NoteAccess> {
  const node = await tree.getNode(noteId);

  lockAllExcept(node !== undefined && node.type === "note" ? node.protectorId ?? null : null);

  if (node === undefined || node.type !== "note") {
    return { status: "missing" };
  }

  if (node.encrypted === true && node.protectorId !== undefined) {
    const key = sessionKeys.get(node.protectorId);
    if (key === undefined) {
      return { status: "locked", redirectTo: node.protectorId };
    }
    try {
      const title = await decryptString(key, node.title);
      const body = await decryptString(key, node.body);
      return { status: "ok", note: node, title, body };
    } catch {
      return { status: "locked", redirectTo: node.protectorId };
    }
  }

  return { status: "ok", note: node, title: node.title, body: node.body };
}
