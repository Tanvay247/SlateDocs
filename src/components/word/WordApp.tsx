import React from 'react';
import { useEditor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { FontFamily } from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Typography } from '@tiptap/extension-typography';
import { CharacterCount } from '@tiptap/extension-character-count';
import { FontSize } from './FontSize';
import { LineHeight } from './LineHeight';
import { Indent } from './Indent';
import { TextTransform } from './TextTransform';
import { Pagination } from './Pagination';
import { getMargins, getPageDimensions } from './PageCanvas';

export type PageMargin = 'Normal' | 'Narrow' | 'Moderate' | 'Wide';
export type PageOrientation = 'Portrait' | 'Landscape';

import { RibbonBar } from './RibbonBar';
import { PageCanvas } from './PageCanvas';
import { StatusBar } from './StatusBar';
import { MessageSquare, Share, Moon, Sun, CheckCircle2 } from 'lucide-react';

const DOCUMENT_STORAGE_KEY = 'slatedocs:word:document:v1';

interface StoredDocument {
  title: string;
  content: JSONContent;
}

interface StoredLayoutSettings {
  pageMargin: PageMargin;
  pageOrientation: PageOrientation;
  showRuler: boolean;
  zoom: number;
}

interface StoredDocumentEnvelope extends StoredDocument {
  version: 1;
  updatedAt: string;
  layout?: StoredLayoutSettings;
}

const DEFAULT_LAYOUT: StoredLayoutSettings = {
  pageMargin: 'Normal',
  pageOrientation: 'Portrait',
  showRuler: true,
  zoom: 100,
};

function createDefaultDocument(): StoredDocument {
  return {
    title: 'Document 1',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Welcome to Slate Doc' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'This is a paginated document editor built with Tiptap, React, and Astro.' }],
        },
      ],
    },
  };
}

function loadStoredDocument(): { doc: StoredDocument; layout: StoredLayoutSettings } {
  if (typeof window === 'undefined') {
    return { doc: createDefaultDocument(), layout: { ...DEFAULT_LAYOUT } };
  }

  try {
    const rawDocument = window.localStorage.getItem(DOCUMENT_STORAGE_KEY);
    if (!rawDocument) return { doc: createDefaultDocument(), layout: { ...DEFAULT_LAYOUT } };

    const storedDocument = JSON.parse(rawDocument) as Partial<StoredDocumentEnvelope>;
    if (
      storedDocument.version !== 1 ||
      typeof storedDocument.title !== 'string' ||
      !storedDocument.content ||
      storedDocument.content.type !== 'doc'
    ) {
      return { doc: createDefaultDocument(), layout: { ...DEFAULT_LAYOUT } };
    }

    const layout: StoredLayoutSettings = {
      pageMargin: storedDocument.layout?.pageMargin ?? DEFAULT_LAYOUT.pageMargin,
      pageOrientation: storedDocument.layout?.pageOrientation ?? DEFAULT_LAYOUT.pageOrientation,
      showRuler: storedDocument.layout?.showRuler ?? DEFAULT_LAYOUT.showRuler,
      zoom: storedDocument.layout?.zoom ?? DEFAULT_LAYOUT.zoom,
    };

    return {
      doc: {
        title: storedDocument.title,
        content: storedDocument.content,
      },
      layout,
    };
  } catch {
    return { doc: createDefaultDocument(), layout: { ...DEFAULT_LAYOUT } };
  }
}

function loadInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem('theme');
  if (stored === 'dark') {
    document.documentElement.classList.add('dark');
    return true;
  }
  if (stored === 'light') {
    document.documentElement.classList.remove('dark');
    return false;
  }
  // Fallback: check if class is already set (e.g., by AppLayout.astro script)
  return document.documentElement.classList.contains('dark');
}

class WordErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('WordApp Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-[#1E1E1E] text-slate-800 dark:text-slate-200 p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#2A2A2A] rounded-xl shadow-lg border border-slate-200 dark:border-zinc-700 p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred in Slate Doc.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#0078D4] hover:bg-[#0068B8] text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function WordAppInner() {
  const [initialData] = React.useState(loadStoredDocument);
  const [isDark, setIsDark] = React.useState(loadInitialTheme);
  const [docTitle, setDocTitle] = React.useState(initialData.doc.title);
  const [saveStatus, setSaveStatus] = React.useState<'saved' | 'saving' | 'error'>('saved');
  const [zoom, setZoom] = React.useState(initialData.layout.zoom);
  const [pageMargin, setPageMargin] = React.useState<PageMargin>(initialData.layout.pageMargin);
  const [pageOrientation, setPageOrientation] = React.useState<PageOrientation>(initialData.layout.pageOrientation);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [showRuler, setShowRuler] = React.useState(initialData.layout.showRuler);
  const documentRef = React.useRef<StoredDocument>(initialData.doc);
  const layoutRef = React.useRef<StoredLayoutSettings>(initialData.layout);
  const saveTimerRef = React.useRef<number | null>(null);

  const writeStoredDocument = React.useCallback(() => {
    const documentToSave: StoredDocumentEnvelope = {
      version: 1,
      title: documentRef.current.title,
      content: documentRef.current.content,
      updatedAt: new Date().toISOString(),
      layout: { ...layoutRef.current },
    };

    try {
      window.localStorage.setItem(DOCUMENT_STORAGE_KEY, JSON.stringify(documentToSave));
      return true;
    } catch {
      return false;
    }
  }, []);

  const scheduleSave = React.useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSaveStatus('saving');
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      setSaveStatus(writeStoredDocument() ? 'saved' : 'error');
    }, 350);
  }, [writeStoredDocument]);

  const isInitialLayoutMount = React.useRef(true);
  const isInitialRulerMount = React.useRef(true);

  React.useEffect(() => {
    const flushPendingSave = () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        writeStoredDocument();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSave();
      }
    };

    window.addEventListener('pagehide', flushPendingSave);
    window.addEventListener('beforeunload', flushPendingSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushPendingSave);
      window.removeEventListener('beforeunload', flushPendingSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushPendingSave();
    };
  }, [writeStoredDocument]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    setIsDark(nextDark);
  };

  const handleDocumentTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const title = event.target.value;
    documentRef.current.title = title;
    setDocTitle(title);
    scheduleSave();
  };

  const handleDocumentTitleBlur = () => {
    if (!docTitle.trim()) {
      const fallback = 'Untitled Document';
      documentRef.current.title = fallback;
      setDocTitle(fallback);
      scheduleSave();
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontFamily,
      Color,
      Subscript,
      Superscript,
      Indent,
      TextTransform,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
      CharacterCount,
      FontSize,
      LineHeight,
      Pagination,
    ],
    content: initialData.doc.content,
    onUpdate: ({ editor }) => {
      documentRef.current.content = editor.getJSON();
      scheduleSave();
    },
  });

  /* ---- Sync page layout & zoom changes into Pagination extension storage ---- */
  React.useEffect(() => {
    if (!editor) return;

    const margins = getMargins(pageMargin);
    const { pageH } = getPageDimensions(pageOrientation);

    // Update the Pagination extension's storage so the plugin reads fresh values
    editor.storage.pagination = {
      ...editor.storage.pagination,
      pageHeight: pageH,
      marginTop: margins.top,
      marginBottom: margins.bottom,
      zoom,
    };

    // Force a re-render by dispatching a transaction
    // This causes the pagination plugin's view.update() to fire immediately
    try {
      if (editor.view && !editor.isDestroyed) {
        const { tr } = editor.state;
        tr.setMeta('layoutChange', true);
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      }
    } catch (e) {
      console.warn('Failed to dispatch layoutChange transaction:', e);
    }

    // Skip saving on initial mount
    if (isInitialLayoutMount.current) {
      isInitialLayoutMount.current = false;
      return;
    }

    // Persist layout settings
    layoutRef.current = { ...layoutRef.current, pageMargin, pageOrientation, zoom };
    scheduleSave();
  }, [editor, pageMargin, pageOrientation, zoom, scheduleSave]);

  /* ---- Persist showRuler ---- */
  React.useEffect(() => {
    // Skip saving on initial mount
    if (isInitialRulerMount.current) {
      isInitialRulerMount.current = false;
      return;
    }

    layoutRef.current = { ...layoutRef.current, showRuler };
    scheduleSave();
  }, [showRuler, scheduleSave]);

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${isDark ? 'dark bg-[#212121]' : 'bg-[#F3F4F6]'}`}>
      
      {/* Top Blue Header Bar Alignment (HeaderBar) */}
      <header className="h-14 w-full bg-[#1B4D89] dark:bg-[#2A2A2A] dark:border-b dark:border-[#3A3A3A] text-white grid grid-cols-3 items-center px-4 sm:px-6 lg:px-8 select-none shrink-0 z-30 shadow-sm transition-colors duration-200">
        
        {/* Left Group */}
        <div className="flex items-center justify-start gap-3 sm:gap-4 h-full">
          <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={docTitle}
                onChange={handleDocumentTitleChange}
                onBlur={handleDocumentTitleBlur}
                size={Math.max(docTitle.length, 1)}
                className="font-bold text-sm tracking-tight hover:bg-white/10 px-2 py-0.5 rounded text-white bg-transparent border-none focus:outline-none focus:bg-white/20 transition-colors leading-none shrink-0 cursor-pointer"
              />
              <div
                className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 mt-0.5 ${
                  saveStatus === 'error'
                    ? 'bg-red-900/60 text-red-200 border-red-400/30'
                    : 'bg-blue-900/60 text-blue-200 border-blue-400/30'
                }`}
                aria-live="polite"
              >
                <CheckCircle2 size={10} className={saveStatus === 'error' ? 'text-red-300' : 'text-emerald-300'} />
                <span>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved'}</span>
              </div>
            </div>
            <span className="text-[10px] text-blue-200/80 px-2 font-medium tracking-wide leading-none mt-1">SlateDocs</span>
          </div>
        </div>

        {/* Center Search Bar */}
        <div className="flex items-center justify-center w-full">
          <div className="w-full max-w-md hidden md:block">
            <input 
              type="text" 
              placeholder="Search (Alt + Q)"
              className="h-8 w-full bg-blue-950/40 border border-blue-400/30 text-white placeholder-blue-200/60 rounded-md text-xs px-3 focus:outline-none focus:ring-1 focus:ring-blue-400/50 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Right Group */}
        <div className="flex items-center justify-end gap-3 h-full">
          <button 
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg hover:bg-white/10 text-white flex items-center justify-center transition-colors shrink-0"
            title="Toggle Dark Mode"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button className="h-8 px-3 text-xs bg-white/10 hover:bg-white/20 rounded-md flex items-center gap-2 transition-colors border border-white/10 shrink-0 shadow-sm">
            <MessageSquare size={14} />
            <span className="hidden sm:inline font-medium">Comments</span>
          </button>

          <button className="h-8 px-4 text-xs bg-white text-[#1B4D89] hover:bg-blue-50 font-semibold rounded-md flex items-center gap-2 transition-colors shadow-sm shrink-0">
            <Share size={14} />
            <span className="hidden sm:inline">Share</span>
          </button>

          <div className="w-8 h-8 rounded-full bg-[#0078D4] text-white text-xs font-bold flex items-center justify-center ring-2 ring-white/20 shrink-0 ml-1 shadow-sm">
            U
          </div>
        </div>
      </header>

      {/* Ribbon */}
      <RibbonBar 
        editor={editor} 
        pageMargin={pageMargin}
        setPageMargin={setPageMargin}
        pageOrientation={pageOrientation}
        setPageOrientation={setPageOrientation}
        showRuler={showRuler}
        setShowRuler={setShowRuler}
        docTitle={docTitle}
      />
      
      {/* Editor Canvas */}
      <PageCanvas 
        editor={editor} 
        zoom={zoom} 
        pageMargin={pageMargin}
        pageOrientation={pageOrientation}
        showRuler={showRuler}
        onPageInfoChange={({ currentPage, totalPages }) => {
          setCurrentPage(currentPage);
          setTotalPages(totalPages);
        }}
      />
      
      {/* Status Bar */}
      <StatusBar 
        editor={editor} 
        zoom={zoom} 
        setZoom={setZoom} 
        currentPage={currentPage}
        totalPages={totalPages}
      />
      
    </div>
  );
}

export function WordApp() {
  return (
    <WordErrorBoundary>
      <WordAppInner />
    </WordErrorBoundary>
  );
}
