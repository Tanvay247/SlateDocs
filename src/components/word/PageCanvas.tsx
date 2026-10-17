import React from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import type { PageMargin, PageOrientation } from './WordApp';
import { PaginationPluginKey } from './Pagination';
import '../../styles/prosemirror.css';

interface PageCanvasProps {
  editor: Editor | null;
  zoom: number;
  pageMargin: PageMargin;
  pageOrientation: PageOrientation;
  showRuler?: boolean;
  onPageInfoChange?: (info: { currentPage: number; totalPages: number }) => void;
}

/* A4 dimensions at 96 DPI */
const A4_W = 816;
const A4_H = 1056;
const PAGE_GAP = 40;

export function getMargins(m: PageMargin) {
  switch (m) {
    case 'Narrow':   return { top: 48, bottom: 48, left: 48, right: 48 };
    case 'Moderate': return { top: 96, bottom: 96, left: 72, right: 72 };
    case 'Wide':     return { top: 96, bottom: 96, left: 192, right: 192 };
    default:         return { top: 96, bottom: 96, left: 96, right: 96 };
  }
}

export function getPageDimensions(orientation: PageOrientation) {
  const isLandscape = orientation === 'Landscape';
  return {
    pageW: isLandscape ? A4_H : A4_W,
    pageH: isLandscape ? A4_W : A4_H,
  };
}

export function PageCanvas({
  editor,
  zoom,
  pageMargin,
  pageOrientation,
  showRuler = true,
  onPageInfoChange,
}: PageCanvasProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [totalPages, setTotalPages] = React.useState(1);

  const { pageW, pageH } = getPageDimensions(pageOrientation);
  const margins = getMargins(pageMargin);
  const contentWidth = pageW - margins.left - margins.right;
  const scale = zoom / 100;

  // Number of inch marks for the vertical ruler (single page)
  const vRulerInches = pageOrientation === 'Landscape' ? 8.5 : 11;
  const hRulerInches = pageOrientation === 'Landscape' ? 11 : 8.5;
  const INCH_PX = 96; // 1 inch = 96px at 96 DPI

  // Stable callback ref prevents scroll listener loop
  const pageInfoCallbackRef = React.useRef(onPageInfoChange);
  React.useEffect(() => {
    pageInfoCallbackRef.current = onPageInfoChange;
  }, [onPageInfoChange]);

  /* ---- Read totalPages from Pagination plugin state ---- */
  React.useEffect(() => {
    if (!editor) return;

    const handleTransaction = () => {
      const pluginState = PaginationPluginKey.getState(editor.state);
      const pages = pluginState?.totalPages ?? 1;
      setTotalPages(prev => (prev !== pages ? pages : prev));
    };

    // Initial read
    handleTransaction();

    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor]);

  /* ---- Scroll position → current page ---- */
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const scrollTop = el.scrollTop;
      const unit = (pageH + PAGE_GAP) * scale;
      // Active page updates when the next page reaches the upper quarter / third of viewport
      const adjusted = Math.max(0, scrollTop + el.clientHeight * 0.25 - 90);
      const cur = Math.max(1, Math.min(totalPages, Math.floor(adjusted / unit) + 1));

      pageInfoCallbackRef.current?.({ currentPage: cur, totalPages });
    };

    el.addEventListener('scroll', onScroll, { passive: true });

    // Calculate immediately
    onScroll();

    return () => el.removeEventListener('scroll', onScroll);
  }, [totalPages, pageH, scale]);

  /* ---- Click empty page area to focus editor at clicked position or end ---- */
  const handlePageAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor) return;
    // Only if clicking the background, not the editor content or rulers
    const target = e.target as HTMLElement;
    if (
      target.closest('.ProseMirror') ||
      target.closest('.page-break-spacer') ||
      target.closest('[data-ruler]')
    ) {
      return;
    }

    const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (pos && typeof pos.pos === 'number') {
      editor.chain().focus().setTextSelection(pos.pos).run();
    } else {
      editor.commands.focus('end');
    }
  };

  /* ---- Derived dimensions ---- */
  const totalH = totalPages * pageH + (totalPages - 1) * PAGE_GAP;
  // Use scaled height for the outer boundary to prevent excess scroll at zoom < 100%
  const scaledTotalH = totalH * scale;

  return (
    <div
      ref={scrollRef}
      className="w-full flex-1 overflow-auto bg-[#F8FAFC] dark:bg-[#212121] transition-colors duration-200 relative z-0"
      onClick={handlePageAreaClick}
    >
      {/* Decorative ambient glow */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-overlay"
        style={{
          width: '800px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(0,120,212,0.05) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          zIndex: -1,
        }}
        aria-hidden="true"
      />

      {/* Horizontal Ruler (Sticky Top) */}
      {showRuler && (
        <div
          data-ruler="true"
          className="sticky top-0 z-50 h-0 pointer-events-none mx-auto transition-all duration-200"
          style={{ width: `${pageW * scale + 100}px` }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 flex overflow-hidden pointer-events-auto transition-all duration-200"
            style={{
              width: `${pageW * scale}px`,
              height: '20px',
            }}
          >
            {/* Left margin zone (shaded) */}
            <div
              className="shrink-0 bg-slate-200 dark:bg-zinc-700/60 border-b border-r border-slate-300 dark:border-zinc-700/60"
              style={{ width: `${margins.left * scale}px`, height: '20px' }}
            />
            {/* Content zone with inch marks */}
            <div
              className="flex-1 bg-white dark:bg-[#2A2A2A] border-b border-slate-300 dark:border-zinc-700/60 flex overflow-hidden relative"
              style={{ height: '20px' }}
            >
              {Array.from({ length: Math.ceil(contentWidth / INCH_PX) }).map((_, i) => (
                <div
                  key={`hr-${i}`}
                  className="relative border-r border-slate-300 dark:border-zinc-700/60 box-border shrink-0 transition-all duration-200"
                  style={{ width: `${INCH_PX * scale}px` }}
                >
                  <span className="absolute top-0 left-1 text-[9px] text-slate-500 font-medium select-none">{i + 1}</span>
                  <div className="absolute bottom-0 left-1/4 h-1.5 border-l border-slate-300 dark:border-zinc-700/60" />
                  <div className="absolute bottom-0 left-1/2 h-2 border-l border-slate-300 dark:border-zinc-700/60" />
                  <div className="absolute bottom-0 left-3/4 h-1.5 border-l border-slate-300 dark:border-zinc-700/60" />
                </div>
              ))}
            </div>
            {/* Right margin zone (shaded) */}
            <div
              className="shrink-0 bg-slate-200 dark:bg-zinc-700/60 border-b border-l border-slate-300 dark:border-zinc-700/60"
              style={{ width: `${margins.right * scale}px`, height: '20px' }}
            />
          </div>
        </div>
      )}

      {/* Vertical Ruler — Fixed to single page height (MS Word style) */}
      {showRuler && (
        <div data-ruler="true" className="sticky left-0 z-40 w-0 h-0 pointer-events-none">
          <div
            className="absolute left-0 bg-white dark:bg-[#2A2A2A] border-r border-slate-300 dark:border-zinc-700/60 shadow-sm overflow-hidden pointer-events-auto transition-all duration-200"
            style={{
              top: '90px',
              height: `${pageH * scale}px`,
              width: '20px',
            }}
          >
            {Array.from({ length: Math.ceil(vRulerInches) }).map((_, i) => (
              <div
                key={`vr-${i}`}
                className="relative border-b border-slate-300 dark:border-zinc-700/60 box-border w-full shrink-0 transition-all duration-200"
                style={{ height: `${INCH_PX * scale}px` }}
              >
                <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] text-slate-500 font-medium leading-none select-none">{i + 1}</span>
                <div className="absolute top-1/4 right-0 w-1.5 border-b border-slate-300 dark:border-zinc-700/60" />
                <div className="absolute top-1/2 right-0 w-2.5 border-b border-slate-300 dark:border-zinc-700/60" />
                <div className="absolute top-3/4 right-0 w-1.5 border-b border-slate-300 dark:border-zinc-700/60" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outer Boundary Box — height uses scaled value to prevent excess scroll at zoom < 100% */}
      <div
        className="relative mx-auto transition-all duration-200"
        style={{
          width: `${pageW * scale + 100}px`,
          minHeight: `${scaledTotalH + 100}px`,
          marginTop: '40px',
          marginBottom: '40px',
        }}
        onClick={handlePageAreaClick}
      >
        {/* Transform Wrapper */}
        <div
          className="absolute top-[50px] left-1/2 -translate-x-1/2 origin-top"
          style={{
            width: `${pageW}px`,
            minHeight: `${totalH}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          {/* ========== Page background sheets ========== */}
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={`sheet-${i}`}
              className="absolute left-0 bg-white dark:bg-[#2A2A2A] border border-slate-200 dark:border-zinc-700/60 transition-colors duration-200"
              style={{
                width: `${pageW}px`,
                height: `${pageH}px`,
                top: `${i * (pageH + PAGE_GAP)}px`,
                boxShadow:
                  '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.04)',
              }}
            >
              <span className="absolute bottom-3 right-4 text-[10px] text-slate-300 dark:text-zinc-700 select-none pointer-events-none font-mono tabular-nums">
                {i + 1}
              </span>
            </div>
          ))}

          {/* ========== Editor content ========== */}
          <div
            ref={wrapperRef}
            className="relative z-10"
            style={{
              width: `${pageW}px`,
              maxWidth: `${pageW}px`,
              padding: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <div style={{
              width: `${contentWidth}px`,
              maxWidth: `${contentWidth}px`,
              overflow: 'hidden',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}>
              <EditorContent editor={editor} className="focus:outline-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
