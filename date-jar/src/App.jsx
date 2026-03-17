import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ai = import.meta.env.VITE_GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY })
  : null;

// ─── Utilities ───────────────────────────────────────────────────────────────

const NOTE_COLORS = [
  "#FFD6D6", "#FFE8C8", "#FFF5C2", "#D6F5D6",
  "#D6EEFF", "#E8D6FF", "#FFD6F0", "#D6FFF5",
];

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return NOTE_COLORS[Math.abs(hash) % NOTE_COLORS.length];
}

function generateCode() {
  const words = ["ROSE", "MOON", "STAR", "DAWN", "DUSK", "TIDE", "PINE", "MIST", "SAGE", "FERN"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}

function getStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function setStorage(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ─── Components ──────────────────────────────────────────────────────────────

function NoteCard({ note, isNew = false }) {
  const color = hashColor(note.id);
  const tilt = ((note.id.charCodeAt(0) % 10) - 5) * 1.3;
  return (
    <div style={{
      background: color,
      borderRadius: 3,
      padding: "20px 18px 14px",
      boxShadow: "3px 4px 10px rgba(0,0,0,0.13), inset 0 1px 0 rgba(255,255,255,0.7)",
      transform: `rotate(${tilt}deg)`,
      fontFamily: "'Caveat', cursive",
      fontSize: "1.2rem",
      color: "#2a1a0e",
      lineHeight: 1.45,
      position: "relative",
      animation: isNew ? "popIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275)" : "none",
      minHeight: 90,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}>
      {/* Pin */}
      <div style={{
        position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)",
        width: 13, height: 13, borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, #ff7b7b, #b03020)",
        boxShadow: "0 2px 5px rgba(0,0,0,0.35)",
      }} />
      <p style={{ margin: "4px 0 10px", wordBreak: "break-word" }}>{note.text}</p>
      <div style={{ fontSize: "0.72rem", opacity: 0.55, fontFamily: "'DM Sans', sans-serif" }}>
        — {note.author}
      </div>
    </div>
  );
}

function JarSVG({ shaking, empty }) {
  return (
    <div style={{ animation: shaking ? "shake 0.55s ease" : "none", display: "inline-block" }}>
      <svg width="110" height="130" viewBox="0 0 90 110" fill="none">
        <path d="M15 40 Q10 55 10 75 Q10 100 45 100 Q80 100 80 75 Q80 55 75 40 Z"
          fill={empty ? "rgba(200,200,200,0.25)" : "rgba(200,230,255,0.45)"}
          stroke={empty ? "#ccc" : "#7bb3d4"} strokeWidth="2" />
        <rect x="25" y="28" width="40" height="14" rx="4"
          fill={empty ? "rgba(200,200,200,0.25)" : "rgba(200,230,255,0.45)"}
          stroke={empty ? "#ccc" : "#7bb3d4"} strokeWidth="2" />
        <rect x="20" y="20" width="50" height="12" rx="5"
          fill={empty ? "#ddd" : "#f4a261"} stroke={empty ? "#bbb" : "#e07b39"} strokeWidth="1.5" />
        {!empty && <>
          <rect x="29" y="52" width="13" height="11" rx="1" fill="#FFD6D6" transform="rotate(-8 36 57)" />
          <rect x="44" y="48" width="13" height="11" rx="1" fill="#D6EEFF" transform="rotate(5 50 53)" />
          <rect x="37" y="62" width="13" height="11" rx="1" fill="#FFF5C2" transform="rotate(-3 44 67)" />
        </>}
        <ellipse cx="29" cy="66" rx="5" ry="16"
          fill="rgba(255,255,255,0.18)" transform="rotate(-10 29 66)" />
      </svg>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)",
      background: "#1a1008", color: "#fff",
      padding: "10px 22px", borderRadius: 30,
      fontSize: "0.88rem", fontFamily: "'DM Sans', sans-serif",
      zIndex: 200, animation: "slideDown 0.3s ease",
      boxShadow: "0 4px 24px rgba(0,0,0,0.22)",
      whiteSpace: "nowrap",
    }}>{message}</div>
  );
}

function PlanningMoment({ note, author, onDone }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("19:00");
  const [myEmail, setMyEmail] = useState(() => getStorage("dj-my-email") || "");
  const [partnerEmail, setPartnerEmail] = useState(() => getStorage("dj-partner-email") || "");
  const [showEmails, setShowEmails] = useState(!!(getStorage("dj-my-email") || getStorage("dj-partner-email")));

  const saveEmails = () => {
    setStorage("dj-my-email", myEmail);
    setStorage("dj-partner-email", partnerEmail);
  };

  const fmtCal = (d, t) => d.replace(/-/g, "") + "T" + t.replace(":", "") + "00";

  const addTwoHours = (t) => {
    const [h, m] = t.split(":").map(Number);
    return `${String(Math.min(h + 2, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const openGoogleCal = () => {
    saveEmails();
    const start = fmtCal(date, time);
    const end = fmtCal(date, addTwoHours(time));
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `📅 ${note.text}`,
      dates: `${start}/${end}`,
      details: "From our Date Jar 💌",
    });
    if (myEmail) params.append("add", myEmail);
    if (partnerEmail) params.append("add", partnerEmail);
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank");
    onDone();
  };

  const openAppleCal = () => {
    saveEmails();
    const start = fmtCal(date, time);
    const end = fmtCal(date, addTwoHours(time));
    const attendees = [
      myEmail ? `ATTENDEE;CN="${author}":mailto:${myEmail}` : "",
      partnerEmail ? `ATTENDEE;CN="Partner":mailto:${partnerEmail}` : "",
    ].filter(Boolean).join("\r\n");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Date Jar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:\uD83D\uDCC5 ${note.text}`,
      `DESCRIPTION:From our Date Jar \uD83D\uDC8C`,
      attendees,
      `UID:${note.id}-${Date.now()}@datejar`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "date.ics"; a.click();
    URL.revokeObjectURL(url);
    onDone();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, paddingTop: 12, animation: "fadeIn 0.3s ease" }}>
      <p style={s.drawnLabel}>🗓 Let's plan it!</p>

      {/* Note preview */}
      <div style={{
        background: hashColor(note.id), borderRadius: 10,
        padding: "14px 20px", maxWidth: 320, width: "100%",
        fontFamily: "'Caveat', cursive", fontSize: "1.15rem",
        color: "#2a1a0e", lineHeight: 1.4,
        boxShadow: "2px 3px 10px rgba(0,0,0,0.1)",
      }}>
        {note.text}
      </div>

      {/* Date + Time */}
      <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 320 }}>
        <div style={{ flex: 1 }}>
          <label style={s.planLabel}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ ...s.input, width: "100%" }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={s.planLabel}>Time</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            style={{ ...s.input, width: "100%" }} />
        </div>
      </div>

      {/* Email fields */}
      <div style={{ width: "100%", maxWidth: 320 }}>
        {!showEmails ? (
          <button style={{ ...s.btnGhost, width: "100%", fontSize: "0.82rem" }}
            onClick={() => setShowEmails(true)}>
            + Add emails to invite both of you
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input style={{ ...s.input, width: "100%" }} type="email"
              placeholder="Your email (optional)"
              value={myEmail} onChange={e => setMyEmail(e.target.value)} />
            <input style={{ ...s.input, width: "100%" }} type="email"
              placeholder="Partner's email (optional)"
              value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} />
          </div>
        )}
      </div>

      {/* Calendar buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
        <button onClick={openGoogleCal}
          style={{ ...s.btn, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span>🗓</span> Add to Google Calendar
        </button>
        <button onClick={openAppleCal}
          style={{ ...s.btn, width: "100%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span>🍎</span> Add to Apple Calendar
        </button>
      </div>

      <button onClick={onDone}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: "0.82rem", fontFamily: "'DM Sans', sans-serif", padding: "4px 0" }}>
        Skip, we'll figure it out →
      </button>
    </div>
  );
}

// ─── Screens ─────────────────────────────────────────────────────────────────

function WelcomeScreen({ onEnter }) {
  const [name, setName] = useState("");
  return (
    <div style={s.centeredPage} className="centered-page">
      <div style={s.card} className="dj-card">
        <div style={{ fontSize: "2.8rem", marginBottom: 10 }}>💌</div>
        <h1 style={s.displayTitle}>Date Jar</h1>
        <p style={s.muted}>A private jar of date ideas, shared between two</p>
        <div style={{ marginTop: 28, display: "flex", gap: 10 }}>
          <input
            style={s.input} placeholder="Your name…" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && name.trim() && onEnter(name.trim())}
            autoFocus
          />
          <button style={s.btn} onClick={() => name.trim() && onEnter(name.trim())}>
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

function JarLobby({ author, onJarReady }) {
  const [mode, setMode] = useState(null); // "create" | "join"
  const [jarName, setJarName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createJar = async () => {
    if (!jarName.trim()) return;
    setLoading(true); setError("");
    const newCode = generateCode();
    const { data, error } = await supabase
      .from("jars").insert([{ name: jarName.trim(), code: newCode }]).select().single();
    if (error) { setError("Could not create jar. Try again."); setLoading(false); return; }
    onJarReady(data);
    setLoading(false);
  };

  const joinJar = async () => {
    if (!code.trim()) return;
    setLoading(true); setError("");
    const { data, error } = await supabase
      .from("jars").select("*").eq("code", code.trim().toUpperCase()).single();
    if (error || !data) {
      setError("No jar found with that code. Check it and try again.");
      setLoading(false); return;
    }
    onJarReady(data);
    setLoading(false);
  };

  return (
    <div style={s.centeredPage} className="centered-page">
      <div style={s.card} className="dj-card">
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>🫙</div>
        <h2 style={s.cardTitle}>Welcome, {author}</h2>
        <p style={s.muted}>Create a new jar or join one with a code</p>

        {!mode && (
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button style={s.btn} onClick={() => setMode("create")}>Create a jar</button>
            <button style={s.btnGhost} onClick={() => setMode("join")}>Join with code</button>
          </div>
        )}

        {mode === "create" && (
          <div style={{ marginTop: 20 }}>
            <p style={{ ...s.muted, marginBottom: 10 }}>Give your jar a name</p>
            <input
              style={{ ...s.input, width: "100%", marginBottom: 10 }}
              placeholder="e.g. Our Date Ideas…"
              value={jarName}
              onChange={e => setJarName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createJar()}
              autoFocus
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button style={s.btn} onClick={createJar} disabled={loading || !jarName.trim()}>
                {loading ? "Creating…" : "Create 🫙"}
              </button>
              <button style={s.btnGhost} onClick={() => setMode(null)}>Back</button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div style={{ marginTop: 20 }}>
            <p style={{ ...s.muted, marginBottom: 10 }}>Enter the jar code</p>
            <input
              style={{ ...s.input, width: "100%", marginBottom: 10, textTransform: "uppercase", letterSpacing: 2 }}
              placeholder="e.g. ROSE-7842"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && joinJar()}
              autoFocus
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button style={s.btn} onClick={joinJar} disabled={loading || !code.trim()}>
                {loading ? "Joining…" : "Join →"}
              </button>
              <button style={s.btnGhost} onClick={() => setMode(null)}>Back</button>
            </div>
          </div>
        )}

        {error && <p style={{ color: "#c0392b", fontSize: "0.85rem", marginTop: 12, fontFamily: "'DM Sans', sans-serif" }}>{error}</p>}
      </div>
    </div>
  );
}

function MainApp({ author, jar, onLeave }) {
  const [notes, setNotes] = useState([]);
  const [drawnNotes, setDrawnNotes] = useState([]);
  const [text, setText] = useState("");
  const [drawnNote, setDrawnNote] = useState(null);
  const [view, setView] = useState("jar"); // jar | add | drawn | history
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showCode, setShowCode] = useState(false);
  const textRef = useRef(null);

  const toast = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(""), 3000); };

  const loadNotes = async () => {
    const { data } = await supabase.from("notes").select("*")
      .eq("jar_id", jar.id).eq("drawn", false).order("created_at");
    if (data) setNotes(data);
  };

  const loadDrawnNotes = async () => {
    const { data } = await supabase.from("notes").select("*")
      .eq("jar_id", jar.id).eq("drawn", true).order("drawn_at", { ascending: false });
    if (data) setDrawnNotes(data);
  };

  useEffect(() => {
    loadNotes();
    loadDrawnNotes();
    const channel = supabase.channel(`jar-${jar.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notes",
        filter: `jar_id=eq.${jar.id}`
      }, () => { loadNotes(); loadDrawnNotes(); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [jar.id]);

  const addNote = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    const { error } = await supabase.from("notes")
      .insert([{ jar_id: jar.id, text: text.trim(), author, drawn: false }]);
    if (error) toast("Something went wrong. Try again.");
    else { setText(""); toast("Idea dropped in the jar! 🎉"); }
    setLoading(false);
  };

  const drawNote = async () => {
    if (notes.length === 0) { toast("The jar is empty! Add some ideas first."); return; }
    setShaking(true);
    await new Promise(r => setTimeout(r, 600));
    setShaking(false);
    const picked = notes[Math.floor(Math.random() * notes.length)];
    const { error } = await supabase.from("notes")
      .update({ drawn: true, drawn_by: author, drawn_at: new Date().toISOString() })
      .eq("id", picked.id);
    if (error) { toast("Something went wrong. Try again."); return; }
    setDrawnNote(picked);
    setView("drawn");
  };

  const generateIdea = async () => {
    if (!ai) {
      toast("AI generation is not configured. Please add VITE_GEMINI_API_KEY.");
      return;
    }
    setGenerating(true);
    toast("Asking AI for an idea...");
    try {
      const existingIdeas = notes.map(n => n.text).join("\n- ");
      const prompt = `You are a creative assistant helping a couple come up with a new date idea.
They have a "Date Jar" with these existing ideas:
- ${existingIdeas || "No ideas yet!"}

Based on the vibe of these ideas (or if none exist, just come up with something cute, romantic, and fun), suggest ONE new date idea.
IMPORTANT: The generated idea MUST be in the exact same language as the existing ideas provided above. If there are no existing ideas, default to English.
Keep it concise, romantic, and written as a single sentence or short paragraph. Do not use quotes or introductory text, just output the idea itself.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (response && response.text) {
        setText(response.text);
        toast("Idea generated! ✨");
      } else {
        toast("Failed to generate idea. Try again.");
      }
    } catch (e) {
      console.error(e);
      toast("Error generating idea.");
    } finally {
      setGenerating(false);
    }
  };

  const returnNote = async () => {
    await supabase.from("notes")
      .update({ drawn: false, drawn_by: null, drawn_at: null }).eq("id", drawnNote.id);
    setDrawnNote(null); setView("jar");
  };

  const keepNote = () => { setView("plan"); };
  const finishPlanning = () => { setDrawnNote(null); setView("jar"); toast("Enjoy your date! 💕"); };

  return (
    <div style={s.appShell}>
      <Toast message={feedback} />

      {/* Header */}
      <header style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.4rem" }}>💌</span>
          <div>
            <div style={s.headerTitle}>{jar.name}</div>
            <button onClick={() => setShowCode(v => !v)} style={s.codeToggle}>
              {showCode ? jar.code : "show code"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={s.userBadge}>✦ {author}</span>
          <span style={s.countBadge}>{notes.length}</span>
          <button onClick={onLeave} style={s.leaveBtn} title="Leave jar">✕</button>
        </div>
      </header>

      {/* Views */}
      <div style={s.main} className="main-area">

        {view === "jar" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <div style={s.jarArea}>
              <button onClick={drawNote} style={s.jarBtn}>
                <JarSVG shaking={shaking} empty={notes.length === 0} />
              </button>
              <p style={s.jarLabel}>
                {notes.length > 0 ? `${notes.length} idea${notes.length !== 1 ? "s" : ""} inside — shake to draw!` : "Jar is empty — add some ideas!"}
              </p>
            </div>
            <div style={s.actionRow}>
              <button style={s.btn} onClick={() => { setView("add"); setTimeout(() => textRef.current?.focus(), 80); }}>
                + Add an idea
              </button>
              {drawnNotes.length > 0 && (
                <button style={s.btnGhost} onClick={() => setView("history")}>
                  Past draws ({drawnNotes.length})
                </button>
              )}
            </div>
          </div>
        )}

        {view === "add" && (
          <div style={s.card} className="dj-card">
            <h2 style={s.cardTitle}>Drop an idea in 💡</h2>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <textarea
                ref={textRef}
                style={s.textarea}
                placeholder="e.g. Sunset picnic with homemade sandwiches…"
                value={text}
                onChange={e => setText(e.target.value)}
                rows={4}
              />
              {notes.length >= 10 && (
                <button
                  onClick={generateIdea}
                  disabled={generating || loading || !ai}
                  title={!ai ? "Missing API Key" : "Generate a personalized idea using AI"}
                  style={{
                    position: "absolute",
                    bottom: 14,
                    right: 14,
                    background: generating ? "var(--bg)" : "rgba(255,255,255,0.7)",
                    border: "1px solid #e8d5c4",
                    borderRadius: 20,
                    padding: "4px 10px",
                    fontSize: "0.75rem",
                    fontFamily: "'DM Sans', sans-serif",
                    color: generating ? "#999" : "var(--accent)",
                    cursor: generating || !ai ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    backdropFilter: "blur(4px)",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                    transition: "all 0.2s ease",
                    opacity: (!ai || generating) ? 0.6 : 1
                  }}
                >
                  {generating ? "⟳ drafting..." : "✨ Generate"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={s.btn} onClick={addNote} disabled={!text.trim() || loading || generating}>
                {(loading || generating) ? "Adding…" : "Into the jar 🫙"}
              </button>
              <button style={s.btnGhost} onClick={() => setView("jar")}>Back</button>
            </div>
          </div>
        )}

        {view === "drawn" && drawnNote && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 20 }}>
            <p style={s.drawnLabel}>✨ You drew…</p>
            <div style={{ width: "100%", maxWidth: 280 }}>
              <NoteCard note={drawnNote} isNew />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button style={s.btn} onClick={keepNote}>Let's do it! 💕</button>
              <button style={s.btnGhost} onClick={returnNote}>Put it back</button>
            </div>
          </div>
        )}

        {view === "history" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={s.cardTitle}>Past draws 📖</h2>
              <button style={s.btnGhost} onClick={() => setView("jar")}>← Back</button>
            </div>
            <div style={s.grid}>
              {drawnNotes.map(note => (
                <div key={note.id}>
                  <NoteCard note={note} />
                  <p style={s.drawnMeta}>
                    Drawn by {note.drawn_by} · {new Date(note.drawn_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "plan" && drawnNote && (
          <PlanningMoment note={drawnNote} author={author} onDone={finishPlanning} />
        )}

      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [author, setAuthor] = useState(() => getStorage("dj-author") || "");
  const [jar, setJar] = useState(() => getStorage("dj-jar") || null);

  const handleName = (name) => {
    setAuthor(name);
    setStorage("dj-author", name);
  };

  const handleJar = (jarData) => {
    setJar(jarData);
    setStorage("dj-jar", jarData);
  };

  const handleLeave = () => {
    setJar(null);
    localStorage.removeItem("dj-jar");
  };

  return (
    <>
      <style>{globalStyles}</style>
      {!author && <WelcomeScreen onEnter={handleName} />}
      {author && !jar && <JarLobby author={author} onJarReady={handleJar} />}
      {author && jar && <MainApp author={author} jar={jar} onLeave={handleLeave} />}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  centeredPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "var(--bg)",
  },
  appShell: {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  header: {
    width: "100%",
    maxWidth: 580,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 24px",
    borderBottom: "1px solid rgba(0,0,0,0.07)",
  },
  headerTitle: {
    fontFamily: "'Lora', serif",
    fontSize: "1.15rem",
    fontWeight: 600,
    color: "var(--ink)",
    lineHeight: 1.2,
  },
  codeToggle: {
    background: "none", border: "none", cursor: "pointer",
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.78rem", color: "var(--accent)",
    letterSpacing: 1, padding: 0,
  },
  userBadge: {
    fontFamily: "'Caveat', cursive",
    fontSize: "1rem", color: "var(--accent)",
  },
  countBadge: {
    background: "var(--accent-soft)", color: "var(--accent)",
    padding: "2px 10px", borderRadius: 20,
    fontSize: "0.78rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
  },
  leaveBtn: {
    background: "none", border: "none", cursor: "pointer",
    color: "#bbb", fontSize: "0.9rem", padding: "2px 6px",
    borderRadius: 6,
  },
  main: {
    width: "100%", maxWidth: 580,
    padding: "32px 24px", flex: 1,
    animation: "fadeIn 0.3s ease",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "32px 28px",
    boxShadow: "0 6px 32px rgba(0,0,0,0.07)",
    maxWidth: 400,
    width: "100%",
    boxSizing: "border-box",
    animation: "fadeIn 0.4s ease",
    textAlign: "center",
  },
  displayTitle: {
    fontFamily: "'Lora', serif",
    fontSize: "2.4rem",
    color: "var(--ink)",
    fontWeight: 600,
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: "'Lora', serif",
    fontSize: "1.25rem",
    color: "var(--ink)",
    marginBottom: 14,
    textAlign: "left",
  },
  muted: {
    color: "#aaa",
    fontSize: "0.9rem",
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: 1.5,
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    border: "1.5px solid #e8d5c4",
    borderRadius: 10,
    fontSize: "1rem",
    fontFamily: "'DM Sans', sans-serif",
    background: "#fdf6ee",
    color: "var(--ink)",
    transition: "border-color 0.2s",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #e8d5c4",
    borderRadius: 10,
    fontSize: "1.15rem",
    fontFamily: "'Caveat', cursive",
    background: "#fdf6ee",
    color: "var(--ink)",
    resize: "vertical",
    lineHeight: 1.5,
  },
  btn: {
    padding: "10px 20px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: "0.95rem",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "opacity 0.15s",
  },
  btnGhost: {
    padding: "10px 16px",
    background: "transparent",
    color: "#999",
    border: "1.5px solid #e8d5c4",
    borderRadius: 10,
    fontSize: "0.9rem",
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
  },
  jarArea: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "28px 0 10px",
  },
  jarBtn: {
    background: "none", border: "none", cursor: "pointer",
    padding: 8, borderRadius: 16,
    transition: "transform 0.15s",
  },
  jarLabel: {
    color: "#bbb", fontSize: "0.83rem",
    fontFamily: "'DM Sans', sans-serif", marginTop: 6,
  },
  actionRow: {
    display: "flex", gap: 12, justifyContent: "center", marginTop: 20,
  },
  drawnLabel: {
    fontFamily: "'Caveat', cursive",
    fontSize: "1.4rem", color: "var(--accent)", fontWeight: 600,
  },
  drawnMeta: {
    fontSize: "0.7rem", color: "#bbb",
    fontFamily: "'DM Sans', sans-serif",
    textAlign: "center", marginTop: 6,
  },
  planLabel: {
    display: "block",
    fontSize: "0.7rem",
    color: "#aaa",
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
    gap: 22,
  },
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@400;500&family=DM+Mono&display=swap');

  :root {
    --bg: #fdf7f0;
    --ink: #1e1008;
    --accent: #d4693a;
    --accent-soft: #fde8d8;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); }

  @keyframes popIn {
    0% { transform: scale(0.4) rotate(0deg); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes shake {
    0%,100% { transform: translateX(0) rotate(0); }
    15%  { transform: translateX(-9px) rotate(-6deg); }
    30%  { transform: translateX(9px)  rotate(6deg);  }
    45%  { transform: translateX(-6px) rotate(-3deg); }
    60%  { transform: translateX(6px)  rotate(3deg);  }
    75%  { transform: translateX(-3px) rotate(-1deg); }
    90%  { transform: translateX(3px)  rotate(1deg);  }
  }
  @keyframes slideDown {
    from { transform: translateX(-50%) translateY(-16px); opacity: 0; }
    to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  input:focus, textarea:focus { outline: none; border-color: var(--accent) !important; }
  button:disabled { opacity: 0.38; cursor: not-allowed; }
  button:not(:disabled):hover { opacity: 0.88; }

  /* ── Responsive ─────────────────────────────────────── */

  /* Tablet (≤768px): slightly tighter, still centred */
  @media (max-width: 768px) {
    .centered-page {
      padding: 20px 16px !important;
    }
    .dj-card {
      padding: 24px 20px !important;
      border-radius: 14px;
    }
    .main-area {
      padding: 24px 16px !important;
    }
  }

  /* Phone (≤480px): fill screen width, compact spacing */
  @media (max-width: 480px) {
    .centered-page {
      padding: 16px 12px !important;
      align-items: stretch !important;
    }
    .dj-card {
      max-width: 100% !important;
      padding: 22px 16px !important;
      border-radius: 12px;
      box-shadow: 0 3px 16px rgba(0,0,0,0.08);
    }
    .main-area {
      padding: 16px 12px !important;
    }
  }
`;
