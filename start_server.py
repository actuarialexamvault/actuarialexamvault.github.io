#!/usr/bin/env python3
"""
Simple HTTP Server for Actuarial Exam Book Website
This script starts a local web server to run the website.
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

# Configuration
PORT = 8000
HOST = 'localhost'

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom request handler with better error handling and MIME types"""
    
    def end_headers(self):
        # Add CORS headers to allow local file access
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
    
    def log_message(self, format, *args):
        """Custom log format"""
        print(f"[{self.log_date_time_string()}] {format % args}")

def start_server():
    """Start the HTTP server"""
    
    # Change to the script's directory
    script_dir = Path(__file__).parent.resolve()
    os.chdir(script_dir)
    
    print("=" * 70)
    print("ACTUARIAL EXAM BOOK - LOCAL WEB SERVER")
    print("=" * 70)
    print(f"\nServer starting at: http://{HOST}:{PORT}")
    print(f"Working directory: {script_dir}\n")
    print("Available pages:")
    print(f"  - Home:         http://{HOST}:{PORT}/index.html")
    print(f"  - Sign In:      http://{HOST}:{PORT}/pages/signin.html")
    print(f"  - Sign Up:      http://{HOST}:{PORT}/pages/signup.html")
    print(f"  - Dashboard:    http://{HOST}:{PORT}/pages/dashboard.html")
    print(f"  - Subjects:     http://{HOST}:{PORT}/pages/subjects.html")
    print("\nPress Ctrl+C to stop the server\n")
    print("=" * 70)
    
    # Create server
    with socketserver.TCPServer((HOST, PORT), MyHTTPRequestHandler) as httpd:
        # Open browser automatically
        try:
            webbrowser.open(f'http://{HOST}:{PORT}/index.html')
            print("\n✓ Browser opened automatically\n")
        except:
            print("\n⚠ Could not open browser automatically")
            print(f"  Please open: http://{HOST}:{PORT}/index.html\n")
        
        try:
            print("Server is running... (Press Ctrl+C to stop)\n")
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n" + "=" * 70)
            print("Server stopped by user")
            print("=" * 70)
            sys.exit(0)

if __name__ == "__main__":
    try:
        start_server()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"\n❌ ERROR: Port {PORT} is already in use!")
            print(f"   Try closing other applications or use a different port.")
            print(f"   You can edit this script to change the PORT variable.\n")
        else:
            print(f"\n❌ ERROR: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}\n")
        sys.exit(1)
