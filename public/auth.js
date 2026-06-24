// ============================================
// STRUCTURA — Firebase Authentication
// ============================================

const StructuraAuth = (function () {
  'use strict';

  let currentUser = null;
  const listeners = [];

  // --- UI elements ---
  const signInBtn = document.getElementById('sign-in-btn');
  const signOutBtn = document.getElementById('sign-out-btn');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const authInfo = document.getElementById('auth-info');
  const authPrompt = document.getElementById('auth-prompt');

  // --- Google sign-in ---
  function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
      console.error('Sign-in failed:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        alert('Sign-in failed: ' + err.message);
      }
    });
  }

  function signOut() {
    auth.signOut().catch(err => console.error('Sign-out failed:', err));
  }

  // --- Auth state listener ---
  auth.onAuthStateChanged(user => {
    currentUser = user;
    updateUI(user);
    listeners.forEach(fn => fn(user));
  });

  function updateUI(user) {
    if (user) {
      if (signInBtn) signInBtn.style.display = 'none';
      if (authPrompt) authPrompt.style.display = 'none';
      if (signOutBtn) signOutBtn.style.display = '';
      if (authInfo) authInfo.style.display = 'flex';
      if (userAvatar) {
        userAvatar.src = user.photoURL || '';
        userAvatar.alt = user.displayName || 'User';
      }
      if (userName) userName.textContent = user.displayName || user.email || 'User';

      // Create/update user doc in Firestore
      db.collection('users').doc(user.uid).set({
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(err => console.error('User doc update failed:', err));
    } else {
      if (signInBtn) signInBtn.style.display = '';
      if (authPrompt) authPrompt.style.display = '';
      if (signOutBtn) signOutBtn.style.display = 'none';
      if (authInfo) authInfo.style.display = 'none';
    }
  }

  // --- Wire up buttons ---
  if (signInBtn) signInBtn.addEventListener('click', signIn);
  if (signOutBtn) signOutBtn.addEventListener('click', signOut);

  // --- Public API ---
  return {
    getUser: () => currentUser,
    onAuthChange: (fn) => { listeners.push(fn); if (currentUser) fn(currentUser); },
    signIn,
    signOut
  };
})();
