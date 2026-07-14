export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface MarkdownHeading {
  id: string;
  text: string;
  level: HeadingLevel;
  line: number;
}

export interface MarkdownMetadata {
  title: string;
  excerpt: string;
  tags: string[];
  headings: MarkdownHeading[];
  wordCount: number;
  readTimeMinutes: number;
}

export interface LibraryFolder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  system?: "all" | "recently-deleted";
}

export interface MarkdownDocument extends MarkdownMetadata {
  id: string;
  content: string;
  folderId: string;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateMarkdownDocumentInput {
  id: string;
  content: string;
  folderId: string;
  isStarred?: boolean;
  createdAt?: string;
  updatedAt?: string;
  title?: string;
  excerpt?: string;
  tags?: string[];
  deletedAt?: string;
}
