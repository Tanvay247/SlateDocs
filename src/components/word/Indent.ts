import { Extension } from '@tiptap/core';

export interface IndentOptions {
  types: string[];
  indentLevels: number[];
  defaultIndentLevel: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      indentLevels: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      defaultIndentLevel: 0,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: this.options.defaultIndentLevel,
            parseHTML: element => {
              const margin = element.style.marginLeft;
              if (!margin) return this.options.defaultIndentLevel;
              const remMatch = margin.match(/^(\d+(?:\.\d+)?)rem$/);
              if (remMatch) {
                return Math.round(parseFloat(remMatch[1]) / 2); 
              }
              const pxMatch = margin.match(/^(\d+(?:\.\d+)?)px$/);
              if (pxMatch) {
                return Math.round(parseFloat(pxMatch[1]) / 32); 
              }
              const ptMatch = margin.match(/^(\d+(?:\.\d+)?)pt$/);
              if (ptMatch) {
                return Math.round(parseFloat(ptMatch[1]) / 24); 
              }
              return this.options.defaultIndentLevel;
            },
            renderHTML: attributes => {
              if (!attributes.indent || attributes.indent === this.options.defaultIndentLevel) {
                return {};
              }
              return {
                style: `margin-left: ${attributes.indent * 2}rem`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent: () => ({ tr, state, dispatch, editor, commands }) => {
        // 1. If inside a table, let the table extension handle Tab → next cell
        if (editor.isActive('table')) {
          if (editor.can().goToNextCell()) {
            return commands.goToNextCell();
          }
          // Still in a table but can't go to next cell (last cell) — don't indent
          return false;
        }

        // 2. If inside a task list, try to nest the task item
        if (editor.isActive('taskItem')) {
          if (editor.can().sinkListItem('taskItem')) {
            return commands.sinkListItem('taskItem');
          }
          return false;
        }

        // 3. If inside a regular list, try to nest the list item
        if (editor.can().sinkListItem('listItem')) {
          return commands.sinkListItem('listItem');
        }
        
        // 4. Otherwise indent paragraph/heading blocks independently
        const { from, to } = state.selection;
        const maxIndent = this.options.indentLevels[this.options.indentLevels.length - 1];
        let applied = false;

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            const currentIndent = node.attrs.indent || 0;
            const nextIndent = Math.min(currentIndent + 1, maxIndent);
            if (nextIndent !== currentIndent) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: nextIndent,
                });
              }
              applied = true;
            }
          }
        });

        return applied;
      },
      
      outdent: () => ({ tr, state, dispatch, editor, commands }) => {
        // 1. If inside a table, let the table extension handle Shift-Tab → prev cell
        if (editor.isActive('table')) {
          if (editor.can().goToPreviousCell()) {
            return commands.goToPreviousCell();
          }
          return false;
        }

        // 2. If inside a task list, try to lift the task item
        if (editor.isActive('taskItem')) {
          if (editor.can().liftListItem('taskItem')) {
            return commands.liftListItem('taskItem');
          }
          return false;
        }

        // 3. If inside a regular list, try to lift the list item
        if (editor.can().liftListItem('listItem')) {
          return commands.liftListItem('listItem');
        }
        
        // 4. Otherwise outdent paragraph/heading blocks independently
        const { from, to } = state.selection;
        const defaultIndent = this.options.defaultIndentLevel;
        let applied = false;

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            const currentIndent = node.attrs.indent || 0;
            const prevIndent = Math.max(currentIndent - 1, defaultIndent);
            if (prevIndent !== currentIndent) {
              if (dispatch) {
                const attrs = { ...node.attrs };
                if (prevIndent === defaultIndent) {
                  delete attrs.indent;
                } else {
                  attrs.indent = prevIndent;
                }
                tr.setNodeMarkup(pos, undefined, attrs);
              }
              applied = true;
            }
          }
        });

        return applied;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      'Shift-Tab': () => this.editor.commands.outdent(),
    };
  }
});
