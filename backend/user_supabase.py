"""
User management module for Supabase
"""
from datetime import datetime
import json
from db import db


class User:
    """User class for handling user operations with Supabase"""
    
    @staticmethod
    def sync_clerk_user(clerk_id, email, name, degree='B.Tech'):
        """
        Sync Clerk user with Supabase database
        Creates new user if doesn't exist, returns existing if does
        """
        try:
            # Try to get existing user
            existing_user = db.get_user_by_clerk_id(clerk_id)
            
            if existing_user:
                # Update user info in case name or email changed
                updated_user = db.update_user(
                    clerk_id=clerk_id,
                    name=name,
                    email=email
                )
                print(f"✓ User synced (existing): {name} ({clerk_id})")
                return updated_user if updated_user else existing_user
            
            # Create new user
            new_user = db.create_user(
                clerk_id=clerk_id,
                name=name,
                email=email,
                degree=degree
            )
            
            if new_user:
                print(f"✓ User created: {name} ({clerk_id})")
                return new_user
            
            return None
            
        except Exception as e:
            print(f"❌ Error syncing user: {e}")
            return None
    
    @staticmethod
    def get_by_clerk_id(clerk_id):
        """Get user by Clerk ID"""
        try:
            user = db.get_user_by_clerk_id(clerk_id)
            return user
        except Exception as e:
            print(f"❌ Error getting user: {e}")
            return None
    
    @staticmethod
    def get_by_id(user_id):
        """Get user by UUID"""
        try:
            user = db.get_user_by_id(user_id)
            return user
        except Exception as e:
            print(f"❌ Error getting user by id: {e}")
            return None
    
    @staticmethod
    def get_by_email(email):
        """Get user by email"""
        try:
            result = db.client.table('users').select('*').eq('email', email).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"❌ Error getting user by email: {e}")
            return None
    
    @staticmethod
    def get_profile(user_id):
        """Get complete user profile with statistics"""
        try:
            user = db.get_user_by_id(user_id)
            if not user:
                return None
            
            # Get user statistics
            stats = db.get_user_statistics(user_id)
            
            # Get domain recommendations
            domain_recommendations = db.get_domain_recommendations(user_id)
            
            # Get recent results
            recent_results = db.get_user_results(user_id, limit=5)
            
            # Format recent results
            formatted_results = []
            for result in recent_results:
                ai_insights = None
                if result.get('ai_insights'):
                    try:
                        ai_insights = json.loads(result['ai_insights']) if isinstance(result['ai_insights'], str) else result['ai_insights']
                    except:
                        pass
                
                formatted_results.append({
                    'id': result['id'],
                    'total_score': result['total_score'],
                    'percentage': round((result['total_score'] / 30) * 100, 2),
                    'recommended_domain': result['recommended_domain'],
                    'completed_at': result['completed_at'],
                    'ai_insights': ai_insights
                })
            
            profile = {
                'user': {
                    'id': user['id'],
                    'clerk_id': user['clerk_id'],
                    'name': user['name'],
                    'email': user['email'],
                    'degree': user.get('degree', 'B.Tech'),
                    'member_since': user['created_at']
                },
                'stats': {
                    'total_attempts': stats.get('total_quizzes', 0) if stats else 0,
                    'completed_quizzes': stats.get('completed_quizzes', 0) if stats else 0,
                    'average_score': stats.get('average_score', 0) if stats else 0,
                    'best_score': max([r['total_score'] for r in recent_results]) if recent_results else 0,
                    'latest_domain': recent_results[0]['recommended_domain'] if recent_results else None,
                    'last_attempt': stats.get('last_quiz_date') if stats else None,
                    'domain_distribution': domain_recommendations
                },
                'recent_results': formatted_results
            }
            
            return profile
            
        except Exception as e:
            print(f"❌ Error getting profile: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def update_profile(user_id, data):
        """Update user profile"""
        try:
            # Get user's clerk_id first
            user = db.get_user_by_id(user_id)
            if not user:
                return False
            
            # Prepare update data
            update_data = {}
            allowed_fields = ['name', 'email', 'degree']
            
            for field in allowed_fields:
                if field in data and data[field]:
                    update_data[field] = data[field]
            
            if not update_data:
                return False
            
            # Update user
            updated_user = db.update_user(user['clerk_id'], **update_data)
            return updated_user is not None
            
        except Exception as e:
            print(f"❌ Error updating profile: {e}")
            return False
    
    @staticmethod
    def get_attempts(user_id, limit=10):
        """Get quiz attempts for a user"""
        try:
            # Get results with quiz session details
            results = db.get_user_results(user_id, limit=limit)
            
            attempts = []
            for result in results:
                # Get quiz session details
                quiz_session = db.get_quiz_session(result['quiz_id'])
                
                # Parse AI insights
                ai_insights = None
                if result.get('ai_insights'):
                    try:
                        ai_insights = json.loads(result['ai_insights']) if isinstance(result['ai_insights'], str) else result['ai_insights']
                    except:
                        pass
                
                attempts.append({
                    'id': result['id'],
                    'total_score': result['total_score'],
                    'percentage': round((result['total_score'] / 30) * 100, 2),
                    'domain_scores': {
                        'programming': result.get('programming_score', 0),
                        'analytics': result.get('analytics_score', 0),
                        'testing': result.get('testing_score', 0)
                    },
                    'recommended_domain': result['recommended_domain'],
                    'completed_at': result['completed_at'],
                    'ai_insights': ai_insights,
                    'difficulty': quiz_session['difficulty'] if quiz_session else 'moderate',
                    'language': quiz_session['language'] if quiz_session else 'python'
                })
            
            return attempts
            
        except Exception as e:
            print(f"❌ Error getting attempts: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    @staticmethod
    def get_improvement_data(user_id):
        """Get data for improvement graph"""
        try:
            # Get all results ordered by completion date
            results = db.get_user_results(user_id, limit=100)
            
            # Sort by completed_at ascending
            results_sorted = sorted(results, key=lambda x: x['completed_at'])
            
            data = []
            for idx, result in enumerate(results_sorted, 1):
                data.append({
                    'attempt': idx,
                    'date': result['completed_at'],
                    'total': result['total_score'],
                    'programming': result.get('programming_score', 0),
                    'analytics': result.get('analytics_score', 0),
                    'testing': result.get('testing_score', 0)
                })
            
            return data
            
        except Exception as e:
            print(f"❌ Error getting improvement data: {e}")
            return []
    
    @staticmethod
    def delete_account(user_id):
        """Delete user account and all associated data (cascade deletes automatically)"""
        try:
            # Get user's clerk_id
            user = db.get_user_by_id(user_id)
            if not user:
                return False
            
            # Delete user (cascade will handle related records)
            success = db.delete_user(user['clerk_id'])
            
            if success:
                print(f"✓ Account deleted: {user['email']}")
            
            return success
            
        except Exception as e:
            print(f"❌ Error deleting account: {e}")
            return False