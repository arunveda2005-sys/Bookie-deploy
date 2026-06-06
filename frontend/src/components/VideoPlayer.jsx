import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { api } from '../api/client';
import { FiBookmark, FiClock, FiShare2, FiThumbsUp, FiCpu, FiTv, FiCalendar, FiPlay, FiHeart, FiEye, FiTrendingUp } from 'react-icons/fi';
import BookmarksList from './BookmarksList';
import SearchTest from './SearchTest';

const SummaryModal = ({ summary, onClose }) => {
    if (!summary) return null;

    if (typeof summary === 'string') {
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                <div className="bg-gradient-to-br from-[#1d1d2b] to-[#15151c] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#2a2a3f]/50 shadow-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            Video Summary
                        </h2>
                    </div>
                    <div className="bg-[#242435]/40 p-4 rounded-xl border border-[#2a2a3f]/50">
                        <p className="text-gray-300 text-sm whitespace-pre-line leading-relaxed">{summary}</p>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fadeIn">
            <div className="bg-gradient-to-br from-[#1d1d2b] to-[#15151c] rounded-2xl max-w-3xl w-full border border-[#2a2a3f]/50 shadow-2xl overflow-hidden">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {summary.title || 'Video AI Summary'}
                            </h2>
                            {summary.category && (
                                <span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-semibold bg-blue-900/30 text-blue-300 rounded-full border border-blue-800/30">
                                    {summary.category}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
                        {summary.overview && (
                            <div>
                                <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">Overview</h3>
                                <div className="bg-[#242435]/40 p-4 rounded-xl border border-[#2a2a3f]/50">
                                    <p className="text-gray-300 text-sm leading-relaxed">{summary.overview}</p>
                                </div>
                            </div>
                        )}

                        {summary.learning_outcome && (
                            <div className="p-4 bg-indigo-950/20 rounded-xl border border-indigo-900/30">
                                <h3 className="text-sm font-bold text-indigo-300 mb-1 flex items-center gap-2">
                                    <FiCpu className="h-4 w-4" /> Key Learning Outcome
                                </h3>
                                <p className="text-indigo-100 text-sm leading-relaxed">{summary.learning_outcome}</p>
                            </div>
                        )}

                        {Array.isArray(summary.summary) && summary.summary.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">Key Takeaways</h3>
                                <ul className="space-y-2.5">
                                    {summary.summary.map((point, i) => (
                                        <li key={i} className="flex items-start">
                                            <span className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                                                {i + 1}
                                            </span>
                                            <span className="text-gray-300 text-sm leading-relaxed">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {Array.isArray(summary.action_items) && summary.action_items.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">Action Items</h3>
                                <ul className="space-y-2">
                                    {summary.action_items.map((item, i) => (
                                        <li key={i} className="flex items-start text-xs text-green-300 leading-relaxed pl-1">
                                            • {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function VideoPlayer({ videoId, setVideoId }) {
    const [currentTime, setCurrentTime] = useState(0);
    const [bookmarks, setBookmarks] = useState([]);
    const [videoInfo, setVideoInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summary, setSummary] = useState(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [relatedVideos, setRelatedVideos] = useState([]);
    const [liked, setLiked] = useState(() => {
        return localStorage.getItem(`liked_${videoId}`) === 'true';
    });
    
    const playerRef = useRef(null);

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
            if (!summary) {
                const shouldGenerate = window.confirm(
                    "No summary found. Would you like to generate one first?"
                );
                if (shouldGenerate) {
                    await handleSummarizeVideo();
                }
                return;
            }

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
            alert('Failed to export summary. Please try generating a summary first.');
        }
    };

    const handleSummarizeVideo = async () => {
        try {
            setIsSummarizing(true);
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
            setShowSummaryModal(true);
        } catch (err) {
            console.error('Failed to summarize video:', err);
            alert(err.message || 'Failed to generate video summary. Please try again.');
        } finally {
            setIsSummarizing(false);
        }
    };

    const closeSummaryModal = () => setShowSummaryModal(false);

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
            {/* Left: Video Player & Description Details */}
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

                {/* Details Section */}
                <div className="mt-6 space-y-5">
                    {/* Header Row: Channel Info and Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262637]/40">
                        {/* Channel Details */}
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-blue-500/10">
                                AI
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                    VideoInsight Engine
                                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                </h4>
                                <p className="text-xs text-[#82829b]">Active AI Analyzer</p>
                            </div>
                        </div>

                        {/* Functional Action Buttons */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <button
                                onClick={handleToggleLike}
                                className={`px-4.5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md ${
                                    liked
                                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                                        : 'bg-[#191924] hover:bg-[#20202f] border border-[#262637] text-white hover:text-rose-400'
                                }`}
                            >
                                <FiHeart className={`h-4 w-4 ${liked ? 'fill-white' : ''}`} />
                                {liked ? 'Liked' : 'Like'}
                            </button>

                            <button
                                onClick={() => createBookmark()}
                                className="px-4.5 py-2.5 text-xs font-bold bg-[#191924]/80 hover:bg-[#20202f] border border-[#262637] text-white rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                            >
                                <FiBookmark className="h-4 w-4 text-blue-400" />
                                Bookmark Note
                            </button>

                            <button
                                onClick={handleSummarizeVideo}
                                disabled={isSummarizing}
                                className={`px-4.5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md ${
                                    isSummarizing
                                        ? 'bg-purple-900/30 text-purple-300 cursor-not-allowed border border-purple-800/20'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
                                }`}
                            >
                                {isSummarizing ? (
                                    <>
                                        <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>
                                        Summarizing...
                                    </>
                                ) : (
                                    <>
                                        <FiCpu className="h-4 w-4" />
                                        AI Summary
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleExport}
                                className="px-4 py-2.5 text-xs font-bold bg-[#1d1d2b] border border-[#2a2a3f] hover:border-gray-500 rounded-xl text-[#eaeaf0] transition-all"
                                title="Export bookmarks as markdown file"
                            >
                                <FiShare2 className="h-3.5 w-3.5 inline mr-1" /> Export
                            </button>
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-snug">
                        {videoInfo?.filename}
                    </h1>

                    {/* Split: Description (Left) & Stats (Right) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                        {/* Description Paragraph */}
                        <div className="md:col-span-2 space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#82829b]">Description</h3>
                            <p className="text-sm text-gray-300 leading-relaxed bg-[#20202f]/25 border border-[#2a2a3f]/30 p-4 rounded-xl font-normal">
                                This video was transcribed, fully indexed, and analyzed using our automatic machine learning pipeline. 
                                Use the Interactive Study Log or AI Semantic Search below to navigate to key discussions, topics, and definitions instantly.
                            </p>
                        </div>

                        {/* Stats Panel */}
                        <div className="md:col-span-1 bg-[#191924]/40 border border-[#262637]/50 rounded-xl p-4 space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[#82829b] mb-1">Video Metrics</h3>
                            
                            <div className="flex items-center gap-2.5 text-xs text-gray-300">
                                <FiEye className="h-4 w-4 text-blue-400" />
                                <span><strong>{viewsCount}</strong> views</span>
                            </div>

                            <div className="flex items-center gap-2.5 text-xs text-gray-300">
                                <FiHeart className="h-4 w-4 text-rose-400" />
                                <span><strong>{likesCount}</strong> likes</span>
                            </div>

                            <div className="flex items-center gap-2.5 text-xs text-gray-300">
                                <FiTrendingUp className="h-4 w-4 text-green-400" />
                                <span><strong>{streamingCount}</strong> active learners</span>
                            </div>

                            <div className="flex items-center gap-2.5 text-xs text-gray-300">
                                <FiCalendar className="h-4 w-4 text-purple-400" />
                                <span className="truncate">Uploaded: {new Date(videoInfo?.upload_date).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Semantic Search Card */}
                <div className="mt-8">
                    <SearchTest videoId={videoId} onResultClick={handleSeek} />
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

            {/* Summary Modal */}
            {showSummaryModal && (
                <SummaryModal
                    summary={summary}
                    onClose={closeSummaryModal}
                />
            )}
        </div>
    );
}
