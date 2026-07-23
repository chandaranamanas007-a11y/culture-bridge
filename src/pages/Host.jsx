import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "../socket.js";
import { Link } from "react-router-dom";
import { Copy, Check, Users, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const OPTION_COLORS = [
  "bg-red-500 text-white border-red-600",
  "bg-blue-500 text-white border-blue-600",
  "bg-yellow-500 text-white border-yellow-600",
  "bg-green-500 text-white border-green-600",
];

export default function Host() {
  const [code, setCode] = useState(null);
  const [room, setRoom] = useState(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Quiz Pools Selection
  const [includeDefault, setIncludeDefault] = useState(true);
  const [includeMauritius, setIncludeMauritius] = useState(true);
  const [includeTgsWadi, setIncludeTgsWadi] = useState(true);

  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    const handler = (updatedRoom) => {
      setRoom(updatedRoom);
    };
    socket.on("roomUpdated", handler);
    return () => {
      socket.off("roomUpdated", handler);
    };
  }, []);

  useEffect(() => {
    const savedCode = localStorage.getItem("hostCode");
    const savedPassword = localStorage.getItem("hostPassword");
    if (savedCode && savedPassword) {
      setPassword(savedPassword);
      socket.emit("rejoinHost", { code: savedCode, password: savedPassword }, (res) => {
        if (res && res.room) {
          setCode(savedCode);
          setRoom(res.room);
        } else {
          localStorage.removeItem("hostCode");
          localStorage.removeItem("hostPassword");
        }
      });
    }
  }, []);

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

  const createRoom = useCallback(() => {
    if (creating) return;
    setError("");
    if (!password.trim()) {
      setError("Please enter the host password.");
      return;
    }
    setCreating(true);
    const questionPools = {
      default: includeDefault,
      mauritius: includeMauritius,
      tgswadi: includeTgsWadi,
    };
    socket.emit("createRoom", { password: password.trim(), questionPools }, (res) => {
      if (res && res.code) {
        setCode(res.code);
        localStorage.setItem("hostCode", res.code);
        localStorage.setItem("hostPassword", password.trim());
      } else if (res && res.error) {
        setError(res.error);
      }
      setCreating(false);
    });
  }, [creating, password, includeDefault, includeMauritius, includeTgsWadi]);

  const startGame = useCallback(() => {
    if (code) {
      socket.emit("startGame", code);
    }
  }, [code]);

  const revealAnswer = useCallback(() => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !code) return;
    const q = currentRoom.questions?.[currentRoom.currentQuestion];
    if (!q) return;
    socket.emit("revealAnswer", {
      code,
      correctIndex: q.correct,
    });
  }, [code]);

  const nextQuestion = useCallback(() => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !code) return;
    const next = currentRoom.currentQuestion + 1;
    socket.emit("nextQuestion", {
      code,
      nextIndex: next,
      isEnd: next >= (currentRoom.questions?.length || 0),
    });
  }, [code]);

  const restartGame = useCallback(() => {
    if (code) {
      socket.emit("restartGame", code);
    }
  }, [code]);

  useEffect(() => {
    const handleTimeUp = ({ questionIndex }) => {
      const currentRoom = roomRef.current;
      if (currentRoom && currentRoom.status === "question" && currentRoom.currentQuestion === questionIndex) {
        revealAnswer();
      }
    };
    socket.on("timeUp", handleTimeUp);
    return () => {
      socket.off("timeUp", handleTimeUp);
    };
  }, [revealAnswer]);

  const handleExit = () => {
    localStorage.removeItem("hostCode");
    localStorage.removeItem("hostPassword");
  };

  const handleCopyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /* ── Pre-game: create room ─────────────────── */
  if (!code) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-lagoon uppercase mb-4">
            Host console
          </p>
          <h1 className="font-display text-4xl font-semibold mb-6">
            Start a Culture Bridge game
          </h1>
          <p className="text-muted max-w-sm mb-8 mx-auto">
            This creates a room others can join with a 4-letter code. Share
            your screen so the group can follow along together.
          </p>
          
          <div className="card p-6 flex flex-col gap-4 text-left max-w-sm mx-auto shadow-xl mb-6">
            <div>
              <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                Host Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to host..."
                className="w-full mt-2 bg-surface2 border-2 border-white/10 rounded-xl px-4 py-3 text-lg focus:border-saffron focus:bg-surface outline-none transition-all placeholder:text-white/20"
              />
            </div>

            {/* Question Pools Selection */}
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                Quiz Question Pools
              </label>
              <div className="flex flex-col gap-2.5 bg-surface2/50 p-4 rounded-xl border border-white/5">
                <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeDefault}
                    onChange={(e) => setIncludeDefault(e.target.checked)}
                    className="accent-saffron w-4 h-4 cursor-pointer"
                  />
                  <span>Default Quiz (16 Questions)</span>
                </label>
                <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeMauritius}
                    onChange={(e) => setIncludeMauritius(e.target.checked)}
                    className="accent-saffron w-4 h-4 cursor-pointer"
                  />
                  <span>Mauritius Custom Questions</span>
                </label>
                <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTgsWadi}
                    onChange={(e) => setIncludeTgsWadi(e.target.checked)}
                    className="accent-saffron w-4 h-4 cursor-pointer"
                  />
                  <span>TGS Wadi Custom Questions</span>
                </label>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                {error}
              </p>
            )}
            <button
              onClick={createRoom}
              disabled={creating}
              className="bg-saffron text-night font-bold py-4 rounded-xl hover:bg-saffron2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-saffron/20 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create Room"}
            </button>
          </div>

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
          <p className="text-muted font-mono animate-pulse">Connecting to room...</p>
        </div>
      </div>
    );
  }

  /* ── Game in progress ─────────────────────── */
  const players = Object.entries(room.players || {}).map(([id, p]) => ({
    id,
    ...p,
  }));
  const ranked = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const q = room.questions?.[room.currentQuestion];
  const answersForQ = room.answers?.[room.currentQuestion] || {};
  const answeredCount = Object.keys(answersForQ).length;
  
  const getFlagEmoji = (country) => {
    if (country === 'India') return '🇮🇳';
    if (country === 'Mauritius') return '🇲🇺';
    if (country === 'Both') return '🇮🇳🤝🇲🇺';
    return '🌍';
  };

  return (
    <div className="min-h-screen px-6 py-6 sm:py-10 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-8">
          <p className="font-display italic text-xl text-muted flex items-center gap-2">
            Culture Bridge <span className="text-sm not-italic opacity-50">• HOST</span>
          </p>
          <div className="font-mono text-sm bg-surface2 px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
            <span className="text-muted uppercase text-xs">Room</span>
            <span className="text-saffron font-bold text-lg">{code}</span>
            <button 
              onClick={handleCopyCode} 
              className="p-1 hover:bg-white/10 rounded transition-colors text-muted hover:text-white"
              title="Copy Room Code"
            >
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── LOBBY ── */}
          {room.status === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="card p-8 sm:p-12 text-center shadow-2xl"
            >
              <p className="text-muted font-mono uppercase tracking-widest text-sm mb-2">Join at <span className="text-lagoon font-bold">{window.location.host}/play</span></p>
              <p className="font-mono text-7xl sm:text-9xl font-bold tracking-[0.1em] my-6 text-cream drop-shadow-md">
                {code}
              </p>
              
              <div className="seam-rule w-32 mx-auto my-8 opacity-50" />
              
              <div className="flex items-center justify-center gap-3 text-muted mb-6">
                <Users size={20} />
                <p className="text-lg">
                  <strong className="text-cream">{players.length}</strong> player{players.length === 1 ? "" : "s"} waiting
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center mb-10 min-h-[60px]">
                <AnimatePresence>
                  {players.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted/50 italic flex items-center h-full">Waiting for players to join...</motion.div>
                  ) : (
                    players.map((p) => (
                      <motion.span
                        key={p.id}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-surface px-4 py-2 rounded-full font-medium border border-white/5 flex items-center gap-2 shadow-sm"
                      >
                        {p.name} <span>{getFlagEmoji(p.country)}</span>
                      </motion.span>
                    ))
                  )}
                </AnimatePresence>
              </div>
              <button
                onClick={startGame}
                disabled={players.length === 0}
                className="bg-lagoon text-night font-bold text-lg px-10 py-5 rounded-2xl hover:bg-lagoon2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-lagoon/20 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                Start Game ({room.questions?.length || 0} Questions)
              </button>
            </motion.div>
          )}

          {/* ── QUESTION ── */}
          {room.status === "question" && q && (
            <motion.div
              key={`q-${room.currentQuestion}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="card overflow-hidden shadow-2xl"
            >
              {/* Timer Progress Bar */}
              <div className="h-2 w-full bg-surface2 relative">
                <motion.div 
                  className={`absolute top-0 left-0 h-full ${timeLeft < 5 ? 'bg-red-500' : 'bg-lagoon'}`}
                  initial={{ width: "100%" }}
                  animate={{ width: `${(timeLeft / room.timeLimit) * 100}%` }}
                  transition={{ ease: "linear", duration: 0.1 }}
                />
              </div>
              
              <div className="p-8 sm:p-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <span className="font-mono text-xs uppercase tracking-widest text-muted bg-surface2 px-3 py-1.5 rounded-full inline-block w-max">
                    Question {room.currentQuestion + 1} / {room.questions?.length || 0}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-mono font-bold w-12 text-right">
                      {Math.ceil(timeLeft)}s
                    </span>
                    <span className="text-sm bg-surface2/50 px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-2">
                      {getFlagEmoji(q.country)} {q.country}
                    </span>
                  </div>
                </div>
                
                <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-10 leading-snug">
                  {q.prompt}
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                  {q.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`${OPTION_COLORS[i]} border-b-4 rounded-xl px-6 py-8 text-xl font-medium shadow-md flex items-center gap-4`}
                    >
                      <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between border-t border-white/5 pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {Object.keys(answersForQ).slice(0, 5).map(pid => (
                        <div key={pid} className="w-8 h-8 rounded-full bg-surface2 border-2 border-surface flex items-center justify-center text-xs font-bold text-muted">
                          ✓
                        </div>
                      ))}
                    </div>
                    <p className="text-muted font-medium">
                      {answeredCount} / {players.length} answered
                    </p>
                  </div>
                  <button
                    onClick={revealAnswer}
                    className="bg-saffron text-night font-bold px-6 py-3 rounded-xl hover:bg-saffron2 hover:scale-105 active:scale-95 transition-all shadow-lg"
                  >
                    Skip & Reveal
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── REVEAL ── */}
          {room.status === "reveal" && q && (
            <motion.div
              key={`reveal-${room.currentQuestion}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="card overflow-hidden shadow-2xl border-t-4 border-t-lagoon"
            >
              <div className="p-8 sm:p-10">
                <span className="font-mono text-xs uppercase tracking-widest text-muted bg-surface2 px-3 py-1.5 rounded-full">
                  Results — Q{room.currentQuestion + 1}
                </span>
                <h2 className="font-display text-2xl font-semibold mt-6 mb-8 text-muted">
                  {q.prompt}
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {q.options.map((opt, i) => {
                    const isCorrect = i === q.correct;
                    const count = Object.values(answersForQ).filter(
                      (c) => (typeof c === 'object' ? c.answer : c) === i
                    ).length;
                    
                    if (!isCorrect && count === 0) return null; // Hide unpicked wrong answers for cleaner UI
                    
                    return (
                      <div
                        key={i}
                        className={`rounded-xl px-6 py-6 text-lg font-medium flex justify-between items-center ${
                          isCorrect
                            ? `${OPTION_COLORS[i]} border-b-4 ring-4 ring-lagoon/50 shadow-lg scale-[1.02]`
                            : "bg-surface2 border border-white/5 text-muted opacity-70"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isCorrect ? 'bg-white/20' : 'bg-white/5'}`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className={isCorrect ? 'text-white' : ''}>{opt}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users size={16} className={isCorrect ? 'text-white/70' : 'text-muted/50'} />
                          <span className="font-mono text-2xl font-bold">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="bg-lagoon/10 border border-lagoon/20 rounded-2xl p-6 mb-8 flex items-start gap-4">
                  <div className="bg-lagoon/20 p-2 rounded-full mt-1">
                    💡
                  </div>
                  <p className="text-cream text-lg leading-relaxed">
                    {q.explain}
                  </p>
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={nextQuestion}
                    className="bg-lagoon text-night font-bold px-8 py-4 rounded-xl hover:bg-lagoon2 hover:scale-105 active:scale-95 transition-all shadow-lg text-lg flex items-center gap-2"
                  >
                    {room.currentQuestion + 1 >= (room.questions?.length || 0)
                      ? "See Podium & Results"
                      : "Next Question"}
                    <span className="text-2xl">→</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── ENDED (PODIUM) ── */}
          {room.status === "ended" && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <div className="text-center mb-12">
                <p className="font-mono text-lagoon uppercase tracking-widest mb-2">Game Over</p>
                <h2 className="font-display text-5xl font-bold text-cream drop-shadow-lg">
                  Final Results
                </h2>
              </div>
              
              {/* Podium Section */}
              <div className="flex items-end justify-center gap-2 sm:gap-4 h-64 mb-16 px-4">
                {/* 2nd Place */}
                {ranked[1] && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "160px", opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.8, type: "spring" }}
                    className="w-1/3 max-w-[140px] flex flex-col items-center justify-end relative"
                  >
                    <div className="absolute -top-16 text-center w-full">
                      <div className="text-3xl mb-1">🥈</div>
                      <div className="font-bold truncate px-2">{ranked[1].name}</div>
                      <div className="font-mono text-muted text-sm">{ranked[1].score}</div>
                    </div>
                    <div className="w-full h-full bg-gradient-to-t from-surface to-surface2 border-t-4 border-[#C0C0C0] rounded-t-lg shadow-lg flex justify-center pt-4">
                      <span className="font-display text-4xl font-bold text-[#C0C0C0]/50">2</span>
                    </div>
                  </motion.div>
                )}
                
                {/* 1st Place */}
                {ranked[0] && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "220px", opacity: 1 }}
                    transition={{ delay: 1, duration: 0.8, type: "spring" }}
                    className="w-1/3 max-w-[160px] flex flex-col items-center justify-end relative z-10"
                  >
                    <div className="absolute -top-20 text-center w-full">
                      <div className="text-5xl mb-2 drop-shadow-lg animate-bounce">👑</div>
                      <div className="font-bold text-xl text-saffron truncate px-2">{ranked[0].name}</div>
                      <div className="font-mono text-cream">{ranked[0].score}</div>
                    </div>
                    <div className="w-full h-full bg-gradient-to-t from-saffron/20 to-saffron/40 border-t-4 border-saffron rounded-t-lg shadow-2xl flex justify-center pt-4">
                      <span className="font-display text-5xl font-bold text-saffron/50">1</span>
                    </div>
                  </motion.div>
                )}
                
                {/* 3rd Place */}
                {ranked[2] && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "120px", opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8, type: "spring" }}
                    className="w-1/3 max-w-[140px] flex flex-col items-center justify-end relative"
                  >
                    <div className="absolute -top-16 text-center w-full">
                      <div className="text-3xl mb-1">🥉</div>
                      <div className="font-bold truncate px-2">{ranked[2].name}</div>
                      <div className="font-mono text-muted text-sm">{ranked[2].score}</div>
                    </div>
                    <div className="w-full h-full bg-gradient-to-t from-surface to-surface2 border-t-4 border-[#CD7F32] rounded-t-lg shadow-lg flex justify-center pt-4">
                      <span className="font-display text-4xl font-bold text-[#CD7F32]/50">3</span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Full Leaderboard */}
              {ranked.length > 3 && (
                <div className="card p-6 sm:p-8 max-w-2xl mx-auto">
                  <h3 className="font-mono text-sm uppercase tracking-widest text-muted mb-6">Other Players</h3>
                  <div className="flex flex-col gap-3">
                    {ranked.slice(3).map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl px-6 py-4 bg-surface2 border border-white/5"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-muted w-6 text-right">{i + 4}.</span>
                          <span className="font-medium text-lg">{p.name}</span>
                          <span>{getFlagEmoji(p.country)}</span>
                        </div>
                        <span className="font-mono font-bold text-cream">{p.score || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-center mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={restartGame}
                  className="bg-saffron text-night px-8 py-4 rounded-xl hover:bg-saffron2 hover:scale-105 active:scale-95 transition-all font-bold shadow-lg shadow-saffron/20"
                >
                  Play Again (Same Room)
                </button>
                <Link
                  to="/"
                  onClick={handleExit}
                  className="bg-surface2 text-cream px-8 py-4 rounded-xl hover:bg-surface transition-colors border border-white/10 font-medium"
                >
                  Exit to Home
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LIVE LEADERBOARD (during play) ── */}
        {(room.status === "question" || room.status === "reveal") &&
          players.length > 0 && (
            <div className="mt-12 text-center">
              <div className="inline-flex flex-wrap gap-2 justify-center max-w-3xl">
                <Trophy size={16} className="text-saffron mt-1 mr-2" />
                {ranked.slice(0, 5).map((p, i) => (
                  <motion.span
                    key={p.id}
                    layout
                    className="bg-surface px-4 py-1.5 rounded-full text-sm border border-white/10 flex items-center gap-2 shadow-sm"
                  >
                    <span className={i === 0 ? "text-saffron font-bold" : "text-muted"}>{i + 1}.</span> 
                    <span className="truncate max-w-[100px]">{p.name}</span> 
                    <span className="font-mono opacity-75">{p.score || 0}</span>
                  </motion.span>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
