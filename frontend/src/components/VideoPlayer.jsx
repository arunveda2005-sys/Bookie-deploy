import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { api } from '../api/client';
import { FiBookmark, FiClock, FiShare2, FiCpu, FiTv, FiCalendar, FiPlay, FiHeart, FiEye, FiTrendingUp, FiSearch, FiCheckSquare } from 'react-icons/fi';
import BookmarksList from './BookmarksList';
import SearchTest from './SearchTest';

export default function VideoPlayer({ videoId, setVideoId }) {
    const [currentTime, setCurrentTime] = useState(0);
    const [bookmarks, setBookmarks] = useState([]);
    const [videoInfo, setVideoInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summary, setSummary] = useState(null);
    const [relatedVideos, setRelatedVideos] = useState([]);
    const [activeTab, setActiveTab] = useState('description'); // 'description' | 'summary' | 'search'
    const [liked, setLiked] = useState(() => {
        return localStorage.getItem(`liked_${videoId}`) === 'true';
    });
    
    const playerRef = useRef(null);
    const insightsRef = useRef(null);

    // Compute mock statistics that are persistent per video ID
    const viewsCount = ((videoId * 17923 + 1259) % 250000).toLocaleString();
    const baseLikes = (videoId * 9871 + 342) % 40000;
    const likesCount = (liked ? baseLikes + 1 : baseLikes).toLocaleString();
    const streamingCount = ((videoId * 4391 + 5402) % 15000).toLocaleString();

    useEffect(() => {
        loadVideoData();
        loadRelatedVideos();

        const handleKeyPress = (e) => {
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                createBookmark();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [videoId]);

    const loadVideoData = async () => {
        try {
            setLoading(true);
            setError(null);
            const video = await api.getVideo(videoId);
            setVideoInfo(video);

            if (video.status === 'ready') {
                const { bookmarks: existingBookmarks } = await api.getBookmarks(videoId);
                setBookmarks(existingBookmarks);
                setLoading(false);
            } else if (video.status === 'error') {
                setError('An error occurred during video transcription. Please try uploading a new copy.');
                setLoading(false);
            } else {
                setTimeout(loadVideoData, 3000);
            }
        } catch (err) {
            console.error('Failed to load video:', err);
            setError(err.message || 'Failed to load video data');
            setLoading(false);
        }
    };

    const loadRelatedVideos = async () => {
        try {
            const data = await api.getAllVideos();
            setRelatedVideos(data.videos.filter(v => v.id !== videoId));
        } catch (err) {
            console.error('Failed to load related videos:', err);
        }
    };

    const createBookmark = async (note) => {
        let noteToUse = typeof note === 'string' ? note : prompt('Add a note (optional):');
        if (noteToUse === null) return;

        try {
            const bookmark = await api.createBookmark(videoId, currentTime, noteToUse || null);
            setBookmarks(prev => [...prev, bookmark]);
        } catch (err) {
            console.error('Failed to create bookmark:', err);
            alert('Failed to create bookmark');
        }
    };

    const handleSeek = (time) => {
        if (playerRef.current) {
            playerRef.current.seekTo(time, 'seconds');
        }
    };

    const handleToggleLike = () => {
        const newLiked = !liked;
        setLiked(newLiked);
        localStorage.setItem(`liked_${videoId}`, String(newLiked));
    };

    const handleExport = async () => {
        try {
            const { content, filename } = await api.exportNotes(videoId);
            const blob = new Blob([content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to export notes');
        }
    };

    const handleExportSummary = async () => {
        try {
            if (!summary) return;

            let markdownContent = `# ${summary.title || 'Video Summary'}\n\n`;
            if (summary.category) markdownContent += `**Category:** ${summary.category}\n\n`;
            if (summary.overview) markdownContent += `## Overview\n${summary.overview}\n\n`;
            if (summary.summary && summary.summary.length > 0) {
                markdownContent += `## Key Points\n`;
                markdownContent += summary.summary.map(point => `- ${point}`).join('\n') + '\n\n';
            }
            if (summary.learning_outcome) markdownContent += `## Learning Outcome\n${summary.learning_outcome}\n\n`;
            if (summary.action_items && summary.action_items.length > 0) {
                markdownContent += `## Action Items\n`;
                markdownContent += summary.action_items.map(item => `- [ ] ${item}`).join('\n') + '\n';
            }

            const blob = new Blob([markdownContent], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `summary_${videoId}_${new Date().toISOString().split('T')[0]}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export summary failed:', err);
            alert('Failed to export summary.');
        }
    };

    const handleSummarizeVideo = async () => {
        setActiveTab('summary');
        if (summary) {
            // Scroll to insights panel
            insightsRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        try {
            setIsSummarizing(true);
            insightsRef.current?.scrollIntoView({ behavior: 'smooth' });
            const response = await api.summarizeVideo(videoId);
            let summaryData = response.summary || response;

            if (!summaryData) throw new Error('No summary data received');

            if (typeof summaryData === 'string') {
                try {
                    summaryData = JSON.parse(summaryData);
                } catch (e) {
                    console.warn('Failed to parse summary as JSON');
                }
            }

            const formattedSummary = {
                title: summaryData.title || 'Video Summary',
                overview: summaryData.overview || summaryData.learning_outcome || '',
                summary: Array.isArray(summaryData.summary)
                    ? summaryData.summary
                    : (summaryData.summary ? [summaryData.summary] : []),
                key_points: Array.isArray(summaryData.key_points)
                    ? summaryData.key_points
                    : (Array.isArray(summaryData.summary) ? summaryData.summary : []),
                learning_outcome: summaryData.learning_outcome || '',
                action_items: Array.isArray(summaryData.action_items)
                    ? summaryData.action_items
                    : [],
                category: summaryData.category || 'General'
            };

            setSummary(formattedSummary);
        } catch (err) {
            console.error('Failed to summarize video:', err);
            alert(err.message || 'Failed to generate video summary. Please try again.');
        } finally {
            setIsSummarizing(false);
        }
    };

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] p-4">
                <div className="text-center bg-[#20202f]/80 border border-red-500/30 p-8 rounded-2xl max-w-md shadow-xl backdrop-blur-sm">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h3 className="text-xl font-bold text-white mb-2">Processing Failed</h3>
                    <p className="text-gray-400 mb-6">{error}</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[70vh]">
                <div className="text-center bg-[#191924]/60 p-10 rounded-2xl border border-[#262637]/50 shadow-2xl backdrop-blur-md">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-lg font-bold text-white">Transcribing and indexing video...</p>
                    <p className="text-sm text-gray-400 mt-2">Whisper AI is working in the background. This can take a few minutes.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left: Video Player & Collapsible insights */}
            <div className="lg:col-span-2 flex flex-col min-w-0">
                {/* Video Player Card */}
                <div className="bg-[#191924]/60 border border-[#262637]/50 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md transition-all duration-300 hover:shadow-blue-500/5">
                    <ReactPlayer
                        ref={playerRef}
                        url={api.getVideoStreamUrl(videoId)}
                        controls
                        width="100%"
                        height="480px"
                        onProgress={(state) => setCurrentTime(state.playedSeconds)}
                        style={{ backgroundColor: '#000000' }}
                    />
                </div>

                {/* Details Toolbar Section */}
                <div className="mt-5 space-y-4">
                    {/* Title */}
                    <h1 className="text-lg md:text-xl font-extrabold text-white tracking-tight leading-snug">
                        {videoInfo?.filename}
                    </h1>

                    {/* Metadata indicators & action row - Super Clean */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262637]/45">
                        
                        {/* Compact Stats Indicators */}
                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#82829b] font-medium">
                            <span className="flex items-center gap-1">
                                <FiEye className="h-3.5 w-3.5 text-blue-400" />
                                {viewsCount} views
                            </span>
                            <span className="flex items-center gap-1">
                                <FiHeart className="h-3.5 w-3.5 text-rose-400" />
                                {likesCount} likes
                            </span>
                            <span className="flex items-center gap-1">
                                <FiTrendingUp className="h-3.5 w-3.5 text-green-400" />
                                {streamingCount} active
                            </span>
                            <span className="flex items-center gap-1">
                                <FiCalendar className="h-3.5 w-3.5 text-purple-400" />
                                {new Date(videoInfo?.upload_date).toLocaleDateString()}
                            </span>
                        </div>

                        {/* Direct Control Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={handleToggleLike}
                                className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm ${
                                    liked
                                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                                        : 'bg-[#191924] hover:bg-[#20202f] border border-[#262637] text-white hover:text-rose-400'
                                }`}
                            >
                                <FiHeart className={`h-3.5 w-3.5 ${liked ? 'fill-white' : ''}`} />
                                {liked ? 'Liked' : 'Like'}
                            </button>

                            <button
                                onClick={() => createBookmark()}
                                className="px-3.5 py-2 text-xs font-bold bg-[#191924]/80 hover:bg-[#20202f] border border-[#262637] text-white rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                            >
                                <FiBookmark className="h-3.5 w-3.5 text-blue-400" />
                                Bookmark
                            </button>

                            <button
                                onClick={handleSummarizeVideo}
                                className="px-3.5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/10"
                            >
                                <FiCpu className="h-3.5 w-3.5" />
                                Summarize
                            </button>

                            <button
                                onClick={handleExport}
                                className="px-3.5 py-2 text-xs font-bold bg-[#1d1d2b] border border-[#2a2a3f] hover:border-gray-500 rounded-xl text-[#eaeaf0] transition-all"
                            >
                                <FiShare2 className="h-3 w-3 inline" /> Export
                            </button>
                        </div>
                    </div>
                </div>

                {/* Unified Insights Card Panel - Super Clean Tabs */}
                <div ref={insightsRef} className="mt-6 glass-card rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                    {/* Tab Selectors */}
                    <div className="flex gap-2 mb-5 border-b border-[#262637]/40 pb-3">
                        <button
                            onClick={() => setActiveTab('description')}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'description'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                                    : 'text-[#82829b] hover:text-white hover:bg-[#20202f]/60'
                            }`}
                        >
                            Description
                        </button>
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                activeTab === 'summary'
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10'
                                    : 'text-[#82829b] hover:text-white hover:bg-[#20202f]/60'
                            }`}
                        >
                            <FiCpu className="h-3 w-3" /> AI Summary
                        </button>
                        <button
                            onClick={() => setActiveTab('search')}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                activeTab === 'search'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                    : 'text-[#82829b] hover:text-white hover:bg-[#20202f]/60'
                            }`}
                        >
                            <FiSearch className="h-3 w-3" /> Transcript Search
                        </button>
                    </div>

                    {/* Tab Contents */}
                    <div className="min-h-[160px]">
                        {/* Tab: Description */}
                        {activeTab === 'description' && (
                            <div className="space-y-3.5 animate-fadeIn">
                                <p className="text-xs text-gray-300 leading-relaxed font-normal bg-[#20202f]/20 p-4 border border-[#2a2a3f]/30 rounded-xl">
                                    This educational video has been parsed by Whisper speech-to-text models. 
                                    You can query parts of the timeline semantically or trigger the AI summarizer to extract key takeaways. 
                                    Bookmarks created by clicking "Bookmark" or typing in the chat log will sync instantly with the video frames.
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-[#82829b] font-mono px-1">
                                    <span>Status: <strong className="text-green-400 uppercase">{videoInfo?.status}</strong></span>
                                    <span>•</span>
                                    <span>ID: {videoId}</span>
                                    <span>•</span>
                                    <span>Time: {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}</span>
                                </div>
                            </div>
                        )}

                        {/* Tab: AI Summary */}
                        {activeTab === 'summary' && (
                            <div className="space-y-4 animate-fadeIn">
                                {isSummarizing ? (
                                    <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                                        <p className="text-xs text-gray-400">Consulting Llama 3 model for full video synthesis...</p>
                                    </div>
                                ) : !summary ? (
                                    <div className="py-8 text-center flex flex-col items-center justify-center gap-4 bg-[#20202f]/10 border border-dashed border-[#2a2a3f]/50 rounded-xl">
                                        <FiCpu className="h-9 w-9 text-[#585870] animate-pulse" />
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-bold text-white">Full Video Summarization</h4>
                                            <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed">
                                                Generate an automated overview, learning outcomes, key takeaways, and action items in one click.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleSummarizeVideo}
                                            className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all shadow-md shadow-purple-600/20"
                                        >
                                            ⚡ Generate AI Summary
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        {/* Header Title & Categories */}
                                        <div className="flex justify-between items-start gap-4">
                                            <h3 className="text-sm font-bold text-white">
                                                {summary.title || 'Synthesis Output'}
                                            </h3>
                                            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-purple-900/30 text-purple-300 rounded-full border border-purple-800/30">
                                                {summary.category || 'General'}
                                            </span>
                                        </div>

                                        {/* Overview Paragraph */}
                                        {summary.overview && (
                                            <div className="bg-[#20202f]/30 p-3.5 rounded-xl border border-[#2a2a3f]/40">
                                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Overview</h4>
                                                <p className="text-xs text-gray-300 leading-relaxed font-normal">{summary.overview}</p>
                                            </div>
                                        )}

                                        {/* Outcomes Highlight box */}
                                        {summary.learning_outcome && (
                                            <div className="p-3.5 bg-indigo-950/20 rounded-xl border border-indigo-900/30">
                                                <h4 className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5 mb-1.5">
                                                    <FiCpu className="h-3.5 w-3.5" /> Key Learning Outcome
                                                </h4>
                                                <p className="text-indigo-100/90 text-xs leading-relaxed font-normal">{summary.learning_outcome}</p>
                                            </div>
                                        )}

                                        {/* Key Points Takeaways */}
                                        {Array.isArray(summary.summary) && summary.summary.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Key Takeaways</h4>
                                                <ul className="space-y-2">
                                                    {summary.summary.map((point, i) => (
                                                        <li key={i} className="flex items-start bg-[#20202f]/20 p-2 rounded-lg border border-[#2a2a3f]/20">
                                                            <span className="h-4.5 w-4.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5 mr-2.5 flex-shrink-0">
                                                                {i + 1}
                                                            </span>
                                                            <span className="text-xs text-gray-300 leading-relaxed font-normal">{point}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Action Items List */}
                                        {Array.isArray(summary.action_items) && summary.action_items.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Action Items</h4>
                                                <ul className="space-y-1.5">
                                                    {summary.action_items.map((item, i) => (
                                                        <li key={i} className="flex items-center gap-2 text-xs text-green-300 font-medium">
                                                            <FiCheckSquare className="h-4 w-4 text-green-400 flex-shrink-0" />
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Export Action */}
                                        <div className="flex justify-end pt-2">
                                            <button
                                                onClick={handleExportSummary}
                                                className="px-4 py-2 text-xs font-bold bg-[#1d1d2b] border border-[#2a2a3f] hover:border-green-600/40 text-green-400 rounded-xl transition-all"
                                            >
                                                Export Summary (.md)
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Semantic Search */}
                        {activeTab === 'search' && (
                            <div className="animate-fadeIn">
                                <SearchTest videoId={videoId} onResultClick={handleSeek} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Side Widgets: Bookmarks & Video Library */}
            <div className="lg:col-span-1 space-y-6">
                {/* Bookmarks Chat Panel */}
                <div className="bg-[#191924]/60 border border-[#262637]/50 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
                    <BookmarksList bookmarks={bookmarks} onSeek={handleSeek} onAddBookmark={createBookmark} />
                </div>

                {/* Related Videos Library List */}
                <div className="bg-[#191924]/60 border border-[#262637]/50 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col justify-between h-[360px]">
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-wide uppercase mb-4 pb-2 border-b border-[#262637]/40 flex items-center gap-2">
                            <FiTv className="text-purple-500 h-4 w-4" /> Related Videos
                        </h3>

                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                            {relatedVideos.length === 0 ? (
                                <p className="text-xs text-gray-500 text-center py-6">
                                    No other videos in database.
                                </p>
                            ) : (
                                relatedVideos.map((video) => (
                                    <div
                                        key={video.id}
                                        onClick={() => setVideoId(video.id)}
                                        className="flex gap-3 p-2 rounded-xl bg-[#20202f]/20 hover:bg-[#20202f]/80 cursor-pointer border border-[#2a2a3f]/30 hover:border-blue-500/30 transition-all duration-200 group"
                                    >
                                        {/* Mock Video Thumbnail */}
                                        <div className="h-12 w-16 rounded-lg bg-[#2b2b3d] flex items-center justify-center flex-shrink-0 relative overflow-hidden border border-gray-700/30 group-hover:bg-[#323249]">
                                            <FiPlay className="h-3 w-3 text-gray-400 group-hover:text-blue-400 transition-colors" />
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                                            <h4 className="text-xs font-bold text-white truncate leading-relaxed group-hover:text-blue-400 transition-colors">
                                                {video.filename}
                                            </h4>
                                            <p className="text-[10px] text-[#82829b] truncate">
                                                {new Date(video.upload_date).toLocaleDateString()} • {video.status}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Exit/Catalog Redirection button */}
                    <button
                        onClick={() => setVideoId(null)}
                        className="w-full mt-4 py-2.5 text-center text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25"
                    >
                        Browse Full Video Catalog
                    </button>
                </div>
            </div>
        </div>
    );
}
