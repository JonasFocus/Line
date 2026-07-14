import { createDocumentFromMarkdown } from "../lib";
import type { LibraryFolder, MarkdownDocument } from "../types";

const MAY_18_2026 = "2026-05-18T15:30:00.000Z";
const MAY_17_2026 = "2026-05-17T18:10:00.000Z";
const MAY_14_2026 = "2026-05-14T09:45:00.000Z";

export const seedFolders: LibraryFolder[] = [
  { id: "all-documents", name: "All Documents", parentId: null, sortOrder: 0, system: "all" },
  { id: "basics", name: "Basics", parentId: null, sortOrder: 1 },
  { id: "documentation", name: "Documentation", parentId: null, sortOrder: 2 },
  { id: "reviews", name: "Reviews", parentId: null, sortOrder: 3 },
  { id: "testflight", name: "TestFlight", parentId: null, sortOrder: 4 },
  { id: "archive", name: "Archive", parentId: "testflight", sortOrder: 0 },
  { id: "work", name: "Work", parentId: "testflight", sortOrder: 1 },
  {
    id: "recently-deleted",
    name: "Recently Deleted",
    parentId: null,
    sortOrder: 5,
    system: "recently-deleted",
  },
];

const darkMatter = `# Dark Matter and Dark Energy: The Universe's Missing 95%

> *"We know more about the history of the universe than we know about what fills it."*

---

## Part I: The Inventory Problem

### What the Universe Is Made Of

Run the numbers on everything we can observe: every star, galaxy, gas cloud, black hole, neutron star, and stray proton, and you account for roughly **5% of the universe's total energy content**.

The remaining 95% consists of two things we cannot directly detect, do not fully understand, and have never touched:

- **Dark matter**, about 27%, which supplies hidden gravitational scaffolding.
- **Dark energy**, about 68%, which appears to push space itself apart.
- **Ordinary matter**, about 5%, which makes every familiar object.

\`\`\`text
Total energy content of the universe:
Ordinary matter  [##                                      ]  5%
Dark matter      [###########                             ] 27%
Dark energy      [###########################             ] 68%
\`\`\`

## Part II: Dark Matter

### The Evidence

In the 1930s, Fritz Zwicky measured galaxies moving through the Coma Cluster too quickly for the visible matter to hold them together. Decades later, Vera Rubin found the same mismatch inside spiral galaxies: stars far from the center orbit just as quickly as stars closer in.

The cleanest modern evidence comes from several directions:

1. Galaxy rotation curves remain unexpectedly flat.
2. Gravitational lenses bend light more than visible matter predicts.
3. The cosmic microwave background records the fingerprint of extra mass.
4. Colliding galaxy clusters separate ordinary gas from most of their gravity.

### What Is It?

Dark matter is a placeholder for an observed effect, not a settled substance. Candidate particles include axions and weakly interacting massive particles, but experiments have not confirmed either. A change to gravity itself remains a minority possibility.

Read the [NASA overview](https://science.nasa.gov/universe/dark-matter-dark-energy/) for a broader introduction. #quantum #world

## Part III: Dark Energy

### The Accelerating Universe

In 1998, two teams studying distant supernovae found that cosmic expansion is speeding up. Gravity should slow expansion, so something else must dominate at enormous scales.

### The Cosmological Constant Problem

Einstein's cosmological constant can describe the measured acceleration, but quantum field calculations predict a vacuum energy vastly larger than observations allow. The disagreement is one of physics' most spectacular failures of scale.

### Competing Explanations

- Vacuum energy that stays constant as space expands
- A changing field sometimes called quintessence
- A large-scale correction to general relativity

## Part IV: The Future the Universe Is Building

### The Big Rip

If dark energy becomes stronger over time, expansion could eventually pull apart galaxies, solar systems, and matter itself. Current measurements do not require this outcome.

### Heat Death

If dark energy remains constant, distant galaxies will disappear beyond our observable horizon while stars burn out and usable energy becomes scarce.

### The Honest Scorecard

We have precise measurements of an inventory we barely understand. That is not a failure. It is a map of where the next discoveries must happen.
`;

const incompleteUniverse = `# An Incomplete Guide to the Universe

> "The universe is under no obligation to make sense to you." — Neil deGrasse Tyson

## Start With Scale

The observable universe is about 93 billion light-years across. That number sounds impossible only because cosmic distance is not a snapshot: while light traveled, space expanded.

## A Practical Field Guide

- Stars turn light elements into heavier ones.
- Galaxies gather stars, gas, dust, and dark matter.
- Black holes make gravity visible by hiding light.
- Empty space is neither perfectly empty nor perfectly still.

## Questions Worth Keeping

What happened before inflation? Is spacetime fundamental? Does life appear wherever chemistry is given enough time? An honest guide leaves room for the unknown. #world #mind
`;

const crispr = `# CRISPR: The Cut-and-Paste Revolution in Biology

> "We have the power to fundamentally alter the human species, and we acquired it on a Tuesday afternoon in a lab."

## A Bacterial Memory Becomes a Tool

CRISPR began as a defense system. Bacteria preserve fragments of viral DNA, then use those fragments to recognize a returning invader. Researchers learned to pair that targeting system with a molecular cutter.

## What Changes

The technique can disable a gene, replace a sequence, or change a single genetic letter. The promise ranges from resilient crops to treatments for inherited disease. The ethical burden grows with the power, especially when edits could pass to future generations. #body #humanity
`;

const evolution = `# Evolution: How Four Billion Years of Death Built Everything

> "Nothing in biology makes sense except in the light of evolution." — Theodosius Dobzhansky

## Variation, Selection, Time

Evolution needs no finish line. Variation creates differences, environments shape which differences persist, and inheritance carries yesterday's accidents forward.

Extinction is not an exception to the process. Most species that have existed are gone, yet every living cell carries an unbroken history reaching back billions of years. #body #world
`;

const stringTheory = `# String Theory and the Quest for Quantum Gravity

> "String theory is a part of 21st-century physics that fell by accident into the 20th century." — Edward Witten

## The Central Trade

Replace point-like particles with tiny vibrating strings and one vibration behaves like the graviton required by quantum gravity. The mathematics is unusually rich; direct experimental support remains absent.

## Why It Persists

String theory has connected black holes, geometry, particle physics, and information in surprising ways. It may be a description of nature, a powerful mathematical language, or both. #quantum #world
`;

const fermiParadox = `# The Fermi Paradox: Where Is Everybody?

> "The silence of the universe is deafening — and deeply suspicious."

## The Tension

Our galaxy contains hundreds of billions of stars and has existed long enough for a technological civilization to cross it many times. Yet we have no confirmed signal, artifact, or visitor.

Possible explanations range from rare life and short-lived civilizations to quiet machines and searches that have barely begun. The paradox may say more about our assumptions than about the sky. #humanity #world
`;

const consciousness = `# The Hard Problem of Consciousness

Even if we knew every neuron that fired when you saw red, we still would not know why it felt like anything at all.

## Description and Experience

Science can connect reports, behavior, and brain activity. The unresolved step is explaining why physical processing produces subjective experience rather than occurring in the dark.

Theories compete over whether consciousness is integrated information, a global broadcast, a predictive model, or a basic feature of reality. #mind #humanity
`;

const multiverse = `# The Multiverse: Many Worlds or Many Mistakes?

The multiverse is not one theory. It is a prediction that appears in several frameworks for different reasons.

## Three Meanings

1. Inflation may produce regions with different physical conditions.
2. Quantum mechanics may branch into non-interacting outcomes.
3. Mathematical structures may describe equally real worlds.

The hard question is not whether another universe sounds strange. It is whether a proposal makes testable predictions here. #quantum #world
`;

const productGuide = `# Line 1.0 for macOS

Line is a quiet place to think and write in Markdown.

## The Library

Use folders and tags to keep related drafts together. Star the documents you return to most often. Search looks through titles, tags, and document text.

## The Editor

- Press **Command-N** to create a document.
- Press **Command-S** to save immediately.
- Use the outline to jump between headings.
- Toggle preview to read rendered Markdown.

Your files remain plain text, so they stay portable. #documentation
`;

const reviewNotes = `# Beta Review Notes

## What Feels Right

The editor stays focused, the outline makes long documents navigable, and the library is understandable without onboarding.

## Before the Next Build

- Improve empty states.
- Preserve the current selection after search.
- Confirm unsaved-change recovery after a forced quit.
- Test importing a folder with duplicate filenames.

#review #testflight
`;

const releaseChecklist = `# TestFlight Release Checklist

## Product

- [ ] Create, edit, rename, and delete a document.
- [ ] Import and export Markdown files.
- [ ] Restore a recently deleted document.
- [ ] Verify keyboard shortcuts.

## Release

1. Increment the build number.
2. Archive a signed build.
3. Upload release notes.
4. Invite the internal group.

#testflight #work
`;

const archivedDraft = `# Notes on Better Writing

Prefer concrete nouns and active verbs. Cut the sentence that explains what the previous sentence already showed. Leave enough silence around an idea for the reader to meet it.

## Revision Pass

Read once for structure, once for clarity, and once aloud for rhythm. #writing #mind
`;

function seedDocument(
  id: string,
  content: string,
  folderId: string,
  options: { isStarred?: boolean; createdAt?: string; updatedAt?: string; deletedAt?: string } = {},
): MarkdownDocument {
  return createDocumentFromMarkdown({
    id,
    content,
    folderId,
    isStarred: options.isStarred,
    createdAt: options.createdAt ?? MAY_18_2026,
    updatedAt: options.updatedAt ?? options.createdAt ?? MAY_18_2026,
    deletedAt: options.deletedAt,
  });
}

export const seedDocuments: MarkdownDocument[] = [
  seedDocument("dark-matter-dark-energy", darkMatter, "basics", { isStarred: true }),
  seedDocument("incomplete-guide-universe", incompleteUniverse, "basics", { isStarred: true }),
  seedDocument("crispr-revolution", crispr, "basics", { updatedAt: "2026-05-18T14:50:00.000Z" }),
  seedDocument("evolution-four-billion-years", evolution, "basics", { isStarred: true }),
  seedDocument("string-theory", stringTheory, "basics"),
  seedDocument("fermi-paradox", fermiParadox, "basics"),
  seedDocument("hard-problem-consciousness", consciousness, "basics", { updatedAt: MAY_17_2026 }),
  seedDocument("multiverse", multiverse, "basics", { updatedAt: MAY_17_2026 }),
  seedDocument("line-macos-guide", productGuide, "documentation", { isStarred: true }),
  seedDocument("beta-review-notes", reviewNotes, "reviews", { createdAt: MAY_17_2026 }),
  seedDocument("testflight-release-checklist", releaseChecklist, "work", { createdAt: MAY_14_2026 }),
  seedDocument("notes-better-writing", archivedDraft, "archive", { createdAt: MAY_14_2026 }),
];

export const seedTags = [...new Set(seedDocuments.flatMap((document) => document.tags))].sort();

export function getSeedDocument(id: string): MarkdownDocument | undefined {
  return seedDocuments.find((document) => document.id === id);
}

export function getFolderDocumentCount(folderId: string): number {
  const childFolderIds = seedFolders
    .filter((folder) => folder.parentId === folderId)
    .map((folder) => folder.id);
  return seedDocuments.filter(
    (document) => document.folderId === folderId || childFolderIds.includes(document.folderId),
  ).length;
}
