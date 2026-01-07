// Small reusable sign-out modal utility

// Create modal markup once and append to body
function ensureModal() {
    let modal = document.getElementById('globalSignoutModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'globalSignoutModal';
    modal.className = 'modal';
    // Use the same markup pattern as the dashboard modal (btn-primary/btn-secondary)
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header" style="flex-direction:column;align-items:center;text-align:center;gap:0.5rem;padding-top:0.75rem;">
                <svg class="modal-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:48px;height:48px;">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="12" cy="16" r="1" fill="currentColor"/>
                </svg>
                <h2 style="margin:0;font-size:1.125rem;font-weight:700;">Confirm</h2>
            </div>
            <div style="width:100%;height:1px;background:rgba(255,255,255,0.08);margin:0.5rem 0;border-radius:2px;"></div>
            <div class="modal-body" style="text-align:center;padding:0.75rem 1.25rem;color:var(--text-secondary);">
                <p id="globalSignoutMessage" style="margin:0;font-size:0.98rem;">Are you sure you want to sign out?</p>
            </div>
            <div class="modal-footer" style="display:flex;justify-content:center;gap:0.75rem;padding:0.75rem 1rem 1.25rem;">
                <div style="display:flex;gap:0.75rem;align-items:center;justify-content:center;width:100%;">
                    <button id="globalSignoutYes" class="btn-primary" style="display:inline-block;text-align:center;font-size:0.95rem;padding:0.65rem 1.1rem;border-radius:8px;border:none;background:linear-gradient(135deg,#00d4aa 0%,#00a3ff 100%);color:#fff;font-weight:700;box-shadow:0 8px 24px rgba(0,163,255,0.22);cursor:pointer;min-width:84px;">Yes</button>
                    <button id="globalSignoutNo" class="btn-secondary" style="display:inline-block;text-align:center;font-size:0.95rem;padding:0.55rem 1rem;border-radius:8px;background:transparent;color:var(--text-secondary,#cbd5e1);border:1px solid rgba(255,255,255,0.08);cursor:pointer;min-width:72px;">No</button>
                </div>
            </div>
            <div style="height:0.5rem"></div>
        </div>
    `;

    document.body.appendChild(modal);
    // Apply strong inline styles so the modal is centered even if page CSS conflicts
    try {
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.display = 'none';
    // Use setProperty with important to avoid page CSS overrides
    modal.style.setProperty('align-items', 'center', 'important');
    modal.style.setProperty('justify-content', 'center', 'important');
    modal.style.setProperty('display', 'none', 'important');
    modal.style.setProperty('background', 'rgba(0,0,0,0.45)', 'important');
    modal.style.setProperty('z-index', '9999', 'important');
    modal.style.setProperty('padding', '1rem', 'important');

        const content = modal.querySelector('.modal-content');
            if (content) {
            // enforce important styles on content to avoid page overrides
            content.style.setProperty('max-width', '520px', 'important');
            content.style.setProperty('width', '100%', 'important');
            content.style.setProperty('box-sizing', 'border-box', 'important');
            content.style.setProperty('border-radius', '10px', 'important');
            content.style.setProperty('padding', '1rem 1.25rem', 'important');
            content.style.setProperty('display', 'flex', 'important');
            content.style.setProperty('flex-direction', 'column', 'important');
            content.style.setProperty('gap', '0.5rem', 'important');
            content.style.setProperty('background', 'var(--bg-secondary)', 'important');
            content.style.setProperty('color', 'var(--text-primary)', 'important');
            content.style.setProperty('box-shadow', '0 12px 30px rgba(2,6,23,0.3)', 'important');
            // ensure content is above other page elements
            content.style.setProperty('z-index', '10000', 'important');
        
            // Style the action buttons immediately so they render correctly when modal opens
            try {
                const yesBtn = content.querySelector('#globalSignoutYes');
                const noBtn = content.querySelector('#globalSignoutNo');
                if (yesBtn) {
                    yesBtn.style.setProperty('display', 'inline-block', 'important');
                    yesBtn.style.setProperty('text-align', 'center', 'important');
                    yesBtn.style.setProperty('font-size', '0.95rem', 'important');
                    yesBtn.style.setProperty('padding', '0.65rem 1.1rem', 'important');
                    yesBtn.style.setProperty('border-radius', '8px', 'important');
                    yesBtn.style.setProperty('border', 'none', 'important');
                    yesBtn.style.setProperty('background', 'linear-gradient(135deg, #00d4aa 0%, #00a3ff 100%)', 'important');
                    yesBtn.style.setProperty('color', '#ffffff', 'important');
                    yesBtn.style.setProperty('font-weight', '700', 'important');
                    yesBtn.style.setProperty('box-shadow', '0 8px 24px rgba(0,163,255,0.22)', 'important');
                    yesBtn.style.setProperty('cursor', 'pointer', 'important');
                    yesBtn.style.setProperty('min-width', '84px', 'important');
                }
                if (noBtn) {
                    noBtn.style.setProperty('display', 'inline-block', 'important');
                    noBtn.style.setProperty('text-align', 'center', 'important');
                    noBtn.style.setProperty('font-size', '0.95rem', 'important');
                    noBtn.style.setProperty('padding', '0.55rem 1rem', 'important');
                    noBtn.style.setProperty('border-radius', '8px', 'important');
                    noBtn.style.setProperty('background', 'transparent', 'important');
                    noBtn.style.setProperty('color', 'var(--text-secondary, #cbd5e1)', 'important');
                    noBtn.style.setProperty('border', '1px solid rgba(255,255,255,0.08)', 'important');
                    noBtn.style.setProperty('cursor', 'pointer', 'important');
                    noBtn.style.setProperty('min-width', '72px', 'important');
                }
            } catch (err) {
                console.warn('[signout-modal] failed to style buttons inline', err);
            }
        }
    } catch (err) {
        console.warn('[signout-modal] failed to apply inline styles', err);
    }
    console.log('[signout-modal] globalSignoutModal created');
    return modal;
}

// Show modal and return a Promise<boolean> resolved with true when user confirms
export function showSignOutModal() {
    return new Promise((resolve) => {
        const modal = ensureModal();
        const yes = modal.querySelector('#globalSignoutYes');
        const no = modal.querySelector('#globalSignoutNo');

        function cleanup() {
            modal.style.display = 'none';
            yes.removeEventListener('click', onYes);
            no.removeEventListener('click', onNo);
        }

        function onYes(e) {
            e.preventDefault();
            cleanup();
            resolve(true);
        }

        function onNo(e) {
            e.preventDefault();
            cleanup();
            resolve(false);
        }

        yes.addEventListener('click', onYes);
        no.addEventListener('click', onNo);

    // show (use setProperty important to beat conflicting CSS)
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('align-items', 'center', 'important');
    modal.style.setProperty('justify-content', 'center', 'important');
    console.log('[signout-modal] modal shown');
    });
}

// Convenience: attach to a button element or selector
export function attachSignOutHandler(btn) {
    const selector = (typeof btn === 'string' && btn) ? btn : '#signOutBtn';

    const performSignout = async () => {
        try {
            const mod = await import('./firebase-auth.js');
            const firebaseAuth = mod.firebaseAuth;
            if (firebaseAuth && typeof firebaseAuth.signout === 'function') {
                await firebaseAuth.signout();
            } else if (window.firebaseAuth && typeof window.firebaseAuth.signout === 'function') {
                await window.firebaseAuth.signout();
            }
        // Ensure buttons match dashboard visuals even on pages that don't include the global button styles
        try {
            const yesBtn = modal.querySelector('#globalSignoutYes');
            const noBtn = modal.querySelector('#globalSignoutNo');
            if (yesBtn) {
                yesBtn.style.setProperty('padding', '0.6rem 1.1rem', 'important');
                yesBtn.style.setProperty('border-radius', '8px', 'important');
                yesBtn.style.setProperty('border', 'none', 'important');
                yesBtn.style.setProperty('background', 'linear-gradient(135deg, #00d4aa 0%, #00a3ff 100%)', 'important');
                yesBtn.style.setProperty('color', '#ffffff', 'important');
                yesBtn.style.setProperty('font-weight', '700', 'important');
                yesBtn.style.setProperty('box-shadow', '0 8px 24px rgba(0,163,255,0.22)', 'important');
                yesBtn.style.setProperty('cursor', 'pointer', 'important');
                yesBtn.style.setProperty('min-width', '84px', 'important');
            }
            if (noBtn) {
                noBtn.style.setProperty('padding', '0.5rem 1rem', 'important');
                noBtn.style.setProperty('border-radius', '8px', 'important');
                noBtn.style.setProperty('background', 'transparent', 'important');
                noBtn.style.setProperty('color', 'var(--text-secondary, #cbd5e1)', 'important');
                noBtn.style.setProperty('border', '1px solid rgba(255,255,255,0.08)', 'important');
                noBtn.style.setProperty('cursor', 'pointer', 'important');
                noBtn.style.setProperty('min-width', '72px', 'important');
            }
        } catch (err) {
            console.warn('[signout-modal] failed to style buttons inline', err);
        }
        } catch (err) {
            console.error('Error signing out:', err);
        }
        window.location.href = '../index.html';
    };

    const attachToElement = (element) => {
        if (!element) return false;
        if (element.__signoutAttached) return true;
        element.addEventListener('click', async (e) => {
            e.preventDefault();
            const confirmed = await showSignOutModal();
            if (confirmed) await performSignout();
        });
        element.__signoutAttached = true;
        console.log('[signout-modal] attached signout handler to element', element);
        return true;
    };

    // If caller provided an actual element reference
    if (btn && typeof btn !== 'string') {
        if (!attachToElement(btn)) {
            document.addEventListener('DOMContentLoaded', () => attachToElement(btn), { once: true });
        }
        return;
    }

    // Try attach now
    if (attachToElement(document.querySelector(selector))) return;

    // Wait for DOMContentLoaded then try again
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (attachToElement(document.querySelector(selector))) return;
        }, { once: true });
    }

    // Fallback: delegated click handler so dynamically created buttons work
    if (!document.__signoutDelegated) {
        document.addEventListener('click', async (e) => {
            const target = e.target.closest(selector);
            if (!target) return;
            console.log('[signout-modal] delegated click detected on', target);
            e.preventDefault();
            const confirmed = await showSignOutModal();
            if (confirmed) await performSignout();
        });
        document.__signoutDelegated = true;
        console.log('[signout-modal] installed delegated click handler for selector', selector);
    }
}
