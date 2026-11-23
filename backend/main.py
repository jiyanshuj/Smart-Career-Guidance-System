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
    difficulty = normalize_difficulty(data.get('difficulty', 'moderate'))
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

import random

QUESTION_CATEGORIES = ['os', 'dbms', 'networks', 'aptitude', 'verbal', 'programming']
QUESTIONS_PER_CATEGORY = 5

VALID_DIFFICULTIES = ('easy', 'moderate', 'hard')


def normalize_difficulty(difficulty):
    """Normalize any incoming difficulty value to easy / moderate / hard"""
    d = str(difficulty or 'moderate').strip().lower()
    if d in ('medium', 'intermediate', 'mod'):
        d = 'moderate'
    if d not in VALID_DIFFICULTIES:
        d = 'moderate'
    return d


# Strict, per-level definition that is injected into the Gemini prompt
DIFFICULTY_PROFILES = {
    'easy': {
        'label': 'EASY (beginner / fresher level)',
        'rules': (
            "- Direct definition or recall questions; single concept; no multi-step thinking.\n"
            "- Aptitude: one-step arithmetic (percentages, simple ratios, simple averages).\n"
            "- Verbal: basic grammar, common synonyms/antonyms, simple everyday idioms.\n"
            "- Programming: basic syntax, data types, loops, simple output questions.\n"
            "- Wrong options must be clearly different from the correct one."
        ),
        'examples': (
            "  os: \"Which of these is an operating system?\"\n"
            "  aptitude: \"What is 25% of 200?\"\n"
            "  programming: \"Which keyword is used to define a function?\""
        ),
    },
    'moderate': {
        'label': 'MODERATE (intermediate / campus placement level)',
        'rules': (
            "- Needs conceptual understanding and application, 2 reasoning steps at most.\n"
            "- OS/DBMS/Networks: comparisons between concepts, normal forms, scheduling, protocols, SQL behaviour.\n"
            "- Aptitude: work-time, profit-loss, probability, number series with 2 steps.\n"
            "- Verbal: sentence correction, contextual vocabulary, idioms.\n"
            "- Programming: time complexity, common data structures, output of short code, recursion.\n"
            "- Wrong options must be plausible and close to the correct one."
        ),
        'examples': (
            "  os: \"Which page replacement algorithm suffers from Belady's anomaly?\"\n"
            "  aptitude: \"A can finish a job in 12 days and B in 18 days. How long together?\"\n"
            "  programming: \"What is the worst-case time complexity of quicksort?\""
        ),
    },
    'hard': {
        'label': 'HARD (advanced / top-tier company interview level)',
        'rules': (
            "- Requires multi-step reasoning, calculation or edge-case analysis; NO simple definitions.\n"
            "- OS/DBMS/Networks: numerical problems (EMAT, page-fault rate, subnetting, window sizes), "
            "candidate keys / normal-form analysis, concurrency control, deadlock analysis, protocol internals.\n"
            "- Aptitude: permutations/combinations, compound interest, mixtures, relative speed, algebraic identities.\n"
            "- Verbal: advanced vocabulary, subtle grammar (conditionals, subjunctive), idioms from literature/history.\n"
            "- Programming: advanced algorithms and data structures, amortized and space complexity, "
            "tricky code-tracing and edge cases.\n"
            "- All 4 options must be very close; common mistakes should be used as distractors."
        ),
        'examples': (
            "  os: \"3 processes each need at most 2 units of a resource. Minimum units that guarantee no deadlock?\"\n"
            "  aptitude: \"If x + 1/x = 3, what is x^2 + 1/x^2?\"\n"
            "  programming: \"What is the time complexity of building a binary heap from n elements?\""
        ),
    },
}


def build_question_prompt(difficulty, language, supports_oop):
    profile = DIFFICULTY_PROFILES[difficulty]
    oop_text = " Include 2 OOP questions among the programming questions." if supports_oop else ""

    return f"""You are creating a technical placement test. Difficulty level: {profile['label']}.

Generate exactly 30 multiple choice questions. EVERY question must strictly match the {difficulty.upper()} level. Never mix in easier or harder questions.

DIFFICULTY RULES FOR {difficulty.upper()}:
{profile['rules']}

CALIBRATION EXAMPLES OF {difficulty.upper()} QUESTIONS:
{profile['examples']}

CATEGORIES (exactly {QUESTIONS_PER_CATEGORY} questions each, use these exact category keys):
- "os": Operating Systems (processes, memory, scheduling, deadlocks)
- "dbms": Database Management (SQL, normalization, transactions, indexing)
- "networks": Computer Networks (TCP/IP, protocols, routing, subnetting)
- "aptitude": Quantitative aptitude, logic and reasoning
- "verbal": Grammar, vocabulary, comprehension
- "programming": {language} programming (syntax, algorithms, data structures).{oop_text}

Return ONLY a valid JSON array in this format:
[
  {{"question":"...","options":["...","...","...","..."],"correct_answer":0,"category":"os"}},
  ...29 more
]

Requirements:
- Exactly 4 options per question, only one correct
- correct_answer must be 0, 1, 2, or 3 and the correct answer position must vary across questions
- Questions under 150 chars, options under 60 chars each
- No duplicate questions
- NO markdown, NO explanations, pure JSON only"""


def _parse_questions_json(text):
    """Parse (and repair if truncated) the JSON array returned by Gemini"""
    text = text.replace('```json', '').replace('```', '').strip()

    # Trim anything before the first '[' / after the last ']'
    start = text.find('[')
    if start > 0:
        text = text[start:]

    if not text.endswith(']'):
        last_close_brace = text.rfind('}')
        if last_close_brace > 0:
            text = text[:last_close_brace + 1] + ']'
            print("🔧 Fixed truncated JSON")

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"⚠️  JSON error at char {e.pos}, attempting repair...")
        for i in range(len(text) - 1, max(0, len(text) - 500), -1):
            try:
                test_text = text[:i]
                if test_text.endswith('}'):
                    test_text += ']'
                elif test_text.endswith(','):
                    test_text = test_text[:-1] + ']'
                data = json.loads(test_text)
                print(f"✓ Repaired JSON (salvaged {len(data)} questions)")
                return data
            except Exception:
                continue
        raise


def normalize_category(raw, language):
    """Map whatever category label Gemini returned to one of our 6 keys"""
    c = str(raw or '').strip().lower().replace('-', ' ').replace('_', ' ')
    lang = str(language or '').strip().lower()
    if not c:
        return None
    if c in QUESTION_CATEGORIES:
        return c
    if 'program' in c or 'coding' in c or c == lang or (lang and lang in c):
        return 'programming'
    if 'operating' in c or c == 'os':
        return 'os'
    if 'dbms' in c or 'database' in c or 'sql' in c:
        return 'dbms'
    if 'network' in c:
        return 'networks'
    if 'aptitude' in c or 'quant' in c or 'reasoning' in c or 'logic' in c:
        return 'aptitude'
    if 'verbal' in c or 'english' in c or 'grammar' in c:
        return 'verbal'
    return None


def generate_all_questions_optimized(difficulty, language, supports_oop):
    """Generate all 30 questions in ONE call, strictly following the chosen difficulty"""

    difficulty = normalize_difficulty(difficulty)
    prompt = build_question_prompt(difficulty, language, supports_oop)

    valid_questions = []
    max_attempts = 2

    for attempt in range(1, max_attempts + 1):
        wait_for_rate_limit()
        model = genai.GenerativeModel('gemini-2.0-flash-lite')

        try:
            print(f"🔄 Generating 30 {difficulty.upper()} questions (attempt {attempt}/{max_attempts})...")

            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.6,   # lower = follows the difficulty rules more strictly
                    top_p=0.9,
                    max_output_tokens=8192,
                )
            )

            text = response.text.strip()
            print(f"📦 Received {len(text)} chars")

            questions_data = _parse_questions_json(text)
            if not isinstance(questions_data, list):
                raise ValueError(f"Expected array, got {type(questions_data)}")

            valid_questions = []
            seen_questions = set()
            category_count = {}

            for idx, q in enumerate(questions_data):
                if not validate_question_structure(q):
                    print(f"⚠️  Q{idx+1} invalid")
                    continue

                cat = normalize_category(q['category'], language)
                if cat is None:
                    print(f"⚠️  Q{idx+1} unknown category '{q['category']}'")
                    continue

                # keep max 5 per category and drop duplicates
                if category_count.get(cat, 0) >= QUESTIONS_PER_CATEGORY:
                    continue
                key = str(q['question']).strip().lower()
                if key in seen_questions:
                    continue
                seen_questions.add(key)

                category_count[cat] = category_count.get(cat, 0) + 1
                valid_questions.append({
                    'id': f"{cat}_{category_count[cat]}",
                    'question': str(q['question']).strip(),
                    'options': [str(opt).strip() for opt in q['options'][:4]],
                    'correct_answer': int(q['correct_answer']),
                    'category': cat,
                    'explanation': ''
                })

            print(f"✅ Generated {len(valid_questions)} valid {difficulty} questions")
            print(f"   Distribution: {category_count}")

            if len(valid_questions) >= 25:
                break
            print("⚠️  Not enough valid questions, retrying...")

        except Exception as e:
            print(f"❌ Generation failed (attempt {attempt}): {e}")
            valid_questions = []

    return _fill_with_fallback(valid_questions, difficulty, language)


def _fill_with_fallback(valid_questions, difficulty, language):
    """Make sure every category has exactly 5 questions, topping up with same-difficulty fallback"""
    fallback = generate_quality_fallback(language, difficulty)

    by_cat = {c: [] for c in QUESTION_CATEGORIES}
    for q in valid_questions:
        by_cat[q['category']].append(q)

    # If Gemini gave almost nothing, use the full fallback set for this difficulty
    if len(valid_questions) < 15:
        print(f"⚠️  Only {len(valid_questions)} usable questions, using {difficulty} fallback set")
        return fallback[:30]

    final = []
    for cat in QUESTION_CATEGORIES:
        have = by_cat[cat][:QUESTIONS_PER_CATEGORY]
        if len(have) < QUESTIONS_PER_CATEGORY:
            extra = [q for q in fallback if q['category'] == cat]
            have_text = {h['question'].lower() for h in have}
            extra = [q for q in extra if q['question'].lower() not in have_text]
            need = QUESTIONS_PER_CATEGORY - len(have)
            print(f"   Adding {need} {difficulty} fallback question(s) for '{cat}'")
            have = have + extra[:need]
        final.extend(have)

    return final[:30]


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

        # options must be unique
        if len({str(o).strip().lower() for o in q['options']}) != 4:
            return False

        return True
    except Exception:
        return False


# Fallback bank: (question, correct option, [3 wrong options]); '{lang}' is replaced with the language
FALLBACK_BANK = {
    'easy': {
        'os': [
            ("What is the primary purpose of an operating system?", "Manage hardware resources", ["Edit documents", "Browse internet", "Play games"]),
            ("Which scheduling algorithm can cause starvation?", "Priority Scheduling", ["Round Robin", "FCFS", "Priority with aging"]),
            ("What is a deadlock in OS?", "Circular wait for resources", ["Process termination", "Memory leak", "CPU idle state"]),
            ("Virtual memory uses which storage?", "Hard disk", ["RAM only", "Cache only", "Registers"]),
            ("What is a critical section?", "Code accessing shared resources", ["Error handling code", "Main function", "Loop structure"]),
        ],
        'dbms': [
            ("What is normalization in databases?", "Removing redundancy", ["Adding indexes", "Backing up data", "Encrypting data"]),
            ("Which SQL clause filters grouped data?", "HAVING", ["WHERE", "GROUP BY", "ORDER BY"]),
            ("ACID properties ensure what?", "Transaction reliability", ["Fast queries", "Data encryption", "User authentication"]),
            ("What is a foreign key?", "References primary key of another table", ["Primary key", "Unique constraint", "Index"]),
            ("Which JOIN returns all rows from both tables?", "FULL OUTER JOIN", ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN"]),
        ],
        'networks': [
            ("What layer is TCP in OSI model?", "Transport Layer", ["Network Layer", "Application Layer", "Data Link Layer"]),
            ("Default HTTP port number is?", "80", ["443", "8080", "21"]),
            ("What does DNS do?", "Converts domain names to IP", ["Encrypts data", "Routes packets", "Assigns IP addresses"]),
            ("Which protocol is connectionless?", "UDP", ["TCP", "FTP", "HTTP"]),
            ("What is subnet mask used for?", "Divide network into subnets", ["Encrypt traffic", "Authenticate users", "Cache data"]),
        ],
        'aptitude': [
            ("If 20% of 150 is X, then X = ?", "30", ["25", "35", "40"]),
            ("Next in series: 2, 6, 12, 20, ?", "30", ["28", "32", "26"]),
            ("A train 100m long crosses a pole in 10 sec. Speed?", "10 m/s", ["100 m/s", "1 m/s", "50 m/s"]),
            ("If A:B = 2:3 and B:C = 4:5, then A:C = ?", "8:15", ["2:5", "3:5", "4:15"]),
            ("Average of 5 numbers is 20. If one number is 30, average of rest?", "17.5", ["20", "22.5", "15"]),
        ],
        'verbal': [
            ("Choose correct: He ___ to school every day.", "goes", ["go", "going", "gone"]),
            ("Synonym of 'Abundant':", "Plentiful", ["Scarce", "Limited", "Rare"]),
            ("Antonym of 'Ancient':", "Modern", ["Old", "Historic", "Traditional"]),
            ("Identify error: 'She don't like coffee.'", "don't should be doesn't", ["No error", "like should be likes", "coffee should be coffees"]),
            ("'Break the ice' means:", "Start conversation", ["Destroy something", "Cool down", "Make ice cubes"]),
        ],
        'programming': [
            ("What is the time complexity of binary search in {lang}?", "O(log n)", ["O(n)", "O(n²)", "O(1)"]),
            ("Which data structure uses LIFO?", "Stack", ["Queue", "Array", "Tree"]),
            ("What does 'return' keyword do in {lang}?", "Exits function with value", ["Loops back", "Throws error", "Prints output"]),
            ("Array indexing in {lang} starts from?", "0", ["1", "-1", "Depends on declaration"]),
            ("What is recursion in {lang}?", "Function calling itself", ["Loop structure", "Variable declaration", "Error handling"]),
        ],
    },
    'moderate': {
        'os': [
            ("Which is NOT a necessary condition for deadlock?", "Preemption of resources", ["Mutual exclusion", "Hold and wait", "Circular wait"]),
            ("Which page replacement algorithm suffers from Belady's anomaly?", "FIFO", ["LRU", "Optimal", "MRU"]),
            ("A semaphore initialized to 1 and used for mutual exclusion is called?", "Binary semaphore", ["Counting semaphore", "Spinlock", "Monitor"]),
            ("What is saved and restored during a context switch?", "Process state stored in the PCB", ["Contents of the hard disk", "The entire RAM", "All files opened by the user"]),
            ("Which non-preemptive algorithm gives minimum average waiting time for known burst times?", "SJF", ["FCFS", "Round Robin", "Priority"]),
        ],
        'dbms': [
            ("Which normal form removes partial dependencies?", "2NF", ["1NF", "3NF", "BCNF"]),
            ("Which SQL keyword filters rows BEFORE grouping?", "WHERE", ["HAVING", "ORDER BY", "DISTINCT"]),
            ("Which ACID property ensures committed data survives a crash?", "Durability", ["Atomicity", "Consistency", "Isolation"]),
            ("Which index structure is the default in most RDBMS?", "B+ tree", ["Bitmap", "Hash", "Full-text"]),
            ("Which isolation level prevents dirty reads but allows non-repeatable reads?", "Read Committed", ["Read Uncommitted", "Repeatable Read", "Serializable"]),
        ],
        'networks': [
            ("Which protocol resolves an IP address to a MAC address?", "ARP", ["RARP", "DNS", "DHCP"]),
            ("How many bits are there in an IPv6 address?", "128", ["32", "64", "256"]),
            ("TCP connection establishment uses which mechanism?", "Three-way handshake", ["Two-way handshake", "Four-way handshake", "Token passing"]),
            ("Which device operates at Layer 3 of the OSI model?", "Router", ["Hub", "Bridge", "Repeater"]),
            ("Which port does HTTPS use by default?", "443", ["80", "22", "25"]),
        ],
        'aptitude': [
            ("A can do a job in 12 days, B in 18 days. Working together they finish in?", "7.2 days", ["15 days", "6 days", "8 days"]),
            ("A price rises 20% and then falls 20%. Net change?", "4% decrease", ["No change", "4% increase", "2% decrease"]),
            ("Next in series: 3, 6, 11, 18, 27, ?", "38", ["36", "40", "35"]),
            ("Probability of getting a sum of 7 with two dice?", "1/6", ["1/12", "7/36", "1/9"]),
            ("Simple interest on ₹5000 at 8% p.a. for 3 years?", "₹1200", ["₹1500", "₹400", "₹1000"]),
        ],
        'verbal': [
            ("Choose the grammatically correct sentence:", "Each of the students has submitted the form.", ["Each of the students have submitted the form.", "Each of the student has submitted the form.", "Each of the students are submitting the form."]),
            ("Synonym of 'Meticulous':", "Painstaking", ["Careless", "Hasty", "Indifferent"]),
            ("Antonym of 'Benevolent':", "Malevolent", ["Generous", "Kind", "Charitable"]),
            ("'Burn the midnight oil' means:", "Work late into the night", ["Waste fuel", "Start a fire", "Cook at night"]),
            ("Fill in the blank: She is senior ___ me.", "to", ["than", "from", "with"]),
        ],
        'programming': [
            ("What is the time complexity of searching in a balanced BST (in {lang})?", "O(log n)", ["O(n)", "O(1)", "O(n log n)"]),
            ("Which data structure is used for BFS traversal?", "Queue", ["Stack", "Heap", "Hash table"]),
            ("What is a hash collision?", "Two different keys produce the same hash index", ["A key is missing from the table", "The table has run out of memory", "Two values are identical"]),
            ("Which statement about recursion in {lang} is true?", "Every recursive function needs a base case", ["Recursion is always faster than loops", "Recursion uses no extra memory", "The base case is optional"]),
            ("Worst-case time complexity of quicksort?", "O(n²)", ["O(n log n)", "O(n)", "O(log n)"]),
        ],
    },
    'hard': {
        'os': [
            ("3 processes each need at most 2 units of a resource. Minimum total units that guarantee no deadlock?", "4", ["3", "5", "6"]),
            ("Memory access = 100 ns, page-fault service = 10 ms. Max page-fault rate for EAT ≤ 110 ns?", "≈ 1 in 1,000,000", ["1 in 10,000", "1 in 100,000", "1 in 100"]),
            ("Priority inversion is best solved by?", "Priority inheritance", ["Round robin", "Increasing the time quantum", "Paging"]),
            ("Banker's algorithm is used for?", "Deadlock avoidance", ["Deadlock detection", "Deadlock prevention", "Deadlock recovery"]),
            ("TLB hit ratio 90%, TLB access 10 ns, memory access 100 ns (single-level paging). EMAT?", "120 ns", ["110 ns", "130 ns", "150 ns"]),
        ],
        'dbms': [
            ("R(A,B,C,D) with FDs A→B, B→C, C→D. Which is the candidate key?", "{A}", ["{B}", "{C,D}", "{B,C}"]),
            ("R(A,B,C) with FDs A→B, B→C and key A. Highest normal form satisfied?", "2NF", ["3NF", "BCNF", "1NF"]),
            ("Which concurrency control protocol is deadlock-free?", "Timestamp ordering", ["Basic two-phase locking", "Strict two-phase locking", "Conservative lock upgrade"]),
            ("Which anomaly can still occur at Repeatable Read in the SQL standard?", "Phantom reads", ["Dirty reads", "Non-repeatable reads", "Dirty writes"]),
            ("R(A,B,C) has A as its only candidate key. Number of superkeys?", "4", ["3", "7", "8"]),
        ],
        'networks': [
            ("Usable host addresses in a /26 subnet?", "62", ["64", "30", "126"]),
            ("In TCP slow start, cwnd grows exponentially until it reaches?", "ssthresh", ["The RTT value", "Zero", "The MTU of the link"]),
            ("Which routing protocol uses Dijkstra's algorithm?", "OSPF", ["RIP", "BGP", "EIGRP"]),
            ("Stop-and-wait efficiency with a = Tp/Tt?", "1/(1+2a)", ["1/(1+a)", "1/(2+a)", "2a/(1+2a)"]),
            ("Maximum sender window size in Go-Back-N with 3-bit sequence numbers?", "7", ["8", "4", "3"]),
        ],
        'aptitude': [
            ("Trains 150 m and 100 m run in opposite directions at 60 and 40 km/h. Time to cross each other?", "9 s", ["10 s", "12 s", "15 s"]),
            ("Number of distinct arrangements of the letters of 'LEVEL'?", "30", ["60", "120", "15"]),
            ("40 L mixture of milk:water = 3:1. Water to add to make the ratio 3:2?", "10 L", ["5 L", "15 L", "20 L"]),
            ("Compound interest on ₹8000 at 10% p.a. for 2 years (annual compounding)?", "₹1680", ["₹1600", "₹1800", "₹1480"]),
            ("If x + 1/x = 3, then x² + 1/x² = ?", "7", ["9", "5", "11"]),
        ],
        'verbal': [
            ("Choose the best word: His ___ remarks offended everyone.", "disparaging", ["laudatory", "ephemeral", "frugal"]),
            ("Synonym of 'Ubiquitous':", "Omnipresent", ["Rare", "Hidden", "Ancient"]),
            ("Antonym of 'Ephemeral':", "Enduring", ["Brief", "Fleeting", "Temporary"]),
            ("Choose the correct sentence:", "Had I known, I would have called you.", ["If I would have known, I would have called you.", "Had I knew, I would have called you.", "If I had known, I will have called you."]),
            ("'A Pyrrhic victory' means:", "A victory won at too great a cost", ["A decisive and cheap victory", "A surprise victory", "A narrow defeat"]),
        ],
        'programming': [
            ("Time complexity of building a binary heap from n elements in {lang}?", "O(n)", ["O(n log n)", "O(log n)", "O(n²)"]),
            ("Which algorithm finds shortest paths with negative edge weights (no negative cycle)?", "Bellman-Ford", ["Dijkstra", "Prim", "Kruskal"]),
            ("Worst-case recursion-stack space of DFS on a graph with V vertices?", "O(V)", ["O(1)", "O(log V)", "O(V²)"]),
            ("Which technique solves problems with overlapping subproblems and optimal substructure?", "Dynamic programming", ["Greedy algorithms", "Binary search", "Hashing"]),
            ("Amortized time per push in a dynamic array that doubles its capacity?", "O(1)", ["O(n)", "O(log n)", "O(n log n)"]),
        ],
    },
}


def generate_quality_fallback(language, difficulty='moderate'):
    """Fallback questions that follow the selected difficulty (used only when the API fails)"""
    difficulty = normalize_difficulty(difficulty)
    bank = FALLBACK_BANK[difficulty]
    questions = []

    for cat in QUESTION_CATEGORIES:
        for i, (q, correct, wrongs) in enumerate(bank[cat]):
            options = [correct] + list(wrongs)
            random.shuffle(options)  # correct answer is no longer always option A
            questions.append({
                'id': f'{cat}_{i}',
                'question': q.replace('{lang}', str(language)),
                'options': options,
                'correct_answer': options.index(correct),
                'category': cat,
                'explanation': ''
            })

    print(f"📚 Using {len(questions)} {difficulty} fallback questions")
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

    # Generate comprehensive insights with URLs
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
    """Generate comprehensive career insights with URLs for all sections"""
    
    wait_for_rate_limit()
    
    model = genai.GenerativeModel('gemini-2.0-flash-lite')
    
    prompt = f"""Generate comprehensive career guidance with REAL, WORKING URLs for quiz results:
Score: {total_correct}/30 ({round(total_correct/30*100)}%)
Recommended Domain: {domain}
Domain Scores: {json.dumps(scores)}
Category Performance: {json.dumps(category_correct)}

IMPORTANT: Include REAL, accessible URLs from popular platforms like:
- Courses: Coursera, Udemy, edX, YouTube, freeCodeCamp
- Practice: LeetCode, HackerRank, CodeSignal, GeeksforGeeks
- Articles: Medium, Dev.to, official documentation
- Career info: LinkedIn, Glassdoor, Indeed

Return valid JSON with these sections:
{{
  "overview": {{
    "summary": "2-3 sentence overview of performance",
    "key_takeaway": "Main insight"
  }},
  "strengths": ["3-4 specific strengths"],
  "improvements": ["3-4 actionable improvements"],
  "career_paths": [
    {{
      "title": "Primary Role",
      "description": "Why suitable (50-80 words)",
      "growth": "Career growth potential",
      "learn_more_url": "https://..."
    }}
  ],
  "action_plan": [
    {{
      "phase": "Immediate (0-3 months)",
      "actions": [
        {{"text": "Specific actionable step", "url": "https://... (real learning resource)"}},
        {{"text": "Another concrete action", "url": "https://..."}},
        {{"text": "Third action item", "url": "https://..."}}
      ]
    }},
    {{
      "phase": "Short-term (3-6 months)",
      "actions": [
        {{"text": "Next level goal", "url": "https://..."}},
        {{"text": "Skill development step", "url": "https://..."}},
        {{"text": "Networking/community action", "url": "https://..."}}
      ]
    }},
    {{
      "phase": "Long-term (6-12 months)",
      "actions": [
        {{"text": "Advanced goal", "url": "https://..."}},
        {{"text": "Career preparation", "url": "https://..."}},
        {{"text": "Expertise building", "url": "https://..."}}
      ]
    }}
  ],
  "learning_resources": [
    {{
      "type": "Course",
      "title": "Specific course name",
      "platform": "Platform name",
      "focus": "What it teaches",
      "url": "https://... (direct course link)"
    }},
    {{
      "type": "Practice",
      "title": "Practice platform/challenge",
      "platform": "Website name",
      "focus": "Skills to build",
      "url": "https://... (direct link)"
    }},
    {{
      "type": "Book/Article",
      "title": "Reading material",
      "platform": "Where to find",
      "focus": "Knowledge area",
      "url": "https://... (Amazon, Medium, etc.)"
    }},
    {{
      "type": "Project",
      "title": "Project idea with tutorial",
      "platform": "Tutorial source",
      "focus": "Skills applied",
      "url": "https://... (tutorial/guide link)"
    }},
    {{
      "type": "Community",
      "title": "Forum/Community",
      "platform": "Platform",
      "focus": "Networking and support",
      "url": "https://... (Discord, Reddit, etc.)"
    }},
    {{
      "type": "Documentation",
      "title": "Official docs/guide",
      "platform": "Official source",
      "focus": "Reference material",
      "url": "https://... (official documentation)"
    }}
  ]
}}

Make URLs relevant to {domain} domain. Use real platforms that exist."""

    try:
        print("🔄 Generating comprehensive insights with URLs...")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.8,
                max_output_tokens=4096,  # Increased for URLs
            )
        )
        
        text = response.text.strip().replace('```json', '').replace('```', '').strip()
        insights = json.loads(text)
        
        # Validate that URLs are included
        has_urls = False
        if insights.get('career_paths'):
            has_urls = any(path.get('learn_more_url') for path in insights['career_paths'])
        
        if not has_urls:
            print("⚠️  No URLs in response, adding fallback URLs...")
            insights = add_fallback_urls(insights, domain)
        
        print("✓ Comprehensive insights with URLs generated")
        return insights
        
    except Exception as e:
        print(f"⚠️  Insights fallback: {e}")
        return get_fallback_insights_with_urls(domain, total_correct)

def add_fallback_urls(insights, domain):
    """Add fallback URLs if Gemini didn't provide them"""
    
    # Career path URLs
    career_url_map = {
        'programming': 'https://www.coursera.org/career-paths/software-developer',
        'analytics': 'https://www.coursera.org/career-paths/data-analyst',
        'testing': 'https://www.coursera.org/career-paths/software-tester',
        'technical': 'https://www.coursera.org/career-paths/technical-support'
    }
    
    if insights.get('career_paths'):
        for path in insights['career_paths']:
            if not path.get('learn_more_url'):
                path['learn_more_url'] = career_url_map.get(domain, 'https://www.linkedin.com/jobs')
    
    # Action plan URLs
    action_urls = [
        'https://leetcode.com/problemset/all/',
        'https://www.coursera.org',
        'https://github.com/explore',
        'https://www.hackerrank.com/domains/tutorials',
        'https://stackoverflow.com/questions',
        'https://dev.to'
    ]
    
    if insights.get('action_plan'):
        url_idx = 0
        for plan in insights['action_plan']:
            if 'actions' in plan:
                new_actions = []
                for action in plan['actions']:
                    if isinstance(action, str):
                        new_actions.append({
                            'text': action,
                            'url': action_urls[url_idx % len(action_urls)]
                        })
                        url_idx += 1
                    else:
                        if not action.get('url'):
                            action['url'] = action_urls[url_idx % len(action_urls)]
                            url_idx += 1
                        new_actions.append(action)
                plan['actions'] = new_actions
    
    # Learning resources URLs
    resource_urls = {
        'Course': 'https://www.udemy.com',
        'Practice': 'https://leetcode.com',
        'Book/Article': 'https://medium.com',
        'Project': 'https://github.com/explore',
        'Community': 'https://discord.com',
        'Documentation': 'https://developer.mozilla.org'
    }
    
    if insights.get('learning_resources'):
        for resource in insights['learning_resources']:
            if not resource.get('url'):
                resource['url'] = resource_urls.get(resource['type'], 'https://www.google.com/search?q=' + resource['title'].replace(' ', '+'))
    
    return insights

def get_fallback_insights_with_urls(domain, score):
    """Fallback insights with URLs if API fails"""
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
                "description": "Build applications and solve complex problems with code. This role involves designing, coding, testing, and maintaining software systems across various platforms and technologies.",
                "growth": "High demand with excellent salary growth potential and opportunities to specialize",
                "learn_more_url": "https://www.coursera.org/career-paths/software-developer"
            },
            {
                "title": "Quality Assurance Engineer",
                "description": "Ensure software quality through testing and automation. Work on creating test plans, identifying bugs, and implementing automated testing frameworks.",
                "growth": "Stable career with growing automation opportunities and transition to DevOps roles",
                "learn_more_url": "https://www.coursera.org/career-paths/software-tester"
            },
            {
                "title": "Technical Analyst",
                "description": "Bridge gap between business and technology teams. Analyze requirements, design solutions, and ensure technical implementations meet business needs.",
                "growth": "Versatile role with transition opportunities to various tech positions",
                "learn_more_url": "https://www.linkedin.com/jobs/technical-analyst-jobs"
            }
        ],
        "action_plan": [
            {
                "phase": "Immediate (0-3 months)",
                "actions": [
                    {
                        "text": "Solve 2-3 LeetCode problems daily focusing on arrays and strings",
                        "url": "https://leetcode.com/problemset/all/"
                    },
                    {
                        "text": "Complete Python/Java fundamentals course on Coursera",
                        "url": "https://www.coursera.org/courses?query=programming%20fundamentals"
                    },
                    {
                        "text": "Build a portfolio project (todo app, calculator, or simple game)",
                        "url": "https://github.com/practical-tutorials/project-based-learning"
                    }
                ]
            },
            {
                "phase": "Short-term (3-6 months)",
                "actions": [
                    {
                        "text": "Contribute to open-source projects on GitHub",
                        "url": "https://github.com/topics/good-first-issue"
                    },
                    {
                        "text": "Join tech communities and attend meetups (Discord, Reddit, local events)",
                        "url": "https://www.meetup.com/topics/software-development/"
                    },
                    {
                        "text": "Master one framework deeply (React, Django, Spring Boot, etc.)",
                        "url": "https://www.freecodecamp.org"
                    }
                ]
            },
            {
                "phase": "Long-term (6-12 months)",
                "actions": [
                    {
                        "text": "Prepare for technical interviews with system design practice",
                        "url": "https://www.educative.io/courses/grokking-the-system-design-interview"
                    },
                    {
                        "text": "Build 2-3 significant full-stack portfolio projects",
                        "url": "https://www.youtube.com/results?search_query=full+stack+project+tutorial"
                    },
                    {
                        "text": "Obtain relevant certifications (AWS, Azure, or language-specific)",
                        "url": "https://aws.amazon.com/certification/"
                    }
                ]
            }
        ],
        "learning_resources": [
            {
                "type": "Course",
                "title": "CS50 - Introduction to Computer Science",
                "platform": "Harvard/edX",
                "focus": "Strong programming fundamentals and problem-solving",
                "url": "https://www.edx.org/cs50"
            },
            {
                "type": "Practice",
                "title": "LeetCode - Algorithm Practice",
                "platform": "LeetCode",
                "focus": "Algorithm and data structure mastery for interviews",
                "url": "https://leetcode.com/problemset/all/"
            },
            {
                "type": "Book/Article",
                "title": "Cracking the Coding Interview",
                "platform": "Amazon",
                "focus": "Interview preparation and problem-solving patterns",
                "url": "https://www.amazon.com/Cracking-Coding-Interview-Programming-Questions/dp/0984782850"
            },
            {
                "type": "Project",
                "title": "Build a Full-Stack Application Tutorial",
                "platform": "freeCodeCamp",
                "focus": "End-to-end development skills with real deployment",
                "url": "https://www.freecodecamp.org/news/tag/full-stack/"
            },
            {
                "type": "Community",
                "title": "r/learnprogramming - Programming Community",
                "platform": "Reddit",
                "focus": "Get help, share progress, and network with learners",
                "url": "https://www.reddit.com/r/learnprogramming/"
            },
            {
                "type": "Documentation",
                "title": "MDN Web Docs / Official Language Documentation",
                "platform": "Mozilla / Official Sites",
                "focus": "Comprehensive reference for web technologies and languages",
                "url": "https://developer.mozilla.org/"
            }
        ]
    }


# ==================== SHARED RESULTS ENDPOINT ====================

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