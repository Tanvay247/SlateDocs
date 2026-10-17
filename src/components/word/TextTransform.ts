import { Mark, mergeAttributes } from '@tiptap/core';

export interface TextTransformOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textTransform: {
      setTextTransform: (transform: 'uppercase' | 'lowercase' | 'capitalize' | 'none') => ReturnType;
      unsetTextTransform: () => ReturnType;
    };
  }
}

export const TextTransform = Mark.create<TextTransformOptions>({
  name: 'textTransform',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      transform: {
        default: 'none',
        parseHTML: element => element.style.textTransform || 'none',
        renderHTML: attributes => {
          if (!attributes.transform || attributes.transform === 'none') {
            return {};
          }
          return {
            style: `text-transform: ${attributes.transform}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        style: 'text-transform',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextTransform: transform => ({ commands }) => {
        if (transform === 'none') {
          return commands.unsetMark(this.name);
        }
        return commands.setMark(this.name, { transform });
      },
      unsetTextTransform: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },
});
