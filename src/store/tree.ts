import { getDb, PARENT_INDEX, STORE } from "./db";
import type { FolderNode, NoteNode, TreeNode } from "./types";
import { ROOT_ID } from "./types";

function newId(): string {
  return crypto.randomUUID();
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    return a.id < b.id ? -1 : 1;
  });
}

const writeQueues = new Map<string, Promise<unknown>>();

function enqueue(id: string, task: () => Promise<void>): Promise<void> {
  const previous = writeQueues.get(id) ?? Promise.resolve();
  const run = previous.then(task, task);
  writeQueues.set(id, run);
  void run.finally(() => {
    if (writeQueues.get(id) === run) {
      writeQueues.delete(id);
    }
  });
  return run;
}

async function patchNode(id: string, mutate: (node: TreeNode) => void): Promise<void> {
  const db = await getDb();
  const node = await db.get(STORE, id);
  if (node === undefined) {
    return;
  }
  mutate(node);
  node.updatedAt = Date.now();
  await db.put(STORE, node);
}

export async function listChildren(parentId: string): Promise<TreeNode[]> {
  const db = await getDb();
  const nodes = await db.getAllFromIndex(STORE, PARENT_INDEX, parentId);
  return sortNodes(nodes);
}

export async function getNode(id: string): Promise<TreeNode | undefined> {
  const db = await getDb();
  return db.get(STORE, id);
}

export async function putNode(node: TreeNode): Promise<void> {
  const db = await getDb();
  await db.put(STORE, node);
}

export async function createFolder(parentId: string, title: string): Promise<FolderNode> {
  const timestamp = Date.now();
  const node: FolderNode = {
    id: newId(),
    type: "folder",
    title,
    parentId,
    order: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const db = await getDb();
  await db.put(STORE, node);
  return node;
}

export async function createNote(parentId: string, title: string): Promise<NoteNode> {
  const timestamp = Date.now();
  const node: NoteNode = {
    id: newId(),
    type: "note",
    title,
    parentId,
    order: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    body: ""
  };
  const db = await getDb();
  await db.put(STORE, node);
  return node;
}

export function renameNode(id: string, title: string): Promise<void> {
  return enqueue(id, () =>
    patchNode(id, (node) => {
      node.title = title;
    })
  );
}

export function saveNoteBody(id: string, body: string): Promise<void> {
  return enqueue(id, () =>
    patchNode(id, (node) => {
      if (node.type === "note") {
        node.body = body;
      }
    })
  );
}

export async function deleteNode(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  const index = tx.store.index(PARENT_INDEX);

  const pending: string[] = [id];
  const targets: string[] = [];

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) {
      break;
    }
    targets.push(current);
    const childKeys = await index.getAllKeys(current);
    for (const key of childKeys) {
      pending.push(key);
    }
  }

  for (const key of targets) {
    await tx.store.delete(key);
  }

  await tx.done;
}

export async function getAncestors(id: string): Promise<TreeNode[]> {
  const db = await getDb();
  const chain: TreeNode[] = [];
  let currentId = id;

  while (currentId !== ROOT_ID) {
    const node = await db.get(STORE, currentId);
    if (node === undefined) {
      break;
    }
    chain.push(node);
    currentId = node.parentId;
  }

  chain.reverse();
  return chain;
}

export async function exportNodes(): Promise<TreeNode[]> {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function importNodes(nodes: TreeNode[]): Promise<number> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  for (const node of nodes) {
    await tx.store.put(node);
  }
  await tx.done;
  return nodes.length;
}
