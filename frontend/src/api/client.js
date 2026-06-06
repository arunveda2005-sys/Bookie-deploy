const API_BASE = import.meta.env.DEV
    ? 'http://localhost:8000/api'
    : 'https://arunad005-bookie-backend.hf.space/api';

export const api = {
    async uploadVideo(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/upload-video`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');
        return response.json();
    },

    async getVideo(videoId) {
        const response = await fetch(`${API_BASE}/video/${videoId}`);
        if (!response.ok) throw new Error('Failed to fetch video');
        return response.json();
    },

    async getTranscript(videoId) {
        const response = await fetch(`${API_BASE}/video/${videoId}/transcript`);
        if (!response.ok) throw new Error('Failed to fetch transcript');
        return response.json();
    },

    async createBookmark(videoId, timestamp, userNote = null, tag = 'custom') {
        const response = await fetch(`${API_BASE}/bookmark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_id: videoId, timestamp, user_note: userNote, tag }),
        });

        if (!response.ok) throw new Error('Failed to create bookmark');
        return response.json();
    },

    async getBookmarks(videoId) {
        const response = await fetch(`${API_BASE}/video/${videoId}/bookmarks`);
        if (!response.ok) throw new Error('Failed to fetch bookmarks');
        return response.json();
    },

    async search(videoId, query) {
        const response = await fetch(`${API_BASE}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_id: videoId, query }),
        });

        if (!response.ok) throw new Error('Search failed');
        return response.json();
    },

    async getTopics(videoId) {
        const response = await fetch(`${API_BASE}/video/${videoId}/topics`);
        if (!response.ok) throw new Error('Failed to fetch topics');
        return response.json();
    },

    async exportNotes(videoId) {
        const response = await fetch(`${API_BASE}/video/${videoId}/export?format=markdown`);
        if (!response.ok) throw new Error('Export failed');
        return response.json();
    },

    getVideoStreamUrl(videoId) {
        return `${API_BASE}/video/${videoId}/stream`;
    },

    async summarizeVideo(videoId) {
        try {
            console.log(`Sending request to: ${API_BASE}/video/${videoId}/summarize`);
            const response = await fetch(`${API_BASE}/video/${videoId}/summarize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include' // Important for cookies, authorization headers, etc.
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                let errorDetail = 'Failed to generate video summary';
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || JSON.stringify(errorData);
                } catch (e) {
                    errorDetail = await response.text();
                }
                console.error('Error response:', errorDetail);
                throw new Error(errorDetail);
            }

            return await response.json();
        } catch (error) {
            console.error('Fetch error:', error);
            throw new Error(`Network error: ${error.message}`);
        }
    },

    async exportSummary(videoId) {
        try {
            console.log(`Exporting summary for video: ${videoId}`);
            const response = await fetch(`${API_BASE}/video/${videoId}/export-summary`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                credentials: 'include'
            });

            console.log('Export summary response status:', response.status);

            if (!response.ok) {
                let errorDetail = 'Failed to export summary';
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || JSON.stringify(errorData);
                } catch (e) {
                    errorDetail = await response.text();
                }
                console.error('Export summary error:', errorDetail);
                throw new Error(errorDetail);
            }

            return await response.json();
        } catch (error) {
            console.error('Export summary fetch error:', error);
            throw new Error(`Export failed: ${error.message}`);
        }
    },

    async getAllVideos() {
        const response = await fetch(`${API_BASE}/videos`);
        if (!response.ok) throw new Error('Failed to fetch videos');
        return response.json();
    },

    async deleteVideo(videoId) {
        const response = await fetch(`${API_BASE}/video/${videoId}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete video');
        return response.json();
    },

    async clearAllVideos() {
        const response = await fetch(`${API_BASE}/videos/clear-all`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to clear all videos');
        return response.json();
    }
};
