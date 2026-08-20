# Line 1.0.1 manual QA

Desktop app only. Pass/fail each item. Quote on-screen copy if it differs.

## Menu

- [ ] File > New Document
- [ ] File > Open…
- [ ] File > Save
- [ ] File > Save As…
- [ ] Save sheet title is **Save Document**, button **Save**
- [ ] Open sheet title is **Open Documents**, button **Open**

## Empty first launch

- [ ] Library: “No Markdown files yet”
- [ ] Library: “Create a blank file or open Markdown from your Mac.”
- [ ] Library actions: **Create file**, **Open file**
- [ ] Workspace: “LINE FOR MARKDOWN”, “Write something worth keeping.”
- [ ] Workspace actions: **Create Markdown**, **Open file**
- [ ] Title shows “No document selected”
- [ ] No demo notes

## Create / open / save / Save As

- [ ] New document opens as Untitled
- [ ] First heading becomes the document title
- [ ] Save chip shows **Save**, then **Saved** after write
- [ ] Save As… writes a new file and keeps editing it
- [ ] Import toast: “Markdown imported”

## Unsaved close

- [ ] Prompt: “Save changes before closing?” / “Save changes to files before closing?”
- [ ] Buttons: **Save**, **Cancel**, **Close and Keep Changes**

## Disk conflict

- [ ] Banner: “This document changed on disk. Use Save As to keep your version without overwriting the external changes.”
- [ ] Banner action: **Save As…**

## Finder open

- [ ] Double-click / Open With while Line is running opens the file
- [ ] Double-click / Open With while Line is quit launches and opens the file
- [ ] Unsaved conflict toast: “Kept your unsaved version of an open document”

## Title-bar chrome

- [ ] Menu bar app name is **Line**, not Electron
- [ ] Traffic lights visible and usable
- [ ] Drag regions work on empty title-bar space

## Quit / relaunch (session-only; bookmarks out)

- [ ] After relaunch, the note is labeled **Not linked — Save As**
- [ ] Save prompts Save As and never overwrites a remembered path

## Unlinked filter

- [ ] Sidebar shows an **Unlinked** row when at least one library note has no path
- [ ] **Unlinked** row clears when the unlinked count hits 0
- [ ] Filtering **Unlinked** shows only notes with no path

## Library heading

- [ ] Heading reads **Unlinked**, or **#tag**, or **Library** depending on the active filter
- [ ] **All Documents** selected state drops when **Unlinked** or a tag is on

## Find shortcut (Cmd+F)

- [ ] With the markdown textarea focused/targeted, Cmd+F does not hijack — native find stays
- [ ] With focus elsewhere, Cmd+F focuses library search
- [ ] No custom Find panel

## Library list entrance

- [ ] No per-card stagger
- [ ] Cards fade in together with a short list-in (~140ms ease-out), not 34ms × index

## Ghost tag / empty filter

- [ ] **All Documents** clears `activeTag`
- [ ] Dead tags drop from the tag list
- [ ] Empty filter copy: “No matching files” / “Try another search.”

## P1s (do not block the rest)

Frontend already shipped these on main. Still verify:

- [ ] **P1-1** Search/tag must not change the open document
- [ ] **P1-2** Create after Preview lands in Editor
- [ ] **P1-3** Narrow window must not hide Sidebar/Library with no way back
