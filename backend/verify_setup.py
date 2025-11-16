"""
Setup verification script
Run this to check if all environment variables and dependencies are configured correctly
"""
import os
from dotenv import load_dotenv

def verify_setup():
    """Verify all required environment variables and dependencies"""
    
    print("=" * 60)
    print("🔍 SETUP VERIFICATION")
    print("=" * 60)
    
    # Load environment variables
    load_dotenv()
    print("\n✓ .env file loaded")
    
    # Check required environment variables
    required_vars = {
        'SUPABASE_URL': 'Supabase project URL',
        'SUPABASE_ANON_KEY': 'Supabase anonymous key',
        'GEMINI_API_KEY': 'Google Gemini API key',
        'SECRET_KEY': 'Flask secret key',
        'CLERK_SECRET_KEY': 'Clerk secret key',
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY': 'Clerk publishable key'
    }
    
    print("\n📋 ENVIRONMENT VARIABLES:")
    print("-" * 60)
    
    all_present = True
    for var, description in required_vars.items():
        value = os.getenv(var)
        if value:
            # Show only first and last few characters for security
            if len(value) > 20:
                masked = f"{value[:8]}...{value[-8:]}"
            else:
                masked = f"{value[:4]}...{value[-4:]}"
            print(f"✓ {var:40s} {masked}")
        else:
            print(f"✗ {var:40s} MISSING")
            all_present = False
    
    print("-" * 60)
    
    if not all_present:
        print("\n❌ Some environment variables are missing!")
        print("Please check your .env file")
        return False
    
    # Check Python packages
    print("\n📦 PYTHON PACKAGES:")
    print("-" * 60)
    
    packages = [
        'flask',
        'flask_cors',
        'supabase',
        'google.generativeai',
        'dotenv',
        'jwt'
    ]
    
    missing_packages = []
    for package in packages:
        try:
            if package == 'dotenv':
                __import__('dotenv')
            elif package == 'flask_cors':
                __import__('flask_cors')
            elif package == 'google.generativeai':
                __import__('google.generativeai')
            else:
                __import__(package)
            print(f"✓ {package}")
        except ImportError:
            print(f"✗ {package} - NOT INSTALLED")
            missing_packages.append(package)
    
    print("-" * 60)
    
    if missing_packages:
        print(f"\n❌ Missing packages: {', '.join(missing_packages)}")
        print("Run: pip install -r requirements.txt")
        return False
    
    # Test Supabase connection
    print("\n🔗 TESTING CONNECTIONS:")
    print("-" * 60)
    
    try:
        from supabase import create_client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        client = create_client(supabase_url, supabase_key)
        
        # Try a simple query to test connection
        result = client.table('users').select('count').limit(1).execute()
        print("✓ Supabase connection successful")
        
    except Exception as e:
        print(f"✗ Supabase connection failed: {e}")
        print("  Please verify your SUPABASE_URL and SUPABASE_ANON_KEY")
        return False
    
    # Test Gemini API
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        model = genai.GenerativeModel('gemini-2.0-flash-lite')
        print("✓ Gemini API configured")
        
    except Exception as e:
        print(f"✗ Gemini API configuration failed: {e}")
        print("  Please verify your GEMINI_API_KEY")
        return False
    
    print("-" * 60)
    
    # Final result
    print("\n" + "=" * 60)
    print("✅ ALL CHECKS PASSED!")
    print("=" * 60)
    print("\n🚀 You're ready to run the application:")
    print("   python main.py")
    print("\n📚 Next steps:")
    print("   1. Make sure you've run the SQL schema in Supabase")
    print("   2. Start the Flask server: python main.py")
    print("   3. The server will run on http://localhost:5000")
    print("=" * 60)
    
    return True

if __name__ == '__main__':
    try:
        verify_setup()
    except KeyboardInterrupt:
        print("\n\n👋 Setup verification cancelled")
    except Exception as e:
        print(f"\n❌ Verification error: {e}")
        import traceback
        traceback.print_exc()