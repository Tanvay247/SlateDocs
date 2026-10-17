import React from 'react';
import type { Editor } from '@tiptap/react';
import { Minus, Plus } from 'lucide-react';

interface StatusBarProps {
  editor: Editor | null;
  zoom: number;
  setZoom: (zoom: number) => void;
  currentPage: number;
  totalPages: number;
}

export function StatusBar({
  editor,
  zoom,
  setZoom,
  currentPage,
  totalPages,
}: StatusBarProps) {
  const [words, setWords] = React.useState(0);
  const [characters, setCharacters] = React.useState(0);

  React.useEffect(() => {
    if (!editor) return;

    const updateStats = () => {
      setWords(editor.storage.characterCount?.words?.() || 0);
      setCharacters(editor.storage.characterCount?.characters?.() || 0);
    };

    // Initial update
    updateStats();

    // Listen to changes in the editor to re-render stats instantly
    editor.on('update', updateStats);
    return () => {
      editor.off('update', updateStats);
    };
  }, [editor]);

  const handleZoomIn = () => setZoom(Math.min(200, zoom + 10));
  const handleZoomOut = () => setZoom(Math.max(50, zoom - 10));

  return (
    <footer className="h-7 w-full bg-[#1B4D89] dark:bg-[#181818] text-blue-100 dark:text-zinc-400 border-t border-blue-900/40 dark:border-zinc-800 px-4 flex items-center justify-between text-xs select-none relative z-20 shrink-0">
      {/* Left: Page Counter & Word Statistics */}
      <div className="flex items-center gap-4">
        <span className="font-medium hover:text-white cursor-pointer transition-colors">
          Page {currentPage} of {totalPages}
        </span>
        <span className="text-blue-300/40 dark:text-zinc-700">|</span>
        <span>
          {words} {words === 1 ? 'word' : 'words'}
        </span>
        <span className="text-blue-300/40 dark:text-zinc-700">|</span>
        <span className="hidden sm:inline">{characters} characters</span>
      </div>

      {/* Right: Zoom Slider & Controls */}
      <div className="flex items-center gap-3">
        {/* Zoom Out Button */}
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 50}
          className="p-0.5 rounded hover:bg-white/10 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Zoom Out (-10%)"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Range Slider */}
        <input
          type="range"
          min="50"
          max="200"
          step="5"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-24 accent-white dark:accent-blue-500 cursor-pointer h-1 bg-blue-950 dark:bg-zinc-700 rounded-lg"
          title={`Zoom: ${zoom}%`}
        />

        {/* Zoom In Button */}
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 200}
          className="p-0.5 rounded hover:bg-white/10 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Zoom In (+10%)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* Clickable Percentage (Click to Reset to 100%) */}
        <button
          onClick={() => setZoom(100)}
          className="w-11 text-right font-mono text-[11px] hover:text-white transition-colors"
          title="Click to reset zoom to 100%"
        >
          {zoom}%
        </button>
      </div>
    </footer>
  );
}
