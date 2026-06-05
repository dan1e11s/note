export const ROOT_ID = "root";

export type NodeType = "folder" | "note";

export type FontChoice = "system" | "serif" | "mono";

export interface BaseNode {
  id: string;
  type: NodeType;
  title: string;
  parentId: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface FolderNode extends BaseNode {
  type: "folder";
}

export interface NoteNode extends BaseNode {
  type: "note";
  body: string;
  font: FontChoice;
}

export type TreeNode = FolderNode | NoteNode;
