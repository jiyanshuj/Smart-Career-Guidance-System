from flask import Flask, request, jsonify       
from flask_cors import CORS
from datetime import datetime
import os
import json
import time
import google.generativeai as genai
from db import db, init_db
from user_supabase import User
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
CORS(app, supports_credentials=True, origins=["*"])

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

genai.configure(api_key=GEMINI_API_KEY)

# Initialize database (just prints message for Supabase)
init_db()

# Rate limiting for gemini-2.0-flash-lite (30 RPM = 2 seconds between calls)
last_api_call_time = 0
API_CALL_INTERVAL = 2.5  # 2.5 seconds to be safe with 30 RPM limit

def wait_for_rate_limit():
    """Wait to respect gemini-2.0-flash-lite's 30 RPM rate limit"""
    global last_api_call_time
    current_time = time.time()
    time_since_last = current_time - last_api_call_time
    
    if time_since_last < API_CALL_INTERVAL:
        wait_time = API_CALL_INTERVAL - time_since_last
        print(f"⏳ Rate limiting: waiting {wait_time:.1f}s...")
        time.sleep(wait_time)
    
    last_api_call_time = time.time()

# ==================== AUTH MIDDLEWARE ====================

def verify_clerk_token():
    """Verify Clerk authentication token from header"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split('Bearer ')[1]
    
    if os.getenv('FLASK_ENV') == 'development':
        try:
            import jwt
            decoded = jwt.decode(token, options={"verify_signature": False})
            clerk_user_id = decoded.get('sub')
            if clerk_user_id:
                return clerk_user_id
        except Exception as e:
            print(f"Token decode error: {e}")
            return None
    
    try:
        import jwt
        import requests
        from urllib.parse import urlparse
        
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            issuer = unverified.get('iss', '')
            if issuer:
                parsed = urlparse(issuer)
                clerk_domain = parsed.netloc
            else:
                clerk_domain = os.getenv('CLERK_FRONTEND_API', 'clerk.example.com')
        except:
            clerk_domain = os.getenv('CLERK_FRONTEND_API', 'clerk.example.com')
        
        jwks_url = f"https://{clerk_domain}/.well-known/jwks.json"
        jwks_response = requests.get(jwks_url, timeout=5)
        jwks = jwks_response.json()
        
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
        
        if rsa_key:
            payload = jwt.decode(token, rsa_key, algorithms=["RS256"])
            return payload.get('sub')
        
    except Exception as e:
        print(f"Token verification error: {e}")
        return None
    
    return None

def require_auth(f):
    """Decorator to require authentication"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        clerk_id = verify_clerk_token()
        if not clerk_id:
            return jsonify({'error': 'Not authenticated'}), 401
        request.clerk_user_id = clerk_id
        return f(*args, **kwargs)
    return decorated_function

# ==================== AUTH ROUTES ====================

@app.route('/api/auth/sync', methods=['POST'])
def sync_user():
    """Sync Clerk user to Supabase database"""
    data = request.json
    clerk_id = data.get('clerk_id')
    email = data.get('email')
    name = data.get('name')
    
    if not all([clerk_id, email, name]):
        return jsonify({'error': 'Missing required fields: clerk_id, email, name'}), 400
    
    user = User.sync_clerk_user(clerk_id, email, name)
    
    if user:
        return jsonify({
            'message': 'User synced successfully',
            'user': user
        }), 200
    
    return jsonify({'error': 'Failed to sync user'}), 500

@app.route('/api/auth/me', methods=['GET'])
@require_auth
def get_current_user():
    """Get current authenticated user"""
    user = User.get_by_clerk_id(request.clerk_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'user': user}), 200

# ==================== QUIZ ROUTES ====================

@app.route('/api/quiz/generate', methods=['POST'])
@require_auth
def generate_quiz():
    """Generate quiz - SINGLE API call optimized for 2 RPM limit"""
    data = request.json or {}
    difficulty = data.get('difficulty', 'moderate')
    language = data.get('language', 'python')

    print(f"\n{'='*60}")
    print(f"🎯 Generating quiz: {difficulty} difficulty, {language}")
    print(f"{'='*60}\n")

    try:
        oop_languages = ['python', 'java', 'cpp', 'javascript', 'csharp', 'go', 'ruby']
        supports_oop = language.lower() in oop_languages

        user = User.get_by_clerk_id(request.clerk_user_id)
        if not user:
            return jsonify({'error': 'User not found. Please try logging in again.'}), 404

        print(f"✓ User: {user['name']} (ID: {user['id']})")

        # Generate ALL 30 questions in ONE call
        all_questions = generate_all_questions_optimized(difficulty, language, supports_oop)

        if len(all_questions) < 20:
            print(f"❌ Only generated {len(all_questions)} questions, need at least 20")
            return jsonify({'error': 'Failed to generate sufficient questions. Please try again in 30 seconds.'}), 500

        # Create quiz session in Supabase
        quiz_session = db.create_quiz_session(
            user_id=user['id'],
            difficulty=difficulty,
            language=language,
            supports_oop=supports_oop
        )

        if not quiz_session:
            return jsonify({'error': 'Failed to create quiz session'}), 500

        quiz_id = quiz_session['id']

        # Prepare questions for bulk insert
        questions_to_insert = []
        for q in all_questions:
            questions_to_insert.append({
                'quiz_id': quiz_id,
                'question': q['question'],
                'options': json.dumps(q['options']),
                'correct_answer': q['correct_answer'],
                'category': q['category'],
                'explanation': q.get('explanation', '')
            })

        # Bulk insert questions
        success = db.add_quiz_questions_bulk(questions_to_insert)

        if not success:
            return jsonify({'error': 'Failed to store quiz questions'}), 500

        # Retrieve stored questions with their database IDs
        stored_questions = db.get_quiz_questions(quiz_id)

        # Format questions for response
        questions_with_db_ids = []
        for sq in stored_questions:
            questions_with_db_ids.append({
                'id': sq['id'],  # UUID from Supabase
                'question': sq['question'],
                'options': json.loads(sq['options']),
                'correct_answer': sq['correct_answer'],
                'category': sq['category'],
                'explanation': sq.get('explanation', '')
            })

        print(f"\n✅ Quiz {quiz_id} created with {len(questions_with_db_ids)} questions")
        print(f"   Sample question IDs: {[str(q['id'])[:8] for q in questions_with_db_ids[:5]]}")
        print(f"{'='*60}\n")

        return jsonify({
            'quiz_id': quiz_id,
            'questions': questions_with_db_ids,
            'total': len(questions_with_db_ids)
        }), 200

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to generate quiz', 'details': str(e)}), 500

@app.route('/api/quiz/submit', methods=['POST'])
@require_auth
def submit_quiz():
    """Submit quiz and get results"""
    data = request.json
    quiz_id = data.get('quiz_id')
    answers = data.get('answers', {})

    if not quiz_id:
        return jsonify({'error': 'quiz_id is required'}), 400

    # For Supabase, question IDs are UUIDs (strings)
    # Normalize answers to use string keys
    normalized_answers = {}
    for key, value in answers.items():
        normalized_answers[str(key)] = value

    print(f"\n🔍 Received submission:")
    print(f"   Quiz ID: {quiz_id}")
    print(f"   Original answers: {len(answers)} answers")
    print(f"   Normalized answers: {len(normalized_answers)} answers")
    print(f"   Sample answer keys: {list(normalized_answers.keys())[:5]}")

    user = User.get_by_clerk_id(request.clerk_user_id)
    
    if not user:
        return jsonify({'error': 'User not found. Please try logging in again.'}), 404
    
    try:
        result = evaluate_quiz_with_gemini(quiz_id, normalized_answers, user['id'])
        return jsonify(result), 200
    except Exception as e:
        print(f"❌ Error evaluating quiz: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to evaluate quiz', 'details': str(e)}), 500

# ==================== PROFILE ROUTES ====================

@app.route('/api/profile', methods=['GET'])
@require_auth
def get_profile():
    """Get user profile"""
    user = User.get_by_clerk_id(request.clerk_user_id)
    user_data = User.get_profile(user['id'])
    return jsonify(user_data), 200

@app.route('/api/profile/update', methods=['PUT'])
@require_auth
def update_profile():
    """Update user profile"""
    data = request.json
    user = User.get_by_clerk_id(request.clerk_user_id)
    success = User.update_profile(user['id'], data)
    
    if success:
        return jsonify({'message': 'Profile updated successfully'}), 200
    return jsonify({'error': 'Update failed'}), 400

@app.route('/api/profile/attempts', methods=['GET'])
@require_auth
def get_attempts():
    """Get quiz attempts"""
    user = User.get_by_clerk_id(request.clerk_user_id)
    attempts = User.get_attempts(user['id'])
    return jsonify({'attempts': attempts}), 200

# ==================== HEALTH CHECK ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'Backend is running with Supabase',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

# ==================== GEMINI AI FUNCTIONS ====================

def generate_all_questions_optimized(difficulty, language, supports_oop):
    """Generate all 30 questions in ONE call - optimized for gemini-2.0-flash-lite"""
    
    # Wait for rate limit
    wait_for_rate_limit()
    
    model = genai.GenerativeModel('gemini-2.0-flash-lite')
    
    diff_map = {
        'easy': 'easy',
        'moderate': 'medium',
        'hard': 'hard'
    }
    
    oop_text = "Include 2 OOP questions." if supports_oop else ""
    
    # Compact prompt optimized for flash-lite
    prompt = f"""Generate exactly 30 {diff_map[difficulty]} difficulty MCQs for technical placement test.

CATEGORIES (5 questions each):
• Operating Systems: processes, memory, scheduling
• Database Management: SQL, normalization, transactions
• Computer Networks: TCP/IP, protocols, routing
• Aptitude: logic, math, reasoning
• Verbal: grammar, comprehension
• {language} Programming: syntax, algorithms, data structures {oop_text}

Return ONLY valid JSON array:
[
  {{"question":"...","options":["...","...","...","..."],"correct_answer":0,"category":"os"}},
  {{"question":"...","options":["...","...","...","..."],"correct_answer":1,"category":"dbms"}},
  ...28 more
]

Requirements:
- Exactly 4 options per question
- correct_answer must be 0, 1, 2, or 3
- Keep questions concise (under 100 chars)
- Keep options short (under 50 chars each)
- NO markdown, NO explanations
- Return pure JSON only"""

    try:
        print("🔄 Generating 30 questions with gemini-2.0-flash-lite...")
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.9,
                top_p=0.95,
                max_output_tokens=8192,
            )
        )
        
        text = response.text.strip()
        print(f"📦 Received {len(text)} chars")
        
        # Clean JSON
        text = text.replace('```json', '').replace('```', '').strip()
        
        # Try to fix truncated JSON
        if not text.endswith(']'):
            # Find last complete question
            last_close_brace = text.rfind('}')
            if last_close_brace > 0:
                text = text[:last_close_brace+1] + ']'
                print("🔧 Fixed truncated JSON")
        
        # Parse JSON
        try:
            questions_data = json.loads(text)
        except json.JSONDecodeError as e:
            print(f"⚠️  JSON error at char {e.pos}, attempting repair...")
            # Try to salvage partial JSON
            for i in range(len(text)-1, max(0, len(text)-500), -1):
                try:
                    test_text = text[:i]
                    if test_text.endswith('}'):
                        test_text += ']'
                    elif test_text.endswith(','):
                        test_text = test_text[:-1] + ']'
                    questions_data = json.loads(test_text)
                    print(f"✓ Repaired JSON (salvaged {len(questions_data)} questions)")
                    break
                except:
                    continue
            else:
                raise
        
        if not isinstance(questions_data, list):
            raise ValueError(f"Expected array, got {type(questions_data)}")
        
        # Validate and format
        valid_questions = []
        category_count = {}
        
        for idx, q in enumerate(questions_data):
            if not validate_question_structure(q):
                print(f"⚠️  Q{idx+1} invalid")
                continue
            
            cat = q['category']
            category_count[cat] = category_count.get(cat, 0) + 1
            
            valid_questions.append({
                'id': f"{cat}_{category_count[cat]}",
                'question': str(q['question']).strip(),
                'options': [str(opt).strip() for opt in q['options'][:4]],
                'correct_answer': int(q['correct_answer']),
                'category': cat,
                'explanation': ''
            })
        
        print(f"✅ Generated {len(valid_questions)} valid questions")
        print(f"   Distribution: {category_count}")
        
        # Return what we have, fill rest with fallback if needed
        if len(valid_questions) >= 25:
            if len(valid_questions) < 30:
                print(f"   Adding {30-len(valid_questions)} fallback questions")
                fallback = generate_quality_fallback(language)
                return (valid_questions + fallback)[:30]
            return valid_questions[:30]
        else:
            print(f"⚠️  Only {len(valid_questions)} questions, using all fallback")
            return generate_quality_fallback(language)
            
    except Exception as e:
        print(f"❌ Generation failed: {e}")
        print("   Using fallback questions")
        return generate_quality_fallback(language)

def validate_question_structure(q):
    """Validate question has required fields and correct structure"""
    try:
        required = ['question', 'options', 'correct_answer', 'category']
        if not all(k in q for k in required):
            return False
        
        if not isinstance(q['options'], list) or len(q['options']) != 4:
            return False
        
        if q['correct_answer'] not in [0, 1, 2, 3]:
            return False
        
        if not q['question'] or not all(q['options']):
            return False
        
        return True
    except:
        return False

def generate_quality_fallback(language):
    """Generate high-quality fallback questions when API fails"""
    
    questions = []
    
    # OS Questions
    os_questions = [
        ("What is the primary purpose of an operating system?", 
         ["Manage hardware resources", "Edit documents", "Browse internet", "Play games"], 0),
        ("Which scheduling algorithm can cause starvation?",
         ["Priority Scheduling", "Round Robin", "FCFS", "SJF with aging"], 0),
        ("What is a deadlock in OS?",
         ["Circular wait for resources", "Process termination", "Memory leak", "CPU idle state"], 0),
        ("Virtual memory uses which storage?",
         ["Hard disk", "RAM only", "Cache only", "Registers"], 0),
        ("What is a critical section?",
         ["Code accessing shared resources", "Error handling code", "Main function", "Loop structure"], 0),
    ]
    
    for i, (q, opts, ans) in enumerate(os_questions):
        questions.append({
            'id': f'os_{i}', 'question': q, 'options': opts,
            'correct_answer': ans, 'category': 'os', 'explanation': ''
        })
    
    # DBMS Questions
    dbms_questions = [
        ("What is normalization in databases?",
         ["Removing redundancy", "Adding indexes", "Backing up data", "Encrypting data"], 0),
        ("Which SQL clause filters grouped data?",
         ["HAVING", "WHERE", "GROUP BY", "ORDER BY"], 0),
        ("ACID properties ensure what?",
         ["Transaction reliability", "Fast queries", "Data encryption", "User authentication"], 0),
        ("What is a foreign key?",
         ["References primary key of another table", "Primary key", "Unique constraint", "Index"], 0),
        ("Which JOIN returns all rows from both tables?",
         ["FULL OUTER JOIN", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN"], 0),
    ]
    
    for i, (q, opts, ans) in enumerate(dbms_questions):
        questions.append({
            'id': f'dbms_{i}', 'question': q, 'options': opts,
            'correct_answer': ans, 'category': 'dbms', 'explanation': ''
        })
    
    # Networks Questions
    net_questions = [
        ("What layer is TCP in OSI model?",
         ["Transport Layer", "Network Layer", "Application Layer", "Data Link Layer"], 0),
        ("Default HTTP port number is?",
         ["80", "443", "8080", "21"], 0),
        ("What does DNS do?",
         ["Converts domain names to IP", "Encrypts data", "Routes packets", "Assigns IP addresses"], 0),
        ("Which protocol is connectionless?",
         ["UDP", "TCP", "FTP", "HTTP"], 0),
        ("What is subnet mask used for?",
         ["Divide network into subnets", "Encrypt traffic", "Authenticate users", "Cache data"], 0),
    ]
    
    for i, (q, opts, ans) in enumerate(net_questions):
        questions.append({
            'id': f'networks_{i}', 'question': q, 'options': opts,
            'correct_answer': ans, 'category': 'networks', 'explanation': ''
        })
    
    # Aptitude Questions
    apt_questions = [
        ("If 20% of 150 is X, then X = ?",
         ["30", "25", "35", "40"], 0),
        ("Next in series: 2, 6, 12, 20, ?",
         ["30", "28", "32", "26"], 0),
        ("A train 100m long crosses a pole in 10 sec. Speed?",
         ["10 m/s", "100 m/s", "1 m/s", "50 m/s"], 0),
        ("If A:B = 2:3 and B:C = 4:5, then A:C = ?",
         ["8:15", "2:5", "3:5", "4:15"], 0),
        ("Average of 5 numbers is 20. If one number is 30, average of rest?",
         ["17.5", "20", "22.5", "15"], 0),
    ]
    
    for i, (q, opts, ans) in enumerate(apt_questions):
        questions.append({
            'id': f'aptitude_{i}', 'question': q, 'options': opts,
            'correct_answer': ans, 'category': 'aptitude', 'explanation': ''
        })
    
    # Verbal Questions
    verbal_questions = [
        ("Choose correct: He ___ to school every day.",
         ["goes", "go", "going", "gone"], 0),
        ("Synonym of 'Abundant':",
         ["Plentiful", "Scarce", "Limited", "Rare"], 0),
        ("Antonym of 'Ancient':",
         ["Modern", "Old", "Historic", "Traditional"], 0),
        ("Identify error: 'She don't like coffee.'",
         ["don't should be doesn't", "No error", "like should be likes", "coffee should be coffees"], 0),
        ("'Break the ice' means:",
         ["Start conversation", "Destroy something", "Cool down", "Make ice cubes"], 0),
    ]
    
    for i, (q, opts, ans) in enumerate(verbal_questions):
        questions.append({
            'id': f'verbal_{i}', 'question': q, 'options': opts,
            'correct_answer': ans, 'category': 'verbal', 'explanation': ''
        })
    
    # Programming Questions
    prog_questions = [
        (f"What is the time complexity of binary search in {language}?",
         ["O(log n)", "O(n)", "O(n²)", "O(1)"], 0),
        (f"Which data structure uses LIFO?",
         ["Stack", "Queue", "Array", "Tree"], 0),
        (f"What does 'return' keyword do in {language}?",
         ["Exits function with value", "Loops back", "Throws error", "Prints output"], 0),
        (f"Array indexing in {language} starts from?",
         ["0", "1", "-1", "Depends on declaration"], 0),
        (f"What is recursion in {language}?",
         ["Function calling itself", "Loop structure", "Variable declaration", "Error handling"], 0),
    ]
    
    for i, (q, opts, ans) in enumerate(prog_questions):
        questions.append({
            'id': f'programming_{i}', 'question': q, 'options': opts,
            'correct_answer': ans, 'category': 'programming', 'explanation': ''
        })
    
    print(f"📚 Using {len(questions)} fallback questions")
    return questions

def evaluate_quiz_with_gemini(quiz_id, answers, user_id):
    """Evaluate quiz with detailed question-by-question analysis"""
    
    questions = db.get_quiz_questions(quiz_id)

    print(f"\n{'='*60}")
    print(f"📊 Evaluating Quiz {quiz_id}")
    print(f"{'='*60}")
    print(f"Total questions: {len(questions)}")
    print(f"User answers received: {len(answers)}")

    scores = {'programming': 0, 'analytics': 0, 'testing': 0, 'technical': 0}
    total_correct = 0
    category_correct = {}
    
    # NEW: Detailed question results
    question_results = []

    for q in questions:
        q_id = str(q['id'])
        question_text = q['question']
        options = json.loads(q['options']) if isinstance(q['options'], str) else q['options']
        correct_answer = q['correct_answer']
        category = q['category']
        explanation = q.get('explanation', '')

        user_answer = answers.get(q_id)

        if category not in category_correct:
            category_correct[category] = {'correct': 0, 'total': 0}

        category_correct[category]['total'] += 1
        is_correct = (user_answer == correct_answer)

        # Store detailed question result
        question_results.append({
            'id': q_id,
            'question': question_text,
            'options': options,
            'user_answer': user_answer,
            'correct_answer': correct_answer,
            'is_correct': is_correct,
            'category': category,
            'explanation': explanation
        })

        if is_correct:
            total_correct += 1
            category_correct[category]['correct'] += 1

            # Scoring logic
            if category in ['programming', 'python programming', 'python', 'python_programming']:
                scores['programming'] += 3.5
                scores['technical'] += 1
            elif category in ['aptitude', 'verbal']:
                scores['analytics'] += 3
                scores['testing'] += 1.5
            elif category in ['os', 'dbms', 'networks', 'network', 'computer networks', 'computer_networks']:
                scores['technical'] += 2.5
                scores['testing'] += 2
                scores['programming'] += 1

    print(f"\n✅ Correct answers: {total_correct}/{len(questions)}")
    print(f"📈 Category breakdown: {category_correct}")
    print(f"🎯 Domain scores: {scores}")
    print(f"{'='*60}\n")

    max_score = max(scores.values()) if scores.values() else 0
    recommended_domain = [k for k, v in scores.items() if v == max_score][0] if max_score > 0 else 'programming'

    # Generate comprehensive insights
    insights = generate_comprehensive_insights(scores, total_correct, recommended_domain, category_correct)

    domain_names = {
        'programming': 'Programmer/Developer',
        'analytics': 'Analytics',
        'testing': 'Software Testing (QA)',
        'technical': 'Technical Support/Engineering'
    }

    # Save result to Supabase
    result = db.save_result(
        user_id=user_id,
        quiz_id=quiz_id,
        total_score=total_correct,
        programming_score=scores['programming'],
        analytics_score=scores['analytics'],
        testing_score=scores['testing'],
        recommended_domain=recommended_domain,
        ai_insights=json.dumps(insights)
    )

    result_id = result['id'] if result else None

    return {
        'result_id': result_id,
        'total_score': total_correct,
        'total_questions': len(questions),
        'percentage': round((total_correct / len(questions)) * 100, 2) if questions else 0,
        'domain_scores': scores,
        'recommended_domain': domain_names.get(recommended_domain, recommended_domain),
        'category_breakdown': category_correct,
        'question_results': question_results,  # NEW: Detailed results
        'ai_insights': insights
    }

def generate_comprehensive_insights(scores, total_correct, domain, category_correct):
    """Generate comprehensive career insights with all sections"""
    
    wait_for_rate_limit()
    
    model = genai.GenerativeModel('gemini-2.0-flash-lite')
    
    prompt = f"""Generate comprehensive career guidance for quiz results:
Score: {total_correct}/30 ({round(total_correct/30*100)}%)
Recommended Domain: {domain}
Domain Scores: {json.dumps(scores)}
Category Performance: {json.dumps(category_correct)}

Return valid JSON with these sections:
{{
  "overview": {{
    "summary": "2-3 sentence overview of performance",
    "key_takeaway": "Main insight"
  }},
  "strengths": ["3-4 specific strengths"],
  "improvements": ["3-4 actionable improvements"],
  "career_paths": [
    {{"title": "Primary Role", "description": "Why suitable", "growth": "Career growth potential"}},
    {{"title": "Secondary Role", "description": "Alternative path", "growth": "Growth outlook"}},
    {{"title": "Emerging Role", "description": "Future opportunity", "growth": "Long-term potential"}}
  ],
  "action_plan": [
    {{"phase": "Immediate (0-3 months)", "actions": ["action1", "action2", "action3"]}},
    {{"phase": "Short-term (3-6 months)", "actions": ["action1", "action2", "action3"]}},
    {{"phase": "Long-term (6-12 months)", "actions": ["action1", "action2", "action3"]}}
  ],
  "learning_resources": [
    {{"type": "Course", "title": "Resource name", "platform": "Platform", "focus": "What it teaches"}},
    {{"type": "Practice", "title": "Practice platform", "platform": "Website", "focus": "Skills to build"}},
    {{"type": "Book/Article", "title": "Reading material", "platform": "Where to find", "focus": "Knowledge area"}},
    {{"type": "Project", "title": "Project idea", "platform": "How to build", "focus": "Skills applied"}}
  ]
}}"""

    try:
        print("🔄 Generating comprehensive insights...")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.8,
                max_output_tokens=2048,
            )
        )
        
        text = response.text.strip().replace('```json', '').replace('```', '').strip()
        insights = json.loads(text)
        print("✓ Comprehensive insights generated")
        return insights
        
    except Exception as e:
        print(f"⚠️  Insights fallback: {e}")
        return get_fallback_insights(domain, total_correct)

def get_fallback_insights(domain, score):
    """Fallback insights if API fails"""
    percentage = round((score / 30) * 100)
    
    return {
        "overview": {
            "summary": f"You scored {score}/30 ({percentage}%), showing strong potential in {domain}. Your performance indicates good foundational knowledge with room for growth.",
            "key_takeaway": "Focus on consistent practice and targeted learning to excel in your chosen field."
        },
        "strengths": [
            "Strong problem-solving mindset",
            "Good grasp of fundamental concepts",
            "Ability to work under timed conditions",
            "Diverse skill set across multiple domains"
        ],
        "improvements": [
            "Practice more coding challenges daily",
            "Deep dive into advanced topics",
            "Work on time management strategies",
            "Build real-world projects to apply knowledge"
        ],
        "career_paths": [
            {
                "title": "Software Developer",
                "description": "Build applications and solve complex problems with code",
                "growth": "High demand with excellent salary growth potential"
            },
            {
                "title": "Quality Assurance Engineer",
                "description": "Ensure software quality through testing and automation",
                "growth": "Stable career with growing automation opportunities"
            },
            {
                "title": "Technical Analyst",
                "description": "Bridge gap between business and technology teams",
                "growth": "Versatile role with transition to various tech positions"
            }
        ],
        "action_plan": [
            {
                "phase": "Immediate (0-3 months)",
                "actions": [
                    "Solve 2-3 LeetCode problems daily",
                    "Complete one online course in your domain",
                    "Build a portfolio project"
                ]
            },
            {
                "phase": "Short-term (3-6 months)",
                "actions": [
                    "Contribute to open-source projects",
                    "Attend tech meetups and networking events",
                    "Master one programming framework deeply"
                ]
            },
            {
                "phase": "Long-term (6-12 months)",
                "actions": [
                    "Prepare for technical interviews at target companies",
                    "Build 2-3 significant portfolio projects",
                    "Consider relevant certifications in your field"
                ]
            }
        ],
        "learning_resources": [
            {
                "type": "Course",
                "title": "CS50 - Introduction to Computer Science",
                "platform": "Harvard/edX",
                "focus": "Strong programming fundamentals"
            },
            {
                "type": "Practice",
                "title": "LeetCode Premium",
                "platform": "leetcode.com",
                "focus": "Algorithm and data structure mastery"
            },
            {
                "type": "Book",
                "title": "Cracking the Coding Interview",
                "platform": "Amazon/Library",
                "focus": "Interview preparation and problem-solving"
            },
            {
                "type": "Project",
                "title": "Build a Full-Stack Application",
                "platform": "GitHub",
                "focus": "End-to-end development skills"
            }
        ]
    }


# ==================== NEW ENDPOINT FOR SHARE RESULTS ====================

@app.route('/api/results/<result_id>', methods=['GET'])
def get_result_details(result_id):
    """Get detailed results for sharing - public endpoint"""
    try:
        result = db.get_result_by_id(result_id)
        
        if not result:
            return jsonify({'error': 'Result not found'}), 404
        
        # Get user info
        user = User.get_by_id(result['user_id'])
        
        # Get quiz questions for detailed breakdown
        quiz_id = result['quiz_id']
        questions = db.get_quiz_questions(quiz_id)
        
        # Parse AI insights
        ai_insights = json.loads(result['ai_insights']) if result.get('ai_insights') else None
        
        return jsonify({
            'result_id': result['id'],
            'user_name': user['name'] if user else 'Anonymous',
            'quiz_id': quiz_id,
            'total_score': result['total_score'],
            'total_questions': len(questions),
            'percentage': round((result['total_score'] / len(questions)) * 100, 2) if questions else 0,
            'domain_scores': {
                'programming': result['programming_score'],
                'analytics': result['analytics_score'],
                'testing': result['testing_score'],
                'technical': result.get('technical_score', 0)
            },
            'recommended_domain': result['recommended_domain'],
            'ai_insights': ai_insights,
            'created_at': result['created_at']
        }), 200
        
    except Exception as e:
        print(f"❌ Error fetching result: {e}")
        return jsonify({'error': 'Failed to fetch result'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=os.getenv('FLASK_ENV') == 'development', port=port, host='0.0.0.0')
