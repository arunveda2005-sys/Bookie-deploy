import os
import json
from dotenv import load_dotenv

# Ensure ffmpeg path is in environment PATH (useful if newly installed and not loaded by parent process)
ffmpeg_dir = r"C:\Users\HP\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
if os.path.exists(ffmpeg_dir) and ffmpeg_dir not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + ffmpeg_dir

# Load environment variables from .env file
load_dotenv()

# Debug: Check if the API key is loaded
print("GEMINI_API_KEY loaded:", "GEMINI_API_KEY" in os.environ)
if "GEMINI_API_KEY" in os.environ:
    print("Key length:", len(os.environ["GEMINI_API_KEY"]))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import shutil
from pathlib import Path
import asyncio
from datetime import datetime

from database import Database
from transcription import TranscriptionService
from embeddings import EmbeddingService
from ai_summarizer import AISummarizer

app = FastAPI(title="Video Bookmarking API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Initialize services
db = Database()
transcription_service = None  # Lazy load
embedding_service = None  # Lazy load
ai_summarizer = AISummarizer()

# Storage directories
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Pydantic models
class BookmarkCreate(BaseModel):
    video_id: int
    timestamp: float
    user_note: Optional[str] = None
    tag: str = "custom"

class SearchQuery(BaseModel):
    video_id: int
    query: str

# Helper functions
def get_transcript_context(segments: List[dict], timestamp: float, window_before: int = 10, window_after: int = 10) -> str:
    """
    Get transcript text around a timestamp with strict time windows.
    
    Args:
        segments: List of transcript segments
        timestamp: Target timestamp in seconds
        window_before: Max seconds of context before the timestamp
        window_after: Max seconds of context after the timestamp
    """
    # Get segments that start within the time window
    context_segments = [
        seg for seg in segments 
        if timestamp - window_before <= seg['start_time'] <= timestamp + window_after
    ]
    
    # If no segments found, try to get the closest segment
    if not context_segments and segments:
        # Find the segment closest to the timestamp
        closest = min(segments, key=lambda x: abs(x['start_time'] - timestamp))
        context_segments = [closest]
    
    # Get the text from these segments
    context_text = ' '.join(seg['text'] for seg in context_segments)
    
    # If we have text, try to clean it up
    if context_text:
        # Remove extra whitespace
        context_text = ' '.join(context_text.split())
        
        # Ensure it's not too long (just in case)
        max_length = 500  # characters
        if len(context_text) > max_length:
            context_text = context_text[:max_length].rsplit(' ', 1)[0] + '...'
    
    return context_text

async def process_video_background(video_id: int, video_path: str):
    """
    Background task to transcribe and process video
    """
    global transcription_service, embedding_service
    
    try:
        # Lazy load Whisper (heavy model)
        if transcription_service is None:
            transcription_service = TranscriptionService(model_size="base")
        
        # Transcribe
        segments = transcription_service.transcribe_video(video_path)
        
        # Save segments
        db.add_transcript_segments(video_id, segments)
        
        # Generate embeddings
        if embedding_service is None:
            embedding_service = EmbeddingService()
        
        segment_records = db.get_transcript_segments(video_id)
        texts = [seg['text'] for seg in segment_records]
        embeddings = embedding_service.encode_segments(texts)
        
        # Save embeddings
        for seg, emb in zip(segment_records, embeddings):
            db.save_embeddings(seg['id'], emb)
        
        # Mark as ready
        db.update_video_status(video_id, 'ready')
        
    except Exception as e:
        print(f"Error processing video {video_id}: {e}")
        db.update_video_status(video_id, 'error')

# API Endpoints
@app.get("/")
async def root():
    return {"message": "Video Bookmarking API", "status": "running"}

@app.post("/api/upload-video")
async def upload_video(file: UploadFile = File(...)):
    """
    Upload video file and start processing
    """
    try:
        # Save file
        file_path = UPLOAD_DIR / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Create video record
        video_id = db.create_video(filename=file.filename)
        
        # Start background processing
        asyncio.create_task(process_video_background(video_id, str(file_path)))
        
        return {
            "video_id": video_id,
            "filename": file.filename,
            "status": "processing",
            "message": "Video uploaded successfully. Transcription in progress."
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/video/{video_id}")
async def get_video(video_id: int):
    """
    Get video metadata and status
    """
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video

@app.get("/api/video/{video_id}/stream")
async def stream_video(video_id: int):
    """
    Stream video file
    """
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    video_path = UPLOAD_DIR / video['filename']
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    
    return FileResponse(video_path)

@app.get("/api/video/{video_id}/transcript")
async def get_transcript(video_id: int):
    """
    Get video transcript segments
    """
    segments = db.get_transcript_segments(video_id)
    return {"segments": segments}

@app.post("/api/bookmark")
async def create_bookmark(bookmark: BookmarkCreate):
    """
    Create a bookmark with AI-generated context
    """
    # Get transcript context
    segments = db.get_transcript_segments(bookmark.video_id)
    transcript_snippet = get_transcript_context(segments, bookmark.timestamp)
    
    # Generate AI summary
    auto_context = ai_summarizer.generate_bookmark_context(
        transcript_snippet, 
        bookmark.timestamp
    )
    
    # Convert auto_context to JSON string if it's a dictionary
    auto_context_str = json.dumps(auto_context) if isinstance(auto_context, dict) else str(auto_context)
    
    # Save bookmark
    bookmark_id = db.create_bookmark(
        video_id=bookmark.video_id,
        timestamp=bookmark.timestamp,
        user_note=bookmark.user_note,
        auto_context=auto_context_str,  # Now passing a string, not a dict
        transcript_snippet=transcript_snippet,
        tag=bookmark.tag
    )
    
    return {
        "id": bookmark_id,
        "video_id": bookmark.video_id,
        "timestamp": bookmark.timestamp,
        "user_note": bookmark.user_note,
        "auto_context": auto_context,
        "transcript_snippet": transcript_snippet,
        "tag": bookmark.tag
    }

@app.get("/api/video/{video_id}/bookmarks")
async def get_bookmarks(video_id: int):
    """
    Get all bookmarks for a video
    """
    bookmarks = db.get_bookmarks(video_id)
    return {"bookmarks": bookmarks}

@app.post("/api/search")
async def search_video(search: SearchQuery):
    """
    Semantic search across video transcript
    """
    global embedding_service
    
    if embedding_service is None:
        embedding_service = EmbeddingService()
    
    # Get segments
    segments = db.get_transcript_segments(search.video_id)
    texts = [seg['text'] for seg in segments]
    
    # Search
    results = embedding_service.semantic_search(
        search.query,
        texts,
        segments,
        top_k=10
    )
    
    return {"results": results}

@app.get("/api/video/{video_id}/topics")
async def get_topics(video_id: int):
    """
    Get detected topic boundaries
    """
    global embedding_service
    
    if embedding_service is None:
        embedding_service = EmbeddingService()
    
    segments = db.get_transcript_segments(video_id)
    boundaries = embedding_service.detect_topic_boundaries(segments)
    
    return {"topics": boundaries}

@app.get("/api/video/{video_id}/export")
async def export_notes(video_id: int, format: str = "markdown"):
    """
    Export bookmarks as markdown
    """
    video = db.get_video(video_id)
    bookmarks = db.get_bookmarks(video_id)
    
    if format == "markdown":
        # Header
        md = f"# {video['filename']}\n\n"
        md += f"**Upload Date:** {video['upload_date']}\n\n"
        
        # Process each bookmark
        for i, bookmark in enumerate(bookmarks, 1):
            # Format timestamp as MM:SS
            minutes = int(bookmark['timestamp'] // 60)
            seconds = int(bookmark['timestamp'] % 60)
            timestamp_str = f"{minutes}:{seconds:02d}"
            
            # Bookmark header
            md += f"## 📌 Bookmark {i} - {timestamp_str}\n\n"
            
            # Tag/Category
            if bookmark['tag'] and bookmark['tag'].lower() != 'custom':
                md += f"**Category:** {bookmark['tag']}\n\n"
            
            # Transcript context
            if bookmark['transcript_snippet']:
                md += "### 📝 Context\n\n"
                md += f"{bookmark['transcript_snippet'].strip()}\n\n"
            
            # AI Summary (if available)
            if bookmark['auto_context']:
                md += "### 📚 Summary\n\n"
                # Clean up the AI summary formatting
                summary = bookmark['auto_context'].replace('•', '• ').replace('\n\n', '\n').strip()
                md += f"{summary}\n\n"
            
            # User Note (if available)
            if bookmark['user_note']:
                md += "### 💭 My Notes\n\n"
                md += f"{bookmark['user_note'].strip()}\n\n"
            
            # Add separator between bookmarks
            if i < len(bookmarks):
                md += "---\n\n"
        
        return {"content": md, "filename": f"{video['filename']}_notes.md"}
    
    raise HTTPException(status_code=400, detail="Unsupported format")

@app.post("/api/video/{video_id}/summarize")
async def summarize_video(video_id: int):
    """
    Generate a comprehensive summary of the entire video
    
    Returns:
        dict: A dictionary containing the video ID and generated summary
        
    Raises:
        HTTPException: If there's an error processing the request
    """
    print(f"[DEBUG] Received summarize request for video {video_id}")
    
    try:
        # Get video metadata
        video = db.get_video(video_id)
        if not video:
            error_msg = f"Video {video_id} not found in database"
            print(f"[ERROR] {error_msg}")
            raise HTTPException(status_code=404, detail=error_msg)
        
        print(f"[DEBUG] Found video: {video}")
        
        # Get transcript segments
        print("[DEBUG] Fetching transcript segments...")
        segments = db.get_transcript_segments(video_id)
        if not segments:
            error_msg = f"No transcript segments found for video {video_id}"
            print(f"[ERROR] {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        print(f"[DEBUG] Found {len(segments)} transcript segments")
        
        # Combine all transcript segments into one text
        full_transcript = " ".join(seg.get('text', '') for seg in segments if seg.get('text'))
        if not full_transcript.strip():
            error_msg = "No transcript text found in segments"
            print(f"[ERROR] {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
            
        print(f"[DEBUG] Combined transcript length: {len(full_transcript)} characters")
        
        try:
            # Generate summary
            print("[DEBUG] Generating summary...")
            summary = ai_summarizer.generate_video_summary(full_transcript)
            print("[DEBUG] Successfully generated summary")
            
            # Ensure summary is in the correct format
            if not isinstance(summary, dict):
                error_msg = f"Unexpected summary format: {type(summary)}"
                print(f"[ERROR] {error_msg}")
                raise ValueError(error_msg)
                
            # Update video with summary in database
            print("[DEBUG] Updating video with summary in database")
            success = db.update_video_summary(video_id, summary)
            if not success:
                error_msg = "Failed to update video summary in database"
                print(f"[WARNING] {error_msg}")
                # Don't fail the request if DB update fails, but log it
        
        except Exception as e:
            error_msg = f"Error generating summary: {str(e)}"
            print(f"[ERROR] {error_msg}")
            import traceback
            traceback.print_exc()
            
            # Return a fallback summary if generation fails
            summary = {
                "title": "Summary Generation Failed",
                "category": "Error",
                "summary": [
                    "We couldn't generate a summary due to an error.",
                    "The video content might be too complex or the service might be temporarily unavailable.",
                    "Please try again later or contact support if the problem persists.",
                    f"Error details: {str(e)}",
                    ""
                ]
            }
        
        # Prepare and return response
        response = {
            "video_id": video_id,
            "summary": summary
        }
        print("[DEBUG] Sending response")
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are
        raise
    except Exception as e:
        error_msg = f"Unexpected error processing video {video_id}: {str(e)}"
        print(f"[ERROR] {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/api/videos")
async def get_all_videos():
    """
    Get all videos in the database
    """
    videos = db.get_all_videos()
    return {"videos": videos}

@app.delete("/api/video/{video_id}")
async def delete_video(video_id: int):
    """
    Delete a video and all associated data
    """
    # Get video info first
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Delete from database
    success = db.delete_video(video_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete video from database")
    
    # Delete video file
    video_path = UPLOAD_DIR / video['filename']
    if video_path.exists():
        try:
            video_path.unlink()
        except Exception as e:
            print(f"Warning: Could not delete video file: {e}")
    
    return {"message": "Video deleted successfully", "video_id": video_id}

@app.delete("/api/videos/clear-all")
async def clear_all_videos():
    """
    Clear all videos and data (use with caution!)
    """
    # Clear database
    success = db.clear_all_data()
    if not success:
        raise HTTPException(status_code=500, detail="Failed to clear database")
    
    # Delete all video files
    deleted_count = 0
    for video_file in UPLOAD_DIR.glob("*"):
        if video_file.is_file():
            try:
                video_file.unlink()
                deleted_count += 1
            except Exception as e:
                print(f"Warning: Could not delete {video_file}: {e}")
    
    return {
        "message": "All data cleared successfully",
        "files_deleted": deleted_count
    }

@app.get("/api/video/{video_id}/export-summary")
async def export_summary(video_id: int, format: str = "markdown"):
    """
    Export video summary as markdown
    """
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    # Get the title and summary from the video data
    video_title = video.get('title', 'Untitled Video')
    summary = video.get('summary')
    
    if not summary:
        raise HTTPException(status_code=400, detail="No summary available for this video")
    
    # Parse summary if it's a string
    if isinstance(summary, str):
        try:
            import json
            # Try to parse the summary if it's a JSON string
            summary = json.loads(summary)
            # Handle case where summary is nested under 'summary' key
            if isinstance(summary, dict) and 'summary' in summary:
                summary = summary['summary']
        except json.JSONDecodeError:
            # If it's not JSON, keep it as is
            pass
    
    # Start building the markdown
    markdown = f"# {video_title} - Summary\n\n"
    
    if isinstance(summary, str):
        # Handle plain text summary
        markdown += f"{summary}\n"
    elif isinstance(summary, dict):
        # Handle structured summary
        if 'overview' in summary:
            markdown += f"## Overview\n{summary['overview']}\n\n"
        
        # Add learning outcome if available
        if 'learning_outcome' in summary and summary['learning_outcome']:
            markdown += f"## Key Learning Outcome\n{summary['learning_outcome']}\n\n"
        
        # Handle summary points if available
        if 'summary' in summary and isinstance(summary['summary'], list) and summary['summary']:
            markdown += "## Summary\n"
            for point in summary['summary']:
                markdown += f"- {point}\n"
            markdown += "\n"
        # Handle practical examples if they exist
        elif 'practical_examples' in summary and summary['practical_examples']:
            markdown += "## Practical Examples\n\n"
            for i, example in enumerate(summary['practical_examples'], 1):
                markdown += f"### Example {i}: {example.get('scenario', '')}\n"
                if 'application' in example:
                    markdown += f"{example['application']}\n\n"
        
        # Fallback to key points if no practical examples or summary
        elif 'key_points' in summary and summary['key_points']:
            markdown += "## Key Points\n"
            for point in summary['key_points']:
                markdown += f"- {point}\n"
            markdown += "\n"
    
    # Create a safe filename
    safe_title = "".join(c if c.isalnum() or c in ' ._-' else '_' for c in video_title)
    safe_title = safe_title[:50].strip()
    
    return {
        "content": markdown,
        "filename": f"{safe_title}_summary.md"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
