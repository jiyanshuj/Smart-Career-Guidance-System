# Smart Career Guidance System - Backend API

A powerful Flask-based REST API that powers the Smart Career Guidance System, leveraging Google's Gemini AI for intelligent quiz generation and personalized career recommendations using Supabase as the database.

## 🌟 Features

### 🎯 Core API Features
- **AI-Powered Quiz Generation** - Generate customized 30-question assessments using Google Gemini 2.0
- **Multi-Domain Assessment** - OS, DBMS, Networks, Aptitude, Verbal, and Programming questions
- **Intelligent Evaluation** - Real-time quiz evaluation with detailed analytics
- **Personalized Insights** - AI-generated career recommendations and learning paths
- **User Profile Management** - Track progress, statistics, and attempt history
- **Secure Authentication** - Clerk-based JWT token authentication

### 🤖 AI Integration
- **Google Gemini 2.0 Flash Lite** - Fast, efficient AI model for question generation
- **Dynamic Question Generation** - Difficulty-based adaptive content
- **Comprehensive Career Insights** - AI-powered recommendations with actionable plans
- **Rate Limiting Optimization** - Smart API call management (30 RPM limit)

### 📊 Database & Storage
- **Supabase** - PostgreSQL-based cloud database
- **Real-time Operations** - Fast CRUD operations with Supabase client
- **Scalable Architecture** - Cloud-native design for growth
- **Data Analytics** - User statistics and performance tracking

## 🛠️ Technology Stack

### Core Framework
- **Flask 3.0.0** - Lightweight WSGI web application framework
- **Gunicorn 21.2.0** - Production WSGI HTTP server
- **Python 3.x** - Modern Python runtime

### Database & Storage
- **Supabase 2.9.1** - PostgreSQL database with real-time capabilities
- **PostgreSQL** - Relational database (via Supabase)

### AI & Machine Learning
- **Google Generative AI 0.3.2** - Gemini AI SDK for question generation and insights

### Authentication & Security
- **PyJWT** - JSON Web Token implementation for Clerk integration
- **Python-dotenv 1.0.0** - Environment variable management
- **Flask-CORS 4.0.0** - Cross-Origin Resource Sharing support

### Utilities
- **Requests** - HTTP library for API calls
- **JSON** - Data serialization and parsing

## 📁 Project Structure

```
backend/
├── main.py                     # Main Flask application & API routes
├── db.py                       # Supabase database manager
├── user_supabase.py           # User operations & profile management
├── user.py                     # Legacy SQLite user module (deprecated)
├── verify_setup.py            # Environment setup verification script
├── requirements.txt           # Python dependencies
├── .env                       # Environment variables (not in repo)
├── __pycache__/              # Python cache files
└── README.md                  # This file
```

## 🗄️ Database Schema

### Tables

#### `users`
Stores user information synced from Clerk authentication.
```sql
- id (UUID, Primary Key)
- clerk_id (String, Unique) - Clerk authentication ID
- name (String) - Full name
- email (String, Unique) - Email address
- degree (String) - Education level (default: 'B.Tech')
- created_at (Timestamp)
- updated_at (Timestamp)
```

#### `quiz_sessions`
Stores quiz configuration and session information.
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key -> users)
- difficulty (String) - easy/moderate/hard
- language (String) - Programming language
- supports_oop (Boolean) - OOP support flag
- started_at (Timestamp)
```

#### `quiz_questions`
Stores individual questions for each quiz session.
```sql
- id (UUID, Primary Key)
- quiz_id (UUID, Foreign Key -> quiz_sessions)
- question (Text) - Question text
- options (JSON) - Array of 4 options
- correct_answer (Integer) - Index (0-3)
- category (String) - os/dbms/networks/aptitude/verbal/programming
- explanation (Text) - Answer explanation
```

#### `results`
Stores quiz results and performance analytics.
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key -> users)
- quiz_id (UUID, Foreign Key -> quiz_sessions)
- total_score (Integer) - Correct answers count
- programming_score (Float) - Programming domain score
- analytics_score (Float) - Analytics domain score
- testing_score (Float) - Testing domain score
- recommended_domain (String) - AI-recommended career path
- ai_insights (JSON) - Comprehensive AI-generated insights
- completed_at (Timestamp)
```

## 🚀 Getting Started

### Prerequisites
- **Python 3.8+** installed
- **Supabase Account** with a project created
- **Google Cloud Account** with Gemini API access
- **Clerk Account** for authentication
- **pip** package manager

### Installation

1. **Clone the repository**
```bash
cd backend
```

2. **Create virtual environment**
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment variables**
Create a `.env` file in the backend directory:
```env
# Flask Configuration
SECRET_KEY=your-secret-key-here
FLASK_ENV=development
PORT=5000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Clerk Authentication
CLERK_SECRET_KEY=your-clerk-secret-key
CLERK_FRONTEND_API=your-clerk-domain.clerk.accounts.dev
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
```

5. **Set up Supabase database**
Run the SQL schema in your Supabase SQL Editor (see Database Setup section below).

6. **Verify setup**
```bash
python verify_setup.py
```

7. **Run development server**
```bash
python main.py
```

The API will be available at `http://localhost:5000`

### Production Deployment

```bash
gunicorn main:app --bind 0.0.0.0:5000 --workers 4
```

## 📋 Database Setup

### Supabase SQL Schema

Run this SQL in your Supabase SQL Editor to create all tables:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    degree TEXT DEFAULT 'B.Tech',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz sessions table
CREATE TABLE quiz_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    difficulty TEXT NOT NULL,
    language TEXT NOT NULL,
    supports_oop BOOLEAN DEFAULT false,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz questions table
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSON NOT NULL,
    correct_answer INTEGER NOT NULL,
    category TEXT NOT NULL,
    explanation TEXT
);

-- Results table
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    total_score INTEGER NOT NULL,
    programming_score FLOAT DEFAULT 0,
    analytics_score FLOAT DEFAULT 0,
    testing_score FLOAT DEFAULT 0,
    recommended_domain TEXT,
    ai_insights JSON,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX idx_results_user_id ON results(user_id);
CREATE INDEX idx_results_quiz_id ON results(quiz_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow service role to bypass)
-- Users can read their own data
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid()::text = clerk_id);

-- Quiz sessions: users can view their own
CREATE POLICY "Users can view own quiz sessions" ON quiz_sessions
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- Quiz questions: users can view questions from their sessions
CREATE POLICY "Users can view own quiz questions" ON quiz_questions
    FOR SELECT USING (quiz_id IN (
        SELECT id FROM quiz_sessions WHERE user_id IN (
            SELECT id FROM users WHERE clerk_id = auth.uid()::text
        )
    ));

-- Results: users can view their own results
CREATE POLICY "Users can view own results" ON results
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));
```

## 🔌 API Endpoints

### Authentication Endpoints

#### `POST /api/auth/sync`
Sync Clerk user to database.
```json
Request:
{
  "clerk_id": "user_xxx",
  "email": "user@example.com",
  "name": "John Doe"
}

Response:
{
  "message": "User synced successfully",
  "user": {
    "id": "uuid",
    "clerk_id": "user_xxx",
    "name": "John Doe",
    "email": "user@example.com",
    "degree": "B.Tech"
  }
}
```

#### `GET /api/auth/me`
Get current authenticated user.
```json
Headers:
Authorization: Bearer <jwt_token>

Response:
{
  "user": {
    "id": "uuid",
    "clerk_id": "user_xxx",
    "name": "John Doe",
    "email": "user@example.com"
  }
}
```

### Quiz Endpoints

#### `POST /api/quiz/generate`
Generate a new quiz with 30 questions.
```json
Headers:
Authorization: Bearer <jwt_token>

Request:
{
  "difficulty": "moderate",  // easy/moderate/hard
  "language": "python"       // python/java/javascript/cpp/csharp/go/ruby/php
}

Response:
{
  "quiz_id": "uuid",
  "questions": [
    {
      "id": "uuid",
      "question": "What is a process?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correct_answer": 0,
      "category": "os",
      "explanation": "Explanation text"
    }
    // ... 29 more questions
  ],
  "total": 30
}
```

#### `POST /api/quiz/submit`
Submit quiz answers and get results.
```json
Headers:
Authorization: Bearer <jwt_token>

Request:
{
  "quiz_id": "uuid",
  "answers": {
    "question_uuid_1": 0,
    "question_uuid_2": 2,
    "question_uuid_3": 1
    // ... all answers
  }
}

Response:
{
  "result_id": "uuid",
  "total_score": 24,
  "total_questions": 30,
  "percentage": 80,
  "domain_scores": {
    "programming": 35.5,
    "analytics": 28.0,
    "testing": 22.5,
    "technical": 18.0
  },
  "recommended_domain": "programming",
  "category_breakdown": {
    "os": {"correct": 4, "total": 5},
    "dbms": {"correct": 5, "total": 5},
    "networks": {"correct": 3, "total": 5},
    "aptitude": {"correct": 4, "total": 5},
    "verbal": {"correct": 4, "total": 5},
    "programming": {"correct": 4, "total": 5}
  },
  "question_results": [
    {
      "id": "uuid",
      "question": "What is...",
      "options": ["A", "B", "C", "D"],
      "user_answer": 1,
      "correct_answer": 1,
      "is_correct": true,
      "category": "os",
      "explanation": "..."
    }
    // ... all questions
  ],
  "ai_insights": {
    "overview": {
      "summary": "...",
      "key_takeaway": "..."
    },
    "strengths": ["...", "..."],
    "improvements": ["...", "..."],
    "career_paths": [...],
    "action_plan": [...],
    "learning_resources": [...]
  }
}
```

### Profile Endpoints

#### `GET /api/profile`
Get user profile with statistics.
```json
Headers:
Authorization: Bearer <jwt_token>

Response:
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "degree": "B.Tech"
  },
  "stats": {
    "total_attempts": 5,
    "average_score": 23.4,
    "best_score": 27,
    "latest_domain": "Programmer/Developer"
  },
  "domain_recommendations": {
    "programming": 3,
    "analytics": 1,
    "testing": 1
  },
  "recent_results": [...]
}
```

#### `PUT /api/profile/update`
Update user profile.
```json
Headers:
Authorization: Bearer <jwt_token>

Request:
{
  "degree": "M.Tech",
  "name": "John Smith"
}

Response:
{
  "message": "Profile updated successfully"
}
```

#### `GET /api/profile/attempts`
Get user quiz attempt history.
```json
Headers:
Authorization: Bearer <jwt_token>

Response:
{
  "attempts": [
    {
      "id": "uuid",
      "quiz_id": "uuid",
      "total_score": 24,
      "percentage": 80,
      "recommended_domain": "programming",
      "difficulty": "moderate",
      "language": "python",
      "completed_at": "2026-01-31T10:30:00Z"
    }
    // ... more attempts
  ]
}
```

### Public Endpoints

#### `GET /api/results/<result_id>`
Get shared result details (public, no auth required).
```json
Response:
{
  "result_id": "uuid",
  "user_name": "John Doe",
  "total_score": 24,
  "total_questions": 30,
  "percentage": 80,
  "domain_scores": {...},
  "recommended_domain": "programming",
  "ai_insights": {...},
  "created_at": "2026-01-31T10:30:00Z"
}
```

#### `GET /api/health`
Health check endpoint.
```json
Response:
{
  "status": "ok",
  "message": "Backend is running with Supabase",
  "timestamp": "2026-01-31T10:30:00Z"
}
```

## 🤖 AI Question Generation

### Question Categories
The system generates 5 questions each for:
1. **Operating Systems** - Processes, memory management, scheduling
2. **Database Management** - SQL, normalization, transactions, ACID
3. **Computer Networks** - TCP/IP, protocols, routing, OSI model
4. **Aptitude** - Logic, mathematics, reasoning
5. **Verbal** - Grammar, comprehension, vocabulary
6. **Programming** - Language-specific syntax, algorithms, data structures

### Difficulty Levels
- **Easy**: Beginner-friendly questions, basic concepts
- **Moderate**: Intermediate level, requires good understanding
- **Hard**: Advanced concepts, complex problem-solving

### Rate Limiting
- **Gemini 2.0 Flash Lite**: 30 requests per minute (RPM)
- **Implementation**: 2.5-second wait between API calls
- **Optimization**: All 30 questions generated in a single API call

## 🔒 Security Features

### Authentication
- **JWT Token Verification** - Validates Clerk-issued tokens
- **Bearer Token Header** - Secure token transmission
- **Protected Routes** - `@require_auth` decorator for secure endpoints

### CORS Configuration
- **Cross-Origin Support** - Configured for frontend integration
- **Credentials Support** - Handles authenticated requests
- **Flexible Origins** - Development and production ready

### Environment Variables
- **Sensitive Data Protection** - All keys in environment variables
- **No Hardcoded Secrets** - Security best practices
- **Development/Production Modes** - Configurable security levels

## 📊 Scoring Algorithm

### Domain Score Calculation
```python
# Programming Domain
- Programming questions: +3.5 points
- Technical questions: +1.0 point

# Analytics Domain
- Aptitude/Verbal questions: +3.0 points
- Technical questions: +1.5 points

# Testing Domain
- Aptitude/Verbal questions: +1.5 points
- Technical questions: +2.0 points

# Technical Domain
- Programming questions: +1.0 point
- Technical questions: +2.5 points
```

### Career Recommendations
Based on highest domain score:
- **Programming** → Programmer/Developer
- **Analytics** → Data Analyst
- **Testing** → QA/Testing Engineer
- **Technical** → Technical Support/Engineering

## 🎯 AI Insights Generation

### Insight Categories

#### 1. Overview
- Performance summary
- Key takeaways
- Motivational message

#### 2. Strengths
- Identified strong areas
- Skills demonstrated
- Positive attributes

#### 3. Areas for Improvement
- Specific topics to focus on
- Actionable suggestions
- Learning priorities

#### 4. Career Paths
- 3-4 recommended roles
- Detailed job descriptions
- Growth potential
- Learning resources with URLs

#### 5. Action Plan
- **Immediate (0-3 months)**: Quick wins and fundamentals
- **Short-term (3-6 months)**: Skill building and projects
- **Long-term (6-12 months)**: Advanced topics and certifications

#### 6. Learning Resources
- Courses with platform URLs
- Practice platforms
- Books and articles
- Communities and forums
- Official documentation

## 🐛 Debugging & Logging

### Log Levels
```python
print(f"✓ Success message")      # Success
print(f"🔄 Processing...")        # In progress
print(f"⏳ Waiting...")          # Rate limiting
print(f"❌ Error: {e}")          # Errors
print(f"📊 Statistics")          # Analytics
```

### Debug Mode
Set `FLASK_ENV=development` in `.env` for:
- Detailed error messages
- Auto-reload on code changes
- Relaxed token verification

### Common Issues

**Issue**: Gemini API rate limit exceeded
- **Solution**: Increase `API_CALL_INTERVAL` to 3.0 seconds
- Check API quota in Google Cloud Console

**Issue**: Supabase connection failed
- **Solution**: Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Check Supabase project status

**Issue**: Authentication failed
- **Solution**: Verify Clerk configuration
- Check JWT token format in Authorization header

**Issue**: Quiz generation incomplete (< 20 questions)
- **Solution**: API timeout or rate limit
- User should retry after 30 seconds
- Consider upgrading Gemini API tier

## ⚡ Performance Optimizations

### Database Optimizations
- **Indexed Columns**: clerk_id, email, user_id, quiz_id
- **Bulk Inserts**: 30 questions inserted in one operation
- **Connection Pooling**: Supabase client handles pooling
- **Cascade Deletes**: Automatic cleanup of related records

### API Optimizations
- **Single AI Call**: All 30 questions in one request
- **Rate Limit Management**: Smart waiting between calls
- **JSON Parsing**: Efficient data serialization
- **Parallel Queries**: Multiple Supabase queries when possible

### Caching Opportunities (Future)
- Cache frequently generated questions
- Store common quiz configurations
- Cache user statistics

## 🧪 Testing

### Manual Testing
```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Test authentication (with valid token)
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/auth/me

# Test quiz generation
curl -X POST http://localhost:5000/api/quiz/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"difficulty":"moderate","language":"python"}'
```

### Verification Script
```bash
python verify_setup.py
```

This checks:
- All environment variables present
- Supabase connectivity
- Gemini API key validity
- Required dependencies installed

## 🚀 Deployment

### Deployment Platforms

#### Render.com
```yaml
# render.yaml
services:
  - type: web
    name: career-guidance-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn main:app
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
```

#### Heroku
```bash
# Procfile
web: gunicorn main:app
```

#### Railway
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "gunicorn main:app --bind 0.0.0.0:$PORT"
  }
}
```

### Environment Variables for Production
Set all variables from `.env` in your hosting platform's dashboard.

### Production Checklist
- [ ] Set `FLASK_ENV=production`
- [ ] Use `SUPABASE_SERVICE_KEY` for bypassing RLS
- [ ] Configure proper CORS origins
- [ ] Set up monitoring and logging
- [ ] Enable HTTPS
- [ ] Configure rate limiting middleware
- [ ] Set up database backups
- [ ] Monitor Gemini API usage

## 📈 Monitoring & Analytics

### Key Metrics to Track
- API response times
- Quiz generation success rate
- Gemini API usage and quotas
- Database query performance
- User authentication success rate
- Error rates by endpoint

### Logging Best Practices
- Log all API requests
- Track quiz completion rates
- Monitor AI insight generation
- Log authentication failures

## 🔮 Future Enhancements

- [ ] Redis caching for questions and results
- [ ] WebSocket support for real-time quiz updates
- [ ] Advanced analytics dashboard
- [ ] Multi-language support for questions
- [ ] Question difficulty calibration system
- [ ] Peer comparison and leaderboards
- [ ] Admin dashboard for content management
- [ ] Automated testing suite
- [ ] GraphQL API option
- [ ] Machine learning model for career predictions
- [ ] Integration with job boards

## 📚 Dependencies Documentation

### Core Dependencies
- **Flask**: https://flask.palletsprojects.com/
- **Supabase Python**: https://supabase.com/docs/reference/python
- **Google Generative AI**: https://ai.google.dev/docs

### Authentication
- **Clerk**: https://clerk.com/docs

### Deployment
- **Gunicorn**: https://gunicorn.org/

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Install dev dependencies
4. Make your changes
5. Test thoroughly
6. Submit a pull request

### Code Style
- Follow PEP 8 guidelines
- Use type hints where possible
- Add docstrings to functions
- Keep functions focused and small
- Comment complex logic

## 📄 License

This project is part of the Smart Career Guidance System.

## 👥 Support

For issues, questions, or contributions, please contact the development team.

---

**Built with ❤️ using Flask, Supabase, and Google Gemini AI**
