import { useEffect, useState, useCallback } from "react";
import { socket } from "../socket.js";
import { Link, useNavigate, Navigate } from "react-router-dom";
import {
  Shield,
  RefreshCw,
  Trash2,
  Users,
  HelpCircle,
  Clock,
  Activity,
  ExternalLink,
  UserPlus,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_COLORS = {
  lobby: "bg-lagoon/20 text-lagoon border-lagoon/30",
  question: "bg-saffron/20 text-saffron border-saffron/30",
  reveal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ended: "bg-muted/20 text-muted border-muted/30",
};

function timeAgo(ts) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export default function CentralAdmin() {
  const navigate = useNavigate();
  const token = localStorage.getItem("staffToken");
  const role = localStorage.getItem("staffRole");
  const name = localStorage.getItem("staffName");

  // Accounts state
  const [accounts, setAccounts] = useState([]);
  const [newId, setNewId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("mentor");
  const [accountError, setAccountError] = useState("");

  // Rooms state
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [terminating, setTerminating] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // History state
  const [history, setHistory] = useState([]);

  const fetchRooms = useCallback(() => {
    if (!token) return;
    setLoadingRooms(true);
    socket.emit("getActiveRooms", { token }, (res) => {
      setLoadingRooms(false);
      if (res && res.error) {
        if (res.error.includes("Unauthorized")) {
          localStorage.clear();
          navigate("/login");
        }
      } else if (res && res.rooms) {
        setRooms(res.rooms);
        setLastRefreshed(Date.now());
      }
    });
  }, [token, navigate]);

  const fetchAccounts = useCallback(() => {
    if (!token) return;
    socket.emit("getAccounts", { token }, (res) => {
      if (res && res.accounts) {
        setAccounts(res.accounts);
      }
    });
  }, [token]);

  const fetchHistory = useCallback(() => {
    if (!token) return;
    socket.emit("getGameHistory", { token }, (res) => {
      if (res && res.history) {
        setHistory(res.history);
      }
    });
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchRooms();
      fetchAccounts();
      fetchHistory();
      socket.on("connect", fetchRooms);
    }
    const interval = setInterval(fetchRooms, 10000);
    return () => {
      clearInterval(interval);
      socket.off("connect", fetchRooms);
    };
  }, [token, fetchRooms, fetchAccounts, fetchHistory]);

  // ── Handler functions ──────────────────────────

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const handleCreateAccount = (e) => {
    e.preventDefault();
    setAccountError("");
    const id = newId.trim();
    const password = newPassword.trim();
    const displayName = newName.trim();

    if (!id || !password || !displayName) {
      setAccountError("Please fill in all fields.");
      return;
    }

    socket.emit("createAccount", { token, id, password, name: displayName, role: newRole }, (res) => {
      if (res && res.error) {
        setAccountError(res.error);
      } else {
        setNewId("");
        setNewPassword("");
        setNewName("");
        setNewRole("mentor");
        fetchAccounts();
      }
    });
  };

  const handleDeleteAccount = (accountId) => {
    if (!window.confirm(`Delete account "${accountId}"? This cannot be undone.`)) return;
    socket.emit("deleteAccount", { token, id: accountId }, (res) => {
      if (res && res.error) {
        alert(`Error: ${res.error}`);
      } else {
        fetchAccounts();
      }
    });
  };

  const handleTerminate = (roomCode) => {
    if (!window.confirm(`Terminate room ${roomCode}? All players will be disconnected.`)) return;
    setTerminating(roomCode);
    socket.emit("terminateRoom", { token, code: roomCode }, (res) => {
      setTerminating(null);
      if (res && res.error) {
        alert(`Error: ${res.error}`);
      } else {
        fetchRooms();
      }
    });
  };

  // ── Auth guard (after all hooks) ───────────────
  if (!token || role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen px-6 py-10 flex flex-col items-center">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-surface2 rounded-xl flex items-center justify-center text-saffron border border-saffron/20 shadow-lg shadow-saffron/10">
              <Shield size={22} />
            </div>
            <div>
              <p className="font-mono text-xs tracking-[0.3em] text-lagoon uppercase mb-1">
                Admin Dashboard
              </p>
              <h1 className="font-display text-3xl font-bold text-cream">
                Welcome, {name}
              </h1>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-muted hover:text-red-400 font-medium flex items-center gap-2"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>

        {/* ── QUICK LINKS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          <Link
            to="/admin/questions"
            className="group card p-7 flex flex-col gap-4 shadow-xl hover:shadow-2xl hover:border-cream/30 transition-all duration-300 block bg-surface2"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl border border-white/20 group-hover:scale-110 transition-transform">
                🌍
              </div>
              <ExternalLink size={18} className="text-muted group-hover:text-cream transition-colors" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-cream">
                Unified Question Manager
              </h3>
              <p className="text-muted text-sm mt-2">
                Manage questions for the Default, Mauritius, and TGS Wadi banks.
              </p>
            </div>
            <div className="mt-auto pt-3 border-t border-white/5 text-sm font-medium text-cream flex items-center gap-2">
              Open Panel →
            </div>
          </Link>
          
          <div className="card p-7 flex flex-col gap-4 shadow-xl bg-surface2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-saffron/10 rounded-xl flex items-center justify-center text-2xl border border-saffron/20">
                📊
              </div>
              <span className="font-mono text-xs text-saffron bg-saffron/10 px-2.5 py-1 rounded-md border border-saffron/20">
                {history.length} Saved Quiz{history.length === 1 ? "" : "zes"}
              </span>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-cream">
                Quiz History &amp; Saved Scores
              </h3>
              <p className="text-muted text-sm mt-2">
                All participant scores and quiz leaderboards are automatically saved on the server.
              </p>
            </div>
            {history.length > 0 && (
              <div className="mt-2 flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1">
                {history.slice(0, 3).map((g) => (
                  <div key={g.id} className="bg-surface p-3 rounded-lg border border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-saffron">Room {g.code}</span>
                      <span className="text-muted/60 ml-2">• {g.playerCount} players</span>
                    </div>
                    <div className="font-mono text-cream font-bold">
                      Winner: {g.leaderboard?.[0]?.name || "N/A"} ({g.leaderboard?.[0]?.score || 0} pts)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-10">
          {/* ── ACCOUNT MANAGEMENT ── */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div className="card p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-semibold text-cream">
                    Accounts
                  </h2>
                  <p className="text-muted text-sm">
                    Manage Staff (Admins &amp; Mentors)
                  </p>
                </div>
              </div>

              {/* Account List */}
              <div className="flex flex-col gap-3 mb-8 max-h-[300px] overflow-y-auto pr-1">
                {accounts.length === 0 ? (
                  <p className="text-muted/60 text-sm text-center py-4">No accounts found.</p>
                ) : (
                  accounts.map(acc => (
                    <div key={acc.id} className="bg-surface2 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cream">{acc.name}</span>
                          <span className={`text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-md border ${
                            acc.role === "admin" ? "bg-saffron/10 text-saffron border-saffron/20" : "bg-lagoon/10 text-lagoon border-lagoon/20"
                          }`}>
                            {acc.role}
                          </span>
                        </div>
                        <p className="text-xs text-muted font-mono mt-1">ID: {acc.id}</p>
                      </div>
                      {acc.id !== "admin" && (
                        <button onClick={() => handleDeleteAccount(acc.id)} className="p-2 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add Account Form */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-sm font-bold text-cream mb-4 flex items-center gap-2"><UserPlus size={16}/> Create Account</h3>
                <form onSubmit={handleCreateAccount} className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <input type="text" value={newId} onChange={e => setNewId(e.target.value)} placeholder="Login ID (e.g. mentor1)" className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-lagoon outline-none text-cream" />
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password" className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-lagoon outline-none text-cream" />
                  </div>
                  <div className="flex gap-3">
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Display Name" className="flex-[2] bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-lagoon outline-none text-cream" />
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-lagoon outline-none cursor-pointer text-cream">
                      <option value="mentor">Mentor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {accountError && <p className="text-red-400 text-xs">{accountError}</p>}
                  <button type="submit" className="bg-lagoon text-night font-bold py-2.5 rounded-lg hover:bg-lagoon2 transition-colors mt-2 text-sm">
                    Create Account
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* ── LIVE ROOM MONITOR ── */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card p-8 shadow-2xl h-full flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 border border-red-500/20">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-cream">
                      Live Rooms
                    </h2>
                    <p className="text-muted text-sm">
                      {lastRefreshed ? `Updated ${timeAgo(lastRefreshed)}` : "Monitor active games"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={fetchRooms}
                  disabled={loadingRooms}
                  className="flex items-center gap-2 p-2 rounded-lg border border-white/10 bg-surface2 hover:bg-surface text-sm transition-all disabled:opacity-60 text-muted hover:text-cream"
                >
                  <RefreshCw size={16} className={loadingRooms ? "animate-spin" : ""} />
                </button>
              </div>

              <AnimatePresence mode="popLayout">
                {rooms.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-16 text-center gap-3 border-2 border-dashed border-white/5 rounded-2xl flex-1"
                  >
                    <p className="text-muted/70 text-lg font-medium">No active rooms</p>
                  </motion.div>
                ) : (
                  <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                    {rooms.map((room) => (
                      <motion.div
                        key={room.code}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="bg-surface2 rounded-2xl px-5 py-4 border border-white/5 flex flex-col gap-3 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xl font-bold text-cream tracking-widest">
                            {room.code}
                          </span>
                          <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border font-semibold ${STATUS_COLORS[room.status] || STATUS_COLORS.ended}`}>
                            {room.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted font-mono">
                          <span className="flex items-center gap-1">
                            <Users size={12} /> {room.playerCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <HelpCircle size={12} />
                            {room.status === "lobby"
                              ? `${room.questionCount} Qs`
                              : `Q${room.currentQuestion + 1}/${room.questionCount}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {timeAgo(room.createdAt)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleTerminate(room.code)}
                          disabled={terminating === room.code}
                          className="absolute bottom-4 right-4 p-2 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-colors disabled:opacity-50"
                          title="Terminate Room"
                        >
                          <Trash2 size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
