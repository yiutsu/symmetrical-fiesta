import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const NOTE_COLORS = [
  "#FFD6D6", "#FFE8C8", "#FFF5C2", "#D6F5D6",
  "#D6EEFF", "#E8D6FF", "#FFD6F0", "#D6FFF5"
];

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return NOTE_COLORS[Math.abs(hash) % NOTE_COLORS.length];
}

function NoteCard({ note, isNew = false }) {
  const color = hashColor(note.id);
  const tilt = ((note.id.charCodeAt(0) % 10) - 5) * 1.2;
  return (
    <div style={{
      background: color,
      borderRadius: "2px",
      padding: "18px 20px",
      boxShadow: "2px 3px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)",
      transform: `rotate(${tilt}deg)`,
      fontFamily: "'Caveat', cursive",
      fontSize: "1.15rem",
      color: "#2a1a0e",
      lineHeight: 1.4,
      position: "relative",
      animation: isNew ? "popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" : "none",
      minHeight: "80px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}>
      <div style={{
        position: "absolute", top: "-8px", left: "50%", transform: "translateX(-50%)",
        width: "12px", height: "12px", borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, #ff6b6b, #c0392b)",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
        zIndex: 2
      }} />
      <p style={{ margin: "6px 0 8px", wordBreak: "break-word" }}>{note.text}</p>
      <div style={{ fontSize: "0.75rem", opacity: 0.6, fontFamily: "'Inter', sans-serif", marginTop: 4 }}>
        — {note.author}
      </div>
    </div>
  );
}

function JarSVG({ shaking }) {
  return (
    <div style={{ animation: shaking ? "shake 0.5s ease" : "none" }}>
      <svg width="100" height="120" viewBox="0 0 90 110" fill="none">
        <path d="M15 40 Q10 55 10 75 Q10 100 45 100 Q80 100 80 75 Q80 55 75 40 Z"
          fill="rgba(200,230,255,0.4)" stroke="#7bb3d4" strokeWidth="2" />
        <rect x="25" y="28" width="40" height="14" rx="4"
          fill="rgba(200,230,255,0.4)" stroke="#7bb3d4" strokeWidth="2" />
        <rect x="20" y="20" width="50" height="12" rx="5"
          fill="#f4a261" stroke="#e07b39" strokeWidth="1.5" />
        <rect x="30" y="52" width="12" height="10" rx="1" fill="#FFD6D6" transform="rotate(-8 36 57)" />
        <rect x="44" y="48" width="12" height="10" rx="1" fill="#D6EEFF" transform="rotate(4 50 53)" />
        <rect x="38" y="60" width="12" height="10" rx="1" fill="#FFF5C2" transform="rotate(-3 44 65)" />
        <ellipse cx="30" cy="65" rx="5" ry="15" fill="rgba(255,255,255,0.2)" transform="rotate(-10 30 65)" />
      </svg>
    </div>
  );
}

export default function App() {
  const [notes, setNotes] = useState([]);
  const [drawnNotes, setDrawnNotes] = useState([]);
  const [author, setAuthor] = useState(() => localStorage.getItem("date-jar-user") || "");
  const [text, setText] = useState("");
  const [drawnNote, setDrawnNote] = useState(null);
  const [view, setView] = useState("jar");
  const [nameInput, setNameInput] = useState("");
  const [loggedIn, setLoggedIn] = useState(() => !!localStorage.getItem("date-jar-user"));
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const textRef = useRef(null);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 3000);
  };

  const loadNotes = async () => {
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("drawn", false)
      .order("created_at", { ascending: true });
    if (data) setNotes(data);
  };

  const loadDrawnNotes = async () => {
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("drawn", true)
      .order("drawn_at", { ascending: false });
    if (data) setDrawnNotes(data);
  };

  useEffect(() => {
    if (!loggedIn) return;
    loadNotes();
    loadDrawnNotes();

    // Real-time updates — any change in the notes table refreshes both lists
    const channel = supabase
      .channel("notes-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => {
        loadNotes();
        loadDrawnNotes();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [loggedIn]);

  const login = () => {
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    setAuthor(name);
    localStorage.setItem("date-jar-user", name);
    setLoggedIn(true);
  };

  const addNote = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);

    console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
    console.log("Attempting insert with:", { text: text.trim(), author, drawn: false });

    const { data, error } = await supabase
      .from("notes")
      .insert([{ text: text.trim(), author, drawn: false }])
      .select();

    console.log("Insert result:", { data, error });

    if (error) {
      showFeedback(`Error: ${error.message}`);
      console.error("Full error:", error);
    } else {
      setText("");
      showFeedback("Idea dropped in the jar! 🎉");
    }
    setLoading(false);
  };

  const drawNote = async () => {
    if (notes.length === 0) {
      showFeedback("The jar is empty! Add some ideas first.");
      return;
    }

    setShaking(true);
    await new Promise(r => setTimeout(r, 600));
    setShaking(false);

    // Pick a random note from the current pool
    const randomIndex = Math.floor(Math.random() * notes.length);
    const picked = notes[randomIndex];

    const { error } = await supabase
      .from("notes")
      .update({ drawn: true, drawn_by: author, drawn_at: new Date().toISOString() })
      .eq("id", picked.id);

    if (error) {
      showFeedback("Something went wrong. Try again.");
      return;
    }

    setDrawnNote(picked);
    setView("drawn");
  };

  const returnNote = async () => {
    if (!drawnNote) return;
    await supabase
      .from("notes")
      .update({ drawn: false, drawn_by: null, drawn_at: null })
      .eq("id", drawnNote.id);
    setDrawnNote(null);
    setView("jar");
  };

  const keepNote = () => {
    setDrawnNote(null);
    setView("jar");
    showFeedback("Enjoy your date! 💕");
  };

  if (!loggedIn) {
    return (
      <>
        <style>{globalStyles}</style>
        <div style={styles.page}>
          <div style={styles.loginCard}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>💌</div>
            <h1 style={styles.title}>Date Jar</h1>
            <p style={styles.subtitle}>A shared jar of date ideas for two</p>
            <div style={styles.inputGroup}>
              <input
                style={styles.input}
                placeholder="Your name..."
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && login()}
                autoFocus
              />
              <button style={styles.primaryBtn} onClick={login}>Enter →</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div style={styles.page}>
        <header style={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.5rem" }}>💌</span>
            <h1 style={styles.headerTitle}>Date Jar</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={styles.userBadge}>✦ {author}</span>
            <span style={styles.countBadge}>{notes.length} idea{notes.length !== 1 ? "s" : ""}</span>
          </div>
        </header>

        {feedback && <div style={styles.toast}>{feedback}</div>}

        {view === "jar" && (
          <div style={styles.main}>
            <div style={styles.jarSection}>
              <button
                onClick={drawNote}
                style={{ background: "none", border: "none", cursor: notes.length > 0 ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
              >
                <JarSVG shaking={shaking} />
                <span style={{ fontFamily: "'Caveat', cursive", fontSize: "1.1rem", color: "#e07b39", fontWeight: 600 }}>
                  {notes.length > 0 ? "Shake the jar!" : "Jar is empty"}
                </span>
              </button>
              <p style={{ color: "#bbb", fontSize: "0.82rem", fontFamily: "'Inter', sans-serif", marginTop: 4 }}>
                {notes.length > 0 ? "Draw a random date idea" : "Add some ideas below!"}
              </p>
            </div>

            <div style={styles.tabs}>
              <button style={styles.tabBtn} onClick={() => { setView("add"); setTimeout(() => textRef.current?.focus(), 100); }}>
                + Add an idea
              </button>
              {drawnNotes.length > 0 && (
                <button style={{ ...styles.tabBtn, ...styles.tabBtnSecondary }} onClick={() => setView("history")}>
                  Past draws ({drawnNotes.length})
                </button>
              )}
            </div>
          </div>
        )}

        {view === "add" && (
          <div style={styles.main}>
            <div style={styles.addCard}>
              <h2 style={styles.cardTitle}>Add a date idea 💡</h2>
              <textarea
                ref={textRef}
                style={styles.textarea}
                placeholder="e.g. Picnic in the park with homemade sandwiches..."
                value={text}
                onChange={e => setText(e.target.value)}
                rows={4}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button style={styles.primaryBtn} onClick={addNote} disabled={!text.trim() || loading}>
                  {loading ? "Adding..." : "Drop it in 🫙"}
                </button>
                <button style={styles.ghostBtn} onClick={() => setView("jar")}>Back</button>
              </div>
            </div>
          </div>
        )}

        {view === "drawn" && drawnNote && (
          <div style={styles.main}>
            <div style={styles.drawnSection}>
              <p style={{ fontFamily: "'Caveat', cursive", fontSize: "1.3rem", color: "#e07b39", marginBottom: 16 }}>
                ✨ You drew...
              </p>
              <div style={{ width: "100%", maxWidth: 300 }}>
                <NoteCard note={drawnNote} isNew />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button style={styles.primaryBtn} onClick={keepNote}>Let's do it! 💕</button>
                <button style={styles.ghostBtn} onClick={returnNote}>Put it back</button>
              </div>
            </div>
          </div>
        )}

        {view === "history" && (
          <div style={styles.main}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={styles.cardTitle}>Past date ideas 📖</h2>
                <button style={styles.ghostBtn} onClick={() => setView("jar")}>← Back</button>
              </div>
              <div style={styles.notesGrid}>
                {drawnNotes.map(note => (
                  <div key={note.id}>
                    <NoteCard note={note} />
                    <p style={{ fontSize: "0.7rem", color: "#aaa", fontFamily: "'Inter', sans-serif", textAlign: "center", marginTop: 6 }}>
                      Drawn by {note.drawn_by} · {new Date(note.drawn_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fdf6ee; }

  @keyframes popIn {
    0% { transform: scale(0.5); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes shake {
    0%,100% { transform: translateX(0) rotate(0); }
    15% { transform: translateX(-8px) rotate(-5deg); }
    30% { transform: translateX(8px) rotate(5deg); }
    45% { transform: translateX(-6px) rotate(-3deg); }
    60% { transform: translateX(6px) rotate(3deg); }
    75% { transform: translateX(-3px) rotate(-1deg); }
    90% { transform: translateX(3px) rotate(1deg); }
  }
  @keyframes slideDown {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  textarea:focus, input:focus { outline: none; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const styles = {
  page: {
    minHeight: "100vh",
    background: "#fdf6ee",
    backgroundImage: `
      radial-gradient(circle at 20% 20%, rgba(255,200,150,0.15) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(200,180,255,0.1) 0%, transparent 50%)
    `,
    fontFamily: "'Lora', serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  loginCard: {
    marginTop: "15vh",
    background: "white",
    borderRadius: 16,
    padding: "40px 48px",
    boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
    textAlign: "center",
    maxWidth: 380,
    width: "90%",
    animation: "fadeIn 0.5s ease",
  },
  title: { fontFamily: "'Lora', serif", fontSize: "2.2rem", color: "#2a1a0e", fontWeight: 600, marginBottom: 6 },
  subtitle: { color: "#999", fontSize: "0.95rem", marginBottom: 28, fontStyle: "italic" },
  inputGroup: { display: "flex", gap: 10 },
  input: {
    flex: 1, padding: "10px 14px", border: "1.5px solid #e8d5c4", borderRadius: 10,
    fontSize: "1rem", fontFamily: "'Inter', sans-serif", background: "#fdf6ee", color: "#2a1a0e",
  },
  textarea: {
    width: "100%", padding: "12px 14px", border: "1.5px solid #e8d5c4", borderRadius: 10,
    fontSize: "1.15rem", fontFamily: "'Caveat', cursive", background: "#fdf6ee",
    color: "#2a1a0e", resize: "vertical", lineHeight: 1.5,
  },
  primaryBtn: {
    padding: "10px 20px", background: "#e07b39", color: "white", border: "none",
    borderRadius: 10, fontSize: "0.95rem", fontFamily: "'Inter', sans-serif",
    fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
  },
  ghostBtn: {
    padding: "10px 16px", background: "transparent", color: "#999",
    border: "1.5px solid #e8d5c4", borderRadius: 10, fontSize: "0.9rem",
    fontFamily: "'Inter', sans-serif", cursor: "pointer",
  },
  header: {
    width: "100%", maxWidth: 600, display: "flex", justifyContent: "space-between",
    alignItems: "center", padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)",
  },
  headerTitle: { fontFamily: "'Lora', serif", fontSize: "1.4rem", color: "#2a1a0e", fontWeight: 600 },
  userBadge: { fontFamily: "'Caveat', cursive", fontSize: "1.05rem", color: "#e07b39" },
  countBadge: {
    background: "#fde8d5", color: "#e07b39", padding: "3px 10px",
    borderRadius: 20, fontSize: "0.8rem", fontFamily: "'Inter', sans-serif", fontWeight: 500,
  },
  toast: {
    position: "fixed", top: 70, background: "#2a1a0e", color: "white",
    padding: "10px 20px", borderRadius: 30, fontSize: "0.9rem",
    fontFamily: "'Inter', sans-serif", zIndex: 100, animation: "slideDown 0.3s ease",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
  },
  main: { width: "100%", maxWidth: 600, padding: "32px 24px", flex: 1, animation: "fadeIn 0.3s ease" },
  jarSection: { display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0" },
  tabs: { display: "flex", gap: 12, justifyContent: "center", marginTop: 24 },
  tabBtn: {
    padding: "12px 24px", background: "#e07b39", color: "white", border: "none",
    borderRadius: 12, fontSize: "0.95rem", fontFamily: "'Inter', sans-serif", fontWeight: 500, cursor: "pointer",
  },
  tabBtnSecondary: { background: "white", color: "#666", border: "1.5px solid #e8d5c4" },
  addCard: { background: "white", borderRadius: 16, padding: "28px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" },
  cardTitle: { fontFamily: "'Lora', serif", fontSize: "1.3rem", color: "#2a1a0e", marginBottom: 16 },
  drawnSection: { display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 20 },
  notesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 },
};
