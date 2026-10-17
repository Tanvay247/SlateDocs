# SlateDocs

A modern, web-based office suite built with Astro, React, and Tiptap. Create, edit, and collaborate on documents, spreadsheets, and presentations — all from your browser.

## Applications

| App | Route | Status |
|-----|-------|--------|
| **Slate Doc** | `/word` | ✅ Functional — rich-text document editor |
| **Slate Sheet** | `/excel` | 🚧 Coming Soon |
| **Slate Slide** | `/powerpoint` | 🚧 Coming Soon |

## Tech Stack

- **Framework**: [Astro 7](https://astro.build) (static output)
- **UI**: [React 19](https://react.dev) (islands architecture via `client:only`)
- **Editor**: [Tiptap](https://tiptap.dev) with 15+ extensions
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) + Geist fonts
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com) (via Wrangler)

## Project Structure

```
src/
├── components/
│   ├── shared/          # Shared UI components (future)
│   └── word/            # Slate Doc components
│       ├── WordApp.tsx   # Main app shell (header, ribbon, canvas, status bar)
│       ├── RibbonBar.tsx # MS Office-style ribbon toolbar
│       ├── PageCanvas.tsx# Document page rendering
│       ├── StatusBar.tsx # Bottom status bar (word count, zoom)
│       ├── FontSize.ts   # Custom Tiptap extension
│       ├── LineHeight.ts # Custom Tiptap extension
│       ├── Indent.ts     # Custom Tiptap extension
│       └── TextTransform.ts # Custom Tiptap extension
├── layouts/
│   └── AppLayout.astro   # Shared layout (navbar, footer, dark mode)
├── pages/
│   ├── index.astro       # Dashboard / landing page
│   ├── word/index.astro  # Slate Doc page
│   ├── excel/index.astro # Slate Sheet placeholder
│   └── powerpoint/index.astro # Slate Slide placeholder
└── styles/
    └── global.css        # Design tokens, animations, scrollbar styles
```

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:4321)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

Deploy to Cloudflare Pages:

```bash
npx wrangler pages deploy dist/
```

## License

All rights reserved © SlateDocs Suite.
