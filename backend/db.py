import os
from supabase import create_client, Client
from datetime import datetime
from typing import Optional, Dict, List, Any
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
# Try service role key first (bypasses RLS), fall back to anon key
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_KEY) must be set in environment variables")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print(f"✓ Supabase initialized with {'service role' if os.getenv('SUPABASE_SERVICE_KEY') else 'anon'} key")


class DatabaseManager:
    """Database manager for Supabase operations"""
    
    def __init__(self):
        self.client = supabase
    
    # ==================== USER OPERATIONS ====================
    
    def create_user(self, clerk_id: str, name: str, email: str, degree: str = 'B.Tech') -> Optional[Dict]:
        """Create a new user"""
        try:
            data = {
                'clerk_id': clerk_id,
                'name': name,
                'email': email,
                'degree': degree,
                'created_at': datetime.utcnow().isoformat()
            }
            result = self.client.table('users').insert(data).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error creating user: {e}")
            return None
    
    def get_user_by_clerk_id(self, clerk_id: str) -> Optional[Dict]:
        """Get user by Clerk ID"""
        try:
            result = self.client.table('users').select('*').eq('clerk_id', clerk_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict]:
        """Get user by UUID"""
        try:
            result = self.client.table('users').select('*').eq('id', user_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    def update_user(self, clerk_id: str, **kwargs) -> Optional[Dict]:
        """Update user information"""
        try:
            kwargs['updated_at'] = datetime.utcnow().isoformat()
            result = self.client.table('users').update(kwargs).eq('clerk_id', clerk_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error updating user: {e}")
            return None
    
    def get_or_create_user(self, clerk_id: str, name: str, email: str, degree: str = 'B.Tech') -> Optional[Dict]:
        """Get existing user or create new one"""
        user = self.get_user_by_clerk_id(clerk_id)
        if user:
            return user
        return self.create_user(clerk_id, name, email, degree)
    
    # ==================== QUIZ SESSION OPERATIONS ====================
    
    def create_quiz_session(self, user_id: str, difficulty: str, language: str, 
                           supports_oop: bool = False) -> Optional[Dict]:
        """Create a new quiz session"""
        try:
            data = {
                'user_id': user_id,
                'difficulty': difficulty,
                'language': language,
                'supports_oop': supports_oop,
                'started_at': datetime.utcnow().isoformat()
            }
            result = self.client.table('quiz_sessions').insert(data).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error creating quiz session: {e}")
            return None
    
    def get_quiz_session(self, quiz_id: str) -> Optional[Dict]:
        """Get quiz session by ID"""
        try:
            result = self.client.table('quiz_sessions').select('*').eq('id', quiz_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error getting quiz session: {e}")
            return None
    
    def get_user_quiz_sessions(self, user_id: str, limit: int = 10) -> List[Dict]:
        """Get all quiz sessions for a user"""
        try:
            result = (self.client.table('quiz_sessions')
                     .select('*')
                     .eq('user_id', user_id)
                     .order('started_at', desc=True)
                     .limit(limit)
                     .execute())
            return result.data if result.data else []
        except Exception as e:
            print(f"Error getting user quiz sessions: {e}")
            return []
    
    # ==================== QUIZ QUESTION OPERATIONS ====================
    
    def add_quiz_question(self, quiz_id: str, question: str, options: str, 
                         correct_answer: int, category: str, explanation: str = None) -> Optional[Dict]:
        """Add a question to a quiz session"""
        try:
            data = {
                'quiz_id': quiz_id,
                'question': question,
                'options': options,
                'correct_answer': correct_answer,
                'category': category,
                'explanation': explanation
            }
            result = self.client.table('quiz_questions').insert(data).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error adding quiz question: {e}")
            return None
    
    def add_quiz_questions_bulk(self, questions: List[Dict]) -> bool:
        """Add multiple questions in bulk"""
        try:
            result = self.client.table('quiz_questions').insert(questions).execute()
            return bool(result.data)
        except Exception as e:
            print(f"Error adding quiz questions in bulk: {e}")
            return False
    
    def get_quiz_questions(self, quiz_id: str) -> List[Dict]:
        """Get all questions for a quiz session"""
        try:
            result = (self.client.table('quiz_questions')
                     .select('*')
                     .eq('quiz_id', quiz_id)
                     .execute())
            return result.data if result.data else []
        except Exception as e:
            print(f"Error getting quiz questions: {e}")
            return []
    
    # ==================== RESULTS OPERATIONS ====================
    
    def save_result(self, user_id: str, quiz_id: str, total_score: int,
                   programming_score: float, analytics_score: float, 
                   testing_score: float, recommended_domain: str,
                   ai_insights: str = None) -> Optional[Dict]:
        """Save quiz results"""
        try:
            data = {
                'user_id': user_id,
                'quiz_id': quiz_id,
                'total_score': total_score,
                'programming_score': programming_score,
                'analytics_score': analytics_score,
                'testing_score': testing_score,
                'recommended_domain': recommended_domain,
                'ai_insights': ai_insights,
                'completed_at': datetime.utcnow().isoformat()
            }
            result = self.client.table('results').insert(data).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error saving result: {e}")
            return None
    
    def get_result(self, result_id: str) -> Optional[Dict]:
        """Get result by ID"""
        try:
            result = self.client.table('results').select('*').eq('id', result_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error getting result: {e}")
            return None
    
    def get_result_by_id(self, result_id: str) -> Optional[Dict]:
        """Get result details by result ID (alias for get_result)"""
        return self.get_result(result_id)
    
    def get_user_results(self, user_id: str, limit: int = 10) -> List[Dict]:
        """Get all results for a user"""
        try:
            result = (self.client.table('results')
                     .select('*')
                     .eq('user_id', user_id)
                     .order('completed_at', desc=True)
                     .limit(limit)
                     .execute())
            return result.data if result.data else []
        except Exception as e:
            print(f"Error getting user results: {e}")
            return []
    
    def get_quiz_result(self, quiz_id: str) -> Optional[Dict]:
        """Get result for a specific quiz"""
        try:
            result = self.client.table('results').select('*').eq('quiz_id', quiz_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error getting quiz result: {e}")
            return None

    def get_quiz_session_by_id(self, quiz_id: str) -> Optional[Dict]:
        """Get quiz session details (alias for get_quiz_session)"""
        return self.get_quiz_session(quiz_id)
    
    # ==================== ANALYTICS OPERATIONS ====================
    
    def get_user_statistics(self, user_id: str) -> Optional[Dict]:
        """Get user statistics"""
        try:
            # Get total quizzes
            quiz_sessions = self.get_user_quiz_sessions(user_id, limit=1000)
            
            # Get all results
            results = self.get_user_results(user_id, limit=1000)
            
            if not results:
                return {
                    'total_quizzes': len(quiz_sessions),
                    'completed_quizzes': 0,
                    'average_score': 0,
                    'last_quiz_date': None
                }
            
            total_score = sum(r['total_score'] for r in results)
            avg_score = total_score / len(results) if results else 0
            last_quiz = max(results, key=lambda x: x['completed_at'])
            
            return {
                'total_quizzes': len(quiz_sessions),
                'completed_quizzes': len(results),
                'average_score': round(avg_score, 2),
                'last_quiz_date': last_quiz['completed_at']
            }
        except Exception as e:
            print(f"Error getting user statistics: {e}")
            return None
    
    def get_domain_recommendations(self, user_id: str) -> Dict[str, int]:
        """Get domain recommendation frequency for a user"""
        try:
            results = self.get_user_results(user_id, limit=1000)
            domain_count = {}
            
            for result in results:
                domain = result['recommended_domain']
                domain_count[domain] = domain_count.get(domain, 0) + 1
            
            return domain_count
        except Exception as e:
            print(f"Error getting domain recommendations: {e}")
            return {}
    
    # ==================== UTILITY OPERATIONS ====================
    
    def delete_quiz_session(self, quiz_id: str) -> bool:
        """Delete a quiz session and all related data (cascade)"""
        try:
            self.client.table('quiz_sessions').delete().eq('id', quiz_id).execute()
            return True
        except Exception as e:
            print(f"Error deleting quiz session: {e}")
            return False
    
    def delete_user(self, clerk_id: str) -> bool:
        """Delete a user and all related data (cascade)"""
        try:
            self.client.table('users').delete().eq('clerk_id', clerk_id).execute()
            return True
        except Exception as e:
            print(f"Error deleting user: {e}")
            return False


# Create a global instance
db = DatabaseManager()


# Helper functions for backward compatibility
def get_db_connection():
    """Get database manager instance (for backward compatibility)"""
    return db


def init_db():
    """Initialize database - not needed for Supabase (use SQL script)"""
    print("For Supabase, run the SQL schema script in the Supabase SQL Editor")
    print("Database operations are ready to use with the DatabaseManager")


if __name__ == '__main__':
    print("Supabase Database Manager initialized")
    print("Make sure to:")
    print("1. Set SUPABASE_URL environment variable")
    print("2. Set SUPABASE_ANON_KEY environment variable")
    print("3. Run the SQL schema script in Supabase SQL Editor")