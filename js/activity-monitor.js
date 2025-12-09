// Activity Monitor for Firebase Auth
// Automatically signs out users after 30 minutes of inactivity

import { firebaseAuth } from './firebase-auth.js';

class ActivityMonitor {
    constructor(inactivityTimeout = 30 * 60 * 1000) { // 30 minutes default
        this.inactivityTimeout = inactivityTimeout;
        this.inactivityTimer = null;
        this.isActive = false;
        this.warningTimer = null;
        this.warningTimeout = 28 * 60 * 1000; // Warn at 28 minutes
        
        this.init();
    }

    init() {
        // Only start monitoring if user is authenticated
        if (firebaseAuth.isAuthenticated()) {
            this.startMonitoring();
        }
    }

    startMonitoring() {
        this.isActive = true;
        this.resetTimers();
        
        // Listen for user activity
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove'];
        events.forEach(event => {
            document.addEventListener(event, () => this.handleActivity(), true);
        });
        
        console.log('Activity monitoring started - Auto logout after 30 minutes of inactivity');
    }

    handleActivity() {
        if (!this.isActive) return;
        
        this.resetTimers();
    }

    resetTimers() {
        // Clear existing timers
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        if (this.warningTimer) {
            clearTimeout(this.warningTimer);
        }

        // Set warning timer (2 minutes before logout)
        this.warningTimer = setTimeout(() => {
            this.showInactivityWarning();
        }, this.warningTimeout);

        // Set inactivity timer
        this.inactivityTimer = setTimeout(() => {
            this.handleInactivity();
        }, this.inactivityTimeout);
    }

    showInactivityWarning() {
        // Show warning modal
        const proceed = confirm(
            'Inactivity Warning\n\n' +
            'You will be automatically signed out in 2 minutes due to inactivity.\n\n' +
            'Click OK to stay signed in, or Cancel to sign out now.'
        );

        if (proceed) {
            // User wants to stay - reset timers
            this.resetTimers();
        } else {
            // User wants to sign out
            this.handleInactivity();
        }
    }

    async handleInactivity() {
        if (!this.isActive) return;
        
        this.stopMonitoring();
        
        console.log('User inactive for 30 minutes - signing out...');
        
        alert('You have been signed out due to inactivity.');
        
        await firebaseAuth.signout();
        window.location.href = '../index.html';
    }

    stopMonitoring() {
        this.isActive = false;
        
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        if (this.warningTimer) {
            clearTimeout(this.warningTimer);
        }
    }

    // Get remaining time in minutes
    getRemainingTime() {
        // This is approximate - not precise
        return Math.ceil(this.inactivityTimeout / (60 * 1000));
    }
}

// Create and export a single instance
export const activityMonitor = new ActivityMonitor();

// Auto-initialize on authenticated pages
export function initActivityMonitor() {
    return activityMonitor;
}
