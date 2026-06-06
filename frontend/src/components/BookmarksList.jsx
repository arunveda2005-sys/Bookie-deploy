import { useState } from 'react';
import { FiBookmark, FiClock, FiCpu, FiMessageSquare, FiSend } from 'react-icons/fi';

export default function BookmarksList({ bookmarks, onSeek, onAddBookmark }) {
    const [newNote, setNewNote] = useState('');

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const tagColors = {
        definition: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
        example: 'bg-green-500/10 text-green-300 border-green-500/20',
        important: 'bg-red-500/10 text-red-300 border-red-500/20',
        custom: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    };

    const renderAutoContext = (autoContext) => {
        if (!autoContext) return null;
        
        if (typeof autoContext === 'string') {
            try {
                autoContext = JSON.parse(autoContext);
            } catch (e) {
                return (
                    <p className="text-[11px] text-indigo-300/80 bg-indigo-950/20 p-2 rounded-lg border border-indigo-900/30 leading-relaxed mt-1">
                        {autoContext}
                    </p>
                );
            }
        }

        return (
            <div className="space-y-1 bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-900/30 text-[11px] mt-1.5">
                <div className="font-bold text-indigo-300 flex items-center gap-1">
                    <FiCpu className="h-3 w-3 text-indigo-400" />
                    {autoContext.title || 'AI Insights'}
                </div>
                {Array.isArray(autoContext.summary) && (
                    <ul className="list-disc list-inside space-y-0.5 text-indigo-100/90 pl-0.5">
                        {autoContext.summary.map((point, i) => (
                            <li key={i} className="leading-relaxed truncate">{point}</li>
                        ))}
                    </ul>
                )}
            </div>
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newNote.trim() && onAddBookmark) {
            onAddBookmark(newNote.trim());
            setNewNote('');
        }
    };

    return (
        <div className="flex flex-col h-[480px]">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#262637]/40">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                    <FiBookmark className="text-blue-500 h-4 w-4" /> Live Study Log
                </h3>
                <span className="text-[11px] font-semibold bg-[#20202f] text-[#82829b] px-2.5 py-1 rounded-full border border-[#2a2a3f]/50">
                    {bookmarks.length || 0} bookmarks
                </span>
            </div>

            {/* Bookmarks message feed */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {(!bookmarks || bookmarks.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-[#262637]/60 rounded-xl bg-[#191924]/20">
                        <FiMessageSquare className="h-8 w-8 text-[#585870] mb-2 animate-pulse" />
                        <p className="text-xs text-gray-400 max-w-[180px] leading-relaxed">
                            No notes here yet. Type a note below to bookmark the video timeline!
                        </p>
                    </div>
                ) : (
                    bookmarks.map((bookmark) => {
                        const isAi = !!bookmark.auto_context;
                        return (
                            <div
                                key={bookmark.id}
                                className="flex gap-2.5 hover:bg-[#20202f]/40 p-2 rounded-xl transition-all duration-200 cursor-pointer group"
                                onClick={() => onSeek(bookmark.timestamp)}
                            >
                                {/* Avatar */}
                                <div className="flex-shrink-0 mt-0.5">
                                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all group-hover:scale-105 ${
                                        isAi 
                                            ? 'bg-gradient-to-tr from-purple-500 to-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                            : 'bg-[#2a2a3f] text-[#eaeaf0] border border-[#3b3b55]'
                                    }`}>
                                        {isAi ? 'AI' : 'ME'}
                                    </div>
                                </div>

                                {/* Bookmark Details bubble */}
                                <div className="flex-grow min-w-0 space-y-1">
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-xs font-bold text-[#eaeaf0] truncate">
                                                {isAi ? 'Bookie AI' : 'Thomas Hope'}
                                            </span>
                                            <span className={`text-[8px] tracking-wider uppercase font-bold px-1.5 py-0.5 rounded border leading-none ${tagColors[bookmark.tag] || tagColors.custom}`}>
                                                {bookmark.tag || 'note'}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-[#82829b] font-mono flex items-center gap-0.5 whitespace-nowrap bg-[#20202f] px-1.5 py-0.5 rounded border border-[#2a2a3f]/40 group-hover:text-blue-400 transition-colors">
                                            <FiClock className="h-2.5 w-2.5" />
                                            {formatTime(bookmark.timestamp)}
                                        </span>
                                    </div>

                                    {/* User Note Bubble */}
                                    {bookmark.user_note && (
                                        <p className="text-xs text-gray-300 font-normal leading-relaxed bg-[#242435]/40 px-3 py-2 rounded-xl border border-[#2a2a3f]/50 shadow-sm">
                                            {bookmark.user_note}
                                        </p>
                                    )}

                                    {/* AI summary context */}
                                    {bookmark.auto_context && renderAutoContext(bookmark.auto_context)}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Write message input - styled exactly like the template Live Chat input */}
            <div className="mt-4 pt-3 border-t border-[#262637]/40">
                <form 
                    onSubmit={handleSubmit}
                    className="flex items-center gap-2 bg-[#20202f]/80 border border-[#2a2a3f]/80 rounded-xl px-3 py-2 text-[#82829b] focus-within:border-blue-500 focus-within:text-white transition-all duration-200"
                >
                    <input
                        type="text"
                        placeholder="Bookmark at current time..."
                        className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-[#585870]"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={!newNote.trim()}
                        className="h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bg-blue-600 flex-shrink-0"
                    >
                        <FiSend className="h-3.5 w-3.5 transform translate-x-0.5 -translate-y-0.2" />
                    </button>
                </form>
            </div>
        </div>
    );
}
