import { useEffect, useState, useCallback } from "react";
import { socket } from "../socket.js";
import { Link } from "react-router-dom";
import { Trash2, Plus, Lock, Unlock, AlertTriangle, ArrowLeft, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Admin({ club }) {
  const clubDisplayName = club === "mauritius" ? "Mauritius Club" : "TGS Wadi Club";
  
  // Session storage keys
  const tokenKey = `admin_token_${club}`;
  
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem(tokenKey));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questionsList, setQuestionsList] = useState([]);

  // Form State
  const [format, setFormat] = useState("Trivia");
  const [country, setCountry] = useState(club === "mauritius" ? "Mauritius" : "India");
  const [prompt, setPrompt] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explain, setExplain] = useState("");

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    socket.emit("getCustomQuestions", (res) => {
      if (res && res[club]) {
        setQuestionsList(res[club]);
      }
      setLoading(false);
    });
  }, [club]);

  // Load questions if already unlocked on mount
  useEffect(() => {
    if (unlocked) {
      fetchQuestions();
    }
  }, [unlocked, fetchQuestions]);

  const handleUnlock = (e) => {
    e.preventDefault();
    setError("");
    if (!password.trim()) {
      setError("Please enter the password.");
      return;
    }

    setLoading(true);
    // Send a dummy request to check password
    socket.emit("getCustomQuestions", (res) => {
      // Check auth using addCustomQuestion with a dry-run flag, or just try to retrieve questions.
      // Wait, getCustomQuestions doesn't take a password. Let's send a delete check or a dummy question add
      // with a wrong index to check the password, OR we can just try to fetch.
      // Actually, let's verify password by doing a quick test action or verify it against the server.
      // Wait, let's just make a verification attempt by calling addCustomQuestion with an empty object to check auth
      socket.emit("addCustomQuestion", { club, password: password.trim(), question: null }, (res) => {
        setLoading(false);
        if (res && res.error && res.error === "Incorrect admin password!") {
          setError("Incorrect password! Access denied.");
        } else {
          // Password verified
          setUnlocked(true);
          sessionStorage.setItem(tokenKey, password.trim());
          if (res && res.customQuestions) {
            setQuestionsList(res.customQuestions[club] || []);
          } else {
            fetchQuestions();
          }
        }
      });
    });
  };

  const handleAddQuestion = (e) => {
    e.preventDefault();
    setError("");

    if (!prompt.trim() || !optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim() || !explain.trim()) {
      setError("Please fill out all fields.");
      return;
    }

    const savedPassword = sessionStorage.getItem(tokenKey) || password;
    const newQuestion = {
      format,
      country,
      prompt: prompt.trim(),
      options: [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()],
      correct: parseInt(correctIndex),
      explain: explain.trim(),
    };

    setSubmitting(true);
    socket.emit("addCustomQuestion", { club, password: savedPassword, question: newQuestion }, (res) => {
      setSubmitting(false);
      if (res && res.error) {
        setError(res.error);
      } else {
        // Clear Form
        setPrompt("");
        setOptionA("");
        setOptionB("");
        setOptionC("");
        setOptionD("");
        setCorrectIndex(0);
        setExplain("");
        
        if (res && res.customQuestions) {
          setQuestionsList(res.customQuestions[club] || []);
        }
      }
    });
  };

  const handleDeleteQuestion = (index) => {
    if (!window.confirm("Are you sure you want to delete this custom question?")) {
      return;
    }

    const savedPassword = sessionStorage.getItem(tokenKey) || password;
    socket.emit("deleteCustomQuestion", { club, password: savedPassword, index }, (res) => {
      if (res && res.error) {
        alert(res.error);
      } else if (res && res.customQuestions) {
        setQuestionsList(res.customQuestions[club] || []);
      }
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem(tokenKey);
    setUnlocked(false);
    setPassword("");
    setQuestionsList([]);
  };

  /* ── PASS LOCK SCREEN ─────────────────────── */
  if (!unlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="w-16 h-16 bg-surface2 rounded-2xl mx-auto mb-6 flex items-center justify-center text-saffron border border-white/5 shadow-lg">
            <Lock size={28} />
          </div>
          <p className="font-mono text-xs tracking-[0.3em] text-lagoon uppercase mb-3">
            Organizers Panel
          </p>
          <h1 className="font-display text-4xl font-semibold mb-6">
            Unlock {clubDisplayName} Admin
          </h1>
          <p className="text-muted max-w-sm mb-8 mx-auto">
            This panel allows you to add custom trivia questions for the next Culture Bridge activity.
          </p>
          
          <form onSubmit={handleUnlock} className="card p-6 flex flex-col gap-4 text-left max-w-sm mx-auto shadow-xl">
            <div>
              <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password..."
                className="w-full mt-2 bg-surface2 border-2 border-white/10 rounded-xl px-4 py-3 text-lg focus:border-saffron focus:bg-surface outline-none transition-all placeholder:text-white/20"
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-saffron text-night font-bold py-4 rounded-xl hover:bg-saffron2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-saffron/20 disabled:opacity-60"
            >
              {loading ? "Unlocking…" : "Unlock Panel"}
            </button>
          </form>

          <div className="mt-8">
            <Link to="/" className="text-muted text-sm hover:text-cream transition-colors flex items-center justify-center gap-2 underline underline-offset-4">
              <ArrowLeft size={16} /> Back to Home
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── ADMIN PANEL INTERFACE ────────────────── */
  return (
    <div className="min-h-screen px-6 py-10 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs tracking-widest uppercase bg-lagoon/20 text-lagoon px-3 py-1 rounded-full font-semibold font-mono">
                {clubDisplayName}
              </span>
              <span className="text-xs tracking-widest uppercase bg-saffron/10 text-saffron px-3 py-1 rounded-full font-semibold font-mono flex items-center gap-1.5">
                <Unlock size={12} /> Authenticated
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-3">
              Quiz Manager
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleLogout}
              className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-muted hover:text-cream font-medium"
            >
              Log Out
            </button>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl bg-surface2 border border-white/10 hover:bg-surface transition-colors font-medium flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Home
            </Link>
          </div>
        </div>

        {/* Warnings */}
        <div className="bg-saffron/10 border border-saffron/20 rounded-2xl p-5 mb-8 flex items-start gap-4">
          <div className="bg-saffron/20 p-2.5 rounded-xl text-saffron mt-0.5">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4 className="font-bold text-cream mb-1">Temporary Cloud Persistence Notice</h4>
            <p className="text-muted text-sm leading-relaxed">
              Because our backend server runs on a free instance, these custom questions are saved to a temporary JSON file. If the hosting server undergoes a redeployment or deep restart, this list will revert to default. Please save backup copies of your custom questions locally!
            </p>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Add Question Form */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="card p-6 shadow-xl">
              <h3 className="font-display text-xl font-semibold mb-6 flex items-center gap-2">
                <Plus size={20} className="text-lagoon" /> Add Custom Question
              </h3>
              
              <form onSubmit={handleAddQuestion} className="flex flex-col gap-4 text-left">
                {/* Format */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                    Question Format
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="bg-surface2 border border-white/15 rounded-xl px-4 py-3 text-sm focus:border-saffron focus:bg-surface outline-none cursor-pointer"
                  >
                    <option value="Trivia">Trivia (General Q&A)</option>
                    <option value="Spot the Myth">Spot the Myth (Find incorrect choice)</option>
                  </select>
                </div>

                {/* Country context */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                    Country Target
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="bg-surface2 border border-white/15 rounded-xl px-4 py-3 text-sm focus:border-saffron focus:bg-surface outline-none cursor-pointer"
                  >
                    <option value="India">India 🇮🇳</option>
                    <option value="Mauritius">Mauritius 🇲🇺</option>
                    <option value="Both">Both 🇮🇳🤝🇲🇺</option>
                  </select>
                </div>

                {/* Prompt */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                    Question Prompt
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter the question here..."
                    rows={3}
                    maxLength={200}
                    className="w-full bg-surface2 border border-white/15 rounded-xl px-4 py-3 text-sm focus:border-saffron focus:bg-surface outline-none transition-all placeholder:text-white/20 resize-none"
                  />
                </div>

                {/* Options */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                    Answer Options
                  </label>
                  <div className="flex flex-col gap-2">
                    <input
                      value={optionA}
                      onChange={(e) => setOptionA(e.target.value)}
                      placeholder="Option A"
                      maxLength={80}
                      className="bg-surface2 border border-white/15 rounded-xl px-4 py-2.5 text-sm focus:border-saffron focus:bg-surface outline-none transition-all placeholder:text-white/20"
                    />
                    <input
                      value={optionB}
                      onChange={(e) => setOptionB(e.target.value)}
                      placeholder="Option B"
                      maxLength={80}
                      className="bg-surface2 border border-white/15 rounded-xl px-4 py-2.5 text-sm focus:border-saffron focus:bg-surface outline-none transition-all placeholder:text-white/20"
                    />
                    <input
                      value={optionC}
                      onChange={(e) => setOptionC(e.target.value)}
                      placeholder="Option C"
                      maxLength={80}
                      className="bg-surface2 border border-white/15 rounded-xl px-4 py-2.5 text-sm focus:border-saffron focus:bg-surface outline-none transition-all placeholder:text-white/20"
                    />
                    <input
                      value={optionD}
                      onChange={(e) => setOptionD(e.target.value)}
                      placeholder="Option D"
                      maxLength={80}
                      className="bg-surface2 border border-white/15 rounded-xl px-4 py-2.5 text-sm focus:border-saffron focus:bg-surface outline-none transition-all placeholder:text-white/20"
                    />
                  </div>
                </div>

                {/* Correct Choice */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                    Correct Option
                  </label>
                  <select
                    value={correctIndex}
                    onChange={(e) => setCorrectIndex(parseInt(e.target.value))}
                    className="bg-surface2 border border-white/15 rounded-xl px-4 py-3 text-sm focus:border-saffron focus:bg-surface outline-none cursor-pointer"
                  >
                    <option value={0}>Option A (First)</option>
                    <option value={1}>Option B (Second)</option>
                    <option value={2}>Option C (Third)</option>
                    <option value={3}>Option D (Fourth)</option>
                  </select>
                </div>

                {/* Explanation */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted uppercase tracking-widest font-semibold ml-1">
                    Explanation (Shown in Reveal screen)
                  </label>
                  <textarea
                    value={explain}
                    onChange={(e) => setExplain(e.target.value)}
                    placeholder="Enter the explanation/fun fact here..."
                    rows={3}
                    maxLength={300}
                    className="w-full bg-surface2 border border-white/15 rounded-xl px-4 py-3 text-sm focus:border-saffron focus:bg-surface outline-none transition-all placeholder:text-white/20 resize-none"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-lagoon text-night font-bold py-3.5 rounded-xl hover:bg-lagoon2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-lagoon/20 disabled:opacity-60 mt-2"
                >
                  {submitting ? "Adding Question…" : "Add Question"}
                </button>
              </form>
            </div>
          </div>

          {/* List of Custom Questions */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="card p-6 shadow-xl min-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-xl font-semibold flex items-center gap-2">
                  <HelpCircle size={20} className="text-saffron" /> Custom Questions ({questionsList.length})
                </h3>
                <button
                  onClick={fetchQuestions}
                  disabled={loading}
                  className="text-xs text-lagoon hover:text-lagoon2 transition-colors font-mono uppercase"
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {loading && questionsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted">
                  <div className="w-6 h-6 border-2 border-lagoon border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-mono">Loading custom questions...</p>
                </div>
              ) : questionsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3 text-muted/50 border-2 border-dashed border-white/5 rounded-2xl">
                  <p className="text-lg font-medium">No custom questions added yet</p>
                  <p className="text-sm max-w-xs">Use the form on the left to add your club's custom questions to the quiz pool!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4 max-h-[700px] overflow-y-auto pr-1">
                  {questionsList.map((q, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-surface2 rounded-xl p-5 border border-white/5 relative group shadow-md"
                    >
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[10px] font-mono tracking-widest uppercase bg-surface px-2.5 py-1 rounded-md text-muted border border-white/5">
                          {q.format}
                        </span>
                        <span className="text-[10px] font-mono tracking-widest uppercase bg-surface px-2.5 py-1 rounded-md text-muted border border-white/5">
                          {q.country === "India" ? "🇮🇳 India" : q.country === "Mauritius" ? "🇲🇺 Mauritius" : "🇮🇳🤝🇲🇺 Both"}
                        </span>
                      </div>
                      
                      <h4 className="font-semibold text-cream leading-snug mb-3">
                        {q.prompt}
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`px-3 py-1.5 rounded-lg border ${
                              optIdx === q.correct
                                ? "bg-green-500/10 border-green-500/30 text-green-400 font-semibold"
                                : "bg-surface border-white/5 text-muted"
                            }`}
                          >
                            <span className="font-bold opacity-50 mr-1.5">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            {opt}
                          </div>
                        ))}
                      </div>

                      <div className="text-xs bg-surface/50 p-3 rounded-lg border border-white/5 text-muted leading-relaxed mb-1">
                        <strong className="text-cream block mb-0.5">Explanation:</strong>
                        {q.explain}
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteQuestion(i)}
                        className="absolute top-4 right-4 p-2 rounded-lg bg-red-500/10 hover:bg-red-500 hover:text-white transition-all text-red-400 shadow-sm border border-red-500/10"
                        title="Delete Question"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
