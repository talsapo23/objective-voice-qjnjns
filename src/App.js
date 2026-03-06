import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── localStorage helpers ────────────────────────────────────────────────────
const KEYS = {
  sims: "taltalks_simulations",
  errors: "taltalks_errors",
  goals_done: "taltalks_goals_done",
  archives: "taltalks_archives",
};
function load(key, fallback) {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// ─── Conversion tables (PDF) ─────────────────────────────────────────────────
const RAW_TO_SCALED = {
  verbal: [
    50, 51, 52, 54, 55, 56, 58, 59, 60, 62, 63, 64, 66, 67, 69, 71, 73, 75, 77,
    79, 81, 83, 86, 88, 91, 94, 97, 99, 102, 105, 107, 109, 112, 114, 116, 119,
    122, 125, 127, 130, 132, 135, 138, 141, 144, 147, 150,
  ],
  quant: [
    50, 52, 54, 56, 58, 60, 63, 66, 68, 70, 73, 76, 78, 80, 83, 86, 88, 90, 93,
    96, 98, 100, 103, 106, 108, 110, 113, 116, 118, 120, 123, 126, 128, 130,
    133, 136, 138, 141, 144, 147, 150,
  ],
  english: [
    50, 51, 52, 53, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82,
    84, 87, 90, 92, 95, 98, 100, 102, 104, 107, 110, 112, 115, 117, 120, 122,
    124, 127, 130, 132, 135, 138, 141, 144, 147, 150,
  ],
};
function rawToScaled(domain, raw) {
  const table = RAW_TO_SCALED[domain];
  if (raw < 0) return 50;
  if (raw >= table.length) return table[table.length - 1];
  return table[raw] ?? 50;
}
const WEIGHTED_TO_GENERAL = [
  { min: 50, max: 50, lo: 200, hi: 200 },
  { min: 51, max: 55, lo: 221, hi: 248 },
  { min: 56, max: 60, lo: 249, hi: 276 },
  { min: 61, max: 65, lo: 277, hi: 304 },
  { min: 66, max: 70, lo: 305, hi: 333 },
  { min: 71, max: 75, lo: 334, hi: 361 },
  { min: 76, max: 80, lo: 362, hi: 389 },
  { min: 81, max: 85, lo: 390, hi: 418 },
  { min: 86, max: 90, lo: 419, hi: 446 },
  { min: 91, max: 95, lo: 447, hi: 474 },
  { min: 96, max: 100, lo: 475, hi: 503 },
  { min: 101, max: 105, lo: 504, hi: 531 },
  { min: 106, max: 110, lo: 532, hi: 559 },
  { min: 111, max: 115, lo: 560, hi: 587 },
  { min: 116, max: 120, lo: 588, hi: 616 },
  { min: 121, max: 125, lo: 617, hi: 644 },
  { min: 126, max: 130, lo: 645, hi: 672 },
  { min: 131, max: 135, lo: 673, hi: 701 },
  { min: 136, max: 140, lo: 702, hi: 729 },
  { min: 141, max: 145, lo: 730, hi: 761 },
  { min: 146, max: 149, lo: 762, hi: 795 },
  { min: 150, max: 150, lo: 800, hi: 800 },
];
function weightedToGeneral(w) {
  const clamped = Math.round(Math.min(150, Math.max(50, w)));
  const row = WEIGHTED_TO_GENERAL.find(
    (r) => clamped >= r.min && clamped <= r.max
  );
  return row ? `${row.lo}–${row.hi}` : "–";
}
const SCORE_PERCENTILES = [
  { lo: 200, hi: 349, below: 0, in: 6, above: 94 },
  { lo: 350, hi: 374, below: 6, in: 4, above: 90 },
  { lo: 375, hi: 399, below: 10, in: 5, above: 85 },
  { lo: 400, hi: 424, below: 15, in: 5, above: 80 },
  { lo: 425, hi: 449, below: 20, in: 6, above: 74 },
  { lo: 450, hi: 474, below: 26, in: 7, above: 67 },
  { lo: 475, hi: 499, below: 33, in: 7, above: 60 },
  { lo: 500, hi: 524, below: 40, in: 7, above: 53 },
  { lo: 525, hi: 549, below: 47, in: 7, above: 46 },
  { lo: 550, hi: 574, below: 54, in: 7, above: 39 },
  { lo: 575, hi: 599, below: 61, in: 7, above: 32 },
  { lo: 600, hi: 624, below: 68, in: 8, above: 24 },
  { lo: 625, hi: 649, below: 76, in: 7, above: 17 },
  { lo: 650, hi: 674, below: 83, in: 6, above: 11 },
  { lo: 675, hi: 699, below: 89, in: 5, above: 6 },
  { lo: 700, hi: 724, below: 94, in: 3, above: 3 },
  { lo: 725, hi: 800, below: 97, in: 3, above: 0 },
];
function getPercentile(scoreStr) {
  const parts = scoreStr.split("–");
  const mid =
    parts.length === 2
      ? Math.round((parseInt(parts[0]) + parseInt(parts[1])) / 2)
      : parseInt(scoreStr);
  if (isNaN(mid)) return null;
  return SCORE_PERCENTILES.find((r) => mid >= r.lo && mid <= r.hi) || null;
}

// ─── Constants & Styles ──────────────────────────────────────────────────────
const emptyRow = () => ({
  id: Date.now() + Math.random(),
  question: "",
  correct: "",
  mistake: "",
  why: "",
  steps: "",
});
const TABS = [
  "מעקב ציונים",
  "תחקור שאלות",
  "יעדים לסימולציה הבאה",
  "חישוב ציון",
  "תחקורים שמורים",
];
const GOAL_COLORS = [
  "#4338ca",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
];
const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: 5,
};
const inputStyle = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: "1.5px solid #e5e7eb",
  fontSize: 14,
  color: "#1e293b",
  background: "#f9fafb",
  outline: "none",
  direction: "rtl",
  fontFamily: "inherit",
};
const textareaStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1.5px solid #e5e7eb",
  fontSize: 12.5,
  color: "#1e293b",
  background: "#f9fafb",
  outline: "none",
  resize: "vertical",
  lineHeight: 1.5,
  direction: "rtl",
  minWidth: 110,
  fontFamily: "inherit",
};
const thStyle = {
  padding: "10px 8px",
  fontWeight: 700,
  fontSize: 12,
  color: "#374151",
  textAlign: "right",
  borderBottom: "2px solid #e5e7eb",
  whiteSpace: "nowrap",
  background: "#f8fafc",
};
const tdStyle = {
  padding: "7px 8px",
  fontSize: 13,
  color: "#374151",
  verticalAlign: "top",
  background: "#fff",
  borderBottom: "1px solid #f1f5f9",
};
const deleteBtnStyle = {
  background: "#fee2e2",
  color: "#ef4444",
  border: "none",
  borderRadius: 6,
  width: 28,
  height: 28,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const cardStyle = {
  background: "#fff",
  borderRadius: 16,
  padding: "22px 24px",
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  marginBottom: 20,
};

// ─── Sub-components ──────────────────────────────────────────────────────────
function ScoreBadge({ score, color }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: color + "18",
        color,
        borderRadius: 7,
        padding: "3px 10px",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {score}
    </span>
  );
}
function EmptyState({ text, onAction, actionLabel }) {
  return (
    <div
      style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}
    >
      <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
      <p style={{ margin: 0, fontSize: 14 }}>{text}</p>
      {onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 16,
            background: "linear-gradient(135deg,#4338ca,#6366f1)",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "10px 22px",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
function SectionHeader({ color, icon, title, subtitle }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: `2px solid ${color}20`,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: color + "15",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#1e1b4b" }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>{subtitle}</div>
      </div>
    </div>
  );
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [simulations, setSimulations] = useState(() => load(KEYS.sims, []));
  const [simForm, setSimForm] = useState({
    name: "",
    quant: "",
    verbal: "",
    english: "",
    psycho: "",
  });
  const [errorRows, setErrorRows] = useState(() =>
    load(KEYS.errors, [emptyRow()])
  );
  const [goalsDone, setGoalsDone] = useState(() => load(KEYS.goals_done, {}));
  const [archives, setArchives] = useState(() => load(KEYS.archives, []));
  const [expandedArchive, setExpandedArchive] = useState(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishName, setFinishName] = useState("");
  const [calc, setCalc] = useState({
    v1: "",
    v2: "",
    essay: "",
    q1: "",
    q2: "",
    e1: "",
    e2: "",
    useEssay: false,
  });
  const [calcResult, setCalcResult] = useState(null);

  const persistSims = (u) => {
    setSimulations(u);
    save(KEYS.sims, u);
  };
  const persistErrors = (u) => {
    setErrorRows(u);
    save(KEYS.errors, u);
  };
  const persistGoals = (u) => {
    setGoalsDone(u);
    save(KEYS.goals_done, u);
  };
  const persistArchive = (u) => {
    setArchives(u);
    save(KEYS.archives, u);
  };

  // ── Simulations ────────────────────────────────────────────────────────────
  const handleSimFormChange = (e) =>
    setSimForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const addSimulation = () => {
    if (!simForm.name && !simForm.quant && !simForm.verbal && !simForm.english)
      return;
    persistSims([
      ...simulations,
      {
        id: Date.now(),
        name: simForm.name || `סימולציה ${simulations.length + 1}`,
        quant: Number(simForm.quant) || 0,
        verbal: Number(simForm.verbal) || 0,
        english: Number(simForm.english) || 0,
        psycho: simForm.psycho ? Number(simForm.psycho) : null,
      },
    ]);
    setSimForm({ name: "", quant: "", verbal: "", english: "", psycho: "" });
  };
  const deleteSim = (id) => persistSims(simulations.filter((x) => x.id !== id));

  // ── Error rows ─────────────────────────────────────────────────────────────
  const addErrorRow = () => persistErrors([...errorRows, emptyRow()]);
  const updateErrorRow = (id, f, v) =>
    persistErrors(errorRows.map((r) => (r.id === id ? { ...r, [f]: v } : r)));
  const deleteErrorRow = (id) =>
    persistErrors(errorRows.filter((r) => r.id !== id));

  // ── Goals ──────────────────────────────────────────────────────────────────
  const toggleGoal = (key) => {
    const u = { ...goalsDone, [key]: !goalsDone[key] };
    persistGoals(u);
  };
  const goals = errorRows
    .map((r) => ({ text: r.steps.trim(), key: `goal_${r.id}` }))
    .filter((g) => g.text);
  const doneCount = goals.filter((g) => goalsDone[g.key]).length;

  // ── Finish & Archive ───────────────────────────────────────────────────────
  const openFinishModal = () => {
    setFinishName("");
    setShowFinishModal(true);
  };
  const confirmFinish = () => {
    if (
      !errorRows.some(
        (r) => r.question || r.correct || r.mistake || r.why || r.steps
      )
    )
      return;
    const entry = {
      id: Date.now(),
      name: finishName.trim() || `תחקור ${formatDate(Date.now())}`,
      date: Date.now(),
      rows: errorRows.filter(
        (r) => r.question || r.correct || r.mistake || r.why || r.steps
      ),
    };
    persistArchive([entry, ...archives]);
    persistErrors([emptyRow()]);
    persistGoals({});
    setShowFinishModal(false);
    setActiveTab(4);
  };
  const deleteArchive = (id) =>
    persistArchive(archives.filter((a) => a.id !== id));

  // ── Calc ───────────────────────────────────────────────────────────────────
  const handleCalcChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCalc((c) => ({ ...c, [name]: type === "checkbox" ? checked : value }));
    setCalcResult(null);
  };
  const runCalc = () => {
    const vRaw = (Number(calc.v1) || 0) + (Number(calc.v2) || 0);
    const qRaw = (Number(calc.q1) || 0) + (Number(calc.q2) || 0);
    const eRaw = (Number(calc.e1) || 0) + (Number(calc.e2) || 0);
    const V_base = rawToScaled("verbal", vRaw);
    const Q = rawToScaled("quant", qRaw);
    const E = rawToScaled("english", eRaw);
    let V = V_base;
    let essayNote = null;
    if (calc.useEssay && calc.essay) {
      const essayScaled = Math.round(
        50 + ((Number(calc.essay) - 1) / 11) * 100
      );
      V = Math.round(V_base * 0.75 + essayScaled * 0.25);
      essayNote = { essayScaled, V_base, V };
    }
    const wMulti = Math.round((2 * V + 2 * Q + E) / 5);
    const wVerbal = Math.round((3 * V + Q + E) / 5);
    const wQuant = Math.round((V + 3 * Q + E) / 5);
    setCalcResult({
      vRaw,
      qRaw,
      eRaw,
      V,
      Q,
      E,
      essayNote,
      wMulti,
      wVerbal,
      wQuant,
      generalMulti: weightedToGeneral(wMulti),
      generalVerbal: weightedToGeneral(wVerbal),
      generalQuant: weightedToGeneral(wQuant),
    });
  };

  const chartData = simulations.map((s) => ({
    name: s.name,
    כמותי: s.quant,
    מילולי: s.verbal,
    אנגלית: s.english,
    ...(s.psycho ? { ציון_פסיכומטרי: s.psycho } : {}),
  }));

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Heebo',Arial,sans-serif",
        minHeight: "100vh",
        background: "#f0f4f8",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; } body { margin:0; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-thumb { background:#c7d2dc; border-radius:4px; }
        .tab-btn:hover { background:rgba(99,102,241,0.06); }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:100; padding:16px; }
      `}</style>

      {/* ── Finish Modal ── */}
      {showFinishModal && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setShowFinishModal(false)
          }
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: "28px 26px",
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h3
              style={{
                margin: "0 0 6px",
                fontSize: 18,
                fontWeight: 800,
                color: "#1e1b4b",
              }}
            >
              💾 שמירת תחקור
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6b7280" }}>
              הטבלה הנוכחית תישמר בארכיון, והטבלה תתאפס למילוי חדש.
            </p>
            <label style={labelStyle}>שם לתחקור הזה (אופציונלי)</label>
            <input
              value={finishName}
              onChange={(e) => setFinishName(e.target.value)}
              placeholder={`לדוג': תחקור סימולציה 3`}
              style={{ ...inputStyle, marginBottom: 20 }}
              onKeyDown={(e) => e.key === "Enter" && confirmFinish()}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={confirmFinish}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg,#1e1b4b,#4338ca)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "11px",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✅ סיימתי, שמור
              </button>
              <button
                onClick={() => setShowFinishModal(false)}
                style={{
                  flex: 1,
                  background: "#f1f5f9",
                  color: "#374151",
                  border: "none",
                  borderRadius: 10,
                  padding: "11px",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header
        style={{
          background:
            "linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)",
          padding: "18px 24px",
          boxShadow: "0 4px 24px rgba(67,56,202,0.18)",
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 11,
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              📊
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  color: "#fff",
                  fontSize: "clamp(15px,3vw,21px)",
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                  lineHeight: 1.2,
                }}
              >
                טל מדברת פסיכומטרי
              </h1>
              <p
                style={{
                  margin: 0,
                  color: "rgba(199,210,254,0.85)",
                  fontSize: 12,
                }}
              >
                דשבורד תחקור אישי
              </p>
            </div>
          </div>
          <a
            href="https://talsapo-psycho.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              border: "1.5px solid rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            🌐 לאתר הראשי
          </a>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1.5px solid #e5e7eb",
          position: "sticky",
          top: 0,
          zIndex: 10,
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            display: "flex",
            overflowX: "auto",
          }}
        >
          {TABS.map((tab, i) => (
            <button
              key={i}
              className="tab-btn"
              onClick={() => setActiveTab(i)}
              style={{
                padding: "13px 14px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "clamp(11px,1.6vw,13px)",
                fontWeight: activeTab === i ? 700 : 500,
                color: activeTab === i ? "#4338ca" : "#6b7280",
                borderBottom:
                  activeTab === i
                    ? "2.5px solid #4338ca"
                    : "2.5px solid transparent",
                whiteSpace: "nowrap",
              }}
            >
              {["📈 ", "🔍 ", "🎯 ", "🧮 ", "🗂️ "][i]}
              {tab}
              {i === 4 && archives.length > 0 && (
                <span
                  style={{
                    marginRight: 4,
                    background: "#4338ca",
                    color: "#fff",
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                  }}
                >
                  {archives.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <main
        style={{ maxWidth: 980, margin: "0 auto", padding: "22px 14px 52px" }}
      >
        {/* ════ TAB 1: Score Tracking ════ */}
        {activeTab === 0 && (
          <div>
            <div style={cardStyle}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1e1b4b",
                }}
              >
                ➕ הוספת סימולציה חדשה
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(145px,1fr))",
                  gap: 11,
                }}
              >
                {[
                  ["name", "שם / מספר סימולציה", "לדוג': סימולציה 1", "text"],
                  ["quant", "✏️ כמותי (נכונות)", "0–40", "number"],
                  ["verbal", "📖 מילולי (נכונות)", "0–46", "number"],
                  ["english", "🌐 אנגלית (נכונות)", "0–44", "number"],
                  ["psycho", "🎓 ציון פסיכומטרי", "200–800", "number"],
                ].map(([n, l, ph, t]) => (
                  <div key={n}>
                    <label style={labelStyle}>{l}</label>
                    <input
                      name={n}
                      type={t}
                      value={simForm[n]}
                      onChange={handleSimFormChange}
                      placeholder={ph}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={addSimulation}
                style={{
                  marginTop: 14,
                  background: "linear-gradient(135deg,#4338ca,#6366f1)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 24px",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 3px 10px rgba(99,102,241,0.3)",
                }}
              >
                הוסף סימולציה
              </button>
            </div>

            {simulations.length > 0 ? (
              <>
                <div style={cardStyle}>
                  <h2
                    style={{
                      margin: "0 0 16px",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#1e1b4b",
                    }}
                  >
                    📈 גרף התקדמות
                  </h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 20, left: -10, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 10,
                          border: "none",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                          fontFamily: "Heebo",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line
                        type="monotone"
                        dataKey="כמותי"
                        stroke="#4338ca"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="מילולי"
                        stroke="#0891b2"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="אנגלית"
                        stroke="#059669"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ציון_פסיכומטרי"
                        stroke="#d97706"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={cardStyle}>
                  <h2
                    style={{
                      margin: "0 0 14px",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#1e1b4b",
                    }}
                  >
                    📋 רשימת סימולציות
                  </h2>
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {[
                            "סימולציה",
                            "כמותי",
                            "מילולי",
                            "אנגלית",
                            "ציון פסיכומטרי",
                            "",
                          ].map((h, i) => (
                            <th
                              key={i}
                              style={{
                                ...thStyle,
                                textAlign: i === 5 ? "center" : "right",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {simulations.map((s) => (
                          <tr
                            key={s.id}
                            style={{ borderBottom: "1px solid #f1f5f9" }}
                          >
                            <td style={tdStyle}>
                              <span style={{ fontWeight: 600 }}>{s.name}</span>
                            </td>
                            <td style={tdStyle}>
                              <ScoreBadge score={s.quant} color="#4338ca" />
                            </td>
                            <td style={tdStyle}>
                              <ScoreBadge score={s.verbal} color="#0891b2" />
                            </td>
                            <td style={tdStyle}>
                              <ScoreBadge score={s.english} color="#059669" />
                            </td>
                            <td style={tdStyle}>
                              {s.psycho ? (
                                <ScoreBadge score={s.psycho} color="#d97706" />
                              ) : (
                                <span style={{ color: "#d1d5db" }}>—</span>
                              )}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <button
                                onClick={() => deleteSim(s.id)}
                                style={deleteBtnStyle}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState text="עוד לא הוספת סימולציות. הוסף סימולציה ראשונה 👆" />
            )}
          </div>
        )}

        {/* ════ TAB 2: Error Table ════ */}
        {activeTab === 1 && (
          <div>
            <div style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#1e1b4b",
                  }}
                >
                  🔍 טבלת תחקור שאלות
                </h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={addErrorRow}
                    style={{
                      background: "linear-gradient(135deg,#4338ca,#6366f1)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 9,
                      padding: "9px 16px",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ➕ הוסף שורה
                  </button>
                  <button
                    onClick={openFinishModal}
                    style={{
                      background: "linear-gradient(135deg,#059669,#10b981)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 9,
                      padding: "9px 16px",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
                    }}
                  >
                    💾 סיימתי
                  </button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 680,
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "#",
                        "השאלה",
                        "התשובה הנכונה",
                        "הטעות שלי",
                        "למה טעיתי",
                        "צעדים לתיקון",
                        "",
                      ].map((h, i) => (
                        <th
                          key={i}
                          style={{
                            ...thStyle,
                            textAlign: i === 0 || i === 6 ? "center" : "right",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {errorRows.map((row, idx) => (
                      <tr key={row.id}>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "center",
                            color: "#9ca3af",
                            fontWeight: 600,
                            fontSize: 12,
                            width: 28,
                          }}
                        >
                          {idx + 1}
                        </td>
                        {["question", "correct", "mistake", "why", "steps"].map(
                          (field) => (
                            <td
                              key={field}
                              style={{ ...tdStyle, padding: "4px 5px" }}
                            >
                              <textarea
                                value={row[field]}
                                onChange={(e) =>
                                  updateErrorRow(row.id, field, e.target.value)
                                }
                                rows={2}
                                placeholder={
                                  {
                                    question: "תאר/י את השאלה...",
                                    correct: "התשובה הנכונה",
                                    mistake: "מה ענית?",
                                    why: "מדוע טעית?",
                                    steps: "מה תעשה אחרת?",
                                  }[field]
                                }
                                style={textareaStyle}
                              />
                            </td>
                          )
                        )}
                        <td
                          style={{ ...tdStyle, textAlign: "center", width: 36 }}
                        >
                          <button
                            onClick={() => deleteErrorRow(row.id)}
                            style={deleteBtnStyle}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {errorRows.length === 0 && (
                <EmptyState text="אין שורות. לחץ על 'הוסף שורה'" />
              )}
            </div>
            <div
              style={{
                background: "linear-gradient(135deg,#ecfdf5,#d1fae5)",
                borderRadius: 12,
                padding: "14px 18px",
                border: "1.5px solid #a7f3d0",
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 18 }}>💡</span>
              <p style={{ margin: 0, fontSize: 13, color: "#065f46" }}>
                כשתסיים/י את התחקור, לחץ/י על <strong>"💾 סיימתי"</strong> —
                הטבלה תישמר בארכיון והתחקור הנוכחי יתאפס.
              </p>
            </div>
          </div>
        )}

        {/* ════ TAB 3: Goals ════ */}
        {activeTab === 2 && (
          <div>
            <div
              style={{
                background: "linear-gradient(135deg,#1e1b4b,#312e81)",
                borderRadius: 16,
                padding: "22px 24px",
                marginBottom: 18,
                boxShadow: "0 4px 20px rgba(67,56,202,0.2)",
              }}
            >
              <h2
                style={{
                  margin: "0 0 5px",
                  fontSize: 19,
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                🎯 יעדים לסימולציה הבאה
              </h2>
              <p
                style={{
                  margin: 0,
                  color: "rgba(199,210,254,0.8)",
                  fontSize: 12.5,
                }}
              >
                נשאבו אוטומטית מ"צעדים לתיקון" • לחץ/י על יעד לסימון ✓
              </p>
              {goals.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    padding: "6px 14px",
                  }}
                >
                  <span
                    style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}
                  >
                    {doneCount} / {goals.length} הושלמו
                  </span>
                  <div
                    style={{
                      height: 6,
                      width: 80,
                      background: "rgba(255,255,255,0.2)",
                      borderRadius: 99,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${
                          goals.length ? (doneCount / goals.length) * 100 : 0
                        }%`,
                        background: "#34d399",
                        borderRadius: 99,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            {goals.length === 0 ? (
              <EmptyState
                text='עדיין אין יעדים. מלא/י את עמודת "צעדים לתיקון"'
                onAction={() => setActiveTab(1)}
                actionLabel="עבור לתחקור שאלות ←"
              />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {goals.map((g, i) => {
                  const done = !!goalsDone[g.key];
                  return (
                    <div
                      key={g.key}
                      onClick={() => toggleGoal(g.key)}
                      style={{
                        background: done ? "#f0fdf4" : "#fff",
                        borderRadius: 13,
                        padding: "14px 18px",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 14,
                        borderRight: `4px solid ${
                          done ? "#22c55e" : GOAL_COLORS[i % GOAL_COLORS.length]
                        }`,
                        cursor: "pointer",
                        opacity: done ? 0.75 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: done
                            ? "#22c55e"
                            : GOAL_COLORS[i % GOAL_COLORS.length],
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: done ? 15 : 13,
                        }}
                      >
                        {done ? "✓" : i + 1}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          color: done ? "#166534" : "#1e293b",
                          lineHeight: 1.6,
                          fontWeight: 500,
                          textDecoration: done ? "line-through" : "none",
                        }}
                      >
                        {g.text}
                      </p>
                    </div>
                  );
                })}
                {doneCount === goals.length && goals.length > 0 && (
                  <div
                    style={{
                      background: "linear-gradient(135deg,#ecfdf5,#d1fae5)",
                      borderRadius: 13,
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      border: "1.5px solid #a7f3d0",
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontSize: 22 }}>🏆</span>
                    <p
                      style={{
                        margin: 0,
                        color: "#065f46",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      כל המשימות הושלמו! אתה/את מוכן/ה לסימולציה הבאה!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ TAB 4: Calculator ════ */}
        {activeTab === 3 && (
          <div>
            <div
              style={{
                background: "linear-gradient(135deg,#fffbeb,#fef3c7)",
                borderRadius: 14,
                padding: "14px 18px",
                marginBottom: 18,
                border: "1.5px solid #fde68a",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#92400e",
                  lineHeight: 1.65,
                }}
              >
                <strong>הערה חשובה:</strong> בבחינה הפסיכומטרית הציון הוא{" "}
                <strong>יחסי</strong> מול שאר הנבחנים באותו המועד. לכן החישוב
                אינו מדויק לחלוטין — הוא לא יכול לקחת בחשבון את הרכיב היחסי. עם
                זאת, הוא מספק <strong>הערכה קרובה מספיק</strong> לזיהוי נקודות
                חוזק וחולשה.
              </p>
            </div>
            <div style={cardStyle}>
              <h2
                style={{
                  margin: "0 0 6px",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1e1b4b",
                }}
              >
                🧮 חישוב ציון הסימולציה
              </h2>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6b7280" }}>
                הזן/י את מספר התשובות הנכונות בכל פרק.
              </p>
              <SectionHeader
                color="#4338ca"
                icon="✏️"
                title="חשיבה כמותית"
                subtitle="40 שאלות סה״כ (2 פרקים × 20)"
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                {[
                  ["q1", "פרק כמותי 1 (0–20)"],
                  ["q2", "פרק כמותי 2 (0–20)"],
                ].map(([n, l]) => (
                  <div key={n}>
                    <label style={labelStyle}>{l}</label>
                    <input
                      name={n}
                      type="number"
                      min="0"
                      max="20"
                      value={calc[n]}
                      onChange={handleCalcChange}
                      placeholder="0"
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <SectionHeader
                color="#0891b2"
                icon="📖"
                title="חשיבה מילולית"
                subtitle="46 שאלות + חיבור אופציונלי"
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                {[
                  ["v1", "פרק מילולי 1 (0–23)"],
                  ["v2", "פרק מילולי 2 (0–23)"],
                ].map(([n, l]) => (
                  <div key={n}>
                    <label style={labelStyle}>{l}</label>
                    <input
                      name={n}
                      type="number"
                      min="0"
                      max="23"
                      value={calc[n]}
                      onChange={handleCalcChange}
                      placeholder="0"
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "#374151",
                  cursor: "pointer",
                  marginBottom: 10,
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  name="useEssay"
                  checked={calc.useEssay}
                  onChange={handleCalcChange}
                  style={{ width: 16, height: 16, accentColor: "#4338ca" }}
                />
                <span>הוסף ציון חיבור (ייחשב כ-25% מהציון המילולי)</span>
              </label>
              {calc.useEssay && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>✍️ ציון חיבור (1–12)</label>
                  <input
                    name="essay"
                    type="number"
                    min="1"
                    max="12"
                    value={calc.essay}
                    onChange={handleCalcChange}
                    placeholder="1–12"
                    style={{ ...inputStyle, maxWidth: 160 }}
                  />
                </div>
              )}
              <SectionHeader
                color="#059669"
                icon="🌐"
                title="אנגלית"
                subtitle="44 שאלות סה״כ (2 פרקים × 22)"
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                {[
                  ["e1", "פרק אנגלית 1 (0–22)"],
                  ["e2", "פרק אנגלית 2 (0–22)"],
                ].map(([n, l]) => (
                  <div key={n}>
                    <label style={labelStyle}>{l}</label>
                    <input
                      name={n}
                      type="number"
                      min="0"
                      max="22"
                      value={calc[n]}
                      onChange={handleCalcChange}
                      placeholder="0"
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={runCalc}
                style={{
                  background: "linear-gradient(135deg,#1e1b4b,#4338ca)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 11,
                  padding: "12px 32px",
                  fontFamily: "inherit",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(67,56,202,0.35)",
                  display: "block",
                  width: "100%",
                }}
              >
                חשב ציון 🧮
              </button>
            </div>
            {calcResult && (
              <div>
                <div style={{ ...cardStyle, border: "2px solid #e0e7ff" }}>
                  <h3
                    style={{
                      margin: "0 0 16px",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#1e1b4b",
                    }}
                  >
                    📊 ציונים לפי תחום (סולם 50–150)
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(150px,1fr))",
                      gap: 12,
                    }}
                  >
                    {[
                      {
                        label: "כמותי",
                        raw: calcResult.qRaw,
                        score: calcResult.Q,
                        color: "#4338ca",
                        max: 40,
                      },
                      {
                        label: "מילולי",
                        raw: calcResult.vRaw,
                        score: calcResult.V,
                        color: "#0891b2",
                        max: 46,
                        note: calcResult.essayNote
                          ? `(בסיס: ${calcResult.essayNote.V_base}, עם חיבור: ${calcResult.V})`
                          : null,
                      },
                      {
                        label: "אנגלית",
                        raw: calcResult.eRaw,
                        score: calcResult.E,
                        color: "#059669",
                        max: 44,
                      },
                    ].map((d) => (
                      <div
                        key={d.label}
                        style={{
                          background: d.color + "0d",
                          borderRadius: 12,
                          padding: "14px",
                          border: `1.5px solid ${d.color}30`,
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                            marginBottom: 4,
                          }}
                        >
                          {d.label} ({d.raw}/{d.max} נכונות)
                        </div>
                        <div
                          style={{
                            fontSize: 32,
                            fontWeight: 800,
                            color: d.color,
                          }}
                        >
                          {d.score}
                        </div>
                        {d.note && (
                          <div
                            style={{
                              fontSize: 10,
                              color: "#9ca3af",
                              marginTop: 2,
                            }}
                          >
                            {d.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ ...cardStyle, border: "2px solid #fde68a" }}>
                  <h3
                    style={{
                      margin: "0 0 14px",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#1e1b4b",
                    }}
                  >
                    🎓 אומדן ציון כללי (סולם 200–800)
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {[
                      {
                        label: "רב-תחומי",
                        formula: `(2V+2Q+E)/5 = ${calcResult.wMulti}`,
                        range: calcResult.generalMulti,
                        color: "#7c3aed",
                      },
                      {
                        label: "דגש מילולי",
                        formula: `(3V+Q+E)/5 = ${calcResult.wVerbal}`,
                        range: calcResult.generalVerbal,
                        color: "#0891b2",
                      },
                      {
                        label: "דגש כמותי",
                        formula: `(V+3Q+E)/5 = ${calcResult.wQuant}`,
                        range: calcResult.generalQuant,
                        color: "#4338ca",
                      },
                    ].map((row) => {
                      const pct = getPercentile(row.range);
                      return (
                        <div
                          key={row.label}
                          style={{
                            background: "#f8fafc",
                            borderRadius: 12,
                            padding: "14px 16px",
                            borderRight: `4px solid ${row.color}`,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 14,
                                color: "#1e1b4b",
                              }}
                            >
                              {row.label}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                                marginTop: 2,
                              }}
                            >
                              {row.formula}
                            </div>
                            {pct && (
                              <div
                                style={{
                                  fontSize: 11.5,
                                  color: "#6b7280",
                                  marginTop: 4,
                                }}
                              >
                                גבוה מ-
                                <strong style={{ color: row.color }}>
                                  {pct.below + Math.round(pct.in / 2)}%
                                </strong>{" "}
                                מהנבחנים
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div
                              style={{
                                fontSize: 24,
                                fontWeight: 800,
                                color: row.color,
                              }}
                            >
                              {row.range}
                            </div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>
                              טווח ציון כללי
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p
                    style={{
                      margin: "14px 0 0",
                      fontSize: 11.5,
                      color: "#9ca3af",
                      lineHeight: 1.6,
                    }}
                  >
                    * הציון מחושב לפי טבלאות המעבר הרשמיות של מרכז הבחינות.
                    הציון בפועל עשוי להשתנות בהתאם לנוסח ולביצועי הנבחנים
                    האחרים.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ TAB 5: Archives ════ */}
        {activeTab === 4 && (
          <div>
            <div
              style={{
                background: "linear-gradient(135deg,#1e1b4b,#312e81)",
                borderRadius: 16,
                padding: "22px 24px",
                marginBottom: 18,
                boxShadow: "0 4px 20px rgba(67,56,202,0.2)",
              }}
            >
              <h2
                style={{
                  margin: "0 0 5px",
                  fontSize: 19,
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                🗂️ תחקורים שמורים
              </h2>
              <p
                style={{
                  margin: 0,
                  color: "rgba(199,210,254,0.8)",
                  fontSize: 12.5,
                }}
              >
                כל תחקורי הסימולציות שסיימת — לחץ/י על תחקור כדי לפתוח ולקרוא
              </p>
            </div>
            {archives.length === 0 ? (
              <EmptyState
                text='עדיין אין תחקורים שמורים. סיים/י תחקור ולחץ/י "💾 סיימתי" כדי לשמור.'
                onAction={() => setActiveTab(1)}
                actionLabel="עבור לתחקור שאלות ←"
              />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {archives.map((archive, ai) => {
                  const isOpen = expandedArchive === archive.id;
                  return (
                    <div
                      key={archive.id}
                      style={{
                        background: "#fff",
                        borderRadius: 16,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                        overflow: "hidden",
                        border: "1.5px solid #e5e7eb",
                      }}
                    >
                      {/* Header row */}
                      <div
                        onClick={() =>
                          setExpandedArchive(isOpen ? null : archive.id)
                        }
                        style={{
                          padding: "16px 20px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          background: isOpen ? "#f5f3ff" : "#fff",
                          borderBottom: isOpen ? "1.5px solid #e5e7eb" : "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background:
                                GOAL_COLORS[ai % GOAL_COLORS.length] + "18",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 18,
                            }}
                          >
                            📋
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 15,
                                color: "#1e1b4b",
                              }}
                            >
                              {archive.name}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#9ca3af",
                                marginTop: 2,
                              }}
                            >
                              {formatDate(archive.date)} • {archive.rows.length}{" "}
                              שגיאות
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 18,
                              color: "#6b7280",
                              transition: "transform 0.2s",
                              display: "inline-block",
                              transform: isOpen
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                            }}
                          >
                            ▾
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteArchive(archive.id);
                            }}
                            style={{ ...deleteBtnStyle, flexShrink: 0 }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {/* Expanded table */}
                      {isOpen && (
                        <div
                          style={{ padding: "16px 20px", overflowX: "auto" }}
                        >
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: 12.5,
                              minWidth: 580,
                            }}
                          >
                            <thead>
                              <tr style={{ background: "#f8fafc" }}>
                                {[
                                  "#",
                                  "השאלה",
                                  "התשובה הנכונה",
                                  "הטעות",
                                  "למה טעיתי",
                                  "צעדים לתיקון",
                                ].map((h, i) => (
                                  <th
                                    key={i}
                                    style={{
                                      ...thStyle,
                                      fontSize: 11,
                                      textAlign: i === 0 ? "center" : "right",
                                    }}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {archive.rows.map((row, ri) => (
                                <tr
                                  key={row.id || ri}
                                  style={{ borderBottom: "1px solid #f1f5f9" }}
                                >
                                  <td
                                    style={{
                                      ...tdStyle,
                                      textAlign: "center",
                                      color: "#9ca3af",
                                      fontWeight: 600,
                                      fontSize: 11,
                                      width: 24,
                                    }}
                                  >
                                    {ri + 1}
                                  </td>
                                  {[
                                    "question",
                                    "correct",
                                    "mistake",
                                    "why",
                                    "steps",
                                  ].map((f) => (
                                    <td
                                      key={f}
                                      style={{
                                        ...tdStyle,
                                        fontSize: 12,
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      {row[f] || (
                                        <span style={{ color: "#d1d5db" }}>
                                          —
                                        </span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
