import os
import time
import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

class RateLimitExceededError(Exception):
    """Raised when rate limit is exceeded"""
    pass

class APITimeoutError(Exception):
    """Raised when API request times out"""
    pass

class AISummarizer:
    _instance = None
    _last_api_call = 0
    MIN_API_INTERVAL = 2  # Minimum seconds between API calls
    MAX_RETRIES = 3
    CACHE_TTL = 3600  # 1 hour cache TTL
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AISummarizer, cls).__new__(cls)
            cls._cache = {}
        return cls._instance
    
    def _rate_limited_call(self, func, *args, **kwargs):
        """Helper method to handle rate limiting"""
        current_time = time.time()
        
        # Enforce minimum interval between API calls
        if hasattr(self, '_last_api_call'):
            time_since_last_call = current_time - self._last_api_call
            if time_since_last_call < self.MIN_API_INTERVAL:
                time.sleep(self.MIN_API_INTERVAL - time_since_last_call)
        
        self._last_api_call = time.time()
        return func(*args, **kwargs)
        
    def _generate_summary(self, prompt: str) -> str:
        """
        Generate a summary using the configured LLM API.
        """
        try:
            if self.provider == "huggingface":
                response = self._rate_limited_call(
                    lambda: self.client.chat_completion(
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=1000
                    )
                )
                if not response or not response.choices:
                    raise ValueError("Empty response from Hugging Face API")
                return response.choices[0].message.content.strip()
            elif self.provider == "gemini":
                response = self._rate_limited_call(
                    lambda: self.model.generate_content(prompt)
                )
                if not response or not response.text:
                    raise ValueError("Empty response from Gemini API")
                return response.text.strip()
            else:
                raise ValueError("No valid AI provider initialized")
        except Exception as e:
            print(f"Error in _generate_summary: {str(e)}")
            raise
        
    def __init__(self):
        """Initialize AI summarizer with Hugging Face or Gemini API"""
        if hasattr(self, 'initialized'):
            return
            
        self.hf_key = os.getenv("HF_API_KEY") or os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN")
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        
        if self.hf_key:
            try:
                from huggingface_hub import InferenceClient
                self.provider = "huggingface"
                # Use Meta-Llama-3-8B-Instruct
                self.model_name = "meta-llama/Meta-Llama-3-8B-Instruct"
                self.client = InferenceClient(model=self.model_name, token=self.hf_key)
                self._last_api_call = 0
                
                # Test connection
                self._rate_limited_call(
                    lambda: self.client.chat_completion(
                        messages=[{"role": "user", "content": "Test connection"}],
                        max_tokens=5
                    )
                )
                print("✓ Successfully connected to Hugging Face Inference API")
                self.initialized = True
            except Exception as e:
                print("❌ Failed to initialize Hugging Face:", str(e))
                if self.gemini_key:
                    print("Falling back to Gemini...")
                else:
                    raise
                    
        if not hasattr(self, 'initialized') and self.gemini_key:
            try:
                import google.generativeai as genai
                self.provider = "gemini"
                genai.configure(api_key=self.gemini_key)
                self.model = genai.GenerativeModel('models/gemini-2.0-flash-001')
                self._last_api_call = 0
                
                # Test connection
                self._rate_limited_call(lambda: self.model.generate_content("Test connection"))
                print("✓ Successfully connected to Gemini 2.0 Flash")
                self.initialized = True
            except Exception as e:
                print("❌ Failed to initialize Gemini:", str(e))
                raise
                
        if not hasattr(self, 'initialized'):
            raise ValueError("Neither HF_API_KEY nor GEMINI_API_KEY environment variables are set")

    def generate_bookmark_context(self, transcript_snippet: str, timestamp: float) -> dict:
        """
        Generate a structured bookmark with title, category, and key points.
        Returns a dictionary with the structured summary.
        """
        if not transcript_snippet.strip():
            return self._get_fallback_summary("Empty transcript snippet provided")

        prompt = f"""
        Create a structured bookmark in this exact JSON format:
        
        {{
            "title": "Concise title (3-7 words)",
            "category": "Main topic (1-3 words)",
            "summary": [
                "Key point 1 (1 sentence).",
                "Key point 2 (1 sentence).",
                "Key point 3 (1 sentence).",
                "Key point 4 (1 sentence).",
                "Key point 5 (1 sentence)."
            ]
        }}
        
        Video segment (first 1000 chars):
        {transcript_snippet.strip()[:1000]}
        
        Rules:
        1. Keep title under 10 words
        2. Category should be 1-3 words
        3. Summary must be exactly 5 bullet points
        4. Each point should be 1 short sentence
        5. No markdown, just plain JSON
        """
        
        try:
            response = self._generate_summary(prompt)
            
            # Parse and validate the response
            import json
            import re
            
            # Extract JSON from the response
            json_match = re.search(r'```(?:json)?\s*({[\s\S]*?})\s*```', response) or re.search(r'({[\s\S]*})', response)
            if not json_match:
                raise ValueError("No valid JSON found in the response")
            
            try:
                bookmark = json.loads(json_match.group(1))
            except json.JSONDecodeError:
                # Try to fix common JSON issues
                fixed_json = json_match.group(1).replace('\n', ' ').replace('\r', '')
                bookmark = json.loads(fixed_json)
            
            # Build the result with defaults
            result = {
                'title': str(bookmark.get('title', 'Bookmark')).strip() or 'Bookmark',
                'category': str(bookmark.get('category', 'General')).strip() or 'General',
                'summary': []
            }
            
            # Handle summary - can be a list or a string
            if isinstance(bookmark.get('summary'), list):
                result['summary'] = [str(s).strip() for s in bookmark['summary'] if str(s).strip()]
            elif 'summary' in bookmark:
                # If summary is a string, split it into sentences
                sentences = re.split(r'(?<=[.!?])\s+', str(bookmark['summary']))
                result['summary'] = [s.strip() for s in sentences if s.strip()]
            
            # Ensure we have exactly 5 summary points
            while len(result['summary']) < 5:
                result['summary'].append(f"Key point {len(result['summary']) + 1}.")
            result['summary'] = result['summary'][:5]
            
            return result
            
        except Exception as e:
            print(f"Error generating bookmark: {str(e)}")
            return self._get_fallback_summary(str(e))
        
    def _clean_json_response(self, text: str) -> str:
        """Clean and extract JSON from the model's response.
        
        Returns:
            str: A valid JSON string, even if it's just an error message
        """
        if not text:
            return '{"error": "Empty response from API"}'
            
        try:
            import json
            
            # Try to parse as JSON directly first
            json.loads(text)
            return text
        except json.JSONDecodeError:
            pass
            
        try:
            # Look for JSON in markdown code blocks
            import re
            
            # Try to extract JSON from markdown code blocks
            json_match = re.search(r'```(?:json)?\s*({[\s\S]*?})\s*```', text)
            if json_match:
                json_str = json_match.group(1).strip()
                # Validate it's actually JSON
                json.loads(json_str)
                return json_str
            
            # Look for JSON without markdown
            json_match = re.search(r'({[\s\S]*})', text)
            if json_match:
                json_str = json_match.group(1).strip()
                # Validate it's actually JSON
                json.loads(json_str)
                return json_str
                
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Error parsing JSON: {str(e)}")
            
        # If we can't extract valid JSON, return a basic error response
        return '{"error": "Could not parse response as JSON"}'
        
    def _get_fallback_summary(self, error_msg: str) -> dict:
        """Return a fallback summary when generation fails"""
        return {
            "title": "Summary Generation Failed",
            "category": "Error",
            "summary": [
                f"An error occurred: {error_msg}",
                "Please try again later."
            ],
            "learning_outcome": "Unable to process the video content.",
            "action_items": [
                "Check your internet connection.",
                "Try again with a different video."
            ]
        }

    def generate_video_summary(self, full_transcript: str) -> dict:
        """Generate a concise summary of the video with title, category, and key points"""
        if not full_transcript.strip():
            return self._get_fallback_summary("Empty transcript provided")
            
        # Limit transcript length to avoid excessive API usage
        transcript = full_transcript[:5000]
        
        try:
            prompt = f"""
            Please analyze the following video transcript and provide a structured summary.
            
            Transcript:
            {transcript}
            
            Return the response in this exact JSON format:
            {{
                "title": "Video Title",
                "category": "General Category",
                "summary": [
                    "Key point 1",
                    "Key point 2",
                    "Key point 3"
                ],
                "learning_outcome": "Main learning outcome",
                "action_items": [
                    "Action item 1",
                    "Action item 2"
                ]
            }}
            """
            
            text = self._generate_summary(prompt)
            
            # Remove markdown code block markers if present
            if text.startswith('```json'):
                text = text[7:]
            if text.endswith('```'):
                text = text[:-3]
                
            # Parse the JSON response
            try:
                summary = json.loads(text)
                
                # Ensure all required fields are present
                if not all(key in summary for key in ['title', 'category', 'summary', 'learning_outcome', 'action_items']):
                    raise ValueError("Missing required fields in response")
                    
                return summary
                
            except json.JSONDecodeError:
                # If JSON parsing fails, return a fallback
                return self._get_fallback_summary("Failed to parse API response")
                
        except Exception as e:
            print(f"Error generating summary: {str(e)}")
            return self._get_fallback_summary(str(e))

    def generate_flashcard(self, transcript_snippet: str) -> Dict[str, str]:
        """
        Generate a flashcard (Q/A format).
        Raises an exception if generation fails.
        """
        if not transcript_snippet.strip():
            raise ValueError("Empty transcript snippet provided")

        prompt = """
        Create a flashcard from the following text.
        
        RULES:
        1. Generate exactly one question and one answer
        2. Question should be clear and specific
        3. Answer should be concise and directly address the question
        4. Format the response exactly as shown below:
        
        Q: [Your question here]
        A: [Your answer here]
        
        Text:
        {text}
        """.format(text=transcript_snippet.strip())

        content = self._generate_summary(prompt)
        
        # Parse the response
        lines = [line.strip() for line in content.split('\n') if line.strip()]
        question = ""
        answer = ""

        for line in lines:
            if line.lower().startswith("q:"):
                question = line[2:].strip()
            elif line.lower().startswith("a:"):
                answer = line[2:].strip()

        if not question or not answer:
            raise ValueError("Failed to parse flashcard from response")
            
        return {"question": question, "answer": answer}
