import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

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

io.on('connection', (socket) => {
  console.log('✓ Client connected:', socket.id);

  /* ─── HOST: Create room ─── */
  socket.on('createRoom', ({ password }, callback) => {
    try {
      if (password !== HOST_PASSWORD) {
        callback({ error: 'Incorrect host password!' });
        return;
      }
      const code = makeCode();
      rooms[code] = {
        status: 'lobby',
        currentQuestion: 0,
        players: {},
        answers: {},
        createdAt: Date.now(),
        hostSocketId: socket.id,
        questionStartedAt: null,
        timeLimit: QUESTION_TIME_LIMIT,
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

  /* ─── HOST: Start game ─── */
  socket.on('startGame', (code) => {
    const room = rooms[code];
    if (!room) return;
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

  /* ─── DISCONNECT ─── */
  socket.on('disconnect', () => {
    console.log('✗ Client disconnected:', socket.id);
  });
});

/* ─── Auto-reveal timer ─── */
function scheduleAutoReveal(code, questionIndex) {
  setTimeout(() => {
    const room = rooms[code];
    if (!room) return;
    if (room.status !== 'question') return;
    if (room.currentQuestion !== questionIndex) return;
    // Time's up — emit a timeUp event so host auto-reveals
    io.to(code).emit('timeUp', { questionIndex });
    console.log(`⏱ Time's up for Q${questionIndex + 1} in room ${code}`);
  }, (QUESTION_TIME_LIMIT + 1) * 1000); // +1s grace
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Culture Bridge server running on port ${PORT}\n`);
});
