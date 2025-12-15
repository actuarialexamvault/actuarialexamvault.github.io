// Theme Manager - Shared utility for theme management across all pages
import { firebaseAuth } from './firebase-auth.js';
import { firestoreData } from './firebase-data.js';

class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.initialized = false;
        this.isLoading = false;
    }

    // Initialize theme on page load
    async init() {
        // Prevent multiple initializations
        if (this.initialized || this.isLoading) {
            return;
        }
        
        this.isLoading = true;
        
        // First, try to load from localStorage for instant application
        const cachedTheme = localStorage.getItem('userTheme');
        if (cachedTheme) {
            this.setTheme(cachedTheme);
        }
        
        const user = firebaseAuth.getCurrentUser();
        
        if (!user) {
            // Wait for Firebase to initialize
            await this.waitForAuth();
        } else {
            await this.loadAndApplyTheme(user);
        }
        
        this.initialized = true;
        this.isLoading = false;
    }

    // Wait for authentication to complete
    async waitForAuth() {
        return new Promise((resolve) => {
            const checkAuth = setInterval(async () => {
                const user = firebaseAuth.getCurrentUser();
                if (user) {
                    clearInterval(checkAuth);
                    await this.loadAndApplyTheme(user);
                    resolve();
                }
            }, 100);

            // Timeout after 3 seconds
            setTimeout(() => {
                clearInterval(checkAuth);
                // Only set to light if we haven't already loaded a theme
                if (!this.initialized || this.currentTheme === 'light') {
                    this.setTheme('light');
                }
                console.log('Auth timeout - keeping current theme:', this.currentTheme);
                resolve();
            }, 3000);
        });
    }

    // Load theme preference from Firebase and apply it
    async loadAndApplyTheme(user) {
        try {
            const result = await firestoreData.getUserProfile(user.uid);
            if (result.success && result.data.theme) {
                this.setTheme(result.data.theme);
            } else {
                // If no theme preference exists in Firebase, check localStorage
                const cachedTheme = localStorage.getItem('userTheme');
                if (cachedTheme) {
                    this.setTheme(cachedTheme);
                } else {
                    // Default to light
                    this.setTheme('light');
                }
            }
        } catch (error) {
            console.error('Error loading theme preference:', error);
            // On error, try to use cached theme from localStorage
            const cachedTheme = localStorage.getItem('userTheme');
            if (cachedTheme) {
                this.setTheme(cachedTheme);
            } else if (!this.currentTheme || this.currentTheme === 'light') {
                this.setTheme('light');
            }
        }
    }

    // Apply theme to the page
    setTheme(theme) {
        // Only update if theme actually changed
        if (this.currentTheme === theme && document.documentElement.getAttribute('data-theme') === (theme === 'dark' ? 'dark' : null)) {
            return;
        }
        
        this.currentTheme = theme;
        
        // Apply to document
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        
        // Save to localStorage for instant load on next page
        localStorage.setItem('userTheme', theme);
        
        console.log(`Theme set to: ${theme}`);
    }

    // Get current theme
    getTheme() {
        return this.currentTheme;
    }

    // Toggle theme (for dashboard page)
    async toggleTheme(user) {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        
        // Apply theme immediately
        this.setTheme(newTheme);
        
        // Save to Firebase
        try {
            await firestoreData.saveUserProfile(user.uid, { theme: newTheme });
            return { success: true, theme: newTheme };
        } catch (error) {
            console.error('Error saving theme preference:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
export const themeManager = new ThemeManager();
