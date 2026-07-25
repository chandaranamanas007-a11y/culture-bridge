import { useState } from "react";
import { socket } from "../socket.js";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Lock, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");

    if (!id.trim() || !password.trim()) {
      setError("Please enter both ID and Password.");
      return;
    }

    setLoading(true);
    socket.emit("login", { id: id.trim(), password: password.trim() }, (res) => {
      setLoading(false);
      if (res && res.error) {
        setError(res.error);
      } else if (res && res.token && res.user) {
        localStorage.setItem("staffToken", res.token);
        localStorage.setItem("staffRole", res.user.role);
        localStorage.setItem("staffName", res.user.name);
        
        if (res.user.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/host");
        }
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="w-16 h-16 bg-surface2 rounded-2xl mx-auto mb-6 flex items-center justify-center text-lagoon border border-white/5 shadow-lg">
          <Shield size={28} />
        </div>
        <p className="font-mono text-xs tracking-[0.3em] text-lagoon uppercase mb-3">
          Culture Bridge
        </p>
        <h1 className="font-display text-4xl font-semibold mb-6">
          Admin Login
        </h1>
        <p className="text-muted max-w-sm mb-8 mx-auto">
          Authorized Admin & Mentor Portal. Log in with your assigned ID and password.
        </p>
        
        <form onSubmit={handleLogin} className="card p-6 flex flex-col gap-4 text-left max-w-sm mx-auto shadow-xl">
          <div>
            <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
              Assigned ID
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. mentor_alice"
              className="w-full mt-2 bg-surface2 border-2 border-white/10 rounded-xl px-4 py-3 text-lg focus:border-lagoon focus:bg-surface outline-none transition-all placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
              Password
            </label>
            <div className="relative mt-2">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-surface2 border-2 border-white/10 rounded-xl pl-11 pr-4 py-3 text-lg focus:border-lagoon focus:bg-surface outline-none transition-all placeholder:text-white/20"
              />
            </div>
          </div>
          {error && (
            <p className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-lg border border-red-400/20 mt-1">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-lagoon text-night font-bold py-4 rounded-xl hover:bg-lagoon2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-lagoon/20 disabled:opacity-60 mt-2"
          >
            {loading ? "Authenticating…" : "Login"}
          </button>
        </form>

        <div className="mt-8">
          <Link to="/" className="text-muted text-sm hover:text-cream transition-colors flex items-center justify-center gap-2 underline underline-offset-4">
            <ArrowLeft size={16} /> Return to Main Site
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
