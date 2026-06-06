import { useState, useCallback } from 'react';
import { api } from '../api/client';
import { FiUpload, FiFile, FiX, FiAlertCircle, FiCpu, FiShield, FiZap } from 'react-icons/fi';

export default function VideoUpload({ onVideoUploaded }) {
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState('');
    const [file, setFile] = useState(null);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            processFile(file);
        }
    }, []);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const processFile = (file) => {
        const fileExt = file.name.split('.').pop().toLowerCase();
        const validExtensions = ['mp4', 'webm', 'mov', 'mkv', 'mp3', 'wav', 'm4a', 'aac', 'ogg'];
        const validMimeTypes = [
            'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
            'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/aac'
        ];

        if (!validMimeTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
            setError('Please upload a valid video or audio file (MP4, WebM, MKV, MP3, WAV, M4A)');
            return;
        }

        if (file.size > 500 * 1024 * 1024) {
            setError('File size should be less than 500MB');
            return;
        }

        setFile(file);
        setFileName(file.name);
        setError(null);
    };

    const removeFile = () => {
        setFile(null);
        setFileName('');
        setError(null);
    };

    const uploadFile = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            const result = await api.uploadVideo(file);
            onVideoUploaded(result.video_id);
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload video. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            {/* Heading Section */}
            <div className="text-center mb-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent mb-3.5 tracking-tight">
                    Add Video to Bookie
                </h1>
                <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto font-normal">
                    Upload educational videos to automatically transcribe speech, query timelines semantically, and generate AI study summaries.
                </p>
            </div>

            {/* Main Upload Box */}
            <div 
                className={`glass-card rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 relative overflow-hidden ${
                    dragActive 
                        ? 'border-blue-500/80 bg-blue-900/10 scale-[1.01] shadow-lg shadow-blue-500/5' 
                        : 'border-[#262637]/50 hover:border-gray-700/50 hover:shadow-indigo-500/5'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                {/* Background decorative glows */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>

                <div className="space-y-6 relative z-10">
                    {/* Big Icon */}
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-[#20202f]/80 border border-[#2a2a3f]/80 shadow-md shadow-black/10">
                        <FiUpload className="h-7 w-7 text-blue-400 animate-pulse" />
                    </div>
                    
                    {!file ? (
                        <div className="space-y-4">
                            <div className="text-sm text-gray-300">
                                <label 
                                    htmlFor="file-upload" 
                                    className="relative cursor-pointer font-bold text-blue-400 hover:text-blue-300 transition-colors focus-within:outline-none"
                                >
                                    <span>Upload a video or audio file</span>
                                    <input 
                                        id="file-upload" 
                                        name="file-upload" 
                                        type="file" 
                                        className="sr-only"
                                        accept="video/*,audio/*"
                                        onChange={handleFileChange}
                                        disabled={uploading}
                                    />
                                </label>
                                <span className="text-gray-400 font-normal"> or drag and drop it here</span>
                            </div>
                            <p className="text-xs text-[#82829b] font-medium uppercase tracking-wider">MP4, WebM, MKV, MP3, WAV, or M4A up to 500MB</p>
                        </div>
                    ) : (
                        <div className="space-y-5 max-w-md mx-auto">
                            {/* Selected File Details Row */}
                            <div className="flex items-center justify-between bg-[#191924]/80 border border-[#2a2a3f]/70 rounded-xl px-4 py-3">
                                <div className="flex items-center space-x-3 min-w-0">
                                    <FiFile className="h-5 w-5 text-blue-400 flex-shrink-0" />
                                    <span className="text-xs font-bold text-gray-200 truncate max-w-[200px] sm:max-w-[250px]">
                                        {fileName}
                                    </span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={removeFile}
                                    className="text-gray-400 hover:text-rose-400 transition-colors p-1"
                                    disabled={uploading}
                                    title="Remove file"
                                >
                                    <FiX className="h-4.5 w-4.5" />
                                </button>
                            </div>

                            {/* Processing button */}
                            <button
                                type="button"
                                onClick={uploadFile}
                                disabled={uploading}
                                className={`w-full flex justify-center items-center px-6 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                                    uploading 
                                        ? 'bg-blue-600/80 cursor-not-allowed shadow-none' 
                                        : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-blue-500/10'
                                }`}
                            >
                                {uploading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Transcribing & Indexing...
                                    </>
                                ) : (
                                    <>
                                        <FiUpload className="mr-2 h-4 w-4" />
                                        Initialize AI Analysis
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mt-6 p-4 bg-rose-950/20 border border-rose-800/30 rounded-xl flex items-start animate-fadeIn">
                    <FiAlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                        <h3 className="text-xs font-bold text-rose-200 uppercase tracking-wide">Upload Failed</h3>
                        <div className="mt-1 text-xs text-rose-400/90 font-medium leading-relaxed">{error}</div>
                    </div>
                </div>
            )}

            {/* Details Features Cards Grid */}
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-5 bg-[#191924]/40 rounded-2xl border border-[#262637]/50 hover:border-blue-500/30 transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 transition-colors group-hover:bg-blue-500/20">
                        <FiZap className="h-5 w-5 text-blue-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2">Automated Transcription</h3>
                    <p className="text-gray-400 text-xs leading-relaxed font-normal">
                        Whisper AI processes speech and creates an exact timeline-linked text record of the video.
                    </p>
                </div>

                <div className="p-5 bg-[#191924]/40 rounded-2xl border border-[#262637]/50 hover:border-indigo-500/30 transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 transition-colors group-hover:bg-indigo-500/20">
                        <FiCpu className="h-5 w-5 text-indigo-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2">Vector Search Indexing</h3>
                    <p className="text-gray-400 text-xs leading-relaxed font-normal">
                        Sentence Transformers index transcript segments, letting you query meanings instead of keywords.
                    </p>
                </div>

                <div className="p-5 bg-[#191924]/40 rounded-2xl border border-[#262637]/50 hover:border-purple-500/30 transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 transition-colors group-hover:bg-purple-500/20">
                        <FiShield className="h-5 w-5 text-purple-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2">Private Storage & Export</h3>
                    <p className="text-gray-400 text-xs leading-relaxed font-normal">
                        All local files are stored privately. Export all timeline notes and AI study outputs as Markdown logs.
                    </p>
                </div>
            </div>
        </div>
    );
}
