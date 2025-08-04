#!/usr/bin/env python3
"""
Local OAuth Testing Server
Run this to test OAuth flow locally without Cloud Run deployment
"""
import os
import sys
import logging
from flask import Flask, jsonify, redirect, request
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'local-dev-secret')

# Simple OAuth handler for local testing
class LocalOAuthHandler:
    def __init__(self):
        self.client_id = os.environ.get('GOOGLE_CLIENT_ID')
        self.client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = 'http://localhost:8080/auth/google/callback'
        self.scopes = [
            'openid',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/drive.file'
        ]
        
    def get_authorization_url(self):
        """Generate Google OAuth authorization URL"""
        import urllib.parse
        
        params = {
            'client_id': self.client_id,
            'response_type': 'code',
            'scope': ' '.join(self.scopes),
            'redirect_uri': self.redirect_uri,
            'access_type': 'offline',
            'prompt': 'consent'
        }
        
        base_url = 'https://accounts.google.com/o/oauth2/v2/auth'
        query_string = urllib.parse.urlencode(params)
        return f"{base_url}?{query_string}"
    
    def handle_callback(self, auth_code):
        """Handle OAuth callback and exchange code for tokens"""
        import requests
        
        token_data = {
            'code': auth_code,
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri': self.redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        response = requests.post('https://oauth2.googleapis.com/token', data=token_data)
        
        if response.status_code == 200:
            tokens = response.json()
            
            # Get user info
            user_response = requests.get(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                headers={'Authorization': f'Bearer {tokens["access_token"]}'}
            )
            
            if user_response.status_code == 200:
                user_info = user_response.json()
                return {
                    'success': True,
                    'access_token': tokens['access_token'],
                    'refresh_token': tokens.get('refresh_token'),
                    'user_info': user_info
                }
        
        return {
            'success': False,
            'error': f'Token exchange failed: {response.status_code} - {response.text}'
        }

# Initialize OAuth handler
oauth_handler = LocalOAuthHandler()

@app.route('/')
def home():
    """Home page with test links"""
    return f"""
    <h1>Local OAuth Testing</h1>
    <p><a href="/auth/debug">Debug Configuration</a></p>
    <p><a href="/auth/google/start">Test OAuth Flow</a></p>
    <p><strong>Client ID:</strong> {oauth_handler.client_id}</p>
    <p><strong>Redirect URI:</strong> {oauth_handler.redirect_uri}</p>
    """

@app.route('/auth/debug')
def auth_debug():
    """Debug OAuth configuration"""
    return jsonify({
        'client_id': oauth_handler.client_id,
        'client_secret_available': bool(oauth_handler.client_secret),
        'redirect_uri': oauth_handler.redirect_uri,
        'scopes': oauth_handler.scopes,
        'authorization_url': oauth_handler.get_authorization_url()
    })

@app.route('/auth/google/start')
def auth_google_start():
    """Start Google OAuth flow"""
    try:
        auth_url = oauth_handler.get_authorization_url()
        print(f"Redirecting to: {auth_url}")
        return redirect(auth_url)
    except Exception as e:
        print(f"OAuth start failed: {e}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to start OAuth flow',
            'error': str(e)
        }), 500

@app.route('/auth/google/callback')
def auth_google_callback():
    """Handle Google OAuth callback"""
    try:
        code = request.args.get('code')
        error = request.args.get('error')
        
        print(f"Callback received - Code: {bool(code)}, Error: {error}")
        
        if error:
            return f"""
            <h1>OAuth Error</h1>
            <p>Error: {error}</p>
            <script>
                if (window.opener) {{
                    window.opener.postMessage({{
                        type: 'oauth-error',
                        error: '{error}'
                    }}, '*');
                    window.close();
                }}
            </script>
            """
        
        if not code:
            return "No authorization code received"
        
        # Exchange code for tokens
        result = oauth_handler.handle_callback(code)
        
        if result['success']:
            # Format user info for JavaScript
            import json
            user_info_json = json.dumps(result['user_info'])
            
            return f"""
            <h1>OAuth Success!</h1>
            <p>User: {result['user_info']['name']} ({result['user_info']['email']})</p>
            <p>Access Token: {result['access_token'][:20]}...</p>
            <p>Refresh Token: {bool(result.get('refresh_token'))}</p>
            <script>
                console.log('OAuth success:', {user_info_json});
                if (window.opener) {{
                    window.opener.postMessage({{
                        type: 'oauth-success',
                        access_token: '{result['access_token']}',
                        user_info: {user_info_json}
                    }}, '*');
                    window.close();
                }}
            </script>
            """
        else:
            return f"""
            <h1>OAuth Failed</h1>
            <p>Error: {result['error']}</p>
            <script>
                if (window.opener) {{
                    window.opener.postMessage({{
                        type: 'oauth-error',
                        error: '{result['error']}'
                    }}, '*');
                    window.close();
                }}
            </script>
            """
            
    except Exception as e:
        print(f"OAuth callback failed: {e}")
        return f"OAuth callback failed: {str(e)}"

if __name__ == '__main__':
    # Setup logging
    logging.basicConfig(level=logging.DEBUG)
    
    print("Starting local OAuth test server...")
    print(f"Client ID: {oauth_handler.client_id}")
    print(f"Client Secret Available: {bool(oauth_handler.client_secret)}")
    print(f"Redirect URI: {oauth_handler.redirect_uri}")
    print("")
    print("Visit: http://localhost:8080")
    print("Add this redirect URI to Google Console:")
    print("http://localhost:8080/auth/google/callback")
    
    app.run(host='0.0.0.0', port=8080, debug=True)