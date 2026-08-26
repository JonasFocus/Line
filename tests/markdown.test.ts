import { describe, expect, it } from "vitest";

import {
  countWords,
  createDocumentFromMarkdown,
  deriveExcerpt,
  deriveHeadings,
  deriveTags,
  deriveTitle,
  estimateReadTime,
  parseMarkdownMetadata,
  renderMarkdown,
} from "../src/lib";

describe("Markdown metadata", () => {
  const markdown = `---
tags: [Science, long-form]
---
# A **Small** Universe

This is a short introduction to a very large subject. #Cosmos #science

## Evidence

One.

## Evidence

Two.

\`\`\`md
# Not a heading
#not-a-tag
\`\`\``;

  it("derives a clean title and excerpt", () => {
    expect(deriveTitle(markdown)).toBe("A Small Universe");
    expect(deriveExcerpt(markdown)).toBe("This is a short introduction to a very large subject. #Cosmos #science");
  });

  it("combines normalized frontmatter and inline tags without duplicates", () => {
    expect(deriveTags(markdown)).toEqual(["science", "long-form", "cosmos"]);
  });

  it("parses YAML block-list frontmatter tags", () => {
    expect(
      deriveTags(`---
tags:
  - Science
  - "long-form"
---
# Title
`),
    ).toEqual(["science", "long-form"]);
  });

  it("combines block-list frontmatter tags with inline body tags", () => {
    expect(
      deriveTags(`---
tags:
  - science
  - long-form
---
This is a short introduction. #Cosmos #science
`),
    ).toEqual(["science", "long-form", "cosmos"]);
  });

  it("ignores an empty frontmatter tag list", () => {
    expect(
      deriveTags(`---
tags:
  -
  - ""
---
Just prose.
`),
    ).toEqual([]);
  });

  it("extracts headings, ignores fences, and makes stable duplicate ids", () => {
    expect(deriveHeadings(markdown).map(({ id, text, level }) => ({ id, text, level }))).toEqual([
      { id: "a-small-universe", text: "A Small Universe", level: 1 },
      { id: "evidence", text: "Evidence", level: 2 },
      { id: "evidence-2", text: "Evidence", level: 2 },
    ]);
  });

  it("counts prose and estimates a minimum one-minute read", () => {
    expect(countWords("# Hello\n\nOne two three.")).toBe(4);
    expect(estimateReadTime(0)).toBe(0);
    expect(estimateReadTime(201)).toBe(2);
  });

  it("returns a complete metadata object", () => {
    const metadata = parseMarkdownMetadata(markdown);
    expect(metadata.title).toBe("A Small Universe");
    expect(metadata.headings).toHaveLength(3);
    expect(metadata.wordCount).toBeGreaterThan(10);
    expect(metadata.readTimeMinutes).toBe(1);
  });

  it("uses useful fallbacks for empty documents", () => {
    expect(deriveTitle("  \n")).toBe("Untitled");
    expect(deriveExcerpt("  \n")).toBe("");
    expect(parseMarkdownMetadata("").readTimeMinutes).toBe(0);
  });
});

describe("Markdown rendering", () => {
  it("renders nothing for empty markdown so the preview :empty placeholder can show", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("  \n\t\n")).toBe("");
  });

  it("renders the supported block and inline syntax", () => {
    const html = renderMarkdown(`# Hello

> A *thought* worth keeping.

Use **strong words**, \`code\`, and [a source](https://example.com).

- First
- Second

1. Open
2. Save

\`\`\`ts
const answer = 42 < 100;
\`\`\``);

    expect(html).toContain('<h1 id="hello">Hello</h1>');
    expect(html).toContain("<blockquote><p>A <em>thought</em> worth keeping.</p></blockquote>");
    expect(html).toContain("<strong>strong words</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="https://example.com">a source</a>');
    expect(html).toContain("<ul><li>First</li><li>Second</li></ul>");
    expect(html).toContain("<ol><li>Open</li><li>Save</li></ol>");
    expect(html).toContain('<pre><code class="language-ts">const answer = 42 &lt; 100;</code></pre>');
  });

  it("nests unordered list items indented by two spaces", () => {
    expect(renderMarkdown("- Parent\n  - Child")).toBe(
      "<ul><li>Parent<ul><li>Child</li></ul></li></ul>",
    );
  });

  it("nests an ordered list inside an unordered list", () => {
    expect(renderMarkdown("- Parent\n  1. Child")).toBe(
      "<ul><li>Parent<ol><li>Child</li></ol></li></ul>",
    );
  });

  it("nests an unordered list inside an ordered list", () => {
    expect(renderMarkdown("1. Parent\n  - Child")).toBe(
      "<ol><li>Parent<ul><li>Child</li></ul></li></ol>",
    );
  });

  it("treats each two spaces of indent as one nesting level", () => {
    expect(renderMarkdown("- One\n  - Two\n    - Three\n      - Four\n        - Five")).toBe(
      "<ul><li>One<ul><li>Two<ul><li>Three<ul><li>Four<ul><li>Five</li></ul></li></ul></li></ul></li></ul></li></ul>",
    );
  });

  it("treats a tab indent as one nested list level", () => {
    expect(renderMarkdown("- Parent\n\t- Child")).toBe(
      "<ul><li>Parent<ul><li>Child</li></ul></li></ul>",
    );
  });

  it("escapes HTML and blocks unsafe links", () => {
    const html = renderMarkdown("<img src=x onerror=alert(1)> [click](javascript:alert(1))");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain('<a href="#">click</a>');
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
  });

  it("renders markdown images with http(s) and root-relative sources", () => {
    const html = renderMarkdown(
      '![Diagram](https://example.com/chart.png) ![Local](/assets/photo.jpg "Studio")',
    );
    expect(html).toContain('<img src="https://example.com/chart.png" alt="Diagram">');
    expect(html).toContain('<img src="/assets/photo.jpg" alt="Local" title="Studio">');
  });

  it("skips images with unsafe schemes and still renders normal links", () => {
    const html = renderMarkdown(
      '![x](javascript:alert(1)) ![y](data:image/png;base64,abc) and [safe](https://example.com)',
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:image");
    expect(html).toContain('<a href="https://example.com">safe</a>');
  });

  it("does not turn image markdown into a bang-prefixed link", () => {
    const html = renderMarkdown("See ![Cat](http://example.com/cat.png) nearby.");
    expect(html).toContain('<img src="http://example.com/cat.png" alt="Cat">');
    expect(html).not.toContain("!<a");
    expect(html).not.toContain('>Cat</a>');
  });

  it("renders strikethrough", () => {
    expect(renderMarkdown("~~retired~~")).toContain("<del>retired</del>");
  });

  it("renders strikethrough next to bold and code", () => {
    const html = renderMarkdown("Keep **bold**, `code`, and ~~retired~~.");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<del>retired</del>");
  });

  it("does not treat a single tilde as strikethrough", () => {
    const html = renderMarkdown("approx ~5 or ~~~~");
    expect(html).not.toContain("<del>");
    expect(html).toContain("approx ~5 or ~~~~");
  });

  it("escapes HTML inside strikethrough", () => {
    const html = renderMarkdown("~~<em>raw</em>~~");
    expect(html).toContain("<del>&lt;em&gt;raw&lt;/em&gt;</del>");
    expect(html).not.toContain("<em>raw</em>");
  });

  it("renders unchecked and checked task list items as disabled checkboxes", () => {
    const html = renderMarkdown("- [ ] write tests\n- [x] ship it\n- [X] also done");
    expect(html).toContain(
      '<li class="task-item"><input type="checkbox" disabled> write tests</li>',
    );
    expect(html).toContain(
      '<li class="task-item"><input type="checkbox" disabled checked> ship it</li>',
    );
    expect(html).toContain(
      '<li class="task-item"><input type="checkbox" disabled checked> also done</li>',
    );
  });

  it("mixes task items with normal bullets in the same unordered list", () => {
    const html = renderMarkdown("- milk\n- [ ] eggs\n- bread");
    expect(html).toBe(
      '<ul><li>milk</li><li class="task-item"><input type="checkbox" disabled> eggs</li><li>bread</li></ul>',
    );
  });

  it("does not treat [x] inside paragraph text as a task", () => {
    const html = renderMarkdown("Remember the [x] marker is not a list.");
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("task-item");
    expect(html).toContain("[x]");
  });
});

describe("Document model", () => {
  it("creates a document with derived metadata and explicit overrides", () => {
    const document = createDocumentFromMarkdown({
      id: "draft",
      folderId: "basics",
      content: "# Generated title\n\nA useful draft. #writing",
      title: "Working title",
      createdAt: "2026-01-01T00:00:00.000Z",
      tags: ["Draft", "#writing", "draft"],
    });

    expect(document.title).toBe("Working title");
    expect(document.tags).toEqual(["draft", "writing"]);
    expect(document.updatedAt).toBe(document.createdAt);
    expect(document.wordCount).toBeGreaterThan(0);
  });

});
