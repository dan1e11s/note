import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type { TreeNode } from "./types";

export const STORE = "nodes" as const;
export const PARENT_INDEX = "by-parent" as const;

interface NoteDb extends DBSchema {
  nodes: {
    key: string;
    value: TreeNode;
    indexes: { "by-parent": string };
  };
}

const DB_NAME = "note";
const DB_VERSION = 1;

let connection: Promise<IDBPDatabase<NoteDb>> | null = null;

export function getDb(): Promise<IDBPDatabase<NoteDb>> {
  if (connection === null) {
    connection = openDB<NoteDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex(PARENT_INDEX, "parentId");
      }
    });
  }
  return connection;
}
