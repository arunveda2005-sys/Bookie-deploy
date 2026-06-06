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

    def _manually_extract_fields(self, text: str) -> Optional[dict]:
        """Manually extract fields from raw text when JSON parsing fails"""
        try:
            import re
            summary = {}
            
            # Try to find Title
            title_match = re.search(r'"title":\s*"([^"]+)"', text) or re.search(r'title:\s*([^\n]+)', text, re.IGNORECASE)
            if title_match:
                summary["title"] = title_match.group(1).strip().strip('"').strip("'")
                
            # Try to find Category
            cat_match = re.search(r'"category":\s*"([^"]+)"', text) or re.search(r'category:\s*([^\n]+)', text, re.IGNORECASE)
            if cat_match:
                summary["category"] = cat_match.group(1).strip().strip('"').strip("'")
                
            # Try to find Learning Outcome
            outcome_match = re.search(r'"learning_outcome":\s*"([^"]+)"', text) or re.search(r'learning_outcome:\s*([^\n]+)', text, re.IGNORECASE) or re.search(r'learning outcome:\s*([^\n]+)', text, re.IGNORECASE)
            if outcome_match:
                summary["learning_outcome"] = outcome_match.group(1).strip().strip('"').strip("'")
                
            # Try to find key takeaways / summary points
            points = []
            summary_array_match = re.search(r'"summary":\s*\[([\s\S]*?)\]', text)
            if summary_array_match:
                points = re.findall(r'"([^"]+)"', summary_array_match.group(1))
            else:
                summary_section = re.search(r'summary:([\s\S]*?)(?:learning|$)', text, re.IGNORECASE)
                if summary_section:
                    points = re.findall(r'(?:-|\*|\d+\.)\s*([^\n]+)', summary_section.group(1))
            if points:
                summary["summary"] = points
                
            # Try to find action items
            action_items = []
            action_array_match = re.search(r'"action_items":\s*\[([\s\S]*?)\]', text)
            if action_array_match:
                action_items = re.findall(r'"([^"]+)"', action_array_match.group(1))
            else:
                action_section = re.search(r'action_items:([\s\S]*?)(?:$)', text, re.IGNORECASE) or re.search(r'action items:([\s\S]*?)(?:$)', text, re.IGNORECASE)
                if action_section:
                    action_items = re.findall(r'(?:-|\*|\d+\.)\s*([^\n]+)', action_section.group(1))
            if action_items:
                summary["action_items"] = action_items
                
            if "title" in summary or "summary" in summary:
                return summary
        except Exception as e:
            print(f"Error in manual extraction: {str(e)}")
        return None

    def generate_video_summary(self, full_transcript: str) -> dict:
        """Generate a comprehensive summary of the video with title, category, and key points"""
        if not full_transcript.strip():
            return self._get_fallback_summary("Empty transcript provided")
            
        # Limit transcript length to avoid excessive API usage
        transcript = full_transcript[:5000]
        
        try:
            prompt = f"""
            Please analyze the following video transcript and provide a highly detailed, comprehensive, and structured educational summary.
            
            Transcript:
            {transcript}
            
            Return the response in this exact JSON format:
            {{
                "title": "A descriptive, engaging title for the video summary",
                "category": "Broad educational category (e.g. Science, Narrative, Design)",
                "overview": "A thorough, comprehensive paragraph (4-6 sentences) summarizing the main concepts, narrative context, arguments, and overarching significance of the video content.",
                "summary": [
                    "Descriptive key takeaway 1: A full, detailed sentence describing a major plot point, concept, or event from the video.",
                    "Descriptive key takeaway 2: A full, detailed sentence describing a major plot point, concept, or event from the video.",
                    "Descriptive key takeaway 3: A full, detailed sentence describing a major plot point, concept, or event from the video.",
                    "Descriptive key takeaway 4: A full, detailed sentence describing a major plot point, concept, or event from the video.",
                    "Descriptive key takeaway 5: A full, detailed sentence describing a major plot point, concept, or event from the video.",
                    "Descriptive key takeaway 6: A full, detailed sentence describing a major plot point, concept, or event from the video."
                ],
                "learning_outcome": "A detailed explanation (2-3 sentences) of the primary learning objectives, moral lessons, or takeaways taught by the video.",
                "action_items": [
                    "Action Item 1: A specific, actionable step or practical lesson derived from the video content.",
                    "Action Item 2: A specific, actionable step or practical lesson derived from the video content.",
                    "Action Item 3: A specific, actionable step or practical lesson derived from the video content.",
                    "Action Item 4: A specific, actionable step or practical lesson derived from the video content."
                ]
            }}
            
            Guidelines:
            1. Avoid short, single-word, or overly simple points. Make every bullet point and description informative and thorough.
            2. Do not include any introductory or concluding text, only the raw JSON string.
            """
            
            text = self._generate_summary(prompt).strip()
            
            import re
            
            # Find the JSON structure { ... } using regex
            json_match = re.search(r'({[\s\S]*})', text)
            if json_match:
                json_str = json_match.group(1).strip()
            else:
                json_str = text
                
            # Parse the JSON response
            try:
                summary = json.loads(json_str)
            except json.JSONDecodeError:
                try:
                    # Clean up common markdown/text around JSON strings
                    cleaned = re.sub(r'//.*', '', json_str)  # Remove comments
                    summary = json.loads(cleaned)
                except Exception:
                    summary = self._manually_extract_fields(text)
                    if not summary:
                        raise ValueError("Failed to parse API response as JSON or key-value text")
            
            # Ensure all required fields are present with defaults if missing
            result = {
                "title": summary.get("title") or summary.get("Video Title") or "Video Summary",
                "category": summary.get("category") or summary.get("General Category") or "General",
                "overview": summary.get("overview") or summary.get("learning_outcome") or "No overview provided.",
                "summary": summary.get("summary") or [],
                "learning_outcome": summary.get("learning_outcome") or summary.get("Main learning outcome") or "Not specified",
                "action_items": summary.get("action_items") or []
            }
            
            # If summary list is empty, try to populate it
            if not result["summary"]:
                if "key_points" in summary:
                    result["summary"] = summary["key_points"]
                elif isinstance(summary.get("summary"), str):
                    result["summary"] = [summary["summary"]]
                else:
                    result["summary"] = ["No key takeaways extracted."]
                    
            if not isinstance(result["summary"], list):
                result["summary"] = [str(result["summary"])]
                
            if not isinstance(result["action_items"], list):
                result["action_items"] = [str(result["action_items"])] if result["action_items"] else ["No action items specified."]
                
            return result
                
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
