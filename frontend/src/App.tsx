import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Loader2, Database, Activity, Clock, WifiOff,
  FileText, Hash, BookOpen, Star, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Plus, Search, Trash2, TrendingUp,
  BarChart2, AlertTriangle, Zap, Layers, Bot, User,
  Copy, Check, X, ExternalLink, Shield, FileSearch
} from "lucide-react";

// ─── CONFIG ───────────────────────────────────────────────────
// ─── BACKEND URL (AUTO DETECT) ───────────────────────────────

// If deployed → same domain (/api)
// If local → fallback to localhost
const BACKEND_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "");

// ─── TYPES ───────────────────────────────────────────────────

interface Source {
  document: string;
  page_number: number;
  snippet: string;
  relevance_score?: number;
}

interface QueryResponse {
  answer: string;
  sources: Source[];
}

// ─── API ─────────────────────────────────────────────────────

async function handleSearch(question: string): Promise<QueryResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: question }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Backend error");
    }

    const data = await response.json();

    return {
      answer: data.answer || "No response generated.",
      sources: (data.sources || []).map((s: any) => ({
        document: s.document || "10K-NVDA",
        page_number: s.page_number || 1,
        snippet: s.snippet || s.text || "",
        relevance_score: s.relevance_score || s.score || 1,
      })),
    };
  } catch (err) {
    console.error("API ERROR:", err);

    return {
      answer: "⚠️ Backend not reachable. Please try again.",
      sources: [],
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function relativeTime(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getCategory(q: string): "revenue" | "risk" | "balance" | "default" {
  const l = q.toLowerCase();
  if (l.includes("revenue") || l.includes("growth") || l.includes("sales") || l.includes("p&l")) return "revenue";
  if (l.includes("risk") || l.includes("debt") || l.includes("liabilit")) return "risk";
  if (l.includes("balance") || l.includes("asset") || l.includes("equity")) return "balance";
  return "default";
}

const CAT_COLOR: Record<string, string> = {
  revenue: "text-emerald-400",
  risk: "text-rose-400",
  balance: "text-sky-400",
  default: "text-slate-400",
};

const CAT_ICON: Record<string, JSX.Element> = {
  revenue: <TrendingUp className="w-3 h-3" />,
  risk: <AlertTriangle className="w-3 h-3" />,
  balance: <BarChart2 className="w-3 h-3" />,
  default: <FileText className="w-3 h-3" />,
};

const STATUS_ORDER: AnalysisStatus[] = ["idle", "connecting", "retrieving", "analyzing", "synthesizing", "done", "error"];

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  idle: "READY", connecting: "CONNECTING...", retrieving: "RETRIEVING VECTORS",
  analyzing: "ANALYZING 10-K...", synthesizing: "SYNTHESIZING", done: "ANALYSIS COMPLETE", error: "ERROR",
};

const STATUS_COLOR: Record<AnalysisStatus, string> = {
  idle: "text-emerald-400", connecting: "text-yellow-400", retrieving: "text-sky-400",
  analyzing: "text-violet-400", synthesizing: "text-emerald-400", done: "text-emerald-400", error: "text-rose-400",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); }}
      className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-slate-300 transition-colors"
    >
      {ok ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-slate-700/60 rounded w-3/4" />
      <div className="h-3 bg-slate-700/60 rounded w-full" />
      <div className="h-3 bg-slate-700/60 rounded w-5/6" />
      <div className="h-2 bg-slate-700/40 rounded w-1/2 mt-4" />
      <div className="grid grid-cols-4 gap-2 mt-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 bg-slate-700/40 rounded" />)}
      </div>
      <div className="h-3 bg-slate-700/60 rounded w-full mt-2" />
      <div className="h-3 bg-slate-700/60 rounded w-4/5" />
    </div>
  );
}

function MsgBubble({ msg, onSrcClick }: { msg: Message; onSrcClick?: (i: number) => void }) {
  if (msg.role === "user") {
    return (
      <div className="flex gap-3 justify-end group">
        <div className="flex flex-col items-end gap-1 max-w-[70%]">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-mono text-slate-600">
              {msg.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
          </div>
          <div className="bg-slate-800 border border-slate-700/60 rounded-lg rounded-tr-sm px-4 py-2.5">
            <p className="text-sm text-slate-200 leading-relaxed">{msg.content}</p>
          </div>
        </div>
        <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0 mt-1">
          <User className="w-3.5 h-3.5 text-slate-300" />
        </div>
      </div>
    );
  }

  if (msg.role === "error") {
    return (
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 mt-1">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
        </div>
        <div className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
          <p className="text-[11px] font-mono text-rose-400 font-semibold tracking-wider mb-1">BACKEND ERROR</p>
          <p className="text-sm text-rose-300/80">{msg.content}</p>
          <p className="text-[11px] font-mono text-rose-500/50 mt-2">Backend request failed. Please check server logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 group">
      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-1">
        <Bot className="w-3.5 h-3.5 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-emerald-500 font-semibold tracking-widest">LEDGERLENS AI</span>
            {!msg.isLoading && (
              <span className="text-[10px] font-mono text-slate-600">
                {msg.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
              </span>
            )}
          </div>
          {!msg.isLoading && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyBtn text={msg.content} />
            </div>
          )}
        </div>
        <div className="bg-slate-900/70 border border-slate-700/40 rounded-lg rounded-tl-sm px-5 py-4">
          {msg.isLoading ? <LoadingSkeleton /> : (
            <div className="prose prose-invert prose-sm max-w-none
              prose-table:border-collapse
              prose-th:bg-slate-800 prose-th:text-emerald-400 prose-th:font-mono prose-th:text-[11px] prose-th:tracking-widest prose-th:uppercase prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-slate-700
              prose-td:font-mono prose-td:text-[12px] prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-slate-800 prose-td:text-slate-300
              prose-h2:text-slate-100 prose-h2:text-base prose-h2:font-bold prose-h2:border-b prose-h2:border-slate-700 prose-h2:pb-2 prose-h2:mb-3
              prose-h3:text-emerald-400 prose-h3:text-[11px] prose-h3:uppercase prose-h3:tracking-widest prose-h3:font-semibold
              prose-p:text-slate-300 prose-p:text-sm prose-p:leading-relaxed
              prose-strong:text-slate-100 prose-strong:font-semibold
              prose-blockquote:border-l-emerald-500/50 prose-blockquote:bg-slate-950/50 prose-blockquote:rounded-r
              prose-code:bg-slate-800 prose-code:text-emerald-400 prose-code:px-1 prose-code:rounded
              prose-li:text-slate-300 prose-li:text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {!msg.isLoading && msg.sources && msg.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.sources.map((src, i) => (
              <button key={i} onClick={() => onSrcClick?.(i)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-700/50 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all group/s">
                <span className="text-[9px] font-mono text-slate-600 group-hover/s:text-emerald-500 font-bold">[{i + 1}]</span>
                <span className="text-[10px] font-mono text-slate-500 group-hover/s:text-slate-300 truncate max-w-[140px]">
                  {src.document.replace(".pdf", "")} p.{src.page_number}
                </span>
                <ExternalLink className="w-2.5 h-2.5 text-slate-600 group-hover/s:text-emerald-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisBar({ status }: { status: AnalysisStatus }) {
  if (status === "idle" || status === "done") return null;
  const STEPS: { s: AnalysisStatus; label: string }[] = [
    { s: "connecting", label: "Connect" },
    { s: "retrieving", label: "Retrieve" },
    { s: "analyzing", label: "Analyze" },
    { s: "synthesizing", label: "Synthesize" },
  ];
  const currIdx = STATUS_ORDER.indexOf(status);
  const pct = status === "connecting" ? "15%" : status === "retrieving" ? "38%" : status === "analyzing" ? "64%" : status === "synthesizing" ? "88%" : "0%";
  return (
    <div className="mx-4 mb-3 rounded-lg border border-slate-700/50 bg-slate-900/60 overflow-hidden">
      <div className="h-0.5 bg-slate-800 relative overflow-hidden">
        <div className={`absolute inset-y-0 left-0 transition-all duration-700 ${status === "error" ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: pct }} />
      </div>
      <div className="flex items-center divide-x divide-slate-700/50">
        {STEPS.map(({ s, label }) => {
          const stepIdx = STATUS_ORDER.indexOf(s);
          const state = currIdx > stepIdx ? "done" : currIdx === stepIdx ? "active" : "pending";
          return (
            <div key={s} className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 ${state === "active" ? "bg-emerald-500/5" : ""}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${state === "done" ? "bg-emerald-500" : state === "active" ? "bg-emerald-400 animate-pulse" : "bg-slate-700"}`} />
              <span className={`text-[10px] font-mono ${state === "done" ? "text-emerald-600" : state === "active" ? "text-emerald-400 font-semibold" : "text-slate-700"}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourceCard({ src, index, highlighted }: { src: Source; index: number; highlighted: boolean }) {
  const [open, setOpen] = useState(false);
  const pct = src.relevance_score !== undefined ? Math.round(src.relevance_score * 100) : null;
  const barColor = pct !== null ? (pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-sky-400" : pct >= 60 ? "bg-yellow-400" : "bg-rose-400") : "";
  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${highlighted ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-700/50 bg-slate-900/40 hover:border-slate-600/60"}`}>
      <div className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="w-5 h-5 rounded bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[9px] font-mono font-bold text-slate-400">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="text-[11px] font-mono text-slate-300 truncate font-medium">{src.document.replace(".pdf", "")}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1"><Hash className="w-2.5 h-2.5 text-slate-600" /><span className="text-[10px] font-mono text-slate-500">p.{src.page_number}</span></div>
            {src.fiscal_year && <div className="flex items-center gap-1"><BookOpen className="w-2.5 h-2.5 text-slate-600" /><span className="text-[10px] font-mono text-slate-500">{src.fiscal_year}</span></div>}
            {pct !== null && <div className="flex items-center gap-1"><Star className="w-2.5 h-2.5 text-slate-600" /><span className={`text-[10px] font-mono ${pct >= 90 ? "text-emerald-400" : pct >= 75 ? "text-sky-400" : "text-yellow-400"}`}>{pct}%</span></div>}
          </div>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-600 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
      </div>
      {pct !== null && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-mono text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
          </div>
        </div>
      )}
      {src.section && (
        <div className="px-3 pb-2.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-[10px] font-mono text-slate-400">{src.section}</span>
        </div>
      )}
      {open && (
        <div className="mx-3 mb-3 p-3 bg-slate-950 border border-slate-700/50 rounded">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[9px] font-mono text-slate-600 tracking-widest uppercase">PDF Excerpt · Page {src.page_number}</span>
          </div>
          <p className="text-[11px] font-mono text-slate-400 leading-relaxed">"{src.snippet}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([
    { id: "h1", query: "NVIDIA 2024 Revenue Analysis", timestamp: new Date(Date.now() - 720000), messageCount: 2 },
    { id: "h2", query: "NVIDIA Balance Sheet FY2023", timestamp: new Date(Date.now() - 2100000), messageCount: 2 },
    { id: "h3", query: "NVIDIA Risk Assessment", timestamp: new Date(Date.now() - 7200000), messageCount: 2 },
  ]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [activeSources, setActiveSources] = useState<Source[]>([]);
  const [highlightedSrc, setHighlightedSrc] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [tick, setTick] = useState(0);

  const endRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTick((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const newChat = useCallback(() => {
    setMessages([]); setActiveSources([]); setHighlightedSrc(null); setActiveId(null); setStatus("idle");
  }, []);

  const loadHistory = useCallback((id: string) => {
  setActiveId(id);
  const item = history.find((h) => h.id === id);
  if (!item) return;

  setMessages([
    {
          id: genId(),
          role: "user",
          content: item.query,
          timestamp: new Date(item.timestamp),
        },
      ]);
    
      setActiveSources([]);
      setHighlightedSrc(null);
    }, [history]);

  const deleteHistory = useCallback((id: string) => {
    setHistory((p) => p.filter((h) => h.id !== id));
    if (activeId === id) newChat();
  }, [activeId, newChat]);

  const simulate = useCallback(async () => {
    setStatus("connecting"); await new Promise((r) => setTimeout(r, 600));
    setStatus("retrieving"); await new Promise((r) => setTimeout(r, 800));
    setStatus("analyzing"); await new Promise((r) => setTimeout(r, 1100));
    setStatus("synthesizing"); await new Promise((r) => setTimeout(r, 700));
  }, []);

  const submit = useCallback(async () => {
  const q = input.trim();
  if (!q || loading) return;

  setInput("");
  if (textRef.current) textRef.current.style.height = "auto";

  const userMsg: Message = {
    id: genId(),
    role: "user",
    content: q,
    timestamp: new Date(),
  };

  const loadId = genId();

  const loadMsg: Message = {
    id: loadId,
    role: "assistant",
    content: "",
    timestamp: new Date(),
    isLoading: true,
  };

  setMessages((p) => [...p, userMsg, loadMsg]);
  setLoading(true);
  setActiveSources([]);
  setHighlightedSrc(null);

  const hId = genId();
  setHistory((p) => [
    { id: hId, query: q, timestamp: new Date(), messageCount: 1 },
    ...p,
  ]);
  setActiveId(hId);

  try {
    await simulate();

    const data = await handleSearch(q);
    await new Promise((r) => setTimeout(r, 300));

    const reply: Message = {
      id: genId(),
      role: "assistant",
      content: data.answer,
      sources: data.sources,
      timestamp: new Date(),
    };

    setMessages((p) =>
      p.map((m) => (m.id === loadId ? reply : m))
    );

    setActiveSources(data.sources ?? []);

    setHistory((p) =>
      p.map((h) =>
        h.id === hId ? { ...h, messageCount: 2 } : h
      )
    );

    setStatus("done");
  } catch (err) {
    const errMsg: Message = {
      id: genId(),
      role: "error",
      content:
        err instanceof Error ? err.message : "Unknown error",
      timestamp: new Date(),
    };

    setMessages((p) =>
      p.map((m) => (m.id === loadId ? errMsg : m))
    );

    setStatus("error");
  } finally {
    setLoading(false);
  }
}, [input, loading, simulate]);

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const isActive = status !== "idle" && status !== "done" && status !== "error";
  const filteredHistory = history.filter((h) => h.query.toLowerCase().includes(search.toLowerCase()));

  const SUGGESTIONS = [
    { icon: <TrendingUp className="w-3 h-3" />, label: "NVIDIA Revenue", q: "Analyze NVIDIA's revenue breakdown for FY2024", color: "text-emerald-400" },
    { icon: <BarChart2 className="w-3 h-3" />, label: "NVIDIA Balance Sheet", q: "Show NVIDIA's balance sheet summary for FY2023", color: "text-sky-400" },
    { icon: <AlertTriangle className="w-3 h-3" />, label: "NVIDIA Risk", q: "Primary risk factors in NVIDIA's FY2024 10-K?", color: "text-rose-400" },
    { icon: <Zap className="w-3 h-3" />, label: "NVIDIA Cash Flow", q: "NVIDIA flow statement for FY2023", color: "text-yellow-400" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <header className="flex items-center justify-between h-10 bg-slate-950 border-b border-slate-700/60 shrink-0 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 border-r border-slate-700/60 h-full min-w-[200px]">
          <div className="w-5 h-5 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Database className="w-2.5 h-2.5 text-emerald-400" />
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-100 tracking-wider">LEDGERLENS</span>
          <span className="text-[10px] font-mono text-slate-500">v2.1</span>
        </div>
        <div className="flex items-center h-full flex-1 overflow-hidden divide-x divide-slate-700/60">
          {[["INDEX", "RAG", "text-emerald-400"], ["MODEL", "llama-3.3-70b-versatile", "text-sky-400"], ["CORPUS", "10K-NVDA", "text-slate-300"], ["VDB", "PINECONE", "text-violet-400"], ["EMBED", "BAAI/bge-small-en-v1.5", "text-slate-300"]].map(([label, val, col]) => (
            <div key={label} className="flex items-center gap-2 px-4 h-full">
              <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">{label}</span>
              <span className={`text-[11px] font-mono font-semibold ${col}`}>{val}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center h-full border-l border-slate-700/60 divide-x divide-slate-700/60">
          <div className="flex items-center gap-2 px-4 h-full">
            {isActive
              ? <div className="w-3 h-3 rounded-full bg-violet-400 animate-ping opacity-75" />
              : <Activity className={`w-3 h-3 ${STATUS_COLOR[status]}`} />}
            <span className={`text-[10px] font-mono font-semibold tracking-widest ${STATUS_COLOR[status]}`}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-4 h-full">
            <WifiOff className="w-3 h-3 text-yellow-400" />
            <span className="text-[10px] font-mono text-yellow-400">Live</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 h-full">
            <Clock className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-mono text-slate-400 tabular-nums">{timeStr}</span>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR ── */}
        {sidebarOpen ? (
          <aside className="w-60 bg-slate-950 border-r border-slate-700/60 flex flex-col shrink-0 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60">
              <span className="text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase">Query History</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-3 py-2 border-b border-slate-700/60">
              <button onClick={newChat} className="w-full flex items-center gap-2 px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 text-xs font-mono font-medium transition-all group">
                <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />New Analysis
              </button>
            </div>
            <div className="px-3 py-2 border-b border-slate-700/60">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                <input type="text" placeholder="Search queries..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded text-[11px] font-mono text-slate-300 placeholder:text-slate-600 pl-6 pr-2 py-1.5 outline-none focus:border-emerald-500/40 transition-colors" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {filteredHistory.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <FileText className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-[11px] font-mono text-slate-600">{search ? "No matches" : "No queries yet"}</p>
                </div>
              ) : filteredHistory.map((item) => {
                const cat = getCategory(item.query);
                const isAct = activeId === item.id;
                return (
                  <div key={item.id}
                    className={`group relative flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-all border-l-2 ${isAct ? "bg-emerald-500/10 border-emerald-500" : "border-transparent hover:bg-slate-900/60 hover:border-slate-700"}`}
                    onClick={() => loadHistory(item.id)}>
                    <div className={`mt-0.5 shrink-0 ${CAT_COLOR[cat]}`}>{CAT_ICON[cat]}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] leading-snug truncate ${isAct ? "text-slate-100" : "text-slate-400"}`}>{item.query}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-2.5 h-2.5 text-slate-600" />
                        <span className="text-[10px] font-mono text-slate-600">{relativeTime(item.timestamp)}</span>
                        {item.messageCount > 0 && <span className="text-[10px] font-mono text-slate-700">· {item.messageCount} msg</span>}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteHistory(item.id); }}
                      className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-600 hover:text-rose-400 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="px-3 py-2 border-t border-slate-700/60">
              <p className="text-[10px] font-mono text-slate-700 text-center">{history.length} sessions · Enterprise RAG</p>
            </div>
          </aside>
        ) : (
          <aside className="w-10 bg-slate-950 border-r border-slate-700/60 flex flex-col items-center py-2 gap-2 shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors" title="Expand">
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-700/60" />
            <button onClick={newChat} className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition-colors" title="New query">
              <Plus className="w-4 h-4" />
            </button>
          </aside>
        )}

        {/* ── MAIN CHAT ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {messages.length === 0 ? (
            // Welcome screen
            <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                <Database className="w-7 h-7 text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight mb-1">LedgerLens Intelligence</h1>
              <p className="text-[10px] font-mono text-slate-600 tracking-widest uppercase mb-4">Enterprise 10-K Analysis · RAG · Semantic Search</p>
              <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-10">
                Ask any question about SEC 10-K filings. Get structured financial analysis with cited PDF sources, markdown tables, and risk scores.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full mb-8">
                {[
                  { icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, title: "Revenue Analysis", desc: "P&L breakdowns, segment revenue, YoY growth trends" },
                  { icon: <BarChart2 className="w-4 h-4 text-sky-400" />, title: "Balance Sheet", desc: "Assets, liabilities, equity ratios as financial tables" },
                  { icon: <Shield className="w-4 h-4 text-rose-400" />, title: "Risk Assessment", desc: "Material risks from Item 1A, scored and prioritized" },
                  { icon: <FileSearch className="w-4 h-4 text-violet-400" />, title: "Semantic Search", desc: "Vector search across thousands of PDF pages" },
                ].map((c, i) => (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-900/50 border border-slate-700/40 text-left hover:border-slate-600/60 transition-colors">
                    <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0">{c.icon}</div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-300 mb-0.5">{c.title}</p>
                      <p className="text-[10px] text-slate-600 leading-snug">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-700/50">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] font-mono text-slate-500">Backend: <span className="text-slate-400">{BACKEND_URL}/query</span></span>
                <span className="text-[10px] font-mono text-emerald-600">· Demo active</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {messages.map((m) => (
                <MsgBubble key={m.id} msg={m} onSrcClick={(i) => { setHighlightedSrc(i); }} />
              ))}
              <div ref={endRef} />
            </div>
          )}

          {/* Analysis progress bar */}
          <AnalysisBar status={status} />

          {/* Composer */}
          <div className="border-t border-slate-700/60 bg-slate-950 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <span className="text-[10px] font-mono text-slate-700 shrink-0 tracking-widest">QUICK QUERIES:</span>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => { setInput(s.q); textRef.current?.focus(); }} disabled={loading}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono whitespace-nowrap transition-all shrink-0 bg-slate-900 border-slate-700/50 text-slate-500 hover:border-slate-600 hover:text-slate-300 hover:bg-slate-800 ${loading ? "opacity-40 cursor-not-allowed" : ""}`}>
                  <span className={s.color}>{s.icon}</span>{s.label}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3 rounded-lg border border-slate-700/60 bg-slate-900 px-4 py-3 focus-within:border-emerald-500/40 transition-all">
              <textarea ref={textRef} value={input} onChange={onInput} onKeyDown={onKeyDown} disabled={loading}
                placeholder="Query the 10-K corpus... e.g. 'What is NVIDIA's gross margin trend?'"
                rows={1}
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none outline-none leading-relaxed min-h-[24px] max-h-[120px] disabled:opacity-50"
                style={{ scrollbarWidth: "none" }} />
              <button onClick={submit} disabled={!input.trim() || loading}
                className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-all ${input.trim() && !loading ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-600 cursor-not-allowed"}`}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] font-mono text-slate-700">↵ Submit · Shift+↵ Newline</span>
              <span className="text-[10px] font-mono text-slate-700">POST {BACKEND_URL}/query</span>
            </div>
          </div>
        </main>

        {/* ── RIGHT PANEL: SOURCE INSPECTOR ── */}
        {inspectorOpen ? (
          <aside className="w-72 bg-slate-950 border-l border-slate-700/60 flex flex-col shrink-0 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase">Source Inspector</span>
              </div>
              <div className="flex items-center gap-2">
                {activeSources.length > 0 && (
                  <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    {activeSources.length} src
                  </span>
                )}
                <button onClick={() => setInspectorOpen(false)} className="p-0.5 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {activeSources.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/50 flex items-center justify-center mb-3">
                  <FileText className="w-5 h-5 text-slate-700" />
                </div>
                <p className="text-[11px] font-mono text-slate-600 leading-relaxed">
                  Source documents will appear here after a query is processed
                </p>
                <div className="mt-4 space-y-1.5 w-full">
                  {[80, 65, 90].map((w, i) => (
                    <div key={i} className="h-2 bg-slate-800 rounded animate-pulse" style={{ width: `${w}%`, margin: "0 auto" }} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex divide-x divide-slate-700/60 border-b border-slate-700/60 shrink-0">
                  {[
                    ["CHUNKS", String(activeSources.length), "text-slate-300"],
                    ["AVG SCORE", activeSources.some((s) => s.relevance_score !== undefined) ? `${Math.round(activeSources.reduce((a, s) => a + (s.relevance_score ?? 0), 0) / activeSources.length * 100)}%` : "—", "text-emerald-400"],
                    ["DOCS", String(new Set(activeSources.map((s) => s.document)).size), "text-slate-300"],
                  ].map(([label, val, col]) => (
                    <div key={label} className="flex-1 px-3 py-2 text-center">
                      <p className="text-[10px] font-mono text-slate-600 tracking-widest">{label}</p>
                      <p className={`text-sm font-mono font-bold tabular-nums ${col}`}>{val}</p>
                    </div>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {activeSources.map((src, i) => (
                    <SourceCard key={i} src={src} index={i} highlighted={highlightedSrc === i} />
                  ))}
                </div>
              </>
            )}
            <div className="px-3 py-2 border-t border-slate-700/60 shrink-0">
              <p className="text-[10px] font-mono text-slate-700 text-center">Vector DB · PGVector · Cosine Similarity</p>
            </div>
          </aside>
        ) : (
          <aside className="w-10 bg-slate-950 border-l border-slate-700/60 flex flex-col items-center py-2 shrink-0">
            <button onClick={() => setInspectorOpen(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors" title="Open Source Inspector">
              <Layers className="w-4 h-4" />
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
