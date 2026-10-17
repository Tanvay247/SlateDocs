import { Extension } from '@tiptap/core';

export interface LineHeightOptions {
  types: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const LineHeight = Extension.create<LineHeightOptions>({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'listItem', 'taskItem'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight || null,
            renderHTML: attributes => {
              if (!attributes.lineHeight) {
                return {};
              }
              return {
                style: `line-height: ${attributes.lineHeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight: lineHeight => ({ tr, state, dispatch }) => {
        const { from, to } = state.selection;
        let applied = false;

        state.doc.nodesBetween(from, to, (node, pos) => {
          // Only target nodes whose type name is in our list
          const typeName = node.type.name;
          if (this.options.types.includes(typeName)) {
            if (dispatch) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                lineHeight,
              });
            }
            applied = true;
          }
        });

        return applied;
      },
      unsetLineHeight: () => ({ tr, state, dispatch }) => {
        const { from, to } = state.selection;
        let applied = false;

        state.doc.nodesBetween(from, to, (node, pos) => {
          const typeName = node.type.name;
          if (this.options.types.includes(typeName) && node.attrs.lineHeight) {
            if (dispatch) {
              const attrs = { ...node.attrs };
              delete attrs.lineHeight;
              tr.setNodeMarkup(pos, undefined, attrs);
            }
            applied = true;
          }
        });

        return applied;
      },
    };
  },
});
