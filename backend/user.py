from db import get_db_connection
from datetime import datetime

class User:
    @staticmethod
    def sync_clerk_user(clerk_id, email, name):
        """Sync or create user from Clerk authentication"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Check if user exists by clerk_id OR email
            cursor.execute('SELECT * FROM users WHERE clerk_id = ? OR email = ?', (clerk_id, email))
            existing_user = cursor.fetchone()
            
            if existing_user:
                # User exists, update clerk_id and other info
                cursor.execute('''
                    UPDATE users 
                    SET clerk_id = ?, name = ?, email = ?, updated_at = ?
                    WHERE id = ?
                ''', (clerk_id, name, email, datetime.now(), existing_user[0]))
                conn.commit()
                
                # Return updated user
                cursor.execute('''
                    SELECT id, clerk_id, name, email, degree, created_at 
                    FROM users WHERE id = ?
                ''', (existing_user[0],))
                row = cursor.fetchone()
                
            else:
                # Create new user
                cursor.execute('''
                    INSERT INTO users (clerk_id, name, email, degree, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (clerk_id, name, email, 'B.Tech', datetime.now(), datetime.now()))
                conn.commit()
                
                # Return new user
                cursor.execute('''
                    SELECT id, clerk_id, name, email, degree, created_at 
                    FROM users WHERE clerk_id = ?
                ''', (clerk_id,))
                row = cursor.fetchone()
            
            conn.close()
            
            if row:
                return {
                    'id': row[0],
                    'clerk_id': row[1],
                    'name': row[2],
                    'email': row[3],
                    'degree': row[4],
                    'created_at': row[5]
                }
            return None
            
        except Exception as e:
            print(f"Error syncing user: {e}")
            conn.rollback()
            conn.close()
            return None
    
    @staticmethod
    def get_by_clerk_id(clerk_id):
        """Get user by Clerk ID"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, clerk_id, name, email, degree, created_at 
            FROM users WHERE clerk_id = ?
        ''', (clerk_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        return {
            'id': row[0],
            'clerk_id': row[1],
            'name': row[2],
            'email': row[3],
            'degree': row[4],
            'created_at': row[5]
        }
    
    @staticmethod
    def get_by_id(user_id):
        """Get user by ID"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, email, degree, created_at FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        return {
            'id': row[0],
            'name': row[1],
            'email': row[2],
            'degree': row[3],
            'created_at': row[4]
        }
    
    @staticmethod
    def get_by_email(email):
        """Get user by email"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, email, clerk_id FROM users WHERE email = ?', (email,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        return {
            'id': row[0],
            'name': row[1],
            'email': row[2],
            'clerk_id': row[3]
        }
    
    @staticmethod
    def get_profile(user_id):
        """Get complete user profile with stats"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get user info
        cursor.execute('SELECT id, name, email, degree, created_at FROM users WHERE id = ?', (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row:
            conn.close()
            return None
        
        # Get total attempts
        cursor.execute('SELECT COUNT(*) FROM results WHERE user_id = ?', (user_id,))
        total_attempts = cursor.fetchone()[0]
        
        # Get average score
        cursor.execute('SELECT AVG(total_score) FROM results WHERE user_id = ?', (user_id,))
        avg_score = cursor.fetchone()[0] or 0
        
        # Get best score
        cursor.execute('SELECT MAX(total_score) FROM results WHERE user_id = ?', (user_id,))
        best_score = cursor.fetchone()[0] or 0
        
        # Get latest recommendation
        cursor.execute('''
            SELECT recommended_domain, completed_at 
            FROM results 
            WHERE user_id = ? 
            ORDER BY completed_at DESC 
            LIMIT 1
        ''', (user_id,))
        latest_result = cursor.fetchone()
        
        # Get domain distribution
        cursor.execute('''
            SELECT recommended_domain, COUNT(*) as count
            FROM results
            WHERE user_id = ?
            GROUP BY recommended_domain
        ''', (user_id,))
        domain_stats = cursor.fetchall()
        
        conn.close()
        
        return {
            'user': {
                'id': user_row[0],
                'name': user_row[1],
                'email': user_row[2],
                'degree': user_row[3],
                'member_since': user_row[4]
            },
            'stats': {
                'total_attempts': total_attempts,
                'average_score': round(avg_score, 2),
                'best_score': best_score,
                'latest_domain': latest_result[0] if latest_result else None,
                'last_attempt': latest_result[1] if latest_result else None,
                'domain_distribution': {row[0]: row[1] for row in domain_stats}
            }
        }
    
    @staticmethod
    def update_profile(user_id, data):
        """Update user profile"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        name = data.get('name')
        degree = data.get('degree')
        
        try:
            cursor.execute('''
                UPDATE users 
                SET name = COALESCE(?, name), 
                    degree = COALESCE(?, degree),
                    updated_at = ?
                WHERE id = ?
            ''', (name, degree, datetime.now(), user_id))
            
            conn.commit()
            success = cursor.rowcount > 0
        except Exception as e:
            print(f"Error updating profile: {e}")
            conn.rollback()
            success = False
        finally:
            conn.close()
        
        return success
    
    @staticmethod
    def get_attempts(user_id):
        """Get all quiz attempts for a user"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                r.id,
                r.total_score,
                r.programming_score,
                r.analytics_score,
                r.testing_score,
                r.recommended_domain,
                r.completed_at,
                r.ai_insights,
                q.difficulty,
                q.language
            FROM results r
            JOIN quiz_sessions q ON r.quiz_id = q.id
            WHERE r.user_id = ?
            ORDER BY r.completed_at DESC
        ''', (user_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        attempts = []
        for row in rows:
            import json
            ai_insights = None
            if row[7]:
                try:
                    ai_insights = json.loads(row[7])
                except:
                    pass
            
            attempts.append({
                'id': row[0],
                'total_score': row[1],
                'percentage': round((row[1] / 30) * 100, 2),
                'domain_scores': {
                    'programming': row[2],
                    'analytics': row[3],
                    'testing': row[4]
                },
                'recommended_domain': row[5],
                'completed_at': row[6],
                'ai_insights': ai_insights,
                'difficulty': row[8],
                'language': row[9]
            })
        
        return attempts
    
    @staticmethod
    def get_improvement_data(user_id):
        """Get data for improvement graph"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                completed_at,
                total_score,
                programming_score,
                analytics_score,
                testing_score
            FROM results
            WHERE user_id = ?
            ORDER BY completed_at ASC
        ''', (user_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        data = []
        for idx, row in enumerate(rows, 1):
            data.append({
                'attempt': idx,
                'date': row[0],
                'total': row[1],
                'programming': row[2],
                'analytics': row[3],
                'testing': row[4]
            })
        
        return data
    
    @staticmethod
    def delete_account(user_id):
        """Delete user account and all associated data"""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Delete results
            cursor.execute('DELETE FROM results WHERE user_id = ?', (user_id,))
            
            # Delete quiz sessions
            cursor.execute('DELETE FROM quiz_sessions WHERE user_id = ?', (user_id,))
            
            # Delete user
            cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
            
            conn.commit()
            success = True
        except Exception as e:
            print(f"Error deleting account: {e}")
            conn.rollback()
            success = False
        finally:
            conn.close()
        
        return success