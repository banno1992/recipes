// Shares the week, picks, locks, shopping-list ticks and pick history between our phones.
// Firestore holds one document (shared/home); only our two Google accounts may read or write it
// (see the security rules in CLAUDE.md). app.js keeps localStorage as its working copy and calls
// window.rxFire.write(); remote changes come back through sync.apply().
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, onSnapshot, setDoc, deleteField } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

// Public by design: access is controlled by the Firestore security rules, not by this config.
const firebaseConfig = {
  apiKey: 'AIzaSyAnU8IUeYtnmSmfM4_QL_G9dZJQmb9UE8s',
  authDomain: 'recipes-6a608.firebaseapp.com',
  projectId: 'recipes-6a608',
  appId: '1:989004090186:web:94c1888a44ebeaec420fb3',
};

const sync = window.rxSync;
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = initializeFirestore(fb, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const ref = doc(db, 'shared', 'home');

// Swap app.js's delete marker for Firestore's deleteField().
function prep(v) {
  if (v === sync.DEL) return deleteField();
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, prep(x)]));
  return v;
}
function fail(e) {
  console.warn('[sync]', e);
  sync.setStatus(e && e.code === 'permission-denied' ? 'denied' : 'error');
}

let unsub = null;
window.rxFire = {
  // op.fields: replace these top-level fields wholesale; otherwise deep-merge.
  write(op) {
    if (!auth.currentUser) return;
    const opts = op.fields ? { mergeFields: op.fields } : { merge: true };
    setDoc(ref, prep(op.data), opts).catch(fail);
  },
  async signIn() {
    const p = new GoogleAuthProvider();
    try { await signInWithPopup(auth, p); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return signInWithRedirect(auth, p);
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') fail(e);
    }
  },
  signOut() { return signOut(auth); },
};

getRedirectResult(auth).catch(fail);

onAuthStateChanged(auth, user => {
  if (unsub) { unsub(); unsub = null; }
  sync.ready = false;
  sync.user = user ? { uid: user.uid, email: user.email || '', name: user.displayName || user.email || '' } : null;
  if (!user) { sync.setStatus('out'); return; }
  sync.setStatus('in');
  let first = true;
  unsub = onSnapshot(ref, { includeMetadataChanges: true }, snap => {
    if (first) {
      // Wait for the server before deciding whether this is the first phone to sync,
      // so an empty offline cache never overwrites the shared state.
      if (snap.metadata.fromCache) { if (snap.exists()) sync.apply(snap.data()); return; }
      first = false;
      if (!snap.exists()) {
        setDoc(ref, sync.localState(), { merge: true }).catch(fail);
      } else {
        sync.apply(snap.data());
        const extra = sync.newerHistory(snap.data().history || {});
        if (extra) setDoc(ref, { history: extra }, { merge: true }).catch(fail);
      }
      sync.ready = true;
      sync.setStatus('in');
      return;
    }
    if (snap.exists()) sync.apply(snap.data());
  }, fail);
});
