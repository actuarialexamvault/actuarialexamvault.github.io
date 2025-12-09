// Authentication utility functions
class AuthManager {
    constructor() {
        this.USERS_KEY = 'actuarial_vault_users';
        this.SESSION_KEY = 'actuarial_vault_session';
        this.SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
    }

    // Get all users from localStorage
    getUsers() {
        const users = localStorage.getItem(this.USERS_KEY);
        if (!users) {
            // Initialize with a demo account if no users exist
            this.initializeDemoAccount();
            return this.getUsers(); // Recursive call to get the newly created demo account
        }
        return JSON.parse(users);
    }

    // Initialize a demo account for testing
    initializeDemoAccount() {
        const demoUser = {
            id: 'demo-user-001',
            fullname: 'Demo User',
            email: 'demo@actuarial.com',
            password: this.hashPassword('demo123'), // Password: demo123
            createdAt: new Date().toISOString(),
            isDemo: true
        };
        
        localStorage.setItem(this.USERS_KEY, JSON.stringify([demoUser]));
        console.log('Demo account initialized - Email: demo@actuarial.com, Password: demo123');
    }

    // Save users to localStorage
    saveUsers(users) {
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    }

    // Register a new user
    register(fullname, email, password) {
        const users = this.getUsers();
        
        // Check if user already exists
        if (users.find(u => u.email === email)) {
            return { success: false, message: 'Email already registered' };
        }

        // Create new user
        const newUser = {
            id: Date.now().toString(),
            fullname,
            email,
            password: this.hashPassword(password), // Simple hash (in production, use proper encryption)
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        this.saveUsers(users);

        return { success: true, message: 'Account created successfully', user: newUser };
    }

    // Sign in user
    signIn(email, password) {
        const users = this.getUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
            return { success: false, message: 'Email not found' };
        }

        if (user.password !== this.hashPassword(password)) {
            return { success: false, message: 'Incorrect password' };
        }

        // Create session
        const session = {
            userId: user.id,
            email: user.email,
            fullname: user.fullname,
            loginTime: Date.now(),
            expiresAt: Date.now() + this.SESSION_DURATION
        };

        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));

        return { success: true, message: 'Signed in successfully', user, session };
    }

    // Get current session
    getSession() {
        const session = localStorage.getItem(this.SESSION_KEY);
        if (!session) return null;

        const sessionData = JSON.parse(session);
        
        // Check if session is expired
        if (Date.now() > sessionData.expiresAt) {
            this.signOut();
            return null;
        }

        return sessionData;
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.getSession() !== null;
    }

    // Sign out user
    signOut() {
        localStorage.removeItem(this.SESSION_KEY);
    }

    // Extend session
    extendSession() {
        const session = this.getSession();
        if (session) {
            session.expiresAt = Date.now() + this.SESSION_DURATION;
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        }
    }

    // Simple password hashing (in production, use proper encryption library)
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    // Get time remaining in session (in minutes)
    getSessionTimeRemaining() {
        const session = this.getSession();
        if (!session) return 0;
        
        const remaining = session.expiresAt - Date.now();
        return Math.max(0, Math.floor(remaining / 60000)); // Convert to minutes
    }

    // Debug function to view all registered users (for development only)
    debugListUsers() {
        const users = this.getUsers();
        console.log('=== REGISTERED USERS ===');
        console.log(`Total users: ${users.length}`);
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.fullname} (${user.email}) - Created: ${user.createdAt}`);
        });
        console.log('=======================');
        return users;
    }

    // Helper function to check if any users exist
    hasUsers() {
        return this.getUsers().length > 0;
    }
}

// Export for use in other scripts
window.AuthManager = AuthManager;
