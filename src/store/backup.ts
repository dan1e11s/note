import { exportNodes, importNodes } from "./tree";
import type { FolderNode, NoteNode, TreeNode } from "./types";

const APP_TAG = "note";
const FORMAT_VERSION = 1;

interface BackupFile {
  app: string;
  version: number;
  exportedAt: number;
  nodes: TreeNode[];
}

export async function exportBackup(): Promise<void> {
  const nodes = await exportNodes();
  const payload: BackupFile = {
    app: APP_TAG,
    version: FORMAT_VERSION,
    exportedAt: Date.now(),
    nodes
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "note-backup-" + formatDate(payload.exportedAt) + ".json";
  link.click();

  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<number> {
  const text = await file.text();
  const nodes = parseBackup(text);
  if (nodes.length === 0) {
    return 0;
  }
  return importNodes(nodes);
}

function parseBackup(text: string): TreeNode[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Файл повреждён или не является JSON");
  }

  const raw = extractNodes(data);
  const nodes: TreeNode[] = [];
  for (const entry of raw) {
    const node = normalizeNode(entry);
    if (node !== null) {
      nodes.push(node);
    }
  }
  return nodes;
}

function extractNodes(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (isObject(data) && Array.isArray(data.nodes)) {
    return data.nodes;
  }
  throw new Error("Неизвестный формат файла");
}

function normalizeNode(raw: unknown): TreeNode | null {
  if (!isObject(raw)) {
    return null;
  }

  const { id, type, title, parentId, order, createdAt, updatedAt } = raw;

  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  if (type !== "folder" && type !== "note") {
    return null;
  }
  if (typeof title !== "string" || typeof parentId !== "string") {
    return null;
  }
  if (typeof order !== "number" || typeof createdAt !== "number" || typeof updatedAt !== "number") {
    return null;
  }

  const protectorId = typeof raw.protectorId === "string" ? raw.protectorId : undefined;
  const encrypted = raw.encrypted === true ? true : undefined;

  if (type === "folder") {
    const folder: FolderNode = { id, type, title, parentId, order, createdAt, updatedAt };
    if (protectorId !== undefined) {
      folder.protectorId = protectorId;
    }
    if (encrypted !== undefined) {
      folder.encrypted = encrypted;
    }
    if (typeof raw.salt === "string") {
      folder.salt = raw.salt;
    }
    if (typeof raw.check === "string") {
      folder.check = raw.check;
    }
    return folder;
  }

  const note: NoteNode = {
    id,
    type,
    title,
    parentId,
    order,
    createdAt,
    updatedAt,
    body: typeof raw.body === "string" ? raw.body : ""
  };
  if (protectorId !== undefined) {
    note.protectorId = protectorId;
  }
  if (encrypted !== undefined) {
    note.encrypted = encrypted;
  }
  return note;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}
