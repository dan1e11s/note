export const ROOT_ID = "root";

export type NodeType = "folder" | "note";

export interface BaseNode {
  id: string;
  type: NodeType;
  title: string;
  parentId: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  protectorId?: string;
  encrypted?: boolean;
}

export interface FolderNode extends BaseNode {
  type: "folder";
  salt?: string;
  check?: string;
}

export interface NoteNode extends BaseNode {
  type: "note";
  body: string;
}

export type TreeNode = FolderNode | NoteNode;
