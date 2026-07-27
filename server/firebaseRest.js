// server/firebaseRest.js
// Firebase Realtime Database persistence using the REST API.
// No service-account credentials required – relies on the database security
// rules allowing read/write (you can lock down rules later with auth tokens).

const DB_URL = process.env.FIREBASE_DATABASE_URL ||
  'https://culture-bridge-1f9a3-default-rtdb.asia-southeast1.firebasedatabase.app';

const SECRET = process.env.FIREBASE_DATABASE_SECRET || ''; // optional auth

function authParam() {
  return SECRET ? `?auth=${SECRET}` : '';
}

async function dbGet(path) {
  try {
    const url = `${DB_URL}/${path}.json${authParam()}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Firebase GET /${path} failed: ${res.status}`);
      return null;
    }
    return await res.json(); // null if node doesn't exist
  } catch (err) {
    console.error(`Firebase GET /${path} error:`, err.message);
    return null;
  }
}

async function dbSet(path, data) {
  try {
    const url = `${DB_URL}/${path}.json${authParam()}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Firebase PUT /${path} failed: ${res.status} – ${text}`);
    }
  } catch (err) {
    console.error(`Firebase PUT /${path} error:`, err.message);
  }
}

// ── Question Sets ──────────────────────────────────────────────────────────

export async function loadQuestionSetsFromDB() {
  const data = await dbGet('questionSets');
  if (!data) return null;
  // Firebase stores arrays as objects with numeric keys; restore to array
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

export async function saveQuestionSetsToDB(sets) {
  await dbSet('questionSets', sets);
}

// ── Accounts ───────────────────────────────────────────────────────────────

export async function loadAccountsFromDB() {
  const data = await dbGet('accounts');
  if (!data) return null;
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

export async function saveAccountsToDB(accounts) {
  await dbSet('accounts', accounts);
}

// ── Game History ───────────────────────────────────────────────────────────

export async function loadGameHistoryFromDB() {
  const data = await dbGet('gameHistory');
  if (!data) return [];
  const arr = Array.isArray(data) ? data : Object.values(data);
  return arr.filter(Boolean).sort((a, b) => b.endedAt - a.endedAt);
}

export async function addGameHistoryToDB(record) {
  await dbSet(`gameHistory/${record.id}`, record);
}
