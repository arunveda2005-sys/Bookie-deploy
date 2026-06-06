import { useState } from 'react';
import { api } from '../api/client';
import { FiSearch, FiClock } from 'react-icons/fi';

export default function SearchTest({ videoId, onResultClick }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async (searchQuery) => {
        const queryToUse = searchQuery || query;
        if (!queryToUse.trim()) return;

        setLoading(true);
        setError(null);
        try {
            const data = await api.search(videoId, queryToUse);
            setResults(data.results || []);
        } catch (err) {
            setError(err.message || 'Search failed');
            console.error('Search failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-4">
            {/* Search Input Bar */}
            <div className="flex gap-2">
                <div className="flex-1 flex items-center bg-[#20202f]/80 border border-[#2a2a3f]/60 rounded-xl px-3.5 py-2 text-[#82829b] focus-within:border-blue-500 focus-within:text-white transition-all duration-200">
                    <FiSearch className="h-4 w-4 mr-2.5 flex-shrink-0 text-[#585870]" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search concepts in video transcript (e.g. 'explain neural network' or 'where is the example?')..."
                        className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-[#585870]"
                    />
                </div>
                <button
                    onClick={() => handleSearch()}
                    disabled={loading || !query.trim()}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/10"
                >
                    {loading ? (
                        <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
                    ) : 'Search'}
                </button>
            </div>

            {error && (
                <div className="bg-rose-950/20 border border-rose-800/30 rounded-xl p-3.5 text-xs text-rose-400">
                    <p className="flex items-center gap-1.5 font-medium">⚠️ {error}</p>
                </div>
            )}

            {loading && (
                <div className="text-center py-8 flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500"></div>
                    <p className="text-xs text-gray-400">Searching transcripts with AI embeddings...</p>
                </div>
            )}

            {/* Results */}
            {!loading && results.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs text-[#82829b] font-medium">
                        Found {results.length} results sorted by semantic relevance:
                    </p>
                    <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                        {results.map((result, idx) => (
                            <div
                                key={idx}
                                onClick={() => onResultClick && onResultClick(result.timestamp)}
                                className="bg-[#20202f]/45 border border-[#2a2a3f]/50 hover:border-blue-500/50 hover:bg-[#20202f]/70 rounded-xl p-3.5 cursor-pointer transition-all duration-200 group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-mono text-xs text-blue-400 font-bold flex items-center gap-1 bg-blue-900/10 px-2 py-0.5 rounded-lg border border-blue-800/20 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <FiClock className="h-3.5 w-3.5" />
                                        {formatTime(result.timestamp)}
                                    </span>
                                    <div className="text-right">
                                        <span className="text-[10px] text-[#82829b] uppercase font-bold tracking-wider mr-1.5">Match Relevance</span>
                                        <span className="text-xs font-bold text-green-400 font-mono">
                                            {(result.relevance_score * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed font-normal">{result.text}</p>

                                {/* Visual relevance bar */}
                                <div className="mt-2.5 bg-[#191924] rounded-full h-1 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-300"
                                        style={{ width: `${result.relevance_score * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!loading && results.length === 0 && query && (
                <div className="text-center py-6 bg-[#20202f]/20 border border-dashed border-[#2a2a3f]/50 rounded-xl">
                    <p className="text-xs text-gray-400">No matching concepts found for "{query}"</p>
                </div>
            )}

            {!loading && !query && results.length === 0 && (
                <div className="bg-blue-950/10 border border-blue-800/10 rounded-xl p-4 text-xs leading-relaxed text-blue-300/80 flex items-start gap-2.5">
                    <span className="h-4.5 w-4.5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono">i</span>
                    <p>
                        <strong>AI Concept Matching:</strong> Our search doesn't just look for exact keyword matches.
                        Type semantic ideas like <em>"key takeaways"</em> or <em>"where the speaker talks about X"</em>, and the model will locate relevant conceptual points in the timeline!
                    </p>
                </div>
            )}
        </div>
    );
}
