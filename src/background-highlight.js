import { ViewPlugin, Decoration, EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import { highlightTheme } from "./highlight-style.js";
const resultEffect = StateEffect.define();
export const resetHighlight = StateEffect.define();
export const backgroundHighlight = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view;
      this.request = 0;
      this.destroyed = false;
      this.decorations = Decoration.none;
      this.start();
    }
    start() {
      const view = this.view;
      this.worker?.terminate();
      this.request++;
      try {
        this.worker = new Worker(
          new URL("./highlight-worker.js", import.meta.url),
          { type: "module" },
        );
        this.worker.onmessage = ({ data }) => {
          if (this.destroyed || data.request !== this.request) return;
          view.dom.dataset.highlightState = "ready";
          view.dispatch({ effects: resultEffect.of(data.spans) });
        };
        this.worker.onerror = () => this.fail();
        this.send({ doc: view.state.doc.toString() });
      } catch {
        queueMicrotask(() => this.fail());
      }
    }
    fail() {
      if (this.destroyed) return;
      this.worker?.terminate();
      this.worker = null;
      this.view.dom.dataset.highlightState = "error";
      this.view.dom.dispatchEvent(
        new CustomEvent("highlight-error", { bubbles: true }),
      );
    }
    send(data) {
      if (!this.worker) return;
      this.view.dom.dataset.highlightState = "pending";
      this.worker.postMessage({
        ...data,
        request: ++this.request,
        ranges: this.view.visibleRanges,
      });
    }
    update(update) {
      if (
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(resetHighlight)),
        )
      ) {
        this.decorations = Decoration.none;
        this.start();
        return;
      }
      if (update.docChanged) {
        this.decorations = this.decorations.map(update.changes);
        const changes = [];
        update.changes.iterChanges((fromA, toA, fromB, toB, insert) =>
          changes.push({ fromA, toA, fromB, toB, insert: insert.toString() }),
        );
        this.send({ changes });
      } else if (update.viewportChanged) this.send({});
      for (const tr of update.transactions)
        for (const effect of tr.effects)
          if (effect.is(resultEffect)) {
            this.decorations = Decoration.set(
              effect.value.map(([from, to, cls]) =>
                Decoration.mark({ class: cls }).range(from, to),
              ),
              true,
            );
          }
    }
    destroy() {
      this.destroyed = true;
      this.worker?.terminate();
      delete this.view.dom.dataset.highlightState;
    }
  },
  { decorations: (value) => value.decorations },
);
export const backgroundHighlightTheme = EditorView.baseTheme(highlightTheme);
