import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { questions as defaultQuestions } from './default_questions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.get('/ping', (req, res) => res.send('pong'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

/* ─── Helpers ─── */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  if (rooms[code]) return makeCode();
  return code;
}

// CRITICAL: Strip the non-serializable timeoutId before emitting over socket
function roomPayload(room) {
  const { timeoutId, ...safe } = room;
  return safe;
}

// Emit a clean room object to all clients in a room
function emitRoom(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit('roomUpdated', roomPayload(room));
}

const rooms = {};

const QUESTION_TIME_LIMIT = 20; // seconds

/* ─── Question Sets ─── */
const QUESTION_SETS_PATH = path.join(__dirname, 'custom_questions.json');
let questionSets = [];

function makeSetId() {
  return 'set_' + Math.random().toString(36).substring(2, 10);
}

function loadQuestionSets() {
  try {
    if (fs.existsSync(QUESTION_SETS_PATH)) {
      const data = JSON.parse(fs.readFileSync(QUESTION_SETS_PATH, 'utf8'));
      if (!Array.isArray(data)) {
        // Migrate old format
        questionSets = [];
        if (data.default && data.default.length > 0)
          questionSets.push({ id: 'set_default', name: 'Default Bank', questions: data.default });
        if (data.mauritius && data.mauritius.length > 0)
          questionSets.push({ id: 'set_mauritius', name: 'Mauritius Custom', questions: data.mauritius });
        if (data.tgswadi && data.tgswadi.length > 0)
          questionSets.push({ id: 'set_tgswadi', name: 'TGS Wadi Custom', questions: data.tgswadi });
        saveQuestionSets();
        console.log('✓ Migrated old question bank to new sets format');
        return;
      }
      questionSets = data;
    }
    if (questionSets.length === 0) {
      questionSets = [{ id: 'set_default', name: 'Default Bank', questions: [...defaultQuestions] }];
      saveQuestionSets();
    }
  } catch (err) {
    console.error('Error loading question sets:', err);
    questionSets = [{ id: 'set_default', name: 'Default Bank', questions: [...defaultQuestions] }];
  }
}

function saveQuestionSets() {
  try {
    fs.writeFileSync(QUESTION_SETS_PATH, JSON.stringify(questionSets, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving question sets:', err);
  }
}

loadQuestionSets();

/* ─── Accounts / Sessions ─── */
const ACCOUNTS_PATH = path.join(__dirname, 'accounts.json');
let accounts = [];

function loadAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_PATH)) {
      accounts = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading accounts:', err);
  }
}

function saveAccounts() {
  try {
    fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving accounts:', err);
  }
}

loadAccounts();

/* ─── Quiz History Persistence ─── */
const HISTORY_PATH = path.join(__dirname, 'game_history.json');
let gameHistory = [];

function loadGameHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      gameHistory = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading game history:', err);
  }
}

function recordGameHistory(room) {
  try {
    const playersList = Object.values(room.players || {}).map(p => ({
      name: p.name,
      country: p.country,
      score: p.score || 0
    })).sort((a, b) => b.score - a.score);

    const historyRecord = {
      id: 'game_' + Date.now(),
      code: room.code,
      endedAt: Date.now(),
      totalQuestions: room.questions ? room.questions.length : 0,
      playerCount: playersList.length,
      leaderboard: playersList
    };

    gameHistory.unshift(historyRecord);
    if (gameHistory.length > 100) gameHistory = gameHistory.slice(0, 100);

    fs.writeFileSync(HISTORY_PATH, JSON.stringify(gameHistory, null, 2), 'utf8');
    console.log(`💾 Saved quiz scores and history for room ${room.code}`);
  } catch (err) {
    console.error('Error recording game history:', err);
  }
}

loadGameHistory();

const sessions = {}; // token -> user object

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/* ─── Game logic helpers ─── */
function performReveal(code) {
  const room = rooms[code];
  if (!room) { console.error(`performReveal: room ${code} not found`); return; }
  if (room.status !== 'question') { console.log(`performReveal: room ${code} status is '${room.status}', skipping`); return; }

  // Cancel any pending auto-reveal timer
  if (room.timeoutId) {
    clearTimeout(room.timeoutId);
    room.timeoutId = null;
  }

  const qIndex = room.currentQuestion;
  const q = room.questions?.[qIndex];
  const correctIndex = q ? q.correct : 0;
  const answersForQ = room.answers[qIndex] || {};
  const questionStartedAt = room.questionStartedAt || Date.now();

  // Score players
  Object.entries(answersForQ).forEach(([pid, answerData]) => {
    const choice = typeof answerData === 'object' ? answerData.answer : answerData;
    const answeredAt = typeof answerData === 'object' ? answerData.answeredAt : Date.now();
    if (choice === correctIndex && room.players[pid]) {
      const elapsed = (answeredAt - questionStartedAt) / 1000;
      const speedRatio = Math.max(0, 1 - elapsed / QUESTION_TIME_LIMIT);
      const speedBonus = Math.round(speedRatio * 50);
      const points = 100 + speedBonus;
      room.players[pid].score = (room.players[pid].score || 0) + points;
      room.players[pid].lastPoints = points;
    } else if (room.players[pid]) {
      room.players[pid].lastPoints = 0;
    }
  });

  // Players who didn't answer
  Object.keys(room.players).forEach((pid) => {
    if (!answersForQ[pid]) {
      room.players[pid].lastPoints = 0;
    }
  });

  room.status = 'reveal';
  room.lastActiveAt = Date.now();
  emitRoom(code);
  console.log(`✓ Answer revealed for Q${qIndex + 1} in room ${code}`);
}

function scheduleAutoReveal(code, questionIndex) {
  const room = rooms[code];
  if (!room) return;
  if (room.timeoutId) clearTimeout(room.timeoutId);

  room.timeoutId = setTimeout(() => {
    const r = rooms[code];
    if (!r || r.status !== 'question' || r.currentQuestion !== questionIndex) return;
    console.log(`⏱ Auto-reveal triggered for Q${questionIndex + 1} in room ${code}`);
    io.to(code).emit('timeUp', { questionIndex });
    performReveal(code);
  }, room.timeLimit * 1000);
}

/* ─── Socket handlers ─── */
io.on('connection', (socket) => {
  console.log('✓ Client connected:', socket.id);

  /* ── AUTH ── */
  socket.on('login', ({ id, password }, callback) => {
    const user = accounts.find((a) => a.id === id && a.password === password);
    if (user) {
      const token = generateToken();
      sessions[token] = user;
      callback({ success: true, token, user: { id: user.id, name: user.name, role: user.role } });
      console.log(`✓ User ${id} logged in as ${user.role}`);
    } else {
      callback({ error: 'Invalid ID or Password' });
    }
  });

  socket.on('verifySession', ({ token }, callback) => {
    const user = sessions[token];
    if (user) {
      callback({ success: true, user: { id: user.id, name: user.name, role: user.role } });
    } else {
      callback({ error: 'Invalid session' });
    }
  });

  /* ── ADMIN: Accounts ── */
  socket.on('getAccounts', ({ token }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    callback({ accounts: accounts.map(a => ({ id: a.id, name: a.name, role: a.role })) });
  });

  socket.on('createAccount', ({ token, accountData }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    if (accounts.some(a => a.id === accountData.id)) { callback({ error: 'An account with this ID already exists.' }); return; }
    accounts.push(accountData);
    saveAccounts();
    callback({ success: true, accounts: accounts.map(a => ({ id: a.id, name: a.name, role: a.role })) });
    console.log(`✓ Account ${accountData.id} created by admin`);
  });

  socket.on('deleteAccount', ({ token, id }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    if (id === 'admin') { callback({ error: 'Cannot delete the Super Admin account.' }); return; }
    accounts = accounts.filter(a => a.id !== id);
    saveAccounts();
    for (const [sToken, sUser] of Object.entries(sessions)) {
      if (sUser.id === id) delete sessions[sToken];
    }
    callback({ success: true, accounts: accounts.map(a => ({ id: a.id, name: a.name, role: a.role })) });
    console.log(`🗑 Account ${id} deleted by admin`);
  });

  /* ── HOST: Create room ── */
  socket.on('createRoom', ({ token, setIds }, callback) => {
    try {
      const user = sessions[token];
      if (!user) { callback({ error: 'Unauthorized. Please log in.' }); return; }

      let roomQuestions = [];
      if (setIds && setIds.length > 0) {
        setIds.forEach(id => {
          const set = questionSets.find(s => s.id === id);
          if (set) roomQuestions = [...roomQuestions, ...set.questions];
        });
      }
      if (roomQuestions.length === 0) {
        roomQuestions = questionSets[0]?.questions || [...defaultQuestions];
      }

      const code = makeCode();
      rooms[code] = {
        code,
        status: 'lobby',
        currentQuestion: 0,
        players: {},
        answers: {},
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        hostSocketId: socket.id,
        questionStartedAt: null,
        timeLimit: QUESTION_TIME_LIMIT,
        timeoutId: null,          // stored server-side only, never sent to clients
        questions: roomQuestions,
      };
      socket.join(code);
      socket.data = { roomCode: code, role: 'host' };
      callback({ code });
      emitRoom(code);
      console.log(`✓ Room created: ${code} (${roomQuestions.length} questions)`);
    } catch (err) {
      console.error('✗ Error creating room:', err);
      callback({ error: 'Failed to create room' });
    }
  });

  /* ── HOST: Rejoin room ── */
  socket.on('rejoinHost', ({ code, token }, callback) => {
    try {
      const user = sessions[token];
      if (!user) { callback({ error: 'Unauthorized. Please log in.' }); return; }
      const roomCode = (code || '').toUpperCase();
      const room = rooms[roomCode];
      if (!room) { callback({ error: 'Room not found.' }); return; }
      room.hostSocketId = socket.id;
      socket.join(roomCode);
      socket.data = { roomCode, role: 'host' };
      callback({ success: true, room: roomPayload(room) });
      emitRoom(roomCode);
      console.log(`✓ Host rejoined room: ${roomCode}`);
    } catch (err) {
      console.error('✗ Error rejoining host:', err);
      callback({ error: 'Failed to rejoin room' });
    }
  });

  /* ── HOST: Start game ── */
  socket.on('startGame', (code) => {
    const roomCode = typeof code === 'string' ? code.toUpperCase() : (code?.code || '').toUpperCase();
    const room = rooms[roomCode];
    if (!room) { console.error('✗ startGame: room not found:', roomCode); return; }
    room.lastActiveAt = Date.now();
    room.status = 'question';
    room.currentQuestion = 0;
    room.answers = {};
    room.questionStartedAt = Date.now();
    emitRoom(roomCode);
    console.log(`✓ Game started in room: ${roomCode}`);
    scheduleAutoReveal(roomCode, 0);
  });

  /* ── HOST: Reveal answer (manual skip) ── */
  socket.on('revealAnswer', (code) => {
    const roomCode = typeof code === 'string' ? code.toUpperCase() : (code?.code || '').toUpperCase();
    console.log(`📢 revealAnswer received for room: ${roomCode}`);
    performReveal(roomCode);
  });

  /* ── HOST: Next question ── */
  socket.on('nextQuestion', ({ code, nextIndex, isEnd }) => {
    const roomCode = (code || '').toUpperCase();
    const room = rooms[roomCode];
    if (!room) return;
    room.lastActiveAt = Date.now();

    if (room.timeoutId) { clearTimeout(room.timeoutId); room.timeoutId = null; }

    if (isEnd) {
      room.status = 'ended';
      room.questionStartedAt = null;
      recordGameHistory(room);
    } else {
      room.status = 'question';
      room.currentQuestion = nextIndex;
      room.answers = {};
      room.questionStartedAt = Date.now();
      scheduleAutoReveal(roomCode, nextIndex);
    }
    emitRoom(roomCode);
    console.log(isEnd ? `✓ Game ended in room ${roomCode}` : `✓ Advanced to Q${nextIndex + 1} in room ${roomCode}`);
  });

  /* ── ADMIN: Get Game History ── */
  socket.on('getGameHistory', ({ token }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    callback({ history: gameHistory });
  });

  /* ── HOST: Restart game ── */
  socket.on('restartGame', (code) => {
    const roomCode = typeof code === 'string' ? code.toUpperCase() : (code?.code || '').toUpperCase();
    const room = rooms[roomCode];
    if (!room) return;
    room.lastActiveAt = Date.now();
    if (room.timeoutId) { clearTimeout(room.timeoutId); room.timeoutId = null; }
    room.status = 'lobby';
    room.currentQuestion = 0;
    room.answers = {};
    room.questionStartedAt = null;
    Object.keys(room.players).forEach(pid => {
      room.players[pid].score = 0;
      room.players[pid].lastPoints = 0;
    });
    emitRoom(roomCode);
    console.log(`✓ Game restarted in room: ${roomCode}`);
  });

  /* ── PLAYER: Join room ── */
  socket.on('joinRoom', ({ code, name, country, playerId }, callback) => {
    try {
      const roomCode = (code || '').toUpperCase();
      const room = rooms[roomCode];
      if (!room) { callback({ error: 'No room found with that code. Double-check with your host.' }); return; }

      room.lastActiveAt = Date.now();
      const existing = room.players[playerId];
      room.players[playerId] = {
        name,
        country,
        score: existing ? existing.score : 0,
        lastPoints: existing ? existing.lastPoints : 0,
        socketId: socket.id,
      };
      socket.join(roomCode);
      socket.data = { roomCode, playerId, role: 'player' };
      emitRoom(roomCode);
      callback({ success: true, room: roomPayload(room) });
      console.log(`✓ Player "${name}" joined room ${roomCode}`);
    } catch (err) {
      console.error('✗ Error joining room:', err);
      callback({ error: 'Something went wrong. Try again.' });
    }
  });

  /* ── PLAYER: Submit answer ── */
  socket.on('submitAnswer', ({ code, playerId, questionIndex, answerIndex }) => {
    const roomCode = (code || '').toUpperCase();
    const room = rooms[roomCode];
    if (!room || room.status !== 'question') return;
    if (room.currentQuestion !== questionIndex) return;

    if (!room.answers[questionIndex]) room.answers[questionIndex] = {};
    if (room.answers[questionIndex][playerId] !== undefined) return;

    room.answers[questionIndex][playerId] = { answer: answerIndex, answeredAt: Date.now() };
    room.lastActiveAt = Date.now();
    emitRoom(roomCode);
    console.log(`✓ Player ${playerId} answered Q${questionIndex + 1} option ${String.fromCharCode(65 + answerIndex)} in ${roomCode}`);

    // Auto-reveal if all players answered
    const totalPlayers = Object.keys(room.players).length;
    const answeredCount = Object.keys(room.answers[questionIndex]).length;
    if (totalPlayers > 0 && answeredCount >= totalPlayers) {
      setTimeout(() => performReveal(roomCode), 400);
    }
  });

  /* ── SHARED: Get Question Sets ── */
  socket.on('getQuestionSets', ({ token }, callback) => {
    const user = sessions[token];
    if (!user) { callback({ error: 'Unauthorized. Please log in.' }); return; }
    callback({ sets: questionSets });
  });

  /* ── ADMIN: Question Set management ── */
  socket.on('createQuestionSet', ({ token, name }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    const newSet = { id: makeSetId(), name: name || 'Untitled Set', questions: [] };
    questionSets.push(newSet);
    saveQuestionSets();
    callback({ success: true, sets: questionSets });
    console.log(`✓ Question set created: ${newSet.name}`);
  });

  socket.on('renameQuestionSet', ({ token, setId, name }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    const set = questionSets.find(s => s.id === setId);
    if (!set) { callback({ error: 'Set not found.' }); return; }
    set.name = name;
    saveQuestionSets();
    callback({ success: true, sets: questionSets });
  });

  socket.on('deleteQuestionSet', ({ token, setId }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    if (questionSets.length <= 1) { callback({ error: 'Cannot delete the last question set.' }); return; }
    questionSets = questionSets.filter(s => s.id !== setId);
    saveQuestionSets();
    callback({ success: true, sets: questionSets });
    console.log(`🗑 Question set deleted: ${setId}`);
  });

  socket.on('addCustomQuestion', ({ token, setId, question }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    const set = questionSets.find(s => s.id === setId);
    if (!set) { callback({ error: 'Set not found.' }); return; }
    set.questions.push(question);
    saveQuestionSets();
    callback({ success: true, sets: questionSets });
  });

  socket.on('editCustomQuestion', ({ token, setId, index, question }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    const set = questionSets.find(s => s.id === setId);
    if (!set || set.questions[index] === undefined) { callback({ error: 'Question not found.' }); return; }
    set.questions[index] = question;
    saveQuestionSets();
    callback({ success: true, sets: questionSets });
  });

  socket.on('deleteCustomQuestion', ({ token, setId, index }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    const set = questionSets.find(s => s.id === setId);
    if (!set || set.questions[index] === undefined) { callback({ error: 'Question not found.' }); return; }
    set.questions.splice(index, 1);
    saveQuestionSets();
    callback({ success: true, sets: questionSets });
  });

  /* ── ADMIN: Active Rooms ── */
  socket.on('getActiveRooms', ({ token }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    const activeRooms = Object.entries(rooms).map(([code, room]) => ({
      code,
      status: room.status,
      playerCount: Object.keys(room.players).length,
      questionCount: room.questions ? room.questions.length : 0,
      currentQuestion: room.currentQuestion,
      createdAt: room.createdAt,
      lastActiveAt: room.lastActiveAt,
    }));
    callback({ rooms: activeRooms });
  });

  /* ── ADMIN: Terminate Room ── */
  socket.on('terminateRoom', ({ token, code }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') { callback({ error: 'Unauthorized. Admin access required.' }); return; }
    const room = rooms[code];
    if (!room) { callback({ error: 'Room not found.' }); return; }
    if (room.timeoutId) clearTimeout(room.timeoutId);
    io.to(code).emit('roomTerminated', { code, reason: 'The room was terminated by an administrator.' });
    delete rooms[code];
    callback({ success: true });
    console.log(`🗑 Room ${code} terminated by admin`);
  });

  /* ── DISCONNECT ── */
  socket.on('disconnect', () => {
    console.log('✗ Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Culture Bridge server running on port ${PORT}\n`);
});

// Cleanup idle rooms every hour
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach((code) => {
    const room = rooms[code];
    if (now - room.lastActiveAt > 6 * 60 * 60 * 1000) {
      if (room.timeoutId) clearTimeout(room.timeoutId);
      delete rooms[code];
      console.log(`🧹 Cleaned up idle room: ${code}`);
    }
  });
}, 60 * 60 * 1000);
