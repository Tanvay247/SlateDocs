import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const PaginationPluginKey = new PluginKey('pagination');

export interface PaginationOptions {
  pageHeight: number;
  pageGap: number;
  marginTop: number;
  marginBottom: number;
  zoom?: number;
}

/** Data stored in the plugin state */
interface PaginationState {
  decorations: DecorationSet;
  totalPages: number;
  /** Serialized version of options to detect layout changes */
  optionsVersion: string;
}

function serializeOptions(opts: PaginationOptions): string {
  return `${opts.pageHeight}|${opts.pageGap}|${opts.marginTop}|${opts.marginBottom}|${opts.zoom ?? 100}`;
}

export const Pagination = Extension.create<PaginationOptions>({
  name: 'pagination',

  addOptions() {
    return {
      pageHeight: 1056,
      pageGap: 40,
      marginTop: 96,
      marginBottom: 96,
      zoom: 100,
    };
  },

  addStorage() {
    return {
      pageHeight: this.options.pageHeight,
      pageGap: this.options.pageGap,
      marginTop: this.options.marginTop,
      marginBottom: this.options.marginBottom,
      zoom: this.options.zoom ?? 100,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: PaginationPluginKey,
        state: {
          init(): PaginationState {
            return {
              decorations: DecorationSet.empty,
              totalPages: 1,
              optionsVersion: '',
            };
          },
          apply(tr, oldState: PaginationState): PaginationState {
            const meta = tr.getMeta(PaginationPluginKey);
            if (meta !== undefined) {
              return meta as PaginationState;
            }
            return {
              decorations: oldState.decorations.map(tr.mapping, tr.doc),
              totalPages: oldState.totalPages,
              optionsVersion: oldState.optionsVersion,
            };
          },
        },
        props: {
          decorations(state) {
            const pluginState = this.getState(state) as PaginationState | undefined;
            return pluginState?.decorations ?? DecorationSet.empty;
          },
        },
        view: (editorView) => {
          let rafId: number | null = null;

          const runMeasurement = (view: typeof editorView) => {
            if (view.isDestroyed || !view.dom) return;

            // Read current options from editor storage (dynamically updated)
            const storage = extension.storage;
            const currentOptions: PaginationOptions = {
              pageHeight: storage.pageHeight ?? extension.options.pageHeight,
              pageGap: storage.pageGap ?? extension.options.pageGap,
              marginTop: storage.marginTop ?? extension.options.marginTop,
              marginBottom: storage.marginBottom ?? extension.options.marginBottom,
              zoom: storage.zoom ?? extension.options.zoom ?? 100,
            };
            const currentVersion = serializeOptions(currentOptions);
            const oldPluginState = PaginationPluginKey.getState(view.state) as PaginationState | undefined;
            const optionsChanged = currentVersion !== (oldPluginState?.optionsVersion ?? '');

            const { pageHeight, pageGap, marginTop, marginBottom } = currentOptions;
            const usableHeight = pageHeight - marginTop - marginBottom;

            // 1. Temporarily hide ALL old spacers so we can measure the raw DOM
            const oldSpacers = view.dom.querySelectorAll('.page-break-spacer');
            oldSpacers.forEach(s => ((s as HTMLElement).style.display = 'none'));

            // Force a synchronous reflow so measurements are accurate
            void view.dom.offsetHeight;

            const decorations: Decoration[] = [];
            const spacerHeights: number[] = [];
            // contentY tracks the Y cursor within the "content area" of the current page
            let contentY = 0;
            let currentPage = 1;
            let prevMarginBottom = 0;

            // Determine the CSS transform scale applied to the editor's ancestor.
            let cssScale = 1;
            const editorRect = view.dom.getBoundingClientRect();
            if (editorRect.height > 0 && view.dom.offsetHeight > 0) {
              cssScale = editorRect.height / view.dom.offsetHeight;
            }

            // 2. Walk every top-level doc node
            view.state.doc.forEach((node, offset) => {
              const domNode = view.nodeDOM(offset) as HTMLElement | null;
              if (!domNode || domNode.nodeType !== 1) return;

              let nodeHeight = domNode.offsetHeight;
              if (nodeHeight <= 0) {
                const rect = domNode.getBoundingClientRect();
                nodeHeight = cssScale > 0 ? rect.height / cssScale : rect.height;
              }
              if (nodeHeight <= 0) return;

              // Include CSS margins with margin collapsing
              const computedStyle = window.getComputedStyle(domNode);
              const marginTopPx = parseFloat(computedStyle.marginTop) || 0;
              const marginBottomPx = parseFloat(computedStyle.marginBottom) || 0;

              // Collapse vertical margins between adjacent blocks on the same page
              const effectiveMarginTop = contentY === 0 ? 0 : Math.max(0, marginTopPx - prevMarginBottom);
              const totalNodeHeight = effectiveMarginTop + nodeHeight + marginBottomPx;

              const remainingOnPage = usableHeight - contentY;

              // Check: does this node fit on the current page?
              if (totalNodeHeight > remainingOnPage && contentY > 0) {
                // It doesn't fit — inject a spacer to push to the next page.
                // Subtract marginTopPx because the node's own margin-top pushes it below the spacer.
                const spacerHeight = Math.max(0, remainingOnPage + marginBottom + pageGap + marginTop - marginTopPx);

                if (spacerHeight > 0) {
                  const spacer = document.createElement('div');
                  spacer.className = 'page-break-spacer';
                  spacer.setAttribute('aria-hidden', 'true');
                  spacer.setAttribute('data-remaining-on-page', String(remainingOnPage));
                  spacer.style.height = `${spacerHeight}px`;
                  spacer.style.width = '100%';
                  spacer.style.pointerEvents = 'none';
                  spacer.style.userSelect = 'none';

                  decorations.push(
                    Decoration.widget(offset, spacer, {
                      key: `page-break-${offset}-${currentPage}`,
                      side: -1,
                      spacerHeight, // Store in spec for change detection
                    })
                  );
                  spacerHeights.push(spacerHeight);
                }

                currentPage++;
                contentY = nodeHeight + marginBottomPx; // Node is now at top of new page
                prevMarginBottom = marginBottomPx;
              } else {
                contentY += totalNodeHeight;
                prevMarginBottom = marginBottomPx;
              }

              // If the node itself exceeds the usable height (very tall node),
              // account for the pages it spans, including inter-page gaps.
              const fullPageStep = usableHeight + marginBottom + pageGap + marginTop;
              while (contentY > usableHeight) {
                contentY -= fullPageStep;
                currentPage++;
              }
              if (contentY < 0) {
                contentY = 0;
              }
            });

            // If there's any content on the last page, it counts
            const totalPages = currentPage;

            // 3. Restore old spacers' display
            oldSpacers.forEach(s => ((s as HTMLElement).style.display = ''));

            // 4. Check if anything actually changed (compare positions AND spacer heights)
            const oldDecos = oldPluginState?.decorations ?? DecorationSet.empty;
            const oldTotalPages = oldPluginState?.totalPages ?? 1;

            let changed = totalPages !== oldTotalPages || optionsChanged;
            if (!changed) {
              const oldFound = oldDecos.find();
              if (decorations.length !== oldFound.length) {
                changed = true;
              } else {
                for (let i = 0; i < decorations.length; i++) {
                  const newD = decorations[i] as any;
                  const oldD = oldFound[i] as any;
                  if (
                    newD.from !== oldD.from ||
                    newD.spec?.spacerHeight !== oldD.spec?.spacerHeight
                  ) {
                    changed = true;
                    break;
                  }
                }
              }
            }

            // 5. Dispatch only if changed
            if (changed) {
              const newState: PaginationState = {
                decorations: DecorationSet.create(view.state.doc, decorations),
                totalPages,
                optionsVersion: currentVersion,
              };
              const tr = view.state.tr.setMeta(PaginationPluginKey, newState);
              tr.setMeta('addToHistory', false);
              view.dispatch(tr);
            }
          };

          const scheduleMeasurement = (view: typeof editorView) => {
            if (rafId !== null) {
              cancelAnimationFrame(rafId);
            }
            rafId = requestAnimationFrame(() => {
              rafId = null;
              runMeasurement(view);
            });
          };

          const handleImageLoad = (e: Event) => {
            const target = e.target as HTMLElement | null;
            if (target && target.tagName === 'IMG') {
              scheduleMeasurement(editorView);
            }
          };

          editorView.dom.addEventListener('load', handleImageLoad, true);

          return {
            update: (view, prevState) => {
              // Read current options from editor storage (dynamically updated)
              const storage = extension.storage;
              const currentOptions: PaginationOptions = {
                pageHeight: storage.pageHeight ?? extension.options.pageHeight,
                pageGap: storage.pageGap ?? extension.options.pageGap,
                marginTop: storage.marginTop ?? extension.options.marginTop,
                marginBottom: storage.marginBottom ?? extension.options.marginBottom,
                zoom: storage.zoom ?? extension.options.zoom ?? 100,
              };
              const currentVersion = serializeOptions(currentOptions);

              // Check if layout options changed
              const oldPluginState = PaginationPluginKey.getState(view.state) as PaginationState | undefined;
              const optionsChanged = currentVersion !== (oldPluginState?.optionsVersion ?? '');
              const forceLayout = Boolean(view.state.tr.getMeta('layoutChange'));

              // Only recalculate when the document changes OR layout options changed
              if (!optionsChanged && !forceLayout && prevState && prevState.doc.eq(view.state.doc)) {
                return;
              }

              scheduleMeasurement(view);
            },
            destroy: () => {
              editorView.dom.removeEventListener('load', handleImageLoad, true);
              if (rafId !== null) {
                cancelAnimationFrame(rafId);
              }
            },
          };
        },
      }),
    ];
  },
});
