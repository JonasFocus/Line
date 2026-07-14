import type {
  CreateMarkdownDocumentInput,
  HeadingLevel,
  MarkdownDocument,
  MarkdownHeading,
  MarkdownMetadata,
} from "../types";

const DEFAULT_WORDS_PER_MINUTE = 200;
const DEFAULT_EXCERPT_LENGTH = 180;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function slugifyHeading(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

function removeFrontmatter(markdown: string): string {
  return markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "");
}

function withoutFencedCode(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, " ");
}

function plainInline(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_]+)_(?!_)/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, "$1")
    .trim();
}

export function stripMarkdown(markdown: string): string {
  return plainInline(withoutFencedCode(removeFrontmatter(markdown)))
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveTitle(markdown: string, fallback = "Untitled"): string {
  const source = removeFrontmatter(withoutFencedCode(markdown));
  const heading = source.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m);

  if (heading) return plainInline(heading[1]) || fallback;

  const firstTextLine = source
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s{0,3}(?:>|[-+*]|\d+[.)])\s+/, ""))
    .map(plainInline)
    .find(Boolean);

  return firstTextLine || fallback;
}

export function deriveExcerpt(
  markdown: string,
  maximumLength = DEFAULT_EXCERPT_LENGTH,
): string {
  if (maximumLength <= 0) return "";

  const source = withoutFencedCode(removeFrontmatter(markdown));
  const blocks = source
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.replace(/^\s{0,3}#{1,6}\s+.*$/gm, ""))
    .map(stripMarkdown)
    .filter(Boolean);

  const excerpt = blocks[0] ?? "";
  if (excerpt.length <= maximumLength) return excerpt;

  const clipped = excerpt.slice(0, Math.max(0, maximumLength - 1));
  const lastSpace = clipped.lastIndexOf(" ");
  const cleanClip = lastSpace > maximumLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${cleanClip.trimEnd()}…`;
}

function frontmatterTags(markdown: string): string[] {
  const frontmatter = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return [];

  const tagsLine = frontmatter[1].match(/^tags\s*:\s*(.+)$/im)?.[1]?.trim();
  if (!tagsLine) return [];

  if (tagsLine.startsWith("[") && tagsLine.endsWith("]")) {
    return tagsLine
      .slice(1, -1)
      .split(",")
      .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ""));
  }

  return tagsLine.split(/\s*,\s*|\s+/);
}

export function deriveTags(markdown: string): string[] {
  const body = withoutFencedCode(removeFrontmatter(markdown))
    .replace(/`[^`]*`/g, "")
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, "");
  const inlineTags = Array.from(body.matchAll(/(^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu), (match) => match[2]);
  const tags = [...frontmatterTags(markdown), ...inlineTags]
    .map((tag) => tag.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(tags)];
}

export function deriveHeadings(markdown: string): MarkdownHeading[] {
  const lines = removeFrontmatter(markdown).split(/\r?\n/);
  const headings: MarkdownHeading[] = [];
  const slugCounts = new Map<string, number>();
  let inFence = false;

  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) return;

    const text = plainInline(match[2]);
    const baseSlug = slugifyHeading(text);
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    headings.push({
      id: count ? `${baseSlug}-${count + 1}` : baseSlug,
      text,
      level: match[1].length as HeadingLevel,
      line: index + 1,
    });
  });

  return headings;
}

export function countWords(markdown: string): number {
  const plainText = stripMarkdown(markdown);
  if (!plainText) return 0;

  return plainText.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function estimateReadTime(
  markdownOrWordCount: string | number,
  wordsPerMinute = DEFAULT_WORDS_PER_MINUTE,
): number {
  const wordCount =
    typeof markdownOrWordCount === "number" ? markdownOrWordCount : countWords(markdownOrWordCount);
  if (wordCount === 0) return 0;
  return Math.max(1, Math.ceil(wordCount / Math.max(1, wordsPerMinute)));
}

export function parseMarkdownMetadata(markdown: string): MarkdownMetadata {
  const wordCount = countWords(markdown);
  return {
    title: deriveTitle(markdown),
    excerpt: deriveExcerpt(markdown),
    tags: deriveTags(markdown),
    headings: deriveHeadings(markdown),
    wordCount,
    readTimeMinutes: estimateReadTime(wordCount),
  };
}

function safeHref(href: string): string {
  const trimmed = href.trim();
  if (/^(?:https?:|mailto:|#|\/)/i.test(trimmed)) return escapeHtml(trimmed);
  return "#";
}

function renderInline(source: string): string {
  const codeTokens: string[] = [];
  const tokenized = source.replace(/`([^`]+)`/g, (_match, code: string) => {
    const token = `\u0000CODE${codeTokens.length}\u0000`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });
  let html = escapeHtml(tokenized);

  html = html.replace(
    /\[([^\]]+)]\(([^\s)]+)(?:\s+[&quot;]([^&]+)[&quot;])?\)/g,
    (_match, label: string, href: string, title?: string) => {
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${safeHref(href)}"${titleAttribute}>${label}</a>`;
    },
  );
  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>")
    .replace(/\u0000CODE(\d+)\u0000/g, (_match, index: string) => codeTokens[Number(index)]);

  return html;
}

function listItem(line: string): { ordered: boolean; text: string } | null {
  const unordered = line.match(/^\s{0,3}[-+*]\s+(.+)$/);
  if (unordered) return { ordered: false, text: unordered[1] };
  const ordered = line.match(/^\s{0,3}\d+[.)]\s+(.+)$/);
  if (ordered) return { ordered: true, text: ordered[1] };
  return null;
}

export function renderMarkdown(markdown: string): string {
  const lines = removeFrontmatter(markdown).split(/\r?\n/);
  const headings = deriveHeadings(markdown);
  const headingIds = [...headings];
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```\s*([\w-]+)?\s*$/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const className = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : "";
      output.push(`<pre><code${className}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const currentHeading = headingIds.shift();
      output.push(
        `<h${level} id="${currentHeading?.id ?? slugifyHeading(heading[2])}">${renderInline(heading[2])}</h${level}>`,
      );
      index += 1;
      continue;
    }

    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (/^\s{0,3}>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s{0,3}>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s{0,3}>\s?/, ""));
        index += 1;
      }
      output.push(`<blockquote><p>${renderInline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    const item = listItem(line);
    if (item) {
      const ordered = item.ordered;
      const items: string[] = [];
      while (index < lines.length) {
        const nextItem = listItem(lines[index]);
        if (!nextItem || nextItem.ordered !== ordered) break;
        items.push(`<li>${renderInline(nextItem.text)}</li>`);
        index += 1;
      }
      const tag = ordered ? "ol" : "ul";
      output.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*```/.test(lines[index]) &&
      !/^\s{0,3}#{1,6}\s+/.test(lines[index]) &&
      !/^\s{0,3}>\s?/.test(lines[index]) &&
      !/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[index]) &&
      !listItem(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join("\n")).replaceAll("\n", "<br>\n")}</p>`);
  }

  return output.join("\n");
}

export function createDocumentFromMarkdown(
  input: CreateMarkdownDocumentInput,
): MarkdownDocument {
  const metadata = parseMarkdownMetadata(input.content);
  const timestamp = new Date().toISOString();
  return {
    ...metadata,
    id: input.id,
    content: input.content,
    folderId: input.folderId,
    isStarred: input.isStarred ?? false,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? input.createdAt ?? timestamp,
    ...(input.deletedAt ? { deletedAt: input.deletedAt } : {}),
    ...(input.title ? { title: input.title } : {}),
    ...(input.excerpt ? { excerpt: input.excerpt } : {}),
    ...(input.tags ? { tags: [...new Set(input.tags.map((tag) => tag.replace(/^#/, "").toLowerCase()))] } : {}),
  };
}
