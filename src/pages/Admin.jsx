import { useEffect, useState, useCallback } from "react";
import { socket } from "../socket.js";
import { Link, useNavigate, Navigate } from "react-router-dom";
import {
  Trash2, Plus, ArrowLeft, HelpCircle, Edit2, Pencil, Check,
  X, FolderPlus, Layers, ChevronRight, LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Admin() {
  const navigate = useNavigate();
  const token = localStorage.getItem("staffToken");
  const role = localStorage.getItem("staffRole");
  const staffName = localStorage.getItem("staffName");

  const [sets, setSets] = useState([]);
  const [activeSetId, setActiveSetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // New set creation
  const [creatingSet, setCreatingSet] = useState(false);
  const [newSetName, setNewSetName] = useState("");

  // Rename set
  const [renamingSetId, setRenamingSetId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  // Edit question
  const [editIndex, setEditIndex] = useState(null);

  // Form state
  const [format, setFormat] = useState("Trivia");
  const [country, setCountry] = useState("Both");
  const [prompt, setPrompt] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explain, setExplain] = useState("");

  const activeSet = sets.find(s => s.id === activeSetId);

  const clearForm = useCallback(() => {
    setEditIndex(null);
    setFormat("Trivia");
    setCountry("Both");
    setPrompt("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectIndex(0);
    setExplain("");
    setError("");
  }, []);

  const fetchSets = useCallback(() => {
    if (!token) return;
    socket.emit("getQuestionSets", { token }, (res) => {
      setLoading(false);
      if (res && res.error) {
        if (res.error.includes("Unauthorized")) {
          localStorage.clear();
          navigate("/login");
        }
        setError(res.error);
      } else if (res && res.sets) {
        setSets(res.sets);
        if (!activeSetId && res.sets.length > 0) setActiveSetId(res.sets[0].id);
      }
    });
  }, [token, navigate, activeSetId]);

  useEffect(() => {
    if (token) {
      fetchSets();
      socket.on("connect", fetchSets);
      return () => socket.off("connect", fetchSets);
    }
  }, [token, fetchSets]);

  // ── Handler functions ──────────────────────────

  const handleCreateSet = () => {
    const name = newSetName.trim();
    if (!name) return;
    socket.emit("createQuestionSet", { token, name }, (res) => {
      if (res && res.error) {
        setError(res.error);
      } else if (res && res.set) {
        setSets(prev => [...prev, res.set]);
        setActiveSetId(res.set.id);
        setNewSetName("");
        setCreatingSet(false);
      }
    });
  };

  const handleRenameSet = (setId) => {
    const name = renameValue.trim();
    if (!name) return;
    socket.emit("renameQuestionSet", { token, setId, name }, (res) => {
      if (res && res.error) {
        setError(res.error);
      } else {
        setSets(prev => prev.map(s => s.id === setId ? { ...s, name } : s));
        setRenamingSetId(null);
      }
    });
  };

  const handleDeleteSet = (setId, setName) => {
    if (!window.confirm(`Delete the set "${setName}" and all its questions? This cannot be undone.`)) return;
    socket.emit("deleteQuestionSet", { token, setId }, (res) => {
      if (res && res.error) {
        setError(res.error);
      } else {
        setSets(prev => prev.filter(s => s.id !== setId));
        if (activeSetId === setId) setActiveSetId(null);
      }
    });
  };

  const handleSaveQuestion = (e) => {
    e.preventDefault();
    if (!prompt.trim() || !optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
      setError("Please fill in the question and all four options.");
      return;
    }
    if (!activeSetId) {
      setError("No question set selected.");
      return;
    }

    setSubmitting(true);
    setError("");

    const question = {
      format,
      country,
      prompt: prompt.trim(),
      options: [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()],
      correct: correctIndex,
      explain: explain.trim(),
    };

    if (editIndex !== null) {
      socket.emit("editQuestion", { token, setId: activeSetId, index: editIndex, question }, (res) => {
        setSubmitting(false);
        if (res && res.error) {
          setError(res.error);
        } else if (res && res.set) {
          setSets(prev => prev.map(s => s.id === activeSetId ? res.set : s));
          clearForm();
        }
      });
    } else {
      socket.emit("addQuestion", { token, setId: activeSetId, question }, (res) => {
        setSubmitting(false);
        if (res && res.error) {
          setError(res.error);
        } else if (res && res.set) {
          setSets(prev => prev.map(s => s.id === activeSetId ? res.set : s));
          clearForm();
        }
      });
    }
  };

  const handleEditClick = (index) => {
    if (!activeSet) return;
    const q = activeSet.questions[index];
    setEditIndex(index);
    setFormat(q.format || "Trivia");
    setCountry(q.country || "Both");
    setPrompt(q.prompt || "");
    setOptionA(q.options?.[0] || "");
    setOptionB(q.options?.[1] || "");
    setOptionC(q.options?.[2] || "");
    setOptionD(q.options?.[3] || "");
    setCorrectIndex(q.correct ?? 0);
    setExplain(q.explain || "");
    setError("");
  };

  const handleDeleteQuestion = (index) => {
    if (!window.confirm("Delete this question?")) return;
    socket.emit("deleteQuestion", { token, setId: activeSetId, index }, (res) => {
      if (res && res.error) {
        setError(res.error);
      } else if (res && res.set) {
        setSets(prev => prev.map(s => s.id === activeSetId ? res.set : s));
        if (editIndex === index) clearForm();
      }
    });
  };

  // ── Auth guard (after all hooks) ───────────────
  if (!token || role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-surface)" }}>
      {/* ── SIDEBAR ── */}
      <aside className="w-72 min-h-screen flex-shrink-0 border-r border-white/8 flex flex-col"
        style={{ background: "rgba(15,15,20,0.95)", backdropFilter: "blur(20px)" }}>
        <div className="p-6 border-b border-white/8">
          <Link to="/admin" className="flex items-center gap-3 group mb-6">
            <div className="w-8 h-8 bg-lagoon/20 rounded-lg flex items-center justify-center border border-lagoon/30">
              <ArrowLeft size={16} className="text-lagoon" />
            </div>
            <span className="text-sm text-muted group-hover:text-cream transition-colors font-medium">Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-saffron/20 rounded-xl flex items-center justify-center border border-saffron/30">
              <Layers size={18} className="text-saffron" />
            </div>
            <div>
              <p className="font-bold text-cream text-sm">Question Manager</p>
              <p className="text-xs text-muted">{staffName}</p>
            </div>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted/60">Question Sets</span>
            <button
              onClick={() => setCreatingSet(true)}
              className="p-1.5 rounded-lg hover:bg-white/8 text-muted hover:text-lagoon transition-colors"
              title="Create New Set"
            >
              <FolderPlus size={14} />
            </button>
          </div>

          <AnimatePresence>
            {creatingSet && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newSetName}
                    onChange={e => setNewSetName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleCreateSet(); if (e.key === "Escape") setCreatingSet(false); }}
                    placeholder="Set name..."
                    className="flex-1 bg-surface2 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-lagoon text-cream"
                  />
                  <button onClick={handleCreateSet} className="p-2 bg-lagoon rounded-lg text-night hover:bg-lagoon2 transition-colors"><Check size={14} /></button>
                  <button onClick={() => setCreatingSet(false)} className="p-2 bg-surface2 rounded-lg text-muted hover:text-cream transition-colors"><X size={14} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-1">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-8 justify-center text-muted text-sm">
                <div className="w-4 h-4 border-2 border-lagoon border-t-transparent rounded-full animate-spin" />
                Loading sets...
              </div>
            ) : (
              sets.map(set => (
                <motion.div key={set.id} layout>
                  {renamingSetId === set.id ? (
                    <div className="flex gap-2 p-1">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleRenameSet(set.id); if (e.key === "Escape") setRenamingSetId(null); }}
                        className="flex-1 bg-surface2 border border-lagoon/50 rounded-lg px-3 py-2 text-sm outline-none text-cream"
                      />
                      <button onClick={() => handleRenameSet(set.id)} className="p-2 bg-lagoon/20 rounded-lg text-lagoon"><Check size={12} /></button>
                      <button onClick={() => setRenamingSetId(null)} className="p-2 bg-surface2 rounded-lg text-muted"><X size={12} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setActiveSetId(set.id); clearForm(); }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-3 rounded-xl text-left transition-all group ${
                        activeSetId === set.id
                          ? "bg-lagoon/15 border border-lagoon/30 text-cream"
                          : "hover:bg-white/5 border border-transparent text-muted hover:text-cream"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ChevronRight size={14} className={`flex-shrink-0 transition-transform ${activeSetId === set.id ? "text-lagoon rotate-90" : "text-muted/40"}`} />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{set.name}</p>
                          <p className="text-[11px] text-muted/60 font-mono">{(set.questions?.length || 0)} questions</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <span onClick={e => { e.stopPropagation(); setRenamingSetId(set.id); setRenameValue(set.name); }}
                          className="p-1 rounded-md hover:bg-white/10 text-muted hover:text-cream transition-colors cursor-pointer">
                          <Pencil size={11} />
                        </span>
                        <span onClick={e => { e.stopPropagation(); handleDeleteSet(set.id, set.name); }}
                          className="p-1 rounded-md hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors cursor-pointer">
                          <Trash2 size={11} />
                        </span>
                      </div>
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/8">
          <button onClick={() => { localStorage.clear(); navigate("/"); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-muted hover:text-red-400 hover:bg-red-400/8 transition-colors text-sm">
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 min-h-screen overflow-auto">
        {!activeSet ? (
          <div className="flex items-center justify-center min-h-screen text-center">
            <div className="max-w-sm">
              <div className="w-20 h-20 bg-surface2 rounded-3xl mx-auto mb-6 flex items-center justify-center border border-white/10">
                <Layers size={36} className="text-muted/40" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-cream mb-3">No Set Selected</h2>
              <p className="text-muted mb-6">Create or select a question set from the sidebar to get started.</p>
              <button onClick={() => setCreatingSet(true)}
                className="bg-lagoon text-night font-bold px-6 py-3 rounded-xl hover:bg-lagoon2 transition-all flex items-center gap-2 mx-auto">
                <FolderPlus size={18} /> Create First Set
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-0 min-h-screen">
            {/* Form Panel */}
            <div className="xl:col-span-5 border-r border-white/8 p-8">
              <div className="sticky top-8">
                <div className="mb-8">
                  <h2 className="font-display text-2xl font-semibold text-cream flex items-center gap-3">
                    {editIndex !== null ? <><Edit2 size={22} className="text-lagoon" /> Edit Question</> : <><Plus size={22} className="text-lagoon" /> New Question</>}
                  </h2>
                  <p className="text-muted text-sm mt-1">Adding to: <span className="text-lagoon font-medium">{activeSet.name}</span></p>
                </div>

                <form onSubmit={handleSaveQuestion} className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono tracking-widest uppercase text-muted mb-2">Format</label>
                      <select value={format} onChange={e => setFormat(e.target.value)}
                        className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-lagoon outline-none cursor-pointer text-cream transition-colors hover:border-white/20">
                        <option value="Trivia">Trivia Q&A</option>
                        <option value="Spot the Myth">Spot the Myth</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono tracking-widest uppercase text-muted mb-2">Country</label>
                      <select value={country} onChange={e => setCountry(e.target.value)}
                        className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-lagoon outline-none cursor-pointer text-cream transition-colors hover:border-white/20">
                        <option value="India">India 🇮🇳</option>
                        <option value="Mauritius">Mauritius 🇲🇺</option>
                        <option value="Both">Both 🌏</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono tracking-widest uppercase text-muted mb-2">Question Prompt</label>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                      placeholder="Write your question here..." rows={3} maxLength={250}
                      className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-lagoon outline-none transition-colors placeholder:text-muted/30 resize-none text-cream hover:border-white/20" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono tracking-widest uppercase text-muted mb-2">Answer Options</label>
                    <div className="flex flex-col gap-2">
                      {[["A", optionA, setOptionA], ["B", optionB, setOptionB], ["C", optionC, setOptionC], ["D", optionD, setOptionD]].map(([letter, val, setter]) => (
                        <div key={letter} className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            letter === ["A","B","C","D"][correctIndex]
                              ? "bg-green-500/20 text-green-400 border border-green-500/40"
                              : "bg-surface2 text-muted border border-white/10"
                          }`}>{letter}</span>
                          <input value={val} onChange={e => setter(e.target.value)} placeholder={`Option ${letter}`} maxLength={100}
                            className="flex-1 bg-surface2 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-lagoon outline-none transition-colors placeholder:text-muted/30 text-cream hover:border-white/20" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono tracking-widest uppercase text-muted mb-2">Correct Answer</label>
                    <div className="grid grid-cols-4 gap-2">
                      {["A", "B", "C", "D"].map((l, i) => (
                        <button key={l} type="button" onClick={() => setCorrectIndex(i)}
                          className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                            correctIndex === i
                              ? "bg-green-500/20 text-green-400 border-2 border-green-500/50 shadow-lg shadow-green-500/10"
                              : "bg-surface2 text-muted border border-white/10 hover:border-white/20"
                          }`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono tracking-widest uppercase text-muted mb-2">Explanation</label>
                    <textarea value={explain} onChange={e => setExplain(e.target.value)}
                      placeholder="Fun fact or explanation shown after reveal..." rows={3} maxLength={300}
                      className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-lagoon outline-none transition-colors placeholder:text-muted/30 resize-none text-cream hover:border-white/20" />
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
                  )}

                  <div className="flex gap-3">
                    <button type="submit" disabled={submitting}
                      className="flex-1 bg-lagoon text-night font-bold py-3.5 rounded-xl hover:bg-lagoon2 transition-all shadow-lg shadow-lagoon/20 disabled:opacity-50">
                      {submitting ? "Saving…" : editIndex !== null ? "Save Changes" : "Add Question"}
                    </button>
                    {editIndex !== null && (
                      <button type="button" onClick={clearForm}
                        className="px-5 bg-surface2 text-muted font-medium py-3.5 rounded-xl hover:bg-surface transition-all border border-white/10 hover:text-cream">
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Questions List Panel */}
            <div className="xl:col-span-7 p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-cream flex items-center gap-3">
                    <HelpCircle size={22} className="text-saffron" />
                    {activeSet.name}
                  </h2>
                  <p className="text-muted text-sm mt-1">{activeSet.questions?.length || 0} question{(activeSet.questions?.length || 0) !== 1 ? "s" : ""} in this set</p>
                </div>
              </div>

              {(activeSet.questions?.length || 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-white/8 rounded-3xl">
                  <div className="w-16 h-16 bg-surface2 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-white/8">
                    <HelpCircle size={28} className="text-muted/40" />
                  </div>
                  <p className="text-cream/60 text-lg font-medium mb-2">No questions yet</p>
                  <p className="text-muted/50 text-sm max-w-xs">Use the form on the left to add your first question to this set.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <AnimatePresence mode="popLayout">
                    {activeSet.questions.map((q, i) => (
                      <motion.div key={i} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                        className={`relative group rounded-2xl border transition-all ${
                          editIndex === i ? "border-lagoon/40 bg-lagoon/5 shadow-lg shadow-lagoon/10" : "border-white/8 bg-surface2/50 hover:border-white/15 hover:bg-surface2"
                        }`}
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono tracking-widest uppercase bg-surface px-2.5 py-1 rounded-lg text-muted border border-white/8">{q.format}</span>
                              <span className="text-[10px] font-mono tracking-widest uppercase bg-surface px-2.5 py-1 rounded-lg text-muted border border-white/8">
                                {q.country === "India" ? "🇮🇳 India" : q.country === "Mauritius" ? "🇲🇺 Mauritius" : "🌏 Both"}
                              </span>
                              <span className="text-[10px] font-mono text-muted/40">#{i + 1}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button onClick={() => handleEditClick(i)}
                                className="p-2 rounded-lg bg-surface hover:bg-surface2 hover:text-lagoon text-muted transition-colors border border-white/8" title="Edit">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => handleDeleteQuestion(i)}
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-colors border border-red-500/15" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <p className="font-semibold text-cream leading-snug mb-4">{q.prompt}</p>

                          <div className="grid grid-cols-2 gap-2 mb-4">
                            {(q.options || []).map((opt, oi) => (
                              <div key={oi} className={`px-3 py-2 rounded-xl text-xs flex items-center gap-2 border ${
                                oi === q.correct
                                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                                  : "bg-surface border-white/8 text-muted/70"
                              }`}>
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold flex-shrink-0 text-[10px] ${oi === q.correct ? "bg-green-500/20" : "bg-white/5"}`}>
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                {opt}
                              </div>
                            ))}
                          </div>

                          <div className="text-xs bg-saffron/5 border border-saffron/15 p-3 rounded-xl text-muted/80 leading-relaxed">
                            <span className="text-saffron/70 font-semibold">💡 </span>{q.explain}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
