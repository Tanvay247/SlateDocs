import { Extension } from '@tiptap/core';

export interface FontSizeOptions {
  types: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

/**
 * Normalize a CSS font-size string to `<number>pt`.
 * Accepts "12pt", "16px", "12", etc.
 * 1px ≈ 0.75pt at 96 DPI.
 */
function normalizeFontSize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const str = String(raw).trim().toLowerCase();
  if (!str) return null;

  if (str.endsWith('pt')) {
    const n = parseFloat(str);
    return isNaN(n) ? null : `${n}pt`;
  }
  if (str.endsWith('px')) {
    const n = parseFloat(str);
    if (isNaN(n)) return null;
    // Convert px to pt: 1px = 0.75pt
    return `${Math.round(n * 0.75 * 100) / 100}pt`;
  }
  // Plain number — treat as pt
  const n = parseFloat(str);
  return isNaN(n) ? null : `${n}pt`;
}

export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => {
              return normalizeFontSize(element.style.fontSize);
            },
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        const normalized = normalizeFontSize(fontSize);
        if (!normalized) return false;
        return chain().setMark('textStyle', { fontSize: normalized }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});
