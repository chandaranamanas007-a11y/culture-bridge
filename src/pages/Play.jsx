import { useEffect, useRef, useState, useCallback } from "react";
import { socket, SERVER_URL } from "../socket.js";
import { questions } from "../data/questions.js";
import { Link } from "react-router-dom";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";

const OPTION_COLORS = [
  "bg-red-500 hover:bg-red-600 active:bg-red-700 text-white",
  "bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white",
  "bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white",
  "bg-green-500 hover:bg-green-600 active:bg-green-700 text-white",
];

function makePlayerId() {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

export default function Play() {
  const [code, setCode] = useState(() => localStorage.getItem("playerRoomCode") || "");
  const [name, setName] = useState(() => localStorage.getItem("playerName") || "");
  const [country, setCountry] = useState(() => localStorage.getItem("playerCountry") || "India");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [room, setRoom] = useState(null);
  const [playerId] = useState(() => {
    let pid = localStorage.getItem("playerId");
    if (!pid) {
      pid = makePlayerId();
      localStorage.setItem("playerId", pid);
    }
    return pid;
  });
  const [selected, setSelected] = useState(null);
  const [answeredIndex, setAnsweredIndex] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);

  const prevQuestionRef = useRef(null);
  const prevStatusRef = useRef(null);

  useEffect(() => {
    const handler = (updatedRoom) => {
      setRoom(updatedRoom);
    };
    socket.on("roomUpdated", handler);
    return () => socket.off("roomUpdated", handler);
  }, []);

  // Wake up Render backend
  useEffect(() => {
    fetch(`${SERVER_URL}/ping`).catch((err) => console.log("Wake-up ping error:", err));
  }, []);

  // Auto rejoin if active session exists
  useEffect(() => {
    const savedCode = localStorage.getItem("playerRoomCode");
    const savedName = localStorage.getItem("playerName");
    const savedCountry = localStorage.getItem("playerCountry");

    if (savedCode && savedName && savedCountry) {
      socket.emit(
        "joinRoom",
        { code: savedCode, name: savedName, country: savedCountry, playerId },
        (res) => {
          if (res.error) {
            localStorage.removeItem("playerRoomCode");
          } else {
            setCode(savedCode);
            setJoined(true);
            setRoom(res.room);
          }
        }
      );
    }
  }, [playerId]);

  // Timer
  useEffect(() => {
    if (room?.status === "question" && room?.questionStartedAt) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - room.questionStartedAt) / 1000;
        const remaining = Math.max(0, room.timeLimit - elapsed);
        setTimeLeft(remaining);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [room?.status, room?.questionStartedAt, room?.timeLimit]);

  // Handle Confetti for correct answers and end of game
  useEffect(() => {
    if (room?.status === "reveal" && prevStatusRef.current === "question") {
      const q = questions[room.currentQuestion];
      if (answeredIndex === q?.correct) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#2FBFAE", "#F2A93B", "#FFFFFF"]
        });
      }
    } else if (room?.status === "ended" && prevStatusRef.current !== "ended") {
      // Big confetti for end
      const duration = 3000;
      const end = Date.now() + duration;
      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#2FBFAE", "#F2A93B"]
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#2FBFAE", "#F2A93B"]
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
    prevStatusRef.current = room?.status;
  }, [room?.status, room?.currentQuestion, answeredIndex]);

  useEffect(() => {
    if (room?.currentQuestion !== prevQuestionRef.current) {
      prevQuestionRef.current = room?.currentQuestion ?? null;
      setSelected(null);
      setAnsweredIndex(null);
    }
  }, [room?.currentQuestion]);

  const handleJoin = useCallback(
    (e) => {
      e.preventDefault();
      setError("");
      const roomCode = code.trim().toUpperCase();
      if (!roomCode || !name.trim()) {
        setError("Enter both a room code and your name.");
        return;
      }
      socket.emit(
        "joinRoom",
        { code: roomCode, name: name.trim(), country, playerId },
        (res) => {
          if (res.error) {
            setError(res.error);
          } else {
            setCode(roomCode);
            localStorage.setItem("playerRoomCode", roomCode);
            localStorage.setItem("playerName", name.trim());
            localStorage.setItem("playerCountry", country);
            setJoined(true);
            setRoom(res.room);
          }
        }
      );
    },
    [code, name, country, playerId]
  );

  const handleExit = () => {
    localStorage.removeItem("playerRoomCode");
    setJoined(false);
    setRoom(null);
  };

  const submitAnswer = useCallback(
    (i) => {
      if (selected !== null || !room) return;
      setSelected(i);
      setAnsweredIndex(i);
      socket.emit("submitAnswer", {
        code,
        playerId,
        questionIndex: room.currentQuestion,
        answerIndex: i,
      });
    },
    [selected, room, code, playerId]
  );

  const getFlagEmoji = (c) => {
    if (c === 'India') return '🇮🇳';
    if (c === 'Mauritius') return '🇲🇺';
    return '🌍';
  };

  /* ── Join form ─────────────────────────────── */
  if (!joined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-lagoon uppercase mb-4">
            Join a game
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold mb-8 text-cream">
            Culture Bridge
          </h1>
          <form
            onSubmit={handleJoin}
            className="card p-8 flex flex-col gap-5 shadow-2xl"
          >
            <div className="text-left">
              <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                Room code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="ABCD"
                className="w-full mt-2 bg-surface2 border-2 border-white/10 rounded-xl px-4 py-4 font-mono text-3xl tracking-[0.3em] text-center focus:border-saffron focus:bg-surface outline-none transition-all placeholder:text-white/20 uppercase"
              />
            </div>
            <div className="text-left">
              <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                Your nickname
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Manas"
                maxLength={15}
                className="w-full mt-2 bg-surface2 border-2 border-white/10 rounded-xl px-4 py-3 text-lg focus:border-saffron focus:bg-surface outline-none transition-all placeholder:text-white/20"
              />
            </div>
            <div className="text-left">
              <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                Joining from
              </label>
              <div className="relative">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full mt-2 bg-surface2 border-2 border-white/10 rounded-xl px-4 py-3 text-lg appearance-none focus:border-saffron focus:bg-surface outline-none transition-all cursor-pointer"
                >
                  <option value="India">India 🇮🇳</option>
                  <option value="Mauritius">Mauritius 🇲🇺</option>
                  <option value="Elsewhere">Elsewhere 🌍</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none mt-1 opacity-50">
                  ▼
                </div>
              </div>
            </div>
            <AnimatePresence>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-lg border border-red-400/20"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <button
              type="submit"
              className="bg-lagoon text-night font-bold text-lg py-4 mt-2 rounded-xl hover:bg-lagoon2 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-lagoon/20"
            >
              Enter Game
            </button>
          </form>
          <div className="mt-8">
            <Link to="/" className="text-muted text-sm hover:text-cream transition-colors underline underline-offset-4">
              Back to Home
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── Connecting… ───────────────────────────── */
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-lagoon border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted font-mono animate-pulse">Entering room {code}...</p>
        </div>
      </div>
    );
  }

  const myPlayer = room.players?.[playerId];
  const myScore = myPlayer?.score || 0;
  const lastPoints = myPlayer?.lastPoints || 0;

  /* ── Lobby: waiting for host ───────────────── */
  if (room.status === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="card p-10 w-full max-w-sm shadow-2xl"
        >
          <div className="w-20 h-20 bg-surface2 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl shadow-inner border border-white/5">
            {getFlagEmoji(country)}
          </div>
          <p className="font-mono text-sm tracking-widest text-lagoon uppercase mb-2">
            You're In!
          </p>
          <h1 className="font-display text-3xl font-bold mb-6 text-cream">
            {name}
          </h1>
          <div className="h-px w-full bg-white/10 my-6"></div>
          <p className="text-muted font-medium">See your nickname on screen?</p>
          <div className="mt-8">
            <p className="text-sm text-muted/70 mb-3 animate-pulse">Waiting for host to start</p>
            <div className="w-6 h-6 mx-auto border-2 border-muted border-t-transparent rounded-full animate-spin" />
          </div>
        </motion.div>
      </div>
    );
  }

  const q = questions[room.currentQuestion];

  /* ── Answering a question ──────────────────── */
  if (room.status === "question" && q) {
    return (
      <div className="min-h-screen flex flex-col pt-4 px-4 pb-8 max-w-md mx-auto">
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6 px-2">
          <span className="bg-surface2 px-4 py-2 rounded-full font-mono text-sm font-bold text-cream border border-white/5 shadow-sm">
            Q{room.currentQuestion + 1}
          </span>
          <span className="bg-saffron/10 text-saffron px-4 py-2 rounded-full font-mono font-bold text-sm border border-saffron/20 shadow-sm flex items-center gap-2">
            🏆 {myScore}
          </span>
        </div>
        
        {/* Timer Bar */}
        <div className="h-3 w-full bg-surface2 rounded-full overflow-hidden mb-8 shadow-inner relative">
          <motion.div 
            className={`absolute top-0 left-0 h-full rounded-full ${timeLeft < 5 ? 'bg-red-500' : 'bg-lagoon'}`}
            initial={{ width: "100%" }}
            animate={{ width: `${(timeLeft / room.timeLimit) * 100}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
          />
        </div>
        
        {/* Question Prompt */}
        <div className="mb-6 px-2">
          <h2 className="font-display text-xl sm:text-2xl font-bold leading-snug text-cream">
            {q.prompt}
          </h2>
        </div>
        
        {/* Options Grid */}
        <div className="flex-1 flex flex-col gap-3">
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            return (
              <motion.button
                key={i}
                whileTap={{ scale: selected !== null ? 1 : 0.95 }}
                onClick={() => submitAnswer(i)}
                disabled={selected !== null}
                className={`flex-1 relative overflow-hidden rounded-2xl border-b-8 transition-all duration-300 flex items-center justify-center p-6 shadow-xl ${
                  isSelected
                    ? `${OPTION_COLORS[i]} border-black/30 ring-4 ring-white/50 scale-[1.02] z-10`
                    : selected !== null
                    ? "bg-surface2 border-white/5 text-transparent cursor-not-allowed opacity-30 shadow-none"
                    : `${OPTION_COLORS[i]} border-black/20 hover:brightness-110`
                }`}
              >
                {/* Large letter in background */}
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-8xl font-black opacity-20 pointer-events-none ${selected !== null && !isSelected ? 'hidden' : ''}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                
                {/* Answer text (visible if not locked, or if this is the selected answer) */}
                <div className={`relative z-10 w-full flex flex-col items-center justify-center gap-1 ${selected !== null && !isSelected ? 'opacity-0' : 'opacity-100'}`}>
                  {isSelected ? (
                    <motion.span 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="font-bold text-xl sm:text-2xl drop-shadow-md text-center"
                    >
                      Answer Sent!
                    </motion.span>
                  ) : (
                    <span className="font-bold text-lg sm:text-xl drop-shadow-md text-center">
                      {opt}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Reveal: show correct answer ───────────── */
  if (room.status === "reveal" && q) {
    const wasCorrect = answeredIndex === q.correct;
    const answered = answeredIndex !== null;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className={`card w-full max-w-sm p-10 shadow-2xl border-b-8 ${wasCorrect ? 'bg-lagoon/10 border-lagoon' : 'bg-red-500/10 border-red-500'}`}
        >
          {answered ? (
            <>
              <div className="text-6xl mb-6">{wasCorrect ? "🎉" : "😅"}</div>
              <p className={`font-display text-4xl font-bold mb-2 ${wasCorrect ? "text-lagoon" : "text-red-400"}`}>
                {wasCorrect ? "Correct!" : "Incorrect"}
              </p>
              
              <div className="mt-8 flex flex-col items-center justify-center">
                <span className="text-sm font-mono text-muted uppercase tracking-widest mb-1">Points Earned</span>
                <span className="text-4xl font-mono font-black text-cream">+{lastPoints}</span>
                {wasCorrect && lastPoints > 100 && (
                  <motion.span 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-saffron font-bold text-sm mt-2 bg-saffron/20 px-3 py-1 rounded-full"
                  >
                    +{lastPoints - 100} Speed Bonus ⚡
                  </motion.span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl mb-6">⏰</div>
              <p className="font-display text-3xl font-bold mb-4 text-muted">Time's Up!</p>
              <span className="text-xl font-mono font-bold text-cream">+0</span>
            </>
          )}
          
          <div className="h-px w-full bg-white/10 my-8"></div>
          <div className="flex justify-between items-center px-4">
            <span className="text-muted font-medium">Total Score</span>
            <span className="font-mono text-xl font-bold text-saffron">{myScore}</span>
          </div>
        </motion.div>
        <p className="mt-10 text-muted font-medium animate-pulse">Look at the host screen...</p>
      </div>
    );
  }

  /* ── Game ended ────────────────────────────── */
  if (room.status === "ended") {
    const players = Object.entries(room.players || {}).map(([id, p]) => ({
      id,
      ...p,
    }));
    const ranked = [...players].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );
    const myRank = ranked.findIndex((p) => p.id === playerId) + 1;
    
    let rankColor = "text-cream";
    if (myRank === 1) rankColor = "text-saffron drop-shadow-[0_0_10px_rgba(242,169,59,0.5)]";
    if (myRank === 2) rankColor = "text-[#C0C0C0]";
    if (myRank === 3) rankColor = "text-[#CD7F32]";

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center">
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="card w-full max-w-sm p-10 shadow-2xl relative overflow-hidden"
        >
          {myRank <= 3 && (
            <div className="absolute top-0 left-0 w-full h-2 bg-saffron"></div>
          )}
          
          <p className="font-mono text-xs uppercase tracking-widest text-muted mb-4">Final Rank</p>
          <div className={`font-display text-7xl font-bold mb-8 ${rankColor}`}>
            #{myRank}
          </div>
          
          <div className="bg-surface2 rounded-2xl p-6 border border-white/5 mb-8">
            <p className="text-sm text-muted mb-1 font-medium">Total Score</p>
            <p className="font-mono text-4xl font-black text-cream">{myScore}</p>
          </div>
          
          <p className="text-lg font-medium text-cream/90">
            {myRank === 1 ? "You're the Culture Master! 👑" : 
             myRank <= 3 ? "On the podium! Great job! 👏" : 
             "Thanks for playing! 🌍"}
          </p>
        </motion.div>
        
        <Link
          to="/"
          onClick={handleExit}
          className="mt-12 bg-surface2 text-cream px-8 py-4 rounded-xl hover:bg-surface transition-colors border border-white/10 font-medium"
        >
          Exit to Home
        </Link>
      </div>
    );
  }

  return null;
}
