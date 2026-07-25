import { useEffect, useState, useCallback } from "react";
import { socket } from "../socket.js";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Plus, ArrowLeft, HelpCircle, Edit2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Admin() {
  const navigate = useNavigate();
  const token = localStorage.getItem("staffToken");
  const role = localStorage.getItem("staffRole");

  useEffect(() => {
    if (!token || role !== "admin") {
      navigate("/login");
    }
  }, [token, role, navigate]);

  const [club, setClub] = useState("default");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questionsList, setQuestionsList] = useState([]);
  const [allQuestions, setAllQuestions] = useState({});
  const [editIndex, setEditIndex] = useState(null);

  // Form State
  const [format, setFormat] = useState("Trivia");
  const [country, setCountry] = useState("Both");
  const [prompt, setPrompt] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explain, setExplain] = useState("");

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    socket.emit("getCustomQuestions", { token }, (res) => {
      setLoading(false);
      if (res && res.error) {
        setError(res.error);
        if (res.error.includes("Unauthorized")) {
          localStorage.clear();
          navigate("/login");
        }
      } else if (res) {
        setAllQuestions(res);
        setQuestionsList(res[club] || []);
      }
    });
  }, [token, club, navigate]);

  useEffect(() => {
    if (token) {
      fetchQuestions();
    }
  }, [fetchQuestions, token]);

  useEffect(() => {
    setQuestionsList(allQuestions[club] || []);
  }, [club, allQuestions]);

  const handleSaveQuestion = (e) => {
    e.preventDefault();
    setError("");

    if (!prompt.trim() || !optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim() || !explain.trim()) {
      setError("Please fill out all fields.");
      return;
    }

    const newQuestion = {
      format,
      country,
      prompt: prompt.trim(),
      options: [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()],
      correct: parseInt(correctIndex),
      explain: explain.trim(),
    };

    setSubmitting(true);
    const eventName = editIndex !== null ? "editCustomQuestion" : "addCustomQuestion";
    const payload = editIndex !== null 
      ? { token, club, index: editIndex, question: newQuestion }
      : { token, club, question: newQuestion };

    socket.emit(eventName, payload, (res) => {
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
        setEditIndex(null);
        
        if (res && res.customQuestions) {
          setAllQuestions(res.customQuestions);
          setQuestionsList(res.customQuestions[club] || []);
        }
      }
    });
  };

  const handleEditClick = (index) => {
    const q = questionsList[index];
    if (!q) return;
    setFormat(q.format || "Trivia");
    setCountry(q.country || "Both");
    setPrompt(q.prompt || "");
    setOptionA(q.options?.[0] || "");
    setOptionB(q.options?.[1] || "");
    setOptionC(q.options?.[2] || "");
    setOptionD(q.options?.[3] || "");
    setCorrectIndex(q.correct || 0);
    setExplain(q.explain || "");
    setEditIndex(index);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setPrompt("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectIndex(0);
    setExplain("");
    setEditIndex(null);
    setError("");
  };

  const handleDeleteQuestion = (index) => {
    if (!window.confirm("Are you sure you want to delete this custom question?")) {
      return;
    }

    socket.emit("deleteCustomQuestion", { token, club, index }, (res) => {
      if (res && res.error) {
        alert(res.error);
      } else if (res && res.customQuestions) {
        setAllQuestions(res.customQuestions);
        setQuestionsList(res.customQuestions[club] || []);
      }
    });
  };

  /* ── ADMIN PANEL INTERFACE ────────────────── */
  if (!token || role !== "admin") return null;

  return (
    <div className="min-h-screen px-6 py-10 flex flex-col items-center">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-3 text-cream">
              Unified Question Manager
            </h1>
            <p className="text-muted mt-2">Manage the Default, Mauritius, and TGS Wadi question banks.</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/admin"
              className="px-5 py-2.5 rounded-xl bg-surface2 border border-white/10 hover:bg-surface transition-colors font-medium flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Dashboard
            </Link>
          </div>
        </div>

        {/* Bank Selector */}
        <div className="flex gap-2 mb-8 bg-surface2 p-2 rounded-2xl w-max border border-white/5 shadow-lg">
          {["default", "mauritius", "tgswadi"].map((bankName) => (
            <button
              key={bankName}
              onClick={() => {
                setClub(bankName);
                handleCancelEdit();
              }}
              className={`px-6 py-3 rounded-xl font-medium tracking-wide transition-all ${
                club === bankName 
                  ? "bg-lagoon text-night shadow-md" 
                  : "text-muted hover:text-cream hover:bg-white/5"
              }`}
            >
              {bankName === "default" ? "Default Bank" : bankName === "mauritius" ? "Mauritius Club" : "TGS Wadi Club"}
            </button>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Add Question Form */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="card p-6 shadow-xl sticky top-6">
              <h3 className="font-display text-xl font-semibold mb-6 flex items-center gap-2">
                {editIndex !== null ? (
                  <><Edit2 size={20} className="text-lagoon" /> Edit Question</>
                ) : (
                  <><Plus size={20} className="text-lagoon" /> Add Custom Question</>
                )}
              </h3>
              
              <form onSubmit={handleSaveQuestion} className="flex flex-col gap-4 text-left">
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

                <div className="flex gap-2 mt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-lagoon text-night font-bold py-3.5 rounded-xl hover:bg-lagoon2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-lagoon/20 disabled:opacity-60"
                  >
                    {submitting ? "Saving…" : editIndex !== null ? "Save Changes" : "Add Question"}
                  </button>
                  {editIndex !== null && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-6 bg-surface2 text-muted font-bold py-3.5 rounded-xl hover:bg-surface transition-all border border-white/10"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* List of Custom Questions */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="card p-6 shadow-xl min-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-xl font-semibold flex items-center gap-2">
                  <HelpCircle size={20} className="text-saffron" /> {club === "default" ? "Default" : club === "mauritius" ? "Mauritius" : "TGS Wadi"} Bank ({questionsList.length})
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
                  <p className="text-sm max-w-xs">Use the form on the left to add questions to this pool!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4 max-h-[700px] overflow-y-auto pr-1">
                  {questionsList.map((q, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-surface2 rounded-xl p-5 border relative group shadow-md transition-all ${
                        editIndex === i ? "border-lagoon/50 shadow-[0_0_20px_rgba(47,191,174,0.15)]" : "border-white/5 hover:border-white/10"
                      }`}
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

                      {/* Edit Button */}
                      <button
                        onClick={() => handleEditClick(i)}
                        className="absolute top-4 right-14 p-2 rounded-lg bg-surface hover:bg-surface2 transition-all text-muted hover:text-lagoon shadow-sm border border-white/5"
                        title="Edit Question"
                      >
                        <Edit2 size={14} />
                      </button>

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
