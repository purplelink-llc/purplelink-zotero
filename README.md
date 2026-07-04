# Purplelink Citation Gap for Zotero

A Zotero 7 plugin that runs [Purplelink's Citation Gap](https://purplelink.llc/tools/citation-gap/)
check on a manuscript directly from your library, instead of downloading the
PDF and re-uploading it through the browser.

Right-click any library item with a PDF attachment → **Check for citation
gaps (Purplelink)** → the result comes back as a note attached to the item.

## Status

**v0.1.0 — end-to-end tested against a real Zotero 9.0.4 install and the live
production backend.** Verified: menu item registers, missing-token guard,
PDF read off disk, upload to `/citation-gap/submit`, polling
`/paper-review/status`, and the result note attaching correctly to the
library item. Two real bugs were found and fixed by this pass (not caught by
type-checking or `npm run build` alone):

- `manifest.json` capped `strict_max_version` at `8.*`, which Zotero 9
  flagged as incompatible. Now `9.*`.
- `FormData` isn't a global in Zotero's privileged main-window scope (unlike
  `fetch`/`Blob`, which are) — fixed by pulling the constructor off the
  browser window via `ztoolkit.getGlobal("FormData")`.

Still open before wider distribution:

1. Only tested on macOS with one manuscript PDF — the backend correctly
   reported it couldn't extract a reference list from that specific PDF
   (a real, honestly-reported edge case, not a plugin bug), so a PDF with a
   normal machine-readable bibliography hasn't been exercised yet.
2. Not tested on Windows/Linux, or against a linked (not stored) PDF
   attachment.
3. No real users yet — this has only been run by the developer.

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
  or any plugin directory, and not yet pushed to a public GitHub repo (this
  is currently a local-only git history) — see
  `docs/zotero-plugin-and-directory-scoping.md` in the main repo. Also note
  that `awesome-zotero`-style lists commonly require an open-source
  release with a public repo before listing; this plugin is AGPL-licensed
  and qualifies once it has a public home.

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
