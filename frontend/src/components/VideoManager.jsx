import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { FiTrash2, FiPlay, FiCalendar, FiClock, FiTv, FiAlertTriangle } from 'react-icons/fi';

export default function VideoManager({ currentVideoId, onPlay, onVideoDeleted }) {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const loadVideos = async () => {
        try {
            const data = await api.getAllVideos();
            setVideos(data.videos || []);
        } catch (err) {
            console.error('Failed to load videos:', err);
        }
    };

    useEffect(() => {
        loadVideos();
    }, []);

    const handleDeleteVideo = async (e, videoId) => {
        e.stopPropagation(); // Avoid triggering card click / play
        if (!confirm('Delete this video and all its transcripts/notes?')) return;

        setLoading(true);
        try {
            await api.deleteVideo(videoId);
            await loadVideos();
            if (videoId === currentVideoId) {
                onVideoDeleted?.();
            }
        } catch (err) {
            alert('Failed to delete video: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = async () => {
        setLoading(true);
        try {
            const result = await api.clearAllVideos();
            await loadVideos();
            onVideoDeleted?.();
            setShowConfirm(false);
            alert(`All database contents cleared. Deleted ${result.files_deleted} local files.`);
        } catch (err) {
            alert('Failed to clear data: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'ready': 
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-950/20 px-2 py-0.5 rounded-full border border-green-800/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                        Ready
                    </span>
                );
            case 'processing': 
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-400 bg-yellow-950/20 px-2 py-0.5 rounded-full border border-yellow-800/20 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400"></span>
                        Processing
                    </span>
                );
            case 'error': 
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-950/20 px-2 py-0.5 rounded-full border border-rose-800/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                        Error
                    </span>
                );
            default: 
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-950/20 px-2 py-0.5 rounded-full border border-gray-800/20">
                        Unknown
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Clear Operations */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#262637]/40">
                <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                        <FiTv className="text-blue-500" /> Video Library Catalog
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                        Select an analyzed video from database to view annotations and run search.
                    </p>
                </div>

                <button
                    onClick={() => setShowConfirm(true)}
                    disabled={loading || videos.length === 0}
                    className="px-4 py-2 text-xs font-bold text-rose-400 bg-rose-950/10 border border-rose-800/20 hover:bg-rose-500 hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                    Clear All Database
                </button>
            </div>

            {/* Clear All Confirmation Alert Box */}
            {showConfirm && (
                <div className="bg-rose-950/15 border border-rose-800/30 rounded-2xl p-5 animate-fadeIn">
                    <div className="flex gap-3 items-start">
                        <FiAlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-rose-200">Critical Warning</h4>
                            <p className="text-xs text-rose-300/80 leading-relaxed mt-1">
                                Are you sure you want to clear the entire database? This will permanently delete all uploaded videos, Whisper transcripts, semantic search indices, and user bookmarks. This cannot be undone.
                            </p>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={handleClearAll}
                                    disabled={loading}
                                    className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all"
                                >
                                    Yes, Clear Everything
                                </button>
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="px-4 py-2 text-xs font-bold bg-[#20202f] border border-[#2a2a3f] text-[#eaeaf0] rounded-xl hover:border-gray-500 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid display of Video Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.length === 0 ? (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-[#262637]/50 rounded-2xl bg-[#191924]/20 flex flex-col items-center justify-center gap-2">
                        <FiTv className="h-10 w-10 text-gray-500 animate-pulse" />
                        <h4 className="text-sm font-bold text-white mt-2">No videos stored yet</h4>
                        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                            Upload your first video file using the sidebar's upload tab to index it.
                        </p>
                    </div>
                ) : (
                    videos.map((video) => {
                        const isCurrent = video.id === currentVideoId;
                        return (
                            <div
                                key={video.id}
                                onClick={() => onPlay?.(video.id)}
                                className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer flex flex-col group ${
                                    isCurrent 
                                        ? 'border-blue-500/50 shadow-md shadow-blue-500/5' 
                                        : 'border-[#262637]/50 hover:border-gray-700/50'
                                }`}
                            >
                                {/* Thumbnail Mock Card header */}
                                <div className="h-28 bg-[#1f1f2e] border-b border-[#262637]/45 flex items-center justify-center relative overflow-hidden group-hover:bg-[#252538] transition-colors">
                                    {/* Gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-0"></div>
                                    <FiPlay className="h-8 w-8 text-gray-500 group-hover:text-blue-400 group-hover:scale-110 z-10 transition-all duration-200" />
                                    
                                    {/* Selected highlight badge */}
                                    {isCurrent && (
                                        <span className="absolute top-2.5 left-2.5 text-[9px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-lg z-10 shadow-md uppercase tracking-wider">
                                            Currently Playing
                                        </span>
                                    )}
                                </div>

                                {/* Content Details */}
                                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-bold text-white line-clamp-2 leading-relaxed" title={video.filename}>
                                            {video.filename}
                                        </h4>
                                    </div>

                                    {/* Badges and meta */}
                                    <div className="space-y-2.5 pt-1 border-t border-[#262637]/30">
                                        <div className="flex justify-between items-center gap-2">
                                            {getStatusBadge(video.status)}
                                            <span className="text-[10px] text-[#82829b] font-mono flex items-center gap-0.5">
                                                <FiCalendar className="h-3 w-3" />
                                                {new Date(video.upload_date).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {/* Action buttons footer */}
                                        <div className="flex gap-2 pt-1 z-10">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onPlay?.(video.id);
                                                }}
                                                className="flex-1 py-1.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/25 hover:border-blue-600 text-blue-300 hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                                            >
                                                <FiPlay className="h-3 w-3" /> Watch Video
                                            </button>
                                            
                                            <button
                                                onClick={(e) => handleDeleteVideo(e, video.id)}
                                                disabled={loading}
                                                className="p-1.5 bg-[#20202f] hover:bg-rose-950/20 border border-[#2a2a3f] hover:border-rose-900/30 text-[#82829b] hover:text-rose-400 rounded-lg transition-all"
                                                title="Delete video record"
                                            >
                                                <FiTrash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {loading && (
                <div className="text-center text-xs text-gray-400 py-4">
                    Processing database request...
                </div>
            )}
        </div>
    );
}
