import React from 'react';
import type { Editor } from '@tiptap/react';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, 
  Highlighter, Subscript, Superscript, Undo, Redo, ClipboardPaste, Scissors, Copy, 
  List, ListOrdered, ListTree, Baseline, IndentDecrease, IndentIncrease,
  Table as TableIcon, Image as ImageIcon, Link as LinkIcon, RemoveFormatting,
  Columns, LayoutTemplate, Settings, Heading1, Heading2, Type, Search, Replace, GripHorizontal, ChevronDown, Check,
  Download, FileText
} from 'lucide-react';
import type { PageMargin, PageOrientation } from './WordApp';
import { exportAsPDF, exportAsDOCX } from './ExportUtils';

interface RibbonBarProps {
  editor: Editor | null;
  pageMargin: PageMargin;
  setPageMargin: (m: PageMargin) => void;
  pageOrientation: PageOrientation;
  setPageOrientation: (o: PageOrientation) => void;
  showRuler: boolean;
  setShowRuler: (s: boolean) => void;
  docTitle?: string;
}

export function RibbonBar({ editor, pageMargin, setPageMargin, pageOrientation, setPageOrientation, showRuler, setShowRuler, docTitle = 'Document 1' }: RibbonBarProps) {
  const [activeTab, setActiveTab] = React.useState('Home');
  const [lastHighlightColor, setLastHighlightColor] = React.useState('#ffff00');
  const [lastTextColor, setLastTextColor] = React.useState('#000000');
  const [showHighlightPalette, setShowHighlightPalette] = React.useState(false);
  const [showTextColorPalette, setShowTextColorPalette] = React.useState(false);
  const [showLineSpacing, setShowLineSpacing] = React.useState(false);
  const [showChangeCase, setShowChangeCase] = React.useState(false);

  // Force re-render on every editor transaction / selection update
  // so toolbar buttons reflect the current cursor formatting
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    if (!editor) return;

    const handler = () => forceUpdate();
    editor.on('transaction', handler);
    editor.on('selectionUpdate', handler);

    return () => {
      editor.off('transaction', handler);
      editor.off('selectionUpdate', handler);
    };
  }, [editor]);

  const HIGHLIGHT_COLORS = [
    '#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#0000FF', '#FF0000',
    '#000080', '#008080', '#008000', '#800080', '#800000', '#808000',
    '#808080', '#C0C0C0', '#000000', '#FFFFFF'
  ];

  const TEXT_COLORS = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
    '#C00000', '#FFC000', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0',
    '#EEECE1', '#1F497D', '#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646'
  ];

  if (!editor) return <div className="h-[140px] bg-[#F3F4F6] dark:bg-[#212121] border-b border-slate-200 dark:border-[#3A3A3A] shrink-0" />;

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor.chain().focus().toggleUnderline().run();
  const toggleStrike = () => editor.chain().focus().toggleStrike().run();

  // Subscript/Superscript: unset the other before toggling
  const toggleSubscript = () => {
    if (editor.isActive('superscript')) {
      editor.chain().focus().toggleSuperscript().toggleSubscript().run();
    } else {
      editor.chain().focus().toggleSubscript().run();
    }
  };
  const toggleSuperscript = () => {
    if (editor.isActive('subscript')) {
      editor.chain().focus().toggleSubscript().toggleSuperscript().run();
    } else {
      editor.chain().focus().toggleSuperscript().run();
    }
  };

  const setAlign = (align: 'left' | 'center' | 'right' | 'justify') => editor.chain().focus().setTextAlign(align).run();

  const setFontFamily = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') {
      // "Calibri (Body)" = reset / unset font family
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(val).run();
    }
  };

  const setColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.chain().focus().setColor(e.target.value).run();
  };

  const setHighlight = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setLastHighlightColor(color);
    editor.chain().focus().setHighlight({ color }).run();
  };

  const toggleHighlight = () => {
    if (editor.isActive('highlight')) {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color: lastHighlightColor }).run();
    }
  };

  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  const toggleTaskList = () => editor.chain().focus().toggleTaskList().run();

  const insertTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  const insertImage = () => {
    const url = window.prompt('Enter Image URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };
  const setLink = () => {
    const url = window.prompt('Enter URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };
  const clearFormatting = () => editor.chain().focus().unsetAllMarks().clearNodes().run();

  // Rich-text clipboard handling — copy HTML when possible
  const handleCopy = async () => {
    try {
      const { from, to } = editor.state.selection;
      const slice = editor.state.doc.slice(from, to);
      const text = editor.state.doc.textBetween(from, to, '\n');

      // Try to write HTML to clipboard via ClipboardItem API
      const tempDiv = document.createElement('div');
      tempDiv.className = 'ProseMirror';
      const fragment = (editor.view as any).domSerializer?.serializeFragment(slice.content);
      if (fragment) {
        tempDiv.appendChild(fragment);
        const htmlStr = tempDiv.innerHTML;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/plain': new Blob([text], { type: 'text/plain' }),
              'text/html': new Blob([htmlStr], { type: 'text/html' }),
            }),
          ]);
        } catch {
          // Fallback to plain text
          await navigator.clipboard.writeText(text);
        }
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      document.execCommand('copy');
    }
    editor.chain().focus().run();
  };
  
  const handleCut = async () => {
    try {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, '\n');
      await navigator.clipboard.writeText(text);
      editor.chain().focus().deleteSelection().run();
    } catch {
      document.execCommand('cut');
      editor.chain().focus().run();
    }
  };

  const handlePaste = async () => {
    try {
      const items = await navigator.clipboard.read();
      let pasted = false;
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const html = await blob.text();
          editor.commands.insertContent(html);
          pasted = true;
          break;
        }
      }
      if (!pasted) {
        const text = await navigator.clipboard.readText();
        editor.commands.insertContent(text);
      }
    } catch {
      try {
        const text = await navigator.clipboard.readText();
        editor.commands.insertContent(text);
      } catch {
        document.execCommand('paste');
      }
    }
  };

  // Get current font size — normalize and display correctly
  const getCurrentFontSize = (): string => {
    const attrs = editor.getAttributes('textStyle');
    if (attrs.fontSize) {
      const raw = String(attrs.fontSize);
      // Remove 'pt' suffix for display
      return raw.replace('pt', '');
    }
    // Show default size based on current heading level
    if (editor.isActive('heading', { level: 1 })) return '28';
    if (editor.isActive('heading', { level: 2 })) return '20';
    if (editor.isActive('heading', { level: 3 })) return '16';
    return '11'; // Default paragraph size
  };

  const handleFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = e.target.value;
    if (size) {
      editor.chain().focus().setFontSize(`${size}pt`).run();
    } else {
      editor.chain().focus().unsetFontSize().run();
    }
  };

  const handleLineHeight = (val: string) => {
    if (val === '1.0') {
      editor.chain().focus().unsetLineHeight().run();
    } else {
      editor.chain().focus().setLineHeight(val).run();
    }
    setShowLineSpacing(false);
  };
  
  const currentLh = (() => {
    if (!editor) return '1.0';
    let lh: string | null = null;
    if (editor.isActive('heading')) lh = editor.getAttributes('heading').lineHeight;
    else if (editor.isActive('listItem')) lh = editor.getAttributes('listItem').lineHeight;
    else if (editor.isActive('taskItem')) lh = editor.getAttributes('taskItem').lineHeight;
    else if (editor.isActive('paragraph')) lh = editor.getAttributes('paragraph').lineHeight;
    
    if (!lh) return '1.0';
    const lhStr = String(lh);
    if (lhStr === '1.25' || lhStr === '1.5' || lhStr === '1.75' || lhStr === '2.5') return lhStr;
    if (lhStr === '1.15') return '1.0'; // Fallback for old values
    if (lhStr === '2' || lhStr === '2.0') return '2.0';
    if (lhStr === '3' || lhStr === '3.0') return '3.0';
    return '1.0';
  })();
  
  const handleChangeCase = (val: 'uppercase' | 'lowercase' | 'capitalize' | 'none') => {
    editor.chain().focus().setTextTransform(val).run();
    setShowChangeCase(false);
  };

  return (
    <div className="flex flex-col relative z-20 shrink-0 select-none">
      
      {/* Ribbon Tab Row */}
      <nav className="h-9 bg-[#F3F4F6] dark:bg-[#212121] flex items-end px-4 sm:px-6 lg:px-8 gap-1 text-[11.5px] font-medium text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-[#3A3A3A] relative z-10 pt-1">
        {['File', 'Home', 'Insert', 'Layout', 'References', 'Review', 'View'].map((tab) => {
          const isActive = tab === activeTab;
          const isFile = tab === 'File';
          
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={
                isActive
                  ? 'bg-white dark:bg-[#2A2A2A] text-blue-700 dark:text-blue-400 border border-b-0 border-slate-200 dark:border-[#3A3A3A] px-4 h-8 flex items-center justify-center rounded-t shadow-[0_1px_0_0_white] dark:shadow-[0_1px_0_0_#2A2A2A] relative z-20 cursor-pointer font-semibold mb-[-1px]'
                  : isFile
                  ? 'hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-4 h-8 flex items-center justify-center rounded-t transition-colors cursor-pointer border border-transparent font-semibold mb-[-1px]'
                  : 'hover:bg-slate-200/80 dark:hover:bg-[#333333] text-slate-600 dark:text-zinc-400 px-4 h-8 flex items-center justify-center rounded-t transition-colors cursor-pointer border border-transparent mb-[-1px]'
              }
            >
              {tab}
            </button>
          );
        })}
      </nav>

      {/* Ribbon Content Toolbar Panel */}
      <div className="relative bg-white dark:bg-[#2A2A2A] flex items-stretch gap-4 px-4 sm:px-6 lg:px-8 py-2 border-b border-slate-300 dark:border-[#3A3A3A] h-24 shadow-sm shrink-0 z-30">
        
        {activeTab === 'Home' && (
          <>
            {/* Group 1: Undo & Clipboard */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex items-center h-full gap-2 text-slate-700 dark:text-slate-200">
                <div className="flex flex-col gap-1 mr-1">
                  <button onMouseDown={(e) => e.preventDefault()} onClick={handlePaste} className="flex flex-col items-center justify-center w-12 h-14 hover:bg-slate-100 dark:hover:bg-[#333333] rounded transition-colors">
                    <ClipboardPaste size={22} className="text-yellow-600 mb-1" />
                    <span className="text-[10px] font-medium">Paste</span>
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <ToolbarButton icon={<Scissors size={14} />} onClick={handleCut} title="Cut" />
                    <ToolbarButton icon={<Copy size={14} />} onClick={handleCopy} title="Copy" />
                  </div>
                  <div className="flex items-center gap-1">
                    <ToolbarButton icon={<Undo size={14} />} onClick={() => editor.chain().focus().undo().run()} title="Undo" />
                    <ToolbarButton icon={<Redo size={14} />} onClick={() => editor.chain().focus().redo().run()} title="Redo" />
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Clipboard</div>
            </div>

            {/* Group 2: Font Controls */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex flex-col justify-center h-full gap-1.5">
                <div className="flex items-center gap-1">
                  <select 
                    className="h-7 px-2 border border-slate-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-[#2A2A2A] dark:text-slate-200 outline-none focus:border-blue-600 transition-all w-36 shadow-sm"
                    onChange={setFontFamily}
                    value={editor.getAttributes('textStyle').fontFamily || ''}
                  >
                    <option value="">Calibri (Body)</option>
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Inter">Inter</option>
                    <option value="Geist">Geist</option>
                  </select>
                  <select 
                    className="h-7 px-1 border border-slate-300 dark:border-zinc-700 rounded text-xs bg-white dark:bg-[#2A2A2A] dark:text-slate-200 outline-none focus:border-blue-600 transition-all w-14 shadow-sm"
                    onChange={handleFontSize}
                    value={getCurrentFontSize()}
                  >
                    <option value="">Default</option>
                    <option value="8">8</option>
                    <option value="9">9</option>
                    <option value="10">10</option>
                    <option value="11">11</option>
                    <option value="12">12</option>
                    <option value="14">14</option>
                    <option value="16">16</option>
                    <option value="18">18</option>
                    <option value="20">20</option>
                    <option value="24">24</option>
                    <option value="28">28</option>
                    <option value="36">36</option>
                    <option value="48">48</option>
                    <option value="72">72</option>
                  </select>
                  
                  <div className="relative flex items-center">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowChangeCase(!showChangeCase)}
                      className="flex items-center justify-between h-7 px-1.5 hover:bg-slate-100 dark:hover:bg-[#333333] rounded border border-transparent transition-all cursor-pointer"
                      title="Change Case"
                    >
                      <div className="flex items-center gap-0.5">
                        <span className="text-[12.5px] font-serif font-medium text-slate-700 dark:text-slate-200 leading-none pb-[1px]">Aa</span>
                        <ChevronDown size={10} className="text-slate-500" />
                      </div>
                    </button>
                    
                    {showChangeCase && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowChangeCase(false)} />
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#2A2A2A] border border-slate-200 dark:border-zinc-700 shadow-xl rounded-md py-1 z-50 w-[150px]">
                          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleChangeCase('uppercase')} className="w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-slate-100 dark:hover:bg-[#333333] text-slate-700 dark:text-slate-200 transition-colors uppercase">UPPERCASE</button>
                          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleChangeCase('lowercase')} className="w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-slate-100 dark:hover:bg-[#333333] text-slate-700 dark:text-slate-200 transition-colors lowercase">lowercase</button>
                          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleChangeCase('capitalize')} className="w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-slate-100 dark:hover:bg-[#333333] text-slate-700 dark:text-slate-200 transition-colors capitalize">Capitalize Each Word</button>
                          <div className="w-full h-px bg-slate-200 dark:bg-zinc-700 my-1"></div>
                          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleChangeCase('none')} className="w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-slate-100 dark:hover:bg-[#333333] text-slate-700 dark:text-slate-200 transition-colors">None</button>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <ToolbarButton icon={<RemoveFormatting size={14} />} onClick={clearFormatting} title="Clear Formatting" />
                </div>
                <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                  <ToolbarButton icon={<Bold size={15} />} isActive={editor.isActive('bold')} onClick={toggleBold} title="Bold" />
                  <ToolbarButton icon={<Italic size={15} />} isActive={editor.isActive('italic')} onClick={toggleItalic} title="Italic" />
                  <ToolbarButton icon={<Underline size={15} />} isActive={editor.isActive('underline')} onClick={toggleUnderline} title="Underline" />
                  <ToolbarButton icon={<Strikethrough size={15} />} isActive={editor.isActive('strike')} onClick={toggleStrike} title="Strikethrough" />
                  <ToolbarButton icon={<Subscript size={15} />} isActive={editor.isActive('subscript')} onClick={toggleSubscript} title="Subscript" />
                  <ToolbarButton icon={<Superscript size={15} />} isActive={editor.isActive('superscript')} onClick={toggleSuperscript} title="Superscript" />
                  
                  <div className="w-px h-5 bg-slate-300 dark:bg-zinc-700 mx-1"></div>
                  
                  <div className="relative flex items-center rounded transition-all duration-200">
                    <button 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={toggleHighlight}
                      className={`flex flex-col items-center justify-center w-7 h-7 rounded-l transition-all duration-150 ${
                        editor.isActive('highlight') 
                          ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700/50 text-blue-700 dark:text-blue-400' 
                          : 'hover:bg-slate-100 dark:hover:bg-[#333333] border border-transparent'
                      }`}
                      title="Toggle Highlight"
                    >
                      <Highlighter size={14} />
                      <div className="w-4 h-1 mt-0.5 rounded-full" style={{ backgroundColor: editor.getAttributes('highlight').color || lastHighlightColor }}></div>
                    </button>
                    <button 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowHighlightPalette(true)}
                      className="relative w-3.5 h-7 flex flex-col items-center justify-center hover:bg-slate-200 dark:hover:bg-[#444444] rounded-r border border-transparent border-l-slate-200 dark:border-l-zinc-700 cursor-pointer"
                    >
                      <ChevronDown size={10} className="text-slate-500" />
                    </button>
                    {showHighlightPalette && (
                      <ColorPalettePicker 
                        colors={HIGHLIGHT_COLORS}
                        activeColor={editor.getAttributes('highlight').color || lastHighlightColor}
                        onSelect={(color) => {
                          setLastHighlightColor(color);
                          editor.chain().focus().setHighlight({ color }).run();
                        }}
                        onClose={() => setShowHighlightPalette(false)}
                      />
                    )}
                  </div>

                  <div className="relative flex items-center rounded transition-all duration-200 ml-1">
                    <button 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => editor.chain().focus().setColor(lastTextColor).run()}
                      className="flex flex-col items-center justify-center w-7 h-7 rounded-l hover:bg-slate-100 dark:hover:bg-[#333333] border border-transparent transition-all duration-150"
                      title="Text Color"
                    >
                      <Baseline size={14} />
                      <div className="w-4 h-1 mt-0.5 rounded-full" style={{ backgroundColor: editor.getAttributes('textStyle').color || lastTextColor }}></div>
                    </button>
                    <button 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowTextColorPalette(true)}
                      className="relative w-3.5 h-7 flex flex-col items-center justify-center hover:bg-slate-200 dark:hover:bg-[#444444] rounded-r border border-transparent border-l-slate-200 dark:border-l-zinc-700 cursor-pointer"
                    >
                      <ChevronDown size={10} className="text-slate-500" />
                    </button>
                    {showTextColorPalette && (
                      <ColorPalettePicker 
                        colors={TEXT_COLORS}
                        activeColor={editor.getAttributes('textStyle').color || lastTextColor}
                        onSelect={(color) => {
                          setLastTextColor(color);
                          editor.chain().focus().setColor(color).run();
                        }}
                        onClose={() => setShowTextColorPalette(false)}
                        showAutomatic
                        onAutomatic={() => {
                          editor.chain().focus().unsetColor().run();
                        }}
                      />
                    )}
                  </div>

                </div>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Font</div>
            </div>

            {/* Group 3: Paragraph Controls */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex flex-col justify-center h-full gap-1.5">
                <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                  <ToolbarButton icon={<List size={15} />} isActive={editor.isActive('bulletList')} onClick={toggleBulletList} title="Bullet List" />
                  <ToolbarButton icon={<ListOrdered size={15} />} isActive={editor.isActive('orderedList')} onClick={toggleOrderedList} title="Numbered List" />
                  <ToolbarButton icon={<ListTree size={15} />} isActive={editor.isActive('taskList')} onClick={toggleTaskList} title="Task List" />
                  
                  <div className="w-px h-5 bg-slate-300 dark:bg-zinc-700 mx-1"></div>
                  
                  <ToolbarButton icon={<IndentDecrease size={15} />} isActive={false} onClick={() => editor.chain().focus().outdent().run()} title="Decrease Indent" />
                  <ToolbarButton icon={<IndentIncrease size={15} />} isActive={false} onClick={() => editor.chain().focus().indent().run()} title="Increase Indent" />
                </div>

                <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                  <ToolbarButton icon={<AlignLeft size={15} />} isActive={editor.isActive({ textAlign: 'left' })} onClick={() => setAlign('left')} title="Align Left" />
                  <ToolbarButton icon={<AlignCenter size={15} />} isActive={editor.isActive({ textAlign: 'center' })} onClick={() => setAlign('center')} title="Align Center" />
                  <ToolbarButton icon={<AlignRight size={15} />} isActive={editor.isActive({ textAlign: 'right' })} onClick={() => setAlign('right')} title="Align Right" />
                  <ToolbarButton icon={<AlignJustify size={15} />} isActive={editor.isActive({ textAlign: 'justify' })} onClick={() => setAlign('justify')} title="Justify" />
                  
                  <div className="w-px h-5 bg-slate-300 dark:bg-zinc-700 mx-1"></div>
                  
                  <div className="relative flex items-center">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowLineSpacing(!showLineSpacing)}
                      className="flex items-center justify-between w-[64px] h-7 px-1.5 hover:bg-slate-100 dark:hover:bg-[#333333] rounded border border-transparent transition-all cursor-pointer"
                      title="Line Spacing"
                    >
                      <div className="flex items-center gap-1.5">
                        <GripHorizontal size={14} className="text-slate-500 dark:text-zinc-400" />
                        <span className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">{currentLh}</span>
                      </div>
                      <ChevronDown size={10} className="text-slate-500" />
                    </button>
                    
                    {showLineSpacing && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowLineSpacing(false)} />
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#2A2A2A] border border-slate-200 dark:border-zinc-700 shadow-xl rounded-md py-1 z-50 w-24">
                          {['1.0', '1.25', '1.5', '1.75', '2.0', '2.5', '3.0'].map(val => (
                            <button
                              key={val}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleLineHeight(val)}
                              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors ${currentLh === val ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-medium' : 'text-slate-700 dark:text-slate-200'}`}
                            >
                              {val}
                              {currentLh === val && <Check size={12} className="text-blue-600 dark:text-blue-400" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Paragraph</div>
            </div>

            {/* Group 4: Styles Gallery */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex items-center h-full gap-2.5 overflow-x-auto max-w-[400px] px-1 py-1">
                 <StyleChip title="Normal" subtitle="AaBbCcDdEe" isActive={!editor.isActive('heading')} onClick={() => editor.chain().focus().setParagraph().run()} />
                 <StyleChip title="Heading 1" subtitle="AaBbCcDdEe" isHeading isActive={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
                 <StyleChip title="Heading 2" subtitle="AaBbCcDdEe" isHeading isActive={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
                 <StyleChip title="Title" subtitle="AaBbCc" isHeading isActive={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Styles</div>
            </div>

            {/* Group 5: Editing */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex flex-col justify-center h-full gap-1">
                <button className="flex items-center gap-2 px-2 py-1 hover:bg-slate-100 dark:hover:bg-[#333333] rounded transition-colors text-slate-700 dark:text-slate-200 w-24">
                  <Search size={14} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium">Find</span>
                </button>
                <button className="flex items-center gap-2 px-2 py-1 hover:bg-slate-100 dark:hover:bg-[#333333] rounded transition-colors text-slate-700 dark:text-slate-200 w-24">
                  <Replace size={14} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium">Replace</span>
                </button>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Editing</div>
            </div>
          </>
        )}

        {activeTab === 'Insert' && (
          <>
            {/* Group 1: Tables */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex flex-col justify-center h-full gap-1.5 px-2">
                <button 
                  onClick={insertTable}
                  className="flex flex-col items-center justify-center w-14 h-14 hover:bg-slate-100 dark:hover:bg-[#333333] rounded transition-colors text-slate-700 dark:text-slate-200"
                >
                  <TableIcon size={24} className="text-orange-500 mb-1" />
                  <span className="text-[10px] font-medium">Table</span>
                </button>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Tables</div>
            </div>

            {/* Group 2: Illustrations */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex flex-col justify-center h-full gap-1.5 px-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <button 
                    onClick={insertImage}
                    className="flex flex-col items-center justify-center w-14 h-14 hover:bg-slate-100 dark:hover:bg-[#333333] rounded transition-colors"
                  >
                    <ImageIcon size={24} className="text-emerald-500 mb-1" />
                    <span className="text-[10px] font-medium">Pictures</span>
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Illustrations</div>
            </div>

            {/* Group 3: Links */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex flex-col justify-center h-full gap-1.5 px-2">
                <button 
                  onClick={setLink}
                  className="flex flex-col items-center justify-center w-14 h-14 hover:bg-slate-100 dark:hover:bg-[#333333] rounded transition-colors text-slate-700 dark:text-slate-200"
                >
                  <LinkIcon size={24} className="text-blue-500 mb-1" />
                  <span className="text-[10px] font-medium">Link</span>
                </button>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Links</div>
            </div>
          </>
        )}

        {activeTab === 'Layout' && (
          <>
            {/* Group 1: Page Setup */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex items-center h-full gap-2 text-slate-700 dark:text-slate-200 px-2">
                
                <div className="flex flex-col items-center justify-center gap-1 w-24">
                  <LayoutTemplate size={20} className="text-slate-600 dark:text-slate-400" />
                  <select 
                    value={pageMargin}
                    onChange={(e) => setPageMargin(e.target.value as PageMargin)}
                    className="h-6 w-full text-center px-1 text-[10px] bg-transparent hover:bg-slate-100 dark:hover:bg-[#333333] rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-600 outline-none font-medium cursor-pointer shadow-none appearance-none"
                    style={{ textAlignLast: 'center' }}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Narrow">Narrow</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Wide">Wide</option>
                  </select>
                </div>

                <div className="flex flex-col items-center justify-center gap-1 w-24">
                  <Columns size={20} className="text-slate-600 dark:text-slate-400" />
                  <select 
                    value={pageOrientation}
                    onChange={(e) => setPageOrientation(e.target.value as PageOrientation)}
                    className="h-6 w-full text-center px-1 text-[10px] bg-transparent hover:bg-slate-100 dark:hover:bg-[#333333] rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-600 outline-none font-medium cursor-pointer shadow-none appearance-none"
                    style={{ textAlignLast: 'center' }}
                  >
                    <option value="Portrait">Portrait</option>
                    <option value="Landscape">Landscape</option>
                  </select>
                </div>

              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Page Setup</div>
            </div>
          </>
        )}
        
        {activeTab === 'View' && (
          <>
            {/* Group 1: Show */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex items-center h-full gap-2 text-slate-700 dark:text-slate-200 px-2">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={showRuler} 
                    onChange={() => setShowRuler(!showRuler)} 
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  Ruler
                </label>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Show</div>
            </div>
          </>
        )}
        
        {activeTab === 'File' && (
          <>
            {/* Group 1: Download / Export */}
            <div className="flex flex-col justify-between border-r border-slate-200 dark:border-[#3A3A3A] pr-4 shrink-0">
              <div className="flex items-center h-full gap-3 text-slate-700 dark:text-slate-200 px-2">
                <button
                  onClick={() => editor && exportAsPDF(editor, docTitle, { pageMargin, pageOrientation })}
                  className="flex flex-col items-center justify-center w-16 h-14 hover:bg-slate-100 dark:hover:bg-[#333333] rounded transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-1">
                    <FileText size={20} className="text-red-600 dark:text-red-400" />
                  </div>
                  <span className="text-[10px] font-semibold">PDF</span>
                </button>
                <button
                  onClick={() => editor && exportAsDOCX(editor, docTitle, { pageMargin, pageOrientation })}
                  className="flex flex-col items-center justify-center w-16 h-14 hover:bg-slate-100 dark:hover:bg-[#333333] rounded transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-1">
                    <Download size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-[10px] font-semibold">DOCX</span>
                </button>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider text-center mt-1">Download</div>
            </div>
          </>
        )}

        {/* Placeholder for un-implemented tabs */}
        {['References', 'Review'].includes(activeTab) && (
          <div className="flex items-center justify-center w-full h-full text-slate-400 text-sm">
            This tab is coming soon!
          </div>
        )}

      </div>
    </div>
  );
}

function ToolbarButton({ icon, isActive, onClick, title }: { icon: React.ReactNode; isActive?: boolean; onClick: () => void, title?: string }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-all duration-150 ${
        isActive
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-semibold border border-blue-300 dark:border-blue-700/50'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#333333]'
      }`}
    >
      {icon}
    </button>
  );
}

function StyleChip({ title, subtitle, isActive, onClick, isHeading }: { title: string, subtitle: string, isActive: boolean, onClick: () => void, isHeading?: boolean }) {
  return (
    <button 
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick} 
      className={`flex flex-col items-center justify-center rounded p-1 min-w-[72px] h-14 transition-all duration-150 border bg-white dark:bg-[#2A2A2A] ${
        isActive 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500' 
          : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
      }`}
    >
      <span className={`text-xs text-slate-700 dark:text-slate-300 ${isHeading ? 'text-blue-700 dark:text-blue-400 font-semibold' : ''}`}>{subtitle}</span>
      <span className="text-[10px] text-slate-500 font-medium">{title}</span>
    </button>
  );
}

function ColorPalettePicker({ 
  colors, 
  onSelect, 
  onClose,
  activeColor,
  showAutomatic,
  onAutomatic
}: { 
  colors: string[], 
  onSelect: (c: string) => void, 
  onClose: () => void,
  activeColor: string,
  showAutomatic?: boolean,
  onAutomatic?: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#2A2A2A] border border-slate-200 dark:border-zinc-700 shadow-xl rounded-md p-2 z-50 w-48">
        
        {showAutomatic && onAutomatic && (
           <button 
             onMouseDown={(e) => e.preventDefault()}
             onClick={() => { onAutomatic(); onClose(); }}
             className="w-full text-left px-2 py-1.5 mb-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#333333] rounded transition-colors flex items-center gap-2 border border-slate-200 dark:border-zinc-600"
           >
             <div className="w-4 h-4 rounded-sm border border-slate-300 dark:border-zinc-500 bg-gradient-to-br from-black to-white"></div>
             Automatic
           </button>
        )}

        <div className="grid grid-cols-6 gap-1">
          {colors.map((c, i) => (
            <button
              key={`${c}-${i}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(c); onClose(); }}
              className={`w-6 h-6 rounded-sm border ${activeColor === c ? 'border-blue-500 ring-1 ring-blue-500 scale-110 z-10' : 'border-slate-200 dark:border-zinc-600 hover:scale-110'} transition-transform`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>
    </>
  );
}
