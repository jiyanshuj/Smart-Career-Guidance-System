import sqlite3
import os

DATABASE_PATH = os.getenv('DATABASE_PATH', 'quiz_app.db')

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with updated schema for Clerk integration"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Drop existing users table if it has constraint issues
    # cursor.execute('DROP TABLE IF EXISTS users')
    
    # Users table (updated for Clerk)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clerk_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            degree TEXT DEFAULT 'B.Tech',
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP
        )
    ''')
    
    # Quiz sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quiz_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            difficulty TEXT NOT NULL,
            language TEXT NOT NULL,
            supports_oop BOOLEAN DEFAULT 0,
            started_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # Quiz questions table (stores generated questions per quiz)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quiz_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            options TEXT NOT NULL,
            correct_answer INTEGER NOT NULL,
            category TEXT NOT NULL,
            explanation TEXT,
            FOREIGN KEY (quiz_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE
        )
    ''')
    
    # Results table (updated with AI insights)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            quiz_id INTEGER NOT NULL,
            total_score INTEGER NOT NULL,
            programming_score REAL DEFAULT 0,
            analytics_score REAL DEFAULT 0,
            testing_score REAL DEFAULT 0,
            recommended_domain TEXT NOT NULL,
            ai_insights TEXT,
            completed_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (quiz_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE
        )
    ''')
    
    # Create indexes for better performance
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_results_quiz_id ON results(quiz_id)
    ''')
    
    conn.commit()
    conn.close()
    
    print("Database initialized successfully with Clerk integration!")

def reset_database():
    """
    Reset the entire database - USE WITH CAUTION!
    This will delete all data
    """
    if os.path.exists(DATABASE_PATH):
        os.remove(DATABASE_PATH)
        print(f"Database {DATABASE_PATH} deleted.")
    
    init_db()
    print("Database reset complete!")

def migrate_existing_users():
    """
    Migration script to add clerk_id to existing users
    Run this once if you have existing users
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if clerk_id column exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'clerk_id' not in columns:
            print("Adding clerk_id column to users table...")
            # Add clerk_id column
            cursor.execute('ALTER TABLE users ADD COLUMN clerk_id TEXT')
            
            # Generate temporary clerk IDs for existing users
            cursor.execute('SELECT id FROM users')
            users = cursor.fetchall()
            
            for user in users:
                temp_clerk_id = f'migrated_user_{user[0]}'
                cursor.execute('UPDATE users SET clerk_id = ? WHERE id = ?', 
                             (temp_clerk_id, user[0]))
            
            # Make clerk_id unique
            cursor.execute('CREATE UNIQUE INDEX idx_users_clerk_id ON users(clerk_id)')
            
            conn.commit()
            print("Migration completed! Please update users with real Clerk IDs.")
        else:
            print("clerk_id column already exists")
            
    except Exception as e:
        print(f"Migration error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    # Uncomment the line below to reset the database (WILL DELETE ALL DATA!)
    # reset_database()
    
    init_db()
    
    # Uncomment the line below if you need to migrate existing database
    # migrate_existing_users()