# Purplelink Citation Gap for Zotero

A Zotero 7 plugin that runs [Purplelink's Citation Gap](https://purplelink.llc/tools/citation-gap/)
check on a manuscript directly from your library, instead of downloading the
PDF and re-uploading it through the browser.

Right-click any library item with a PDF attachment → **Check for citation
gaps (Purplelink)** → the result comes back as a note attached to the item.

## Status

**v0.1.0 — builds cleanly, not yet tested inside a real Zotero installation.**
This repo was scaffolded and its API calls verified against Zotero's own
TypeScript type definitions (`zotero-types`) and the official
[`zotero-plugin-template`](https://github.com/windingwind/zotero-plugin-template),
but there is no Zotero desktop app available in the environment this was
built in — `npm run build` produces a real, type-checked `.xpi`, but nobody
has clicked the menu item inside Zotero yet. Before distributing:

1. Install the built `.xpi` (`.scaffold/build/purplelink-citation-gap.xpi`
   after `npm run build`) in a real Zotero 7 install via Tools → Add-ons →
   gear icon → "Install Add-on From File".
2. Set a real Citation Gap token in Settings → Purplelink Citation Gap
   (buy one at purplelink.llc/tools/citation-gap/, $3).
3. Select a library item with an attached manuscript PDF, right-click, run
   the check, and confirm the resulting note actually appears and reads
   correctly.
4. Confirm `attachment.getFilePathAsync()` returns a usable path for a
   normal (non-linked) stored PDF attachment — this is the one API call in
   `src/modules/citationGap.ts` most worth double-checking live, since it's
   the piece with the least redundant verification behind it.

## How it works

- No new backend — this is a thin client over the same `/citation-gap/submit`
  and `/paper-review/status` endpoints the web upload flow at
  purplelink.llc/tools/citation-gap/ already uses (see
  `backend/app.py` in the main Purplelink repo).
- The token is a normal Citation Gap purchase token, pasted into the plugin's
  preferences pane. This plugin doesn't do checkout — buy the token on the
  website first, same as any other Citation Gap customer.
- The PDF is read straight off disk (`IOUtils.read` on the attachment's
  file path) and uploaded as multipart form data — nothing is sent
  anywhere except Purplelink's existing backend.
- On completion, the Markdown report is attached as a child note on the
  original item (currently as escaped plain text in a `<pre>` block — no
  Markdown-to-HTML rendering yet, see Known limitations).

## Known limitations (v0.1)

- **No Markdown rendering.** The report note shows raw Markdown source in a
  `<pre>` block rather than rendered HTML. Fine to read, not pretty.
- **One PDF per item.** If an item has multiple PDF attachments, the first
  one found is used — no picker.
- **No in-plugin purchase flow.** Users still buy their token on the
  website. An in-Zotero checkout is out of scope for v0.1.
- **Distribution.** Not yet submitted to
  [MohamedElashri/awesome-zotero](https://github.com/MohamedElashri/awesome-zotero)
  or any plugin directory — see
  `docs/zotero-plugin-and-directory-scoping.md` in the main repo. Hold that
  submission until this has been smoke-tested per the Status section above.

## Development

Built on the official
[Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)
(TypeScript, esbuild, [`zotero-plugin-toolkit`](https://github.com/windingwind/zotero-plugin-toolkit)).

```bash
npm install
npm run build   # -> .scaffold/build/purplelink-citation-gap.xpi
npm run start   # launches a real Zotero profile with the plugin hot-loaded, if Zotero is installed locally
```

See `zotero-plugin.config.ts` for build config and `.env.example` for the
`start`/`serve` environment variables (Zotero binary path, profile, etc.).

## License

AGPL-3.0-or-later (inherited from the upstream template).
