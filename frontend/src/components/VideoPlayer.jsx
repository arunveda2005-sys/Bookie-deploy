import { useState, useEffect, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { api } from '../api/client';
import { FiBookmark, FiClock, FiPlay, FiPause, FiVolume2, FiVolumeX, FiMaximize, FiMinimize, FiX, FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
import { formatTime } from '../utils/formatTime';
import BookmarksList from './BookmarksList';
import SemanticSearch from './SemanticSearch';
import SearchTest from './SearchTest';

const SummaryModal = ({ summary, onClose }) => {
    if (!summary) {
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl max-w-2xl w-full p-8 border border-gray-700/50 shadow-2xl">
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-700/50 mb-4">
                            <FiX className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Summary Available</h3>
                        <p className="text-gray-400 mb-6">There's no summary data to display for this video.</p>
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Handle case where summary is a string
    if (typeof summary === 'string') {
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700/50 shadow-2xl">
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                Video Summary
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                            >
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="prose prose-invert max-w-none">
                            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                                <p className="text-gray-300 whitespace-pre-line">{summary}</p>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                            >
                                Close Summary
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Handle case where summary is an object
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl max-w-4xl w-full my-8 border border-gray-700/50 shadow-2xl overflow-hidden">
                <div className="p-1 bg-gradient-to-r from-blue-500 to-purple-600">
                    <div className="bg-gray-900 p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white">
                                    {summary.title || 'Video Summary'}
                                </h2>
                                {summary.category && (
                                    <span className="inline-block mt-2 px-3 py-1 text-xs font-medium bg-blue-900/30 text-blue-300 rounded-full border border-blue-800/50">
                                        {summary.category}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 -m-2 rounded-full hover:bg-gray-800/50 text-gray-400 hover:text-white transition-colors"
                                aria-label="Close"
                            >
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>

                        {summary.overview && (
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                                    <span className="w-1.5 h-5 bg-blue-500 rounded-full mr-2"></span>
                                    Overview
                                </h3>
                                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                                    <p className="text-gray-300 leading-relaxed">{summary.overview}</p>
                                </div>
                            </div>
                        )}

                        {summary.learning_outcome && (
                            <div className="mb-8 p-5 bg-blue-900/10 rounded-xl border border-blue-800/30">
                                <h3 className="text-lg font-semibold text-blue-300 mb-2 flex items-center">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                                    </svg>
                                    Key Learning Outcome
                                </h3>
                                <p className="text-blue-100 pl-7">{summary.learning_outcome}</p>
                            </div>
                        )}

                        {Array.isArray(summary.summary) && summary.summary.length > 0 ? (
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                                    <span className="w-1.5 h-5 bg-purple-500 rounded-full mr-2"></span>
                                    Summary Points
                                </h3>
                                <div className="space-y-3">
                                    {summary.summary.map((point, i) => (
                                        <div key={i} className="flex items-start">
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
                                                    {i + 1}
                                                </div>
                                            </div>
                                            <p className="ml-3 text-gray-300">{point}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {Array.isArray(summary.key_topics) && summary.key_topics.length > 0 ? (
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-white mb-3">
                                    <span className="w-1.5 h-5 bg-cyan-500 rounded-full mr-2 inline-block"></span>
                                    Key Topics
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {summary.key_topics.map((topic, i) => (
                                        <div key={i} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 hover:border-cyan-500/30 transition-colors">
                                            {topic.topic && <h4 className="font-medium text-cyan-300">{topic.topic}</h4>}
                                            {topic.summary && <p className="mt-1 text-sm text-gray-400">{topic.summary}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {Array.isArray(summary.key_points) && summary.key_points.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-white mb-3">
                                    <span className="w-1.5 h-5 bg-green-500 rounded-full mr-2 inline-block"></span>
                                    Key Points
                                </h3>
                                <ul className="space-y-2">
                                    {summary.key_points.map((point, i) => (
                                        <li key={i} className="flex items-start">
                                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-500/10 text-green-400 text-xs font-medium mt-0.5 mr-2 flex-shrink-0">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                                </svg>
                                            </span>
                                            <span className="text-gray-300">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {Array.isArray(summary.action_items) && summary.action_items.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                                    <span className="w-1.5 h-5 bg-green-500 rounded-full mr-2"></span>
                                    Action Items
                                </h3>
                                <ul className="list-disc list-inside space-y-1 text-green-300 pl-5">
                                    {summary.action_items.map((item, i) => (
                                        <li key={i} className="whitespace-normal">{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Fallback for any other summary format */}
                        {!summary.overview && !summary.key_topics?.length && !summary.key_points?.length && !summary.action_items?.length && (
                            <div className="text-gray-300 whitespace-pre-line">
                                {JSON.stringify(summary, null, 2)}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function VideoPlayer({ videoId }) {
    const [currentTime, setCurrentTime] = useState(0);
    const [bookmarks, setBookmarks] = useState([]);
    const [videoInfo, setVideoInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summary, setSummary] = useState(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const playerRef = useRef(null);

    useEffect(() => {
        loadVideoData();

        // Keyboard shortcut for bookmarking
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
                // Poll for processing completion
                setTimeout(loadVideoData, 3000);
            }
        } catch (err) {
            console.error('Failed to load video:', err);
            setError(err.message || 'Failed to load video data');
            setLoading(false);
        }
    };

    const createBookmark = async () => {
        const note = prompt('Add a note (optional):');

        try {
            const bookmark = await api.createBookmark(videoId, currentTime, note);
            setBookmarks([...bookmarks, bookmark]);
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

    const handleExport = async () => {
        try {
            const { content, filename } = await api.exportNotes(videoId);

            // Download as file
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

            // Format the summary as markdown
            let markdownContent = `# ${summary.title || 'Video Summary'}\n\n`;

            if (summary.category) {
                markdownContent += `**Category:** ${summary.category}\n\n`;
            }

            if (summary.overview) {
                markdownContent += `## Overview\n${summary.overview}\n\n`;
            }

            if (summary.summary && summary.summary.length > 0) {
                markdownContent += `## Key Points\n`;
                markdownContent += summary.summary.map(point => `- ${point}`).join('\n') + '\n\n';
            }

            if (summary.learning_outcome) {
                markdownContent += `## Learning Outcome\n${summary.learning_outcome}\n\n`;
            }

            if (summary.action_items && summary.action_items.length > 0) {
                markdownContent += `## Action Items\n`;
                markdownContent += summary.action_items.map(item => `- [ ] ${item}`).join('\n') + '\n';
            }

            // Create and download the file
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
            console.log('Summary response:', response); // Debug log

            // The backend returns the summary in response.summary
            let summaryData = response.summary || response;

            // Ensure we have a valid summary object
            if (!summaryData) {
                throw new Error('No summary data received');
            }

            // If the summary is a string, try to parse it as JSON
            if (typeof summaryData === 'string') {
                try {
                    summaryData = JSON.parse(summaryData);
                } catch (e) {
                    console.warn('Failed to parse summary as JSON, using as plain text');
                }
            }

            // Transform the summary data to match the expected format
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

            console.log('Formatted summary:', formattedSummary);
            setSummary(formattedSummary);

            setShowSummaryModal(true);
        } catch (err) {
            console.error('Failed to summarize video:', err);
            alert(err.message || 'Failed to generate video summary. Please try again.');
        } finally {
            setIsSummarizing(false);
        }
    };

    const closeSummaryModal = () => {
        setShowSummaryModal(false);
    };

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] p-4">
                <div className="text-center bg-gray-800/80 border border-red-500/30 p-8 rounded-2xl max-w-md shadow-xl backdrop-blur-sm">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h3 className="text-xl font-bold text-white mb-2">Processing Failed</h3>
                    <p className="text-gray-400 mb-6">{error}</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                    <p className="text-xl">Processing video...</p>
                    <p className="text-gray-400 mt-2">This may take a few minutes</p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-screen p-4">
            {/* Left: Video Player */}
            <div className="lg:col-span-2 flex flex-col">
                <div className="bg-black rounded-lg overflow-hidden">
                    <ReactPlayer
                        ref={playerRef}
                        url={api.getVideoStreamUrl(videoId)}
                        controls
                        width="100%"
                        height="70vh"
                        onProgress={(state) => setCurrentTime(state.playedSeconds)}
                    />
                </div>

                {/* Controls */}
                <div className="mt-4 flex gap-2 flex-wrap">
                    <button
                        onClick={createBookmark}
                        className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 font-semibold"
                    >
                        📌 Bookmark (Ctrl+B)
                    </button>

                    <button
                        onClick={handleExport}
                        className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                    >
                        📥 Export Notes
                    </button>

                    <button
                        onClick={handleExportSummary}
                        disabled={!summary}
                        className={`px-6 py-3 rounded-lg flex items-center gap-2 ${summary ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        📄 Export Summary
                    </button>

                    <button
                        onClick={handleSummarizeVideo}
                        disabled={isSummarizing}
                        className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${isSummarizing
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                    >
                        {isSummarizing ? (
                            <>
                                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                Summarizing...
                            </>
                        ) : (
                            '✨ Summarize Video'
                        )}
                    </button>

                    <div className="px-4 py-3 bg-gray-700 rounded-lg font-mono">
                        {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                    </div>
                </div>

                {/* Search */}
                <div className="mt-6">
                    <SearchTest videoId={videoId} />
                    <SemanticSearch videoId={videoId} onResultClick={handleSeek} />
                </div>
            </div>

            {/* Right: Notes Panel */}
            <div className="lg:col-span-1 overflow-y-auto bg-gray-800 rounded-lg p-4">
                <BookmarksList bookmarks={bookmarks} onSeek={handleSeek} />
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
