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

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  if (rooms[code]) return makeCode();
  return code;
}

const rooms = {};

const QUESTION_TIME_LIMIT = 20; // seconds

const HOST_PASSWORD = process.env.HOST_PASSWORD || 'interact2026';

const CUSTOM_QUESTIONS_PATH = path.join(__dirname, 'custom_questions.json');
let customQuestions = { default: [], mauritius: [], tgswadi: [] };

function loadCustomQuestions() {
  try {
    let needsSave = false;
    if (fs.existsSync(CUSTOM_QUESTIONS_PATH)) {
      const data = fs.readFileSync(CUSTOM_QUESTIONS_PATH, 'utf8');
      customQuestions = JSON.parse(data);
      if (!customQuestions.mauritius) customQuestions.mauritius = [];
      if (!customQuestions.tgswadi) customQuestions.tgswadi = [];
    }
    
    // Seed default questions if empty
    if (!customQuestions.default || customQuestions.default.length === 0) {
      customQuestions.default = [...defaultQuestions];
      needsSave = true;
    }

    if (needsSave) {
      saveCustomQuestions();
    }
  } catch (err) {
    console.error('Error loading custom questions:', err);
  }
}

function saveCustomQuestions() {
  try {
    fs.writeFileSync(CUSTOM_QUESTIONS_PATH, JSON.stringify(customQuestions, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving custom questions:', err);
  }
}

loadCustomQuestions();

const MAURITIUS_ADMIN_PASSWORD = process.env.MAURITIUS_ADMIN_PASSWORD || 'mauritius2026';
const TGSWADI_ADMIN_PASSWORD = process.env.TGSWADI_ADMIN_PASSWORD || 'tgswadi2026';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'Interact2026';

function verifyAdminPassword(club, password) {
  if (club === 'mauritius') return password === MAURITIUS_ADMIN_PASSWORD;
  if (club === 'tgswadi') return password === TGSWADI_ADMIN_PASSWORD;
  if (club === 'default') return password === DEFAULT_ADMIN_PASSWORD;
  return false;
}

const ACCOUNTS_PATH = path.join(__dirname, 'accounts.json');
let accounts = [];

function loadAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_PATH)) {
      const data = fs.readFileSync(ACCOUNTS_PATH, 'utf8');
      accounts = JSON.parse(data);
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

const sessions = {}; // token -> user object

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

io.on('connection', (socket) => {
  console.log('✓ Client connected:', socket.id);

  /* ─── AUTH: Login ─── */
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

  /* ─── AUTH: Verify Session ─── */
  socket.on('verifySession', ({ token }, callback) => {
    const user = sessions[token];
    if (user) {
      callback({ success: true, user: { id: user.id, name: user.name, role: user.role } });
    } else {
      callback({ error: 'Invalid session' });
    }
  });

  /* ─── ADMIN: Account Management ─── */
  socket.on('getAccounts', ({ token }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') {
      callback({ error: 'Unauthorized. Admin access required.' });
      return;
    }
    // Return accounts without passwords
    const safeAccounts = accounts.map(a => ({ id: a.id, name: a.name, role: a.role }));
    callback({ accounts: safeAccounts });
  });

  socket.on('createAccount', ({ token, accountData }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') {
      callback({ error: 'Unauthorized. Admin access required.' });
      return;
    }
    if (accounts.some(a => a.id === accountData.id)) {
      callback({ error: 'An account with this ID already exists.' });
      return;
    }
    accounts.push(accountData);
    saveAccounts();
    const safeAccounts = accounts.map(a => ({ id: a.id, name: a.name, role: a.role }));
    callback({ success: true, accounts: safeAccounts });
    console.log(`✓ Account ${accountData.id} created by admin`);
  });

  socket.on('deleteAccount', ({ token, id }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') {
      callback({ error: 'Unauthorized. Admin access required.' });
      return;
    }
    if (id === 'admin') {
      callback({ error: 'Cannot delete the Super Admin account.' });
      return;
    }
    accounts = accounts.filter(a => a.id !== id);
    saveAccounts();
    // Also invalidate their sessions
    for (const [sToken, sUser] of Object.entries(sessions)) {
      if (sUser.id === id) {
        delete sessions[sToken];
      }
    }
    const safeAccounts = accounts.map(a => ({ id: a.id, name: a.name, role: a.role }));
    callback({ success: true, accounts: safeAccounts });
    console.log(`🗑 Account ${id} deleted by admin`);
  });

  /* ─── HOST: Create room ─── */
  socket.on('createRoom', ({ token, questionPools }, callback) => {
    try {
      const user = sessions[token];
      if (!user) {
        callback({ error: 'Unauthorized. Please log in.' });
        return;
      }

      // Compile room questions based on selected pools
      let roomQuestions = [];
      const pools = questionPools || { default: true, mauritius: true, tgswadi: true };
      
      if (pools.default && customQuestions.default) {
        roomQuestions = [...roomQuestions, ...customQuestions.default];
      }
      if (pools.mauritius && customQuestions.mauritius) {
        roomQuestions = [...roomQuestions, ...customQuestions.mauritius];
      }
      if (pools.tgswadi && customQuestions.tgswadi) {
        roomQuestions = [...roomQuestions, ...customQuestions.tgswadi];
      }
      
      // Fallback if no pools selected
      if (roomQuestions.length === 0) {
        roomQuestions = [...(customQuestions.default || defaultQuestions)];
      }

      const code = makeCode();
      rooms[code] = {
        status: 'lobby',
        currentQuestion: 0,
        players: {},
        answers: {},
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        hostSocketId: socket.id,
        questionStartedAt: null,
        timeLimit: QUESTION_TIME_LIMIT,
        timeoutId: null,
        questions: roomQuestions,
      };
      socket.join(code);
      socket.data = { ...(socket.data || {}), roomCode: code, role: 'host' };
      callback({ code });
      io.to(code).emit('roomUpdated', rooms[code]);
      console.log('✓ Room created:', code);
    } catch (err) {
      console.error('✗ Error creating room:', err);
      callback({ error: 'Failed to create room' });
    }
  });

  /* ─── HOST: Rejoin room ─── */
  socket.on('rejoinHost', ({ code, token }, callback) => {
    try {
      const user = sessions[token];
      if (!user) {
        callback({ error: 'Unauthorized. Please log in.' });
        return;
      }
      const roomCode = (code || '').toUpperCase();
      const room = rooms[roomCode];
      if (!room) {
        callback({ error: 'Room not found.' });
        return;
      }
      room.hostSocketId = socket.id;
      socket.join(roomCode);
      socket.data = { ...(socket.data || {}), roomCode, role: 'host' };
      callback({ success: true, room });
      io.to(roomCode).emit('roomUpdated', room);
      console.log(`✓ Host rejoined room: ${roomCode}`);
    } catch (err) {
      console.error('✗ Error rejoining host:', err);
      callback({ error: 'Failed to rejoin room' });
    }
  });

  /* ─── HOST: Start game ─── */
  socket.on('startGame', (code) => {
    const room = rooms[code];
    if (!room) return;
    room.lastActiveAt = Date.now();
    room.status = 'question';
    room.currentQuestion = 0;
    room.questionStartedAt = Date.now();
    io.to(code).emit('roomUpdated', room);
    console.log('✓ Game started in room:', code);

    // Auto-reveal after time limit
    scheduleAutoReveal(code, 0);
  });

  /* ─── HOST: Reveal answer ─── */
  socket.on('revealAnswer', ({ code, correctIndex }) => {
    const room = rooms[code];
    if (!room || room.status !== 'question') return;
    room.lastActiveAt = Date.now();
    
    if (room.timeoutId) {
      clearTimeout(room.timeoutId);
      room.timeoutId = null;
    }
    
    const qIndex = room.currentQuestion;
    const answersForQ = room.answers[qIndex] || {};
    const questionStartedAt = room.questionStartedAt || Date.now();

    // Score all correct answers with speed bonus
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

    // Players who didn't answer get 0
    Object.keys(room.players).forEach((pid) => {
      if (!answersForQ[pid]) {
        room.players[pid].lastPoints = 0;
      }
    });

    room.status = 'reveal';
    io.to(code).emit('roomUpdated', room);
    console.log(`✓ Answer revealed for Q${qIndex + 1} in room ${code}`);
  });

  /* ─── HOST: Restart game ─── */
  socket.on('restartGame', (code) => {
    const room = rooms[code];
    if (!room) return;
    room.lastActiveAt = Date.now();

    if (room.timeoutId) {
      clearTimeout(room.timeoutId);
      room.timeoutId = null;
    }
    room.status = 'lobby';
    room.currentQuestion = 0;
    room.answers = {};
    room.questionStartedAt = null;
    // Reset all player scores
    Object.keys(room.players).forEach(pid => {
      room.players[pid].score = 0;
      room.players[pid].lastPoints = 0;
    });
    io.to(code).emit('roomUpdated', room);
    console.log(`✓ Game restarted in room: ${code}`);
  });

  /* ─── HOST: Next question or end ─── */
  socket.on('nextQuestion', ({ code, nextIndex, isEnd }) => {
    const room = rooms[code];
    if (!room) return;
    room.lastActiveAt = Date.now();

    if (room.timeoutId) {
      clearTimeout(room.timeoutId);
      room.timeoutId = null;
    }
    if (isEnd) {
      room.status = 'ended';
      room.questionStartedAt = null;
    } else {
      room.status = 'question';
      room.currentQuestion = nextIndex;
      room.questionStartedAt = Date.now();
      // Schedule auto-reveal for the new question
      scheduleAutoReveal(code, nextIndex);
    }
    io.to(code).emit('roomUpdated', room);
    console.log(
      isEnd
        ? `✓ Game ended in room ${code}`
        : `✓ Advanced to Q${nextIndex + 1} in room ${code}`
    );
  });

  /* ─── PLAYER: Join room ─── */
  socket.on('joinRoom', ({ code, name, country, playerId }, callback) => {
    try {
      const roomCode = (code || '').toUpperCase();
      if (!rooms[roomCode]) {
        callback({
          error: 'No room found with that code. Double-check with your host.',
        });
        return;
      }

      rooms[roomCode].lastActiveAt = Date.now();

      rooms[roomCode].players[playerId] = {
        name,
        country,
        score: 0,
        lastPoints: 0,
        socketId: socket.id,
      };
      socket.join(roomCode);
      socket.data = {
        ...(socket.data || {}),
        roomCode: roomCode,
        playerId,
        role: 'player',
      };

      io.to(roomCode).emit('roomUpdated', rooms[roomCode]);
      callback({ success: true, room: rooms[roomCode] });
      console.log(`✓ Player "${name}" (${playerId}) joined room ${roomCode}`);
    } catch (err) {
      console.error('✗ Error joining room:', err);
      callback({ error: 'Something went wrong. Try again.' });
    }
  });

  /* ─── PLAYER: Submit answer ─── */
  socket.on('submitAnswer', ({ code, playerId, questionIndex, answerIndex }) => {
    const room = rooms[code];
    if (!room) return;
    room.lastActiveAt = Date.now();
    if (room.status !== 'question') return;
    if (room.currentQuestion !== questionIndex) return;

    if (!room.answers[questionIndex]) {
      room.answers[questionIndex] = {};
    }
    if (room.answers[questionIndex][playerId] !== undefined) return;

    room.answers[questionIndex][playerId] = {
      answer: answerIndex,
      answeredAt: Date.now(),
    };
    io.to(code).emit('roomUpdated', room);
    console.log(
      `✓ Player ${playerId} answered Q${questionIndex + 1} with option ${String.fromCharCode(65 + answerIndex)} in room ${code}`
    );
  });

  /* ─── ADMIN: Get Custom Questions ─── */
  socket.on('getCustomQuestions', ({ token }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') {
      callback({ error: 'Unauthorized. Admin access required.' });
      return;
    }
    callback(customQuestions);
  });

  /* ─── ADMIN: Add Custom Question ─── */
  socket.on('addCustomQuestion', ({ token, club, question }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') {
      callback({ error: 'Unauthorized. Admin access required.' });
      return;
    }
    if (!question) {
      callback({ success: true });
      return;
    }
    if (!customQuestions[club]) {
      customQuestions[club] = [];
    }
    customQuestions[club].push(question);
    saveCustomQuestions();
    callback({ success: true, customQuestions });
    console.log(`✓ Custom question added for ${club}`);
  });

  /* ─── ADMIN: Edit Custom Question ─── */
  socket.on('editCustomQuestion', ({ token, club, index, question }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') {
      callback({ error: 'Unauthorized. Admin access required.' });
      return;
    }
    if (customQuestions[club] && customQuestions[club][index] !== undefined) {
      customQuestions[club][index] = question;
      saveCustomQuestions();
      callback({ success: true, customQuestions });
      console.log(`✓ Custom question edited for ${club} at index ${index}`);
    } else {
      callback({ error: 'Question index invalid' });
    }
  });

  /* ─── ADMIN: Delete Custom Question ─── */
  socket.on('deleteCustomQuestion', ({ token, club, index }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') {
      callback({ error: 'Unauthorized. Admin access required.' });
      return;
    }
    if (customQuestions[club] && customQuestions[club][index] !== undefined) {
      customQuestions[club].splice(index, 1);
      saveCustomQuestions();
      callback({ success: true, customQuestions });
      console.log(`✓ Custom question deleted for ${club} at index ${index}`);
    } else {
      callback({ error: 'Question index invalid' });
    }
  });

  /* ─── ADMIN: Get Active Rooms ─── */
  socket.on('getActiveRooms', ({ token }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') {
      callback({ error: 'Unauthorized. Admin access required.' });
      return;
    }
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

  /* ─── ADMIN: Terminate Room ─── */
  socket.on('terminateRoom', ({ token, code }, callback) => {
    const user = sessions[token];
    if (!user || user.role !== 'admin') {
      callback({ error: 'Unauthorized. Admin access required.' });
      return;
    }
    const room = rooms[code];
    if (!room) {
      callback({ error: 'Room not found.' });
      return;
    }
    if (room.timeoutId) {
      clearTimeout(room.timeoutId);
    }
    io.to(code).emit('roomTerminated', { code, reason: 'The room was terminated by an administrator.' });
    delete rooms[code];
    callback({ success: true });
    console.log(`🗑 Room ${code} terminated by admin`);
  });

  /* ─── DISCONNECT ─── */
  socket.on('disconnect', () => {
    console.log('✗ Client disconnected:', socket.id);
  });
});

/* ─── Auto-reveal timer ─── */
function scheduleAutoReveal(code, questionIndex) {
  const room = rooms[code];
  if (!room) return;
  if (room.timeoutId) {
    clearTimeout(room.timeoutId);
  }
  room.timeoutId = setTimeout(() => {
    const r = rooms[code];
    if (!r) return;
    if (r.status !== 'question') return;
    if (r.currentQuestion !== questionIndex) return;
    // Time's up — emit a timeUp event so host auto-reveals
    io.to(code).emit('timeUp', { questionIndex });
    console.log(`⏱ Time's up for Q${questionIndex + 1} in room ${code}`);
  }, (room.timeLimit + 1) * 1000); // +1s grace
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Culture Bridge server running on port ${PORT}\n`);
});

// Cleanup idle rooms every hour
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach((code) => {
    const room = rooms[code];
    // Delete rooms that haven't been active for 6 hours
    if (now - room.lastActiveAt > 6 * 60 * 60 * 1000) {
      if (room.timeoutId) {
        clearTimeout(room.timeoutId);
      }
      delete rooms[code];
      console.log(`🧹 Cleaned up idle room: ${code}`);
    }
  });
}, 60 * 60 * 1000); // check hourly
