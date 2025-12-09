# Running the Actuarial Exam Book Website Locally

This guide explains how to run the website on your local machine using a development server.

## Why Do You Need a Local Server?

Modern web browsers have security restrictions that prevent websites from accessing local files when opened directly (using `file://` protocol). Running a local server solves this by serving files over HTTP (`http://localhost`).

## Prerequisites

- **Python 3.x** installed on your computer
  - Download from: https://www.python.org/downloads/
  - During installation, make sure to check "Add Python to PATH"

## Quick Start

### Option 1: Windows Batch File (Easiest)
1. Double-click `start_server.bat`
2. Your browser should open automatically
3. If not, go to: http://localhost:8000

### Option 2: PowerShell Script
1. Right-click `start_server.ps1`
2. Select "Run with PowerShell"
3. Your browser should open automatically

### Option 3: Python Directly
1. Open PowerShell or Command Prompt
2. Navigate to the project folder:
   ```powershell
   cd "c:\Users\lmdunge\OneDrive - Deloitte (O365D)\Documents\2. Studies\Actuarial_Exam_book\Actuarial-Exam-Book-main"
   ```
3. Run the server:
   ```powershell
   python start_server.py
   ```

### Option 4: Simple Python HTTP Server
```powershell
cd "c:\Users\lmdunge\OneDrive - Deloitte (O365D)\Documents\2. Studies\Actuarial_Exam_book\Actuarial-Exam-Book-main"
python -m http.server 8000
```
Then open: http://localhost:8000

## Accessing the Website

Once the server is running, you can access:

- **Home Page**: http://localhost:8000/index.html
- **Sign In**: http://localhost:8000/pages/signin.html
- **Sign Up**: http://localhost:8000/pages/signup.html
- **Dashboard**: http://localhost:8000/pages/dashboard.html
- **Subjects**: http://localhost:8000/pages/subjects.html

## Stopping the Server

Press `Ctrl+C` in the terminal/command prompt window where the server is running.

## Troubleshooting

### "Port 8000 is already in use"
Another application is using port 8000. Either:
1. Close the other application
2. Or edit `start_server.py` and change `PORT = 8000` to another port (e.g., `PORT = 8080`)

### "Python is not recognized"
Python is not installed or not in your PATH:
1. Install Python from https://www.python.org/downloads/
2. During installation, check "Add Python to PATH"
3. Restart your computer
4. Try again

### Browser doesn't open automatically
Manually open your browser and go to: http://localhost:8000

### Downloads still not working
Make sure you're accessing the site via `http://localhost:8000` and NOT opening the HTML files directly.

## Using VS Code Live Server (Alternative)

If you use VS Code:
1. Install the "Live Server" extension
2. Right-click any HTML file
3. Select "Open with Live Server"

## Production Deployment

For production deployment, consider using:
- **Node.js** with Express
- **Apache** or **Nginx** web servers
- **Cloud hosting** services (Netlify, Vercel, GitHub Pages)

This simple Python server is only for local development and testing.
