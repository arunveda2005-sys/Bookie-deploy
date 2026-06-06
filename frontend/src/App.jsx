import { useState, useEffect } from 'react';
import VideoUpload from './components/VideoUpload';
import VideoPlayer from './components/VideoPlayer';
import VideoManager from './components/VideoManager';
import { FiHome, FiUpload, FiFolder, FiTrash2, FiSearch, FiChevronDown, FiVideo } from 'react-icons/fi';
import { api } from './api/client';

function App() {
    const [videoId, setVideoId] = useState(() => {
        const savedVideoId = localStorage.getItem('currentVideoId');
        return savedVideoId ? parseInt(savedVideoId) : null;
    });

    const [currentView, setCurrentView] = useState('upload'); // 'upload' or 'library'
    const [searchQuery, setSearchQuery] = useState('');

    // Save videoId to localStorage when it changes
    useEffect(() => {
        if (videoId) {
            localStorage.setItem('currentVideoId', videoId);
        } else {
            localStorage.removeItem('currentVideoId');
        }
    }, [videoId]);

    const handleBackToUpload = () => {
        setVideoId(null);
        setCurrentView('upload');
    };

    const handleBackToLibrary = () => {
        setVideoId(null);
        setCurrentView('library');
    };

    return (
        <div className="flex min-h-screen bg-[#15151c] text-[#eaeaf0]">
            {/* Left Sidebar Navigation */}
            <aside className="w-20 bg-[#191924]/90 border-r border-[#262637]/50 flex flex-col items-center py-6 flex-shrink-0 z-30 justify-between">
                <div className="flex flex-col items-center gap-8 w-full">
                    {/* Brand Logo */}
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 cursor-pointer" onClick={() => setVideoId(null)}>
                        <FiVideo className="h-5 w-5 text-white" />
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex flex-col items-center gap-4 w-full px-2">
                        <button
                            onClick={() => { setVideoId(null); setCurrentView('upload'); }}
                            title="Upload Video"
                            className={`p-3.5 rounded-xl transition-all duration-200 ${
                                !videoId && currentView === 'upload'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                    : 'text-[#82829b] hover:bg-[#20202f]/80 hover:text-white'
                            }`}
                        >
                            <FiUpload className="h-5 w-5" />
                        </button>

                        <button
                            onClick={() => { setVideoId(null); setCurrentView('library'); }}
                            title="Video Library"
                            className={`p-3.5 rounded-xl transition-all duration-200 ${
                                !videoId && currentView === 'library'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                    : 'text-[#82829b] hover:bg-[#20202f]/80 hover:text-white'
                            }`}
                        >
                            <FiFolder className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Bottom Profile / Utility */}
                <div className="flex flex-col items-center gap-4">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-bold text-xs shadow-md">
                        T
                    </div>
                </div>
            </aside>

            {/* Main Application Container */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                {/* Top Search and Header */}
                <header className="h-20 bg-[#15151c]/80 backdrop-blur-md border-b border-[#262637]/30 flex items-center justify-between px-8 sticky top-0 z-20">
                    {/* Left title */}
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent tracking-tight">
                            Bookie Insights
                        </h2>
                    </div>

                    {/* Center Search bar (placeholder layout matching template) */}
                    <div className="hidden md:flex items-center w-full max-w-md bg-[#1d1d2b]/60 border border-[#2a2a3f]/80 rounded-xl px-4 py-2 text-[#82829b] focus-within:border-blue-500 focus-within:text-white transition-all duration-200">
                        <FiSearch className="h-4 w-4 mr-3 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Search video catalogs or bookmarks..."
                            className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-[#585870]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Right User details dropdown */}
                    <div className="flex items-center gap-4">
                        {videoId && (
                            <button
                                onClick={handleBackToLibrary}
                                className="px-4 py-2 text-xs font-semibold bg-[#1d1d2b] border border-[#2a2a3f] hover:border-gray-600 rounded-lg transition-all"
                            >
                                ← Back to Library
                            </button>
                        )}
                        <div className="flex items-center gap-2 bg-[#1d1d2b]/60 border border-[#2a2a3f]/40 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-[#20202f] transition-all">
                            <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-semibold text-white">
                                A
                            </div>
                            <span className="text-xs font-semibold text-[#eaeaf0] hidden sm:inline">Arun</span>
                            <FiChevronDown className="h-3 w-3 text-gray-400" />
                        </div>
                    </div>
                </header>

                {/* Main Content Body */}
                <main className="flex-1 p-6 md:p-8">
                    {!videoId ? (
                        <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn">
                            {currentView === 'upload' ? (
                                <VideoUpload onVideoUploaded={setVideoId} />
                            ) : (
                                <VideoManager
                                    currentVideoId={videoId}
                                    onPlay={setVideoId}
                                    onVideoDeleted={() => setVideoId(null)}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="animate-fadeIn">
                            <VideoPlayer videoId={videoId} setVideoId={setVideoId} />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
