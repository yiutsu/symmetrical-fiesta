import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { MeshGradient } from "@paper-design/shaders-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ai = import.meta.env.VITE_GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY })
  : null;

const anthropic = import.meta.env.VITE_ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true })
  : null;

// ─── Utilities ───────────────────────────────────────────────────────────────

const NOTE_COLORS = [
  "#FEEAD2", "#FCE0CA", "#FFE3D8", "#FCDDC2",
  "#FFECDB", "#FDF1E6", "#FAE3D9", "#FBE8D8",
];

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return NOTE_COLORS[Math.abs(hash) % NOTE_COLORS.length];
}

function generateCode() {
  const words = ["ROSE", "MOON", "STAR", "DAWN", "SUNK", "TIDE", "PINE", "MIST", "SAGE", "FERN"];
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
      borderRadius: 16,
      padding: "20px 18px 14px",
      boxShadow: "0 6px 16px rgba(160,107,74,0.15)",
      transform: `rotate(${tilt}deg)`,
      fontFamily: "'Caveat', cursive",
      fontSize: "1.25rem",
      color: "var(--text-main)",
      lineHeight: 1.45,
      position: "relative",
      animation: isNew ? "popIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275)" : "none",
      minHeight: 100,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}>
      {/* Tape or Pin */}
      <div style={{
        position: "absolute", top: -8, left: "50%",
        width: 32, height: 12, background: "rgba(255,255,255,0.5)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)", borderRadius: 2, transform: "translateX(-50%) rotate(-2deg)"
      }} />
      <p style={{ margin: "14px 0 10px", wordBreak: "break-word" }}>{note.text}</p>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
          fill={empty ? "rgba(253,235,225,0.5)" : "rgba(219,82,3,0.15)"}
          stroke={empty ? "#DEAD94" : "#BC5C0C"} strokeWidth="2" />
        <rect x="25" y="28" width="40" height="14" rx="4"
          fill={empty ? "rgba(253,235,225,0.5)" : "rgba(219,82,3,0.15)"}
          stroke={empty ? "#DEAD94" : "#BC5C0C"} strokeWidth="2" />
        <rect x="20" y="20" width="50" height="12" rx="5"
          fill={empty ? "#E8C8B5" : "#DB5203"} stroke={empty ? "#C9A18B" : "#A06B4A"} strokeWidth="1.5" />
        {!empty && <>
          <rect x="29" y="52" width="13" height="11" rx="2" fill="#FCE0CA" transform="rotate(-8 36 57)" />
          <rect x="44" y="48" width="13" height="11" rx="2" fill="#FFE3D8" transform="rotate(5 50 53)" />
          <rect x="37" y="62" width="13" height="11" rx="2" fill="#FCDDC2" transform="rotate(-3 44 67)" />
        </>}
        <ellipse cx="29" cy="66" rx="5" ry="16"
          fill="rgba(255,255,255,0.3)" transform="rotate(-10 29 66)" />
      </svg>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
      background: "var(--text-main)", color: "#fff",
      padding: "12px 24px", borderRadius: 999,
      fontSize: "0.95rem", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500,
      zIndex: 200, animation: "slideDown 0.3s ease",
      boxShadow: "0 8px 24px rgba(62,36,21,0.25)",
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
      action: "TEMPLATE", text: `📅 ${note.text}`, dates: `${start}/${end}`, details: "From our Date Jar 💌",
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
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Date Jar//EN", "CALSCALE:GREGORIAN",
      "METHOD:REQUEST", "BEGIN:VEVENT", `DTSTART:${start}`, `DTEND:${end}`,
      `SUMMARY:\uD83D\uDCC5 ${note.text}`, `DESCRIPTION:From our Date Jar \uD83D\uDC8C`,
      attendees, `UID:${note.id}-${Date.now()}@datejar`, "STATUS:CONFIRMED",
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "date.ics"; a.click();
    URL.revokeObjectURL(url);
    onDone();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, animation: "fadeIn 0.3s ease" }}>
      <p style={s.drawnLabel}>Let's plan it!</p>

      {/* Note preview */}
      <div style={{ width: "100%", maxWidth: 320 }}>
        <NoteCard note={note} />
      </div>

      {/* Date + Time */}
      <div style={{ display: "flex", gap: 16, width: "100%", maxWidth: 320 }}>
        <div style={{ flex: 1 }}>
          <label style={s.planLabel}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...s.input, width: "100%" }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={s.planLabel}>Time</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...s.input, width: "100%" }} />
        </div>
      </div>

      {/* Email fields */}
      <div style={{ width: "100%", maxWidth: 320 }}>
        {!showEmails ? (
          <button style={{ ...s.btnGhost, width: "100%", fontSize: "0.85rem" }} onClick={() => setShowEmails(true)}>
            + Add emails to invite both of you
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input style={{ ...s.input, width: "100%" }} type="email" placeholder="Your email (optional)"
              value={myEmail} onChange={e => setMyEmail(e.target.value)} />
            <input style={{ ...s.input, width: "100%" }} type="email" placeholder="Partner's email (optional)"
              value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} />
          </div>
        )}
      </div>

      {/* Calendar buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}>
        <button onClick={openGoogleCal} style={{ ...s.btn, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span>🗓</span> Add to Google Calendar
        </button>
        <button onClick={openAppleCal} style={{ ...s.btnInverted, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span>🍎</span> Add to Apple Calendar
        </button>
      </div>

      <button onClick={onDone} style={s.skipBtn}>Skip, we'll figure it out →</button>
    </div>
  );
}

// ─── Screens ─────────────────────────────────────────────────────────────────

function WelcomeScreen({ onEnter }) {
  const [name, setName] = useState("");
  return (
    <div style={s.centeredPage} className="centered-page">
      <MeshGradient speed={0.5} scale={0.85} distortion={0.8} swirl={0.07} colors={['#DB5203','#E69C05','#FCE8D8','#BC5C0C']} style={s.bgShader} />
      <div style={s.flexCardCenter}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>💌</div>
        <h1 style={s.displayTitle}>Date Jar</h1>
        <p style={s.muted}>A private jar of date ideas, shared between two</p>
        <div style={{ marginTop: 32, display: "flex", gap: 12, flexDirection: "column" }}>
          <input
            style={{...s.input, textAlign: "center"}} placeholder="Your name…" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && name.trim() && onEnter(name.trim())}
            autoFocus
          />
          <button style={s.btn} onClick={() => name.trim() && onEnter(name.trim())}>Continue →</button>
        </div>
      </div>
    </div>
  );
}

function JarLobby({ author, onJarReady }) {
  const [mode, setMode] = useState(null);
  const [jarName, setJarName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createJar = async () => {
    if (!jarName.trim()) return;
    setLoading(true); setError("");
    const newCode = generateCode();
    const { data, error } = await supabase.from("jars").insert([{ name: jarName.trim(), code: newCode }]).select().single();
    if (error) { setError("Could not create jar. Try again."); setLoading(false); return; }
    onJarReady(data);
    setLoading(false);
  };

  const joinJar = async () => {
    if (!code.trim()) return;
    setLoading(true); setError("");
    const { data, error } = await supabase.from("jars").select("*").eq("code", code.trim().toUpperCase()).single();
    if (error || !data) { setError("No jar found with that code."); setLoading(false); return; }
    onJarReady(data);
    setLoading(false);
  };

  return (
    <div style={s.centeredPage} className="centered-page">
      <MeshGradient speed={0.5} scale={0.85} distortion={0.8} swirl={0.07} colors={['#DB5203','#E69C05','#FCE8D8','#BC5C0C']} style={s.bgShader} />
      <div style={s.flexCardCenter}>
        <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>🫙</div>
        <h2 style={s.cardTitle}>Welcome, {author}</h2>
        <p style={{...s.muted, marginBottom: 24}}>Create a new jar or join one with a code</p>

        {!mode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button style={s.btn} onClick={() => setMode("create")}>Create a jar</button>
            <button style={s.btnSecondary} onClick={() => setMode("join")}>Join with code</button>
          </div>
        )}

        {mode === "create" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input style={{...s.input, textAlign: "center"}} placeholder="e.g. Our Dates…" value={jarName} onChange={e => setJarName(e.target.value)} onKeyDown={e => e.key === "Enter" && createJar()} autoFocus />
            <button style={s.btn} onClick={createJar} disabled={loading || !jarName.trim()}>
              {loading ? "Creating…" : "Create 🫙"}
            </button>
            <button style={s.btnGhost} onClick={() => setMode(null)}>Back</button>
          </div>
        )}

        {mode === "join" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input style={{...s.input, textAlign: "center", textTransform: "uppercase", letterSpacing: 2}} placeholder="e.g. ROSE-7842" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && joinJar()} autoFocus />
            <button style={s.btn} onClick={joinJar} disabled={loading || !code.trim()}>
              {loading ? "Joining…" : "Join →"}
            </button>
            <button style={s.btnGhost} onClick={() => setMode(null)}>Back</button>
          </div>
        )}
        {error && <p style={{ color: "#c0392b", fontSize: "0.85rem", marginTop: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{error}</p>}
      </div>
    </div>
  );
}

function MainApp({ author, jar, onLeave }) {
  const [notes, setNotes] = useState([]);
  const [drawnNotes, setDrawnNotes] = useState([]);
  const [text, setText] = useState("");
  const [drawnNote, setDrawnNote] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [whisper, setWhisper] = useState("");
  const [whisperVisible, setWhisperVisible] = useState(false);
  const textRef = useRef(null);
  const whisperTimerRef = useRef(null);

  // ─── Whisper (Claude debounced suggestion) ────────────────────────────────
  const getWhisper = async (inputText) => {
    if (!anthropic || !inputText.trim() || inputText.trim().length < 4) return;
    try {
      const msg = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 32,
        messages: [{ role: "user", content: `Someone is adding a date idea to their private jar.\nThey've written so far: "${inputText}"\n\nComplete or extend their thought in 6 words or fewer.\nBe evocative, specific, warm. No punctuation at the end.\nJust the whisper, nothing else.` }]
      });
      const result = msg.content?.[0]?.text?.trim();
      if (result) { setWhisper(result); setWhisperVisible(true); }
    } catch (e) {
      // silently ignore whisper errors
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    setWhisperVisible(false);
    setWhisper("");
    clearTimeout(whisperTimerRef.current);
    if (val.trim().length >= 4) {
      whisperTimerRef.current = setTimeout(() => getWhisper(val), 600);
    }
  };

  useEffect(() => () => clearTimeout(whisperTimerRef.current), []);

  const toast = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(""), 3000); };

  const loadNotes = async () => {
    const { data } = await supabase.from("notes").select("*").eq("jar_id", jar.id).eq("drawn", false).order("created_at");
    if (data) setNotes(data);
  };

  const loadDrawnNotes = async () => {
    const { data } = await supabase.from("notes").select("*").eq("jar_id", jar.id).eq("drawn", true).order("drawn_at", { ascending: false });
    if (data) setDrawnNotes(data);
  };

  useEffect(() => {
    loadNotes(); loadDrawnNotes();
    const channel = supabase.channel(`jar-${jar.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `jar_id=eq.${jar.id}` }, () => { loadNotes(); loadDrawnNotes(); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [jar.id]);

  const addNote = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    const { error } = await supabase.from("notes").insert([{ jar_id: jar.id, text: text.trim(), author, drawn: false }]);
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
    const { error } = await supabase.from("notes").update({ drawn: true, drawn_by: author, drawn_at: new Date().toISOString() }).eq("id", picked.id);
    if (error) { toast("Something went wrong. Try again."); return; }
    setDrawnNote(picked);
    setPlanning(false);
  };

  const generateIdea = async () => {
    if (!ai) { toast("AI generation is not configured. Please add VITE_GEMINI_API_KEY."); return; }
    setGenerating(true); toast("Asking AI for an idea...");
    try {
      const existingIdeas = notes.map(n => n.text).join("\n- ");
      const prompt = `Use this Date Jar context: ${existingIdeas || "none"}. Suggest EXACTLY ONE romantically written, concise new date idea in the same language.`;
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      if (response && response.text) { setText(response.text); toast("Idea generated! ✨"); }
      else toast("Failed to generate idea. Try again.");
    } catch (e) {
      console.error(e); toast("Error generating idea.");
    } finally { setGenerating(false); }
  };

  const returnNote = async () => {
    await supabase.from("notes").update({ drawn: false, drawn_by: null, drawn_at: null }).eq("id", drawnNote.id);
    setDrawnNote(null); setPlanning(false);
  };

  const keepNote = () => setPlanning(true);
  const finishPlanning = () => { setDrawnNote(null); setPlanning(false); toast("Enjoy your date! 💕"); };

  return (
    <div style={s.appShell}>
      <MeshGradient speed={0.5} scale={0.85} distortion={0.8} swirl={0.07} colors={['#DB5203','#E69C05','#FCE8D8','#BC5C0C']} style={s.bgShader} />
      <Toast message={feedback} />

      <header style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "1.6rem" }}>💌</span>
          <div>
            <div style={s.headerTitle}>{jar.name}</div>
            <button onClick={() => setShowCode(v => !v)} style={s.codeToggle}>{showCode ? jar.code : "show code"}</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={s.userBadge}>✦ {author}</span>
          <span style={s.countBadge}>{notes.length}</span>
          <button onClick={onLeave} style={s.leaveBtn} title="Leave jar">✕</button>
        </div>
      </header>

      {/* Dynamic Floating Dashboard Layout */}
      <div style={s.dashboardContainer} className="dashboard">
        {drawnNote ? (
          /* Focus view: Planning or Drawn Note */
          <div style={{...s.flexCardCenter, gridColumn: "1 / -1", margin: "0 auto", animation: "popIn 0.3s ease"}}>
            {!planning ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                <p style={s.drawnLabel}>✨ You drew…</p>
                <div style={{ width: "100%", maxWidth: 320 }}><NoteCard note={drawnNote} isNew /></div>
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <button style={s.btn} onClick={keepNote}>Let's do it! 💕</button>
                  <button style={s.btnGhost} onClick={returnNote}>Put it back</button>
                </div>
              </div>
            ) : (
              <PlanningMoment note={drawnNote} author={author} onDone={finishPlanning} />
            )}
          </div>
        ) : (
          <>
            {/* Left Column: Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={s.card}>
                <h2 style={{...s.cardTitle, textAlign: "center"}}>The Jar</h2>
                <div style={s.jarArea}>
                  <button onClick={drawNote} style={s.jarBtn}>
                    <JarSVG shaking={shaking} empty={notes.length === 0} />
                  </button>
                  <p style={s.jarLabel}>
                    {notes.length > 0 ? `${notes.length} idea${notes.length !== 1 ? "s" : ""} inside — shake!` : "Jar is empty!"}
                  </p>
                </div>
              </div>

              <div style={s.card}>
                <h2 style={s.cardTitle}>Drop an idea in 💡</h2>
                <div style={{ position: "relative", marginBottom: whisperVisible ? 8 : 16 }}>
                  <textarea
                    ref={textRef} style={s.textarea}
                    placeholder="e.g. Sunset picnic with homemade sandwiches…"
                    value={text} onChange={handleTextChange} rows={3}
                    onKeyDown={() => { setWhisperVisible(false); clearTimeout(whisperTimerRef.current); }}
                    onFocus={() => { if (!whisper) return; setWhisperVisible(true); }}
                    onBlur={() => setWhisperVisible(false)}
                  />
                  {notes.length >= 10 && (
                    <button
                      onClick={generateIdea} disabled={generating || loading || !ai}
                      title={!ai ? "Missing API Key" : "Generate idea using AI"}
                      style={s.aiBtn(generating, ai)}
                    >
                      {generating ? "⟳" : "✨"} Generate
                    </button>
                  )}
                </div>
                {/* Whisper ghost line */}
                {anthropic && (
                  <div style={{
                    minHeight: 28,
                    marginBottom: 16,
                    paddingLeft: 20,
                    fontFamily: "'Caveat', cursive",
                    fontSize: "1.1rem",
                    fontStyle: "italic",
                    color: "var(--neutral)",
                    opacity: whisperVisible ? 0.65 : 0,
                    transition: "opacity 500ms ease",
                    pointerEvents: "none",
                    lineHeight: 1.4,
                    userSelect: "none",
                  }}>
                    {whisper && `…${whisper}`}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button style={s.btn} onClick={addNote} disabled={!text.trim() || loading || generating}>
                    {(loading || generating) ? "Adding…" : "Drop it in 🫙"}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: History */}
            <div style={s.card}>
              <h2 style={s.cardTitle}>Past draws 📖</h2>
              {drawnNotes.length === 0 ? (
                <p style={s.muted}>Nothing drawn yet. Draw an idea from the jar to start making memories!</p>
              ) : (
                <div style={s.grid}>
                  {drawnNotes.map(note => (
                    <div key={note.id} style={{ animation: "fadeIn 0.3s ease" }}>
                      <NoteCard note={note} />
                      <p style={s.drawnMeta}>
                        Drawn by {note.drawn_by} · {new Date(note.drawn_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [author, setAuthor] = useState(() => getStorage("dj-author") || "");
  const [jar, setJar] = useState(() => getStorage("dj-jar") || null);

  const handleName = (name) => { setAuthor(name); setStorage("dj-author", name); };
  const handleJar = (jarData) => { setJar(jarData); setStorage("dj-jar", jarData); };
  const handleLeave = () => { setJar(null); localStorage.removeItem("dj-jar"); };

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
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    padding: 24, position: "relative", overflow: "hidden", background: "var(--bg-peach)"
  },
  bgShader: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", zIndex: 0 },
  appShell: {
    minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
    position: "relative", background: "var(--bg-peach)", overflowX: "hidden"
  },
  header: {
    width: "100%", maxWidth: 1000, display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "24px", zIndex: 1, position: "relative"
  },
  headerTitle: { fontFamily: "'Noto Serif', serif", fontSize: "1.3rem", fontWeight: 600, color: "var(--text-main)", lineHeight: 1.2 },
  codeToggle: { background: "none", border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.8rem", color: "var(--primary)", fontWeight: 500 },
  userBadge: { fontFamily: "'Noto Serif', serif", fontStyle: "italic", fontSize: "1.05rem", color: "var(--primary)" },
  countBadge: { background: "var(--tertiary)", color: "#fff", padding: "2px 10px", borderRadius: 20, fontSize: "0.8rem", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 },
  leaveBtn: { background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.9rem", padding: "2px 6px", borderRadius: 6 },
  
  dashboardContainer: {
    width: "100%", maxWidth: 1000, padding: "12px 24px 48px", flex: 1, zIndex: 1,
    display: "grid", gap: 24, gridTemplateColumns: "1fr", alignItems: "start",
    animation: "fadeIn 0.3s ease",
  },
  card: {
    background: "var(--card-surface)", borderRadius: 24, padding: "32px 28px",
    boxShadow: "0 8px 32px rgba(160,107,74,0.12)", boxSizing: "border-box", textAlign: "left",
    position: "relative"
  },
  flexCardCenter: {
    background: "var(--card-surface)", borderRadius: 24, padding: "40px 32px",
    boxShadow: "0 8px 32px rgba(160,107,74,0.12)", width: "100%", maxWidth: 460, textAlign: "center", zIndex: 1,
    display: "flex", flexDirection: "column", alignItems: "center"
  },
  
  displayTitle: { fontFamily: "'Noto Serif', serif", fontSize: "3rem", color: "var(--text-main)", fontWeight: 600, marginBottom: 8, letterSpacing: "-0.02em" },
  cardTitle: { fontFamily: "'Noto Serif', serif", fontSize: "1.5rem", color: "var(--text-main)", marginBottom: 16 },
  muted: { color: "var(--text-muted)", fontSize: "0.95rem", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.5 },
  
  input: {
    flex: 1, padding: "14px 18px", border: "1px solid rgba(160,107,74,0.3)", borderRadius: 12,
    fontSize: "1rem", fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#fff", color: "var(--text-main)", transition: "border-color 0.2s"
  },
  textarea: {
    width: "100%", padding: "16px 20px", border: "1px solid rgba(160,107,74,0.3)", borderRadius: 16,
    fontSize: "1.1rem", fontFamily: "'Caveat', cursive", background: "#fff", color: "var(--text-main)", resize: "vertical", lineHeight: 1.5
  },
  
  btn: {
    padding: "14px 28px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 999,
    fontSize: "1rem", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: "pointer", transition: "transform 0.15s, opacity 0.15s", whiteSpace: "nowrap"
  },
  btnSecondary: {
    padding: "14px 28px", background: "var(--bg-peach)", color: "var(--primary)", border: "none", borderRadius: 999,
    fontSize: "1rem", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: "pointer", transition: "opacity 0.15s"
  },
  btnGhost: {
    padding: "12px 24px", background: "transparent", color: "var(--secondary)", border: "1px solid rgba(160,107,74,0.4)", borderRadius: 999,
    fontSize: "0.95rem", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: "pointer"
  },
  btnInverted: {
    padding: "14px 28px", background: "var(--text-main)", color: "var(--bg-peach)", border: "none", borderRadius: 999,
    fontSize: "1rem", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: "pointer"
  },
  skipBtn: { background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "8px 0" },
  
  aiBtn: (generating, ai) => ({
    position: "absolute", bottom: 16, right: 16,
    background: generating ? "var(--bg-peach)" : "#fff",
    border: "1px solid rgba(160,107,74,0.3)", borderRadius: 999, padding: "6px 14px",
    fontSize: "0.8rem", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
    color: generating ? "var(--text-muted)" : "var(--primary)",
    cursor: generating || !ai ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6,
    boxShadow: "0 2px 8px rgba(160,107,74,0.08)", transition: "all 0.2s ease", opacity: (!ai || generating) ? 0.6 : 1
  }),

  jarArea: { display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" },
  jarBtn: { background: "none", border: "none", cursor: "pointer", padding: 8, transition: "transform 0.15s" },
  jarLabel: { color: "var(--neutral)", fontSize: "0.88rem", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 16, fontStyle: "italic" },
  
  drawnLabel: { fontFamily: "'Noto Serif', serif", fontSize: "1.8rem", color: "var(--primary)", fontWeight: 600, fontStyle: "italic", marginBottom: 8 },
  drawnMeta: { fontSize: "0.75rem", color: "var(--neutral)", fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center", marginTop: 10 },
  planLabel: { display: "block", fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 },
  
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 24, alignItems: "start" }
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Noto+Serif:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');

  :root {
    --primary: #DB5203;
    --secondary: #BC5C0C;
    --tertiary: #E69C05;
    --neutral: #A06B4A;
    --bg-peach: #FFF4ED;
    --card-surface: #FDF4EB;
    --text-main: #3E2415;
    --text-muted: #8E5A3D;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg-peach); font-family: 'Plus Jakarta Sans', sans-serif; color: var(--text-main); }

  @keyframes popIn {
    0% { transform: scale(0.4) rotate(-5deg); opacity: 0; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
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
    from { transform: translateX(-50%) translateY(-24px); opacity: 0; }
    to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  input:focus, textarea:focus { outline: none; border-color: var(--primary) !important; }
  button:disabled { opacity: 0.38; cursor: not-allowed; }
  button:not(:disabled):hover { opacity: 0.88; transform: translateY(-1px); }

  /* ── Responsive Dashboard Layout ────────────────────── */

  @media (min-width: 800px) {
    .dashboard {
      grid-template-columns: 350px 1fr !important;
    }
  }

  /* Tablet (≤768px) */
  @media (max-width: 768px) {
    .dashboard { padding: 12px 16px 32px !important; }
    .centered-page { padding: 20px 16px !important; }
  }

  /* Phone (≤480px) */
  @media (max-width: 480px) {
    .centered-page { padding: 16px 12px !important; align-items: stretch !important; }
    .dashboard { padding: 8px 12px 24px !important; gap: 16px !important; }
    div[style*="max-width: 460px"] { max-width: 100% !important; padding: 32px 20px !important; border-radius: 20px !important; }
  }
`;
