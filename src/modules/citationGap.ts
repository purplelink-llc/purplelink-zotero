import { getPref } from "../utils/prefs";
import { getString } from "../utils/locale";

// Purplelink's existing paid Citation Gap endpoint — the same one the
// web upload flow at https://purplelink.llc/tools/citation-gap/ uses.
// No new backend was built for this plugin; it's a thin client over the
// tool that already exists and is live.
const SUBMIT_URL =
  "https://ben-ampel--purplelink-latextools-web.modal.run/citation-gap/submit";
const STATUS_URL =
  "https://ben-ampel--purplelink-latextools-web.modal.run/paper-review/status";

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — generous; the web UI's own polling has no hard cap

export class CitationGapFactory {
  static registerRightClickMenuItem() {
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "zotero-itemmenu-purplelink-citationgap",
      label: getString("menuitem-label"),
      commandListener: () => CitationGapFactory.checkSelectedItem(),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`,
    });
  }

  static async checkSelectedItem() {
    const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
      closeOnClick: false,
    });

    function fail(text: string) {
      pw.changeLine({ text, type: "fail" });
      pw.startCloseTimer(8000);
    }

    try {
      const token = getPref("token");
      if (!token) {
        pw.createLine({
          text: "Set your Citation Gap token in the plugin preferences first (Zotero Settings → Purplelink Citation Gap).",
          type: "fail",
        }).show();
        pw.startCloseTimer(8000);
        return;
      }

      const zoteroPane = ztoolkit.getGlobal("ZoteroPane");
      const items = zoteroPane.getSelectedItems();
      if (items.length !== 1) {
        pw.createLine({
          text: "Select exactly one item with a PDF attachment.",
          type: "fail",
        }).show();
        pw.startCloseTimer(6000);
        return;
      }

      const parent = items[0];
      pw.createLine({
        text: "Looking for a PDF attachment...",
        type: "default",
        progress: 5,
      }).show();

      const pdfItem = await CitationGapFactory.findPdfAttachment(parent);
      if (!pdfItem) {
        fail("No PDF attachment found on this item.");
        return;
      }

      pw.changeLine({ text: "Reading PDF...", progress: 15 });
      const path = await pdfItem.getFilePathAsync();
      if (!path) {
        fail(
          "Could not read the attached PDF file — it may be a linked (not stored) file.",
        );
        return;
      }
      const bytes = await IOUtils.read(path);
      const blob = new Blob([bytes], { type: "application/pdf" });

      pw.changeLine({ text: "Uploading to Purplelink...", progress: 30 });
      const form = new FormData();
      form.append("token", token);
      form.append("file", blob, "manuscript.pdf");
      const submitResp = await fetch(SUBMIT_URL, {
        method: "POST",
        body: form,
      });
      const submitData = (await submitResp.json()) as {
        detail?: string;
        error?: string;
      };
      if (!submitResp.ok) {
        fail(
          `Purplelink rejected the upload: ${submitData?.detail || submitData?.error || submitResp.status}`,
        );
        return;
      }

      pw.changeLine({
        text: "Checking for citation gaps (this can take a couple of minutes)...",
        progress: 50,
      });
      const resultMd = await CitationGapFactory.pollForResult(token);
      if (!resultMd) {
        fail(
          "Timed out waiting for the result. Check purplelink.llc/tools/paper-review/status/ with your token — the scan may still finish.",
        );
        return;
      }

      await CitationGapFactory.attachResultNote(parent, resultMd);
      pw.changeLine({
        text: "Done — see the new note attached to this item.",
        progress: 100,
        type: "success",
      });
      pw.startCloseTimer(5000);
    } catch (e) {
      ztoolkit.log("Purplelink citation gap check failed", e);
      fail(
        "Something went wrong — see the browser console (Help → Debug Output Logging) for details.",
      );
    }
  }

  /** First PDF attachment found on a regular (non-attachment, non-note)
   * item. Doesn't try to disambiguate multiple PDFs — a manuscript item
   * should only have the one relevant PDF attached. */
  static async findPdfAttachment(
    parent: Zotero.Item,
  ): Promise<Zotero.Item | null> {
    if (!parent.isRegularItem()) return null;
    const attachmentIDs = parent.getAttachments();
    for (const id of attachmentIDs) {
      const attachment = Zotero.Items.get(id) as Zotero.Item;
      if (
        attachment.isAttachment() &&
        attachment.attachmentContentType === "application/pdf"
      ) {
        return attachment;
      }
    }
    return null;
  }

  /** Mirrors the web upload flow's polling loop (see
   * site/tools/paper-review/status.js) — same /paper-review/status
   * endpoint, shared across all adjacent tools including citation-gap. */
  static async pollForResult(token: string): Promise<string | null> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await Zotero.Promise.delay(POLL_INTERVAL_MS);
      let resp: Response;
      try {
        resp = await fetch(`${STATUS_URL}?token=${encodeURIComponent(token)}`);
      } catch {
        continue; // transient network error — keep polling until the deadline
      }
      if (!resp.ok) continue;
      const data = (await resp.json()) as {
        status?: string;
        result_md?: string;
      };
      if (data.status === "done" && data.result_md) return data.result_md;
      if (data.status === "error") return null;
    }
    return null;
  }

  /** Reports are attached as a child note rather than shown in a popup,
   * so they persist in the library alongside the manuscript instead of
   * disappearing when the dialog closes. Rendered as escaped <pre> text
   * for v0.1 — no markdown-to-HTML conversion yet, see README "Known
   * limitations". */
  static async attachResultNote(parent: Zotero.Item, resultMd: string) {
    const note = new Zotero.Item("note");
    note.parentID = parent.id;
    note.libraryID = parent.libraryID;
    const escaped = resultMd
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    note.setNote(`<h1>Purplelink Citation Gap</h1><pre>${escaped}</pre>`);
    await note.saveTx();
  }
}
