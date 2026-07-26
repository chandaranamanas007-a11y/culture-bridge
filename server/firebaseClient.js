// server/firebaseClient.js
import admin from 'firebase-admin';
import fs from 'fs';

// Load service account credentials from env var or file
let serviceAccount;
const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
if (raw?.startsWith('{')) {
  serviceAccount = JSON.parse(raw);
} else {
  const keyPath = raw || './serviceAccountKey.json';
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://culture-bridge-1f9a3-default-rtdb.asia-southeast1.firebasedatabase.app',
  });
}

const db = admin.database();

export const firebase = {
  // ---------- Question Sets ----------
  async loadQuestionSets() {
    const snap = await db.ref('questionSets').once('value');
    return snap.exists() ? snap.val() : null;
  },
  async saveQuestionSets(sets) {
    await db.ref('questionSets').set(sets);
  },

  // ---------- Accounts ----------
  async loadAccounts() {
    const snap = await db.ref('accounts').once('value');
    if (!snap.exists()) return [];
    return Object.values(snap.val());
  },
  async saveAccount(account) {
    await db.ref(`accounts/${account.id}`).set(account);
  },
  async deleteAccount(id) {
    await db.ref(`accounts/${id}`).remove();
  },

  // ---------- Game History ----------
  async loadGameHistory(limit = 100) {
    const snap = await db.ref('gameHistory').orderByChild('endedAt').limitToLast(limit).once('value');
    const data = snap.val() || {};
    return Object.values(data).sort((a, b) => b.endedAt - a.endedAt);
  },
  async addGameHistory(record) {
    await db.ref(`gameHistory/${record.id}`).set(record);
  },
};
