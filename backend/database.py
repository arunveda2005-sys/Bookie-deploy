import os
import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional
import numpy as np

# Try to import psycopg2 for PostgreSQL support
try:
    import psycopg2
    import psycopg2.extras
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False


class Database:
    def __init__(self, db_path: str = "video_bookmarks.db"):
        self.db_path = db_path
        self.db_url = os.getenv("DATABASE_URL")
        
        # Determine if we should use Postgres
        self.is_postgres = False
        if self.db_url and (self.db_url.startswith("postgres://") or self.db_url.startswith("postgresql://")):
            if not POSTGRES_AVAILABLE:
                print("⚠️ Warning: DATABASE_URL is set but psycopg2 is not installed. Falling back to SQLite.")
            else:
                self.is_postgres = True
                # Standardize database url for psycopg2
                if self.db_url.startswith("postgres://"):
                    self.db_url = self.db_url.replace("postgres://", "postgresql://", 1)
                print("✓ Using PostgreSQL database.")
                
        self.init_db()
        
    def get_connection(self):
        if self.is_postgres:
            conn = psycopg2.connect(self.db_url, cursor_factory=psycopg2.extras.RealDictCursor)
            return conn
        else:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            return conn
            
    def q(self, query: str) -> str:
        """Replace standard placeholder ? with %s if using Postgres"""
        if self.is_postgres:
            return query.replace("?", "%s")
        return query
        
    def execute_insert(self, conn, query: str, params: tuple) -> int:
        cursor = conn.cursor()
        if self.is_postgres:
            # Append RETURNING id to the query
            pg_query = self.q(query) + " RETURNING id"
            cursor.execute(pg_query, params)
            last_id = cursor.fetchone()['id']
        else:
            cursor.execute(query, params)
            last_id = cursor.lastrowid
        return last_id

    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if self.is_postgres:
            # PostgreSQL schema
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS videos (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(512) NOT NULL,
                    duration REAL,
                    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(50) DEFAULT 'processing',
                    summary TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transcript_segments (
                    id SERIAL PRIMARY KEY,
                    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
                    start_time REAL NOT NULL,
                    end_time REAL NOT NULL,
                    text TEXT NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS bookmarks (
                    id SERIAL PRIMARY KEY,
                    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
                    timestamp REAL NOT NULL,
                    user_note TEXT,
                    auto_context TEXT,
                    transcript_snippet TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    tag VARCHAR(50) DEFAULT 'custom'
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS segment_embeddings (
                    id SERIAL PRIMARY KEY,
                    segment_id INTEGER NOT NULL REFERENCES transcript_segments(id) ON DELETE CASCADE,
                    embedding BYTEA NOT NULL
                )
            """)
        else:
            # SQLite schema
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS videos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL,
                    duration REAL,
                    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'processing',
                    summary TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transcript_segments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    video_id INTEGER NOT NULL,
                    start_time REAL NOT NULL,
                    end_time REAL NOT NULL,
                    text TEXT NOT NULL,
                    FOREIGN KEY(video_id) REFERENCES videos(id)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS bookmarks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    video_id INTEGER NOT NULL,
                    timestamp REAL NOT NULL,
                    user_note TEXT,
                    auto_context TEXT,
                    transcript_snippet TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    tag TEXT DEFAULT 'custom',
                    FOREIGN KEY(video_id) REFERENCES videos(id)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS segment_embeddings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    segment_id INTEGER NOT NULL,
                    embedding BLOB NOT NULL,
                    FOREIGN KEY(segment_id) REFERENCES transcript_segments(id)
                )
            """)
            
        conn.commit()
        conn.close()
    
    def create_video(self, filename: str, duration: float = None) -> int:
        conn = self.get_connection()
        video_id = self.execute_insert(
            conn,
            "INSERT INTO videos (filename, duration) VALUES (?, ?)",
            (filename, duration)
        )
        conn.commit()
        conn.close()
        return video_id
    
    def update_video_status(self, video_id: int, status: str):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            self.q("UPDATE videos SET status = ? WHERE id = ?"),
            (status, video_id)
        )
        conn.commit()
        conn.close()
    
    def update_video_summary(self, video_id: int, summary: dict) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            if self.is_postgres:
                cursor.execute(
                    "UPDATE videos SET summary = %s WHERE id = %s",
                    (json.dumps(summary), video_id)
                )
            else:
                cursor.execute("PRAGMA table_info(videos)")
                columns = [column[1] for column in cursor.fetchall()]
                if 'summary' not in columns:
                    cursor.execute("ALTER TABLE videos ADD COLUMN summary TEXT")
                cursor.execute(
                    "UPDATE videos SET summary = ? WHERE id = ?",
                    (json.dumps(summary), video_id)
                )
            conn.commit()
            return True
        except Exception as e:
            print(f"Error updating video summary: {str(e)}")
            conn.rollback()
            return False
        finally:
            conn.close()
            
    def get_video(self, video_id: int) -> Optional[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(self.q("SELECT * FROM videos WHERE id = ?"), (video_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def add_transcript_segments(self, video_id: int, segments: List[Dict]):
        conn = self.get_connection()
        cursor = conn.cursor()
        for seg in segments:
            cursor.execute(
                self.q("""INSERT INTO transcript_segments 
                   (video_id, start_time, end_time, text) 
                   VALUES (?, ?, ?, ?)"""),
                (video_id, seg['start'], seg['end'], seg['text'])
            )
        conn.commit()
        conn.close()
    
    def get_transcript_segments(self, video_id: int) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            self.q("SELECT * FROM transcript_segments WHERE video_id = ? ORDER BY start_time"),
            (video_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def create_bookmark(self, video_id: int, timestamp: float, 
                       user_note: str = None, auto_context: str = None,
                       transcript_snippet: str = None, tag: str = 'custom') -> int:
        conn = self.get_connection()
        bookmark_id = self.execute_insert(
            conn,
            """INSERT INTO bookmarks 
               (video_id, timestamp, user_note, auto_context, transcript_snippet, tag)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (video_id, timestamp, user_note, auto_context, transcript_snippet, tag)
        )
        conn.commit()
        conn.close()
        return bookmark_id
    
    def get_bookmarks(self, video_id: int) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            self.q("SELECT * FROM bookmarks WHERE video_id = ? ORDER BY timestamp"),
            (video_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def save_embeddings(self, segment_id: int, embedding: np.ndarray):
        conn = self.get_connection()
        cursor = conn.cursor()
        embedding_bytes = embedding.tobytes()
        if self.is_postgres:
            cursor.execute(
                "INSERT INTO segment_embeddings (segment_id, embedding) VALUES (%s, %s)",
                (segment_id, psycopg2.Binary(embedding_bytes))
            )
        else:
            cursor.execute(
                "INSERT INTO segment_embeddings (segment_id, embedding) VALUES (?, ?)",
                (segment_id, embedding_bytes)
            )
        conn.commit()
        conn.close()
    
    def get_embeddings(self, video_id: int) -> List[np.ndarray]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(self.q("""
            SELECT se.embedding 
            FROM segment_embeddings se
            JOIN transcript_segments ts ON se.segment_id = ts.id
            WHERE ts.video_id = ?
            ORDER BY ts.start_time
        """), (video_id,))
        rows = cursor.fetchall()
        conn.close()
        
        embeddings = []
        for row in rows:
            emb_data = row['embedding']
            if isinstance(emb_data, memoryview):
                emb_data = emb_data.tobytes()
            embeddings.append(np.frombuffer(emb_data, dtype=np.float32))
        return embeddings
    
    def delete_video(self, video_id: int) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            # Delete embeddings first (foreign key constraint)
            cursor.execute(self.q("""
                DELETE FROM segment_embeddings 
                WHERE segment_id IN (
                    SELECT id FROM transcript_segments WHERE video_id = ?
                )
            """), (video_id,))
            
            # Delete transcript segments
            cursor.execute(self.q("DELETE FROM transcript_segments WHERE video_id = ?"), (video_id,))
            
            # Delete bookmarks
            cursor.execute(self.q("DELETE FROM bookmarks WHERE video_id = ?"), (video_id,))
            
            # Delete video record
            cursor.execute(self.q("DELETE FROM videos WHERE id = ?"), (video_id,))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Error deleting video {video_id}: {str(e)}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def get_all_videos(self) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM videos ORDER BY upload_date DESC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def clear_all_data(self) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM segment_embeddings")
            cursor.execute("DELETE FROM transcript_segments")
            cursor.execute("DELETE FROM bookmarks")
            cursor.execute("DELETE FROM videos")
            conn.commit()
            return True
        except Exception as e:
            print(f"Error clearing database: {str(e)}")
            conn.rollback()
            return False
        finally:
            conn.close()
