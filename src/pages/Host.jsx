import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "../socket.js";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Copy, Check, Users, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const OPTION_COLORS = [
  "bg-red-500 text-white border-red-600",
  "bg-blue-500 text-white border-blue-600",
  "bg-yellow-500 text-white border-yellow-600",
  "bg-green-500 text-white border-green-600",
];

export default function Host() {
  const navigate = useNavigate();
  const token = localStorage.getItem("staffToken");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const [code, setCode] = useState(null);
  const [room, setRoom] = useState(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [error, setError] = useState("");

  // Question Sets Selection
  const [questionSets, setQuestionSets] = useState([]);
  const [selectedSetIds, setSelectedSetIds] = useState([]);
  const [setsLoading, setSetsLoading] = useState(true);

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
    if (!token) return;

    const doRejoin = () => {
      socket.emit("getQuestionSets", { token }, (res) => {
        setSetsLoading(false);
        if (res && res.sets) {
          setQuestionSets(res.sets);
          setSelectedSetIds(prev => prev.length === 0 ? res.sets.map(s => s.id) : prev);
        }
      });
      const savedCode = localStorage.getItem("hostCode");
      if (savedCode) {
        socket.emit("rejoinHost", { code: savedCode, token }, (res) => {
          if (res && res.room) {
            setCode(savedCode);
            setRoom(res.room);
          } else {
            localStorage.removeItem("hostCode");
          }
        });
      }
    };

    doRejoin();
    socket.on("connect", doRejoin);
    return () => socket.off("connect", doRejoin);
  }, [token]);

  useEffect(() => {
    if (room?.status === "question" && room?.questionStartedAt) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - room.questionStartedAt) / 1000;
        const remaining = Math.max(0, room.timeLimit - elapsed);
        setTimeLeft(remaining);
      }, 250);
      return () => clearInterval(interval);
    }
  }, [room?.status, room?.questionStartedAt, room?.timeLimit]);

  const toggleSet = (id) => {
    setSelectedSetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const createRoom = useCallback(() => {
    if (creating) return;
    setError("");
    if (selectedSetIds.length === 0) {
      setError("Please select at least one question set.");
      return;
    }
    setCreating(true);
    socket.emit("createRoom", { token, setIds: selectedSetIds }, (res) => {
      if (res && res.code) {
        setCode(res.code);
        localStorage.setItem("hostCode", res.code);
      } else if (res && res.error) {
        setError(res.error);
        if (res.error.includes("Unauthorized")) { localStorage.clear(); navigate("/login"); }
      }
      setCreating(false);
    });
  }, [creating, token, selectedSetIds, navigate]);

  const codeRef = useRef(code);
  codeRef.current = code;

  const getRoomCode = useCallback(() => {
    return codeRef.current || localStorage.getItem("hostCode") || "";
  }, []);

  const startGame = useCallback(() => {
    const c = getRoomCode();
    console.log("[Host] startGame → room:", c);
    if (c) socket.emit("startGame", c);
  }, [getRoomCode]);

  const revealAnswer = useCallback(() => {
    const c = getRoomCode();
    console.log("[Host] revealAnswer → room:", c);
    if (c) socket.emit("revealAnswer", c);
  }, [getRoomCode]);

  const nextQuestion = useCallback(() => {
    const c = getRoomCode();
    const currentRoom = roomRef.current;
    if (!c || !currentRoom) return;
    const next = currentRoom.currentQuestion + 1;
    socket.emit("nextQuestion", {
      code: c,
      nextIndex: next,
      isEnd: next >= (currentRoom.questions?.length || 0),
    });
  }, [getRoomCode]);

  const restartGame = useCallback(() => {
    const c = getRoomCode();
    console.log("[Host] restartGame → room:", c);
    if (c) socket.emit("restartGame", c);
  }, [getRoomCode]);

  // timeUp is only informational now — server already performs the reveal itself
  useEffect(() => {
    const handleTimeUp = ({ questionIndex }) => {
      console.log("[Host] timeUp event received for Q", questionIndex);
    };
    socket.on("timeUp", handleTimeUp);
    return () => socket.off("timeUp", handleTimeUp);
  }, []);

  useEffect(() => {
    const handleTerminated = ({ reason }) => {
      localStorage.removeItem("hostCode");
      localStorage.removeItem("hostPassword");
      alert(`Room terminated by admin: ${reason || "Room has been shut down."}`);
      navigate("/");
    };
    socket.on("roomTerminated", handleTerminated);
    return () => {
      socket.off("roomTerminated", handleTerminated);
    };
  }, [navigate]);

  const handleExit = () => {
    localStorage.removeItem("hostCode");
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
    const totalQs = questionSets
      .filter(s => selectedSetIds.includes(s.id))
      .reduce((sum, s) => sum + (s.questions?.length || 0), 0);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full">
          <div className="mb-8">
            <p className="font-mono text-xs tracking-[0.3em] text-lagoon uppercase mb-4">Host Console</p>
            <h1 className="font-display text-4xl font-semibold mb-4">Start a Culture Bridge game</h1>
            <p className="text-muted max-w-sm mx-auto">Select one or more question sets, then create a room for your group to join.</p>
          </div>

          <div className="card p-6 text-left shadow-2xl mb-6">
            <label className="block text-[11px] font-mono tracking-[0.2em] uppercase text-muted mb-4">Select Question Sets</label>

            {setsLoading ? (
              <div className="flex items-center gap-3 py-8 justify-center text-muted">
                <div className="w-5 h-5 border-2 border-lagoon border-t-transparent rounded-full animate-spin" />
                Loading sets...
              </div>
            ) : questionSets.length === 0 ? (
              <div className="text-center py-8 text-muted/60">
                <p>No question sets found. Ask an Admin to create some!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {questionSets.map(set => {
                  const isSelected = selectedSetIds.includes(set.id);
                  return (
                    <button
                      key={set.id}
                      type="button"
                      onClick={() => toggleSet(set.id)}
                      className={`flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition-all text-left group ${
                        isSelected
                          ? "border-lagoon/60 bg-lagoon/10 shadow-lg shadow-lagoon/10"
                          : "border-white/10 bg-surface2/50 hover:border-white/20 hover:bg-surface2"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected ? "border-lagoon bg-lagoon" : "border-white/20"
                        }`}>
                          {isSelected && <span className="text-night font-bold text-[10px]">✓</span>}
                        </div>
                        <div>
                          <p className={`font-semibold transition-colors ${isSelected ? "text-cream" : "text-muted group-hover:text-cream"}`}>
                            {set.name}
                          </p>
                          <p className="text-xs text-muted/60 font-mono mt-0.5">{set.questions.length} question{set.questions.length !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-mono text-lagoon/70 bg-lagoon/10 px-2 py-1 rounded-lg border border-lagoon/20">Selected</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedSetIds.length > 0 && (
              <div className="mt-4 px-4 py-3 bg-saffron/8 rounded-xl border border-saffron/20 text-sm text-saffron/80 font-mono">
                {totalQs} total question{totalQs !== 1 ? "s" : ""} from {selectedSetIds.length} set{selectedSetIds.length !== 1 ? "s" : ""}
              </div>
            )}

            {error && (
              <div className="mt-4 text-red-400 text-sm bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</div>
            )}

            <button
              onClick={createRoom}
              disabled={creating || selectedSetIds.length === 0}
              className="w-full mt-6 bg-saffron text-night font-bold py-4 rounded-2xl hover:bg-saffron2 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-saffron/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating Room…" : `Create Room${totalQs > 0 ? ` (${totalQs} Qs)` : ""}`}
            </button>
          </div>

          <Link to="/" className="text-muted text-sm hover:text-cream transition-colors underline underline-offset-4">
            Back to Home
          </Link>
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
              <p className="text-muted font-mono uppercase tracking-widest text-sm mb-2">Join at <span className="text-lagoon font-bold">{window.location.host}</span></p>
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
