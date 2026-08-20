import { describe, expect, it } from "vitest";

import { extractOutline } from "../src/components/MarkdownPreview";
import { deriveHeadings, frontmatterLineOffset } from "../src/lib";

function caretOffsetAtLine(source: string, line: number) {
  return source.split("\n").slice(0, line).join("\n").length + (line ? 1 : 0);
}

describe("Outline navigation line math", () => {
  it("offsets heading lines by YAML frontmatter so editor caret math hits the heading", () => {
    const markdown = `---
tags: [Science]
---
# A Small Universe

## Evidence
`;

    expect(frontmatterLineOffset(markdown)).toBe(3);
    expect(deriveHeadings(markdown).map((heading) => heading.line)).toEqual([4, 6]);

    const outline = extractOutline(markdown);
    const lines = markdown.split("\n");
    expect(lines[outline[0].line]).toBe("# A Small Universe");
    expect(lines[outline[1].line]).toBe("## Evidence");
    expect(markdown.slice(caretOffsetAtLine(markdown, outline[0].line)).startsWith("# A Small Universe")).toBe(true);
    expect(markdown.slice(caretOffsetAtLine(markdown, outline[1].line)).startsWith("## Evidence")).toBe(true);
  });

  it("keeps heading lines aligned to the source when frontmatter is absent", () => {
    const markdown = `# Hello

## World
`;

    expect(frontmatterLineOffset(markdown)).toBe(0);
    expect(deriveHeadings(markdown).map((heading) => heading.line)).toEqual([1, 3]);

    const outline = extractOutline(markdown);
    const lines = markdown.split("\n");
    expect(lines[outline[0].line]).toBe("# Hello");
    expect(lines[outline[1].line]).toBe("## World");
    expect(markdown.slice(caretOffsetAtLine(markdown, outline[0].line)).startsWith("# Hello")).toBe(true);
  });
});
