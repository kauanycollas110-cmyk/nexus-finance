import { useState, useEffect, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";

const INITIAL_SUBS = [
  { id: "s1", name: "Mentoria Calistenia", value: 150, currency: "BRL", category: "Desenvolvimento", active: true },
  { id: "s2", name: "Mentoria Vestibular", value: 350, currency: "BRL", category: "Desenvolvimento", active: true },
  { id: "s3", name: "Claude Pro", value: 110, currency: "BRL", category: "Ferramentas IA", active: true },
  { id: "s4", name: "Supernotes", value: 54, currency: "BRL", category: "Ferramentas", active: true },
  { id: "s5", name: "Notion Business", value: 30, currency: "USD", category: "Ferramentas IA", active: true },
  { id: "s6", name: "TickTick", value: 4, currency: "USD", category: "Ferramentas", active: true },
  { id: "s7", name: "Wispr Flow", value: 30, currency: "BRL", category: "Ferramentas IA", active: true },
  { id: "s8", name: "Comunidade IA", value: 97, currency: "BRL", category: "Desenvolvimento", active: false },
];

const INITIAL_STATE = {
  income: 1090,
  vr: 330,
  vrTablet: 200,
  vrMesada: 50,
  creditLimit: 600,
  exchangeRate: 5.70,
  exchangeLastUpdated: null,
  geminiKey: "",
  subs: INITIAL_SUBS,
  transactions: [],
  creditTransactions: [],
  reserveBox: 0,
  cdiRate: 10.5,
};

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
const fmt2 = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const pct = (v) => `${Math.round(v)}%`;
const uid = () => Math.random().toString(36).slice(2, 9);

const CAT_COLORS = {
  "Desenvolvimento": "#DC2626",
  "Ferramentas IA": "#D4A84B",
  "Ferramentas": "#737373",
  "Alimentação": "#22C55E",
  "Lazer": "#8B5CF6",
  "Transporte": "#3B82F6",
  "Outros": "#525252",
};

const HEALTH_LABELS = ["CRÍTICO", "RISCO", "ATENÇÃO", "SAUDÁVEL", "EXCELENTE"];
const HEALTH_COLORS = ["#DC2626", "#F97316", "#EAB308", "#22C55E", "#10B981"];

export default function NexusFinance() {
  const [state, setState] = useState(INITIAL_STATE);
  const [tab, setTab] = useState("macro");
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddCC, setShowAddCC] = useState(false);
  const [txForm, setTxForm] = useState({ desc: "", value: "", cat: "Alimentação", date: new Date().toISOString().slice(0, 10) });
  const [ccForm, setCcForm] = useState({ desc: "", value: "", installments: 1, date: new Date().toISOString().slice(0, 10) });
  const [showAddSub, setShowAddSub] = useState(false);
  const [subForm, setSubForm] = useState({ name: "", value: "", currency: "BRL", category: "Ferramentas" });
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeTemp, setIncomeTemp] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexus_fin_v2");
      if (raw) setState(prev => ({ ...prev, ...JSON.parse(raw) }));
    } catch (e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("nexus_fin_v2", JSON.stringify(state)); } catch (e) {}
  }, [state, loaded]);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ─── AUTO-FETCH CÂMBIO USD/BRL ───
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=BRL");
        const data = await res.json();
        const rate = data?.rates?.BRL;
        if (rate && !isNaN(rate)) {
          setState(p => ({ ...p, exchangeRate: parseFloat(rate.toFixed(4)), exchangeLastUpdated: new Date().toISOString() }));
        }
      } catch (e) {}
    };
    fetchRate();
    const interval = setInterval(fetchRate, 6 * 60 * 60 * 1000); // every 6h
    return () => clearInterval(interval);
  }, []);

  // ─── COMPUTED VALUES ───
  const totalSubsBRL = useMemo(() => {
    return state.subs.filter(s => s.active).reduce((acc, s) => {
      return acc + (s.currency === "USD" ? s.value * state.exchangeRate : s.value);
    }, 0);
  }, [state.subs, state.exchangeRate]);

  const vrLivre = state.vr - state.vrTablet - state.vrMesada;
  const cashLivre = state.income - totalSubsBRL;

  // Auto-reset mensal: só mostra gastos do mês atual
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const txThisMonth = state.transactions.filter(t => t.date && t.date.startsWith(currentMonthKey));
  const totalTxMonth = txThisMonth.reduce((a, t) => a + t.value, 0);
  const saldoReal = cashLivre - totalTxMonth;

  const ccUsed = state.creditTransactions.reduce((a, t) => a + (t.value / t.installments), 0);
  const ccAvailable = state.creditLimit - ccUsed;
  const monthlyYield = (state.reserveBox * (state.cdiRate / 100)) / 12;

  const burnRate = useMemo(() => {
    const today = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const spent = totalSubsBRL + totalTxMonth;
    return { daily: spent / (today || 1), remaining: saldoReal, daysLeft: daysInMonth - today, projected: (spent / (today || 1)) * daysInMonth };
  }, [totalSubsBRL, totalTxMonth, saldoReal]);

  // Health Score: 0-100
  const healthScore = useMemo(() => {
    let score = 50;
    const savingsRate = saldoReal / state.income;
    if (savingsRate > 0.2) score += 20;
    else if (savingsRate > 0.1) score += 10;
    else if (savingsRate > 0) score += 5;
    else score -= 20;
    if (state.creditTransactions.length === 0 || ccUsed < state.creditLimit * 0.3) score += 15;
    else if (ccUsed < state.creditLimit * 0.7) score += 5;
    else score -= 15;
    if (totalSubsBRL / state.income < 0.7) score += 10;
    else score -= 10;
    if (state.reserveBox > 0) score += 5;
    return Math.max(0, Math.min(100, score));
  }, [saldoReal, state.income, ccUsed, state.creditLimit, totalSubsBRL, state.reserveBox, state.creditTransactions.length]);

  const healthIdx = healthScore >= 80 ? 4 : healthScore >= 65 ? 3 : healthScore >= 45 ? 2 : healthScore >= 25 ? 1 : 0;

  // Category breakdown for pie
  const catData = useMemo(() => {
    const map = {};
    state.subs.filter(s => s.active).forEach(s => {
      const v = s.currency === "USD" ? s.value * state.exchangeRate : s.value;
      map[s.category] = (map[s.category] || 0) + v;
    });
    txThisMonth.forEach(t => {
      map[t.cat] = (map[t.cat] || 0) + t.value;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [state.subs, state.transactions, state.exchangeRate]);

  // Monthly projection data (6 months)
  const projectionData = useMemo(() => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const cm = new Date().getMonth();
    return Array.from({ length: 6 }, (_, i) => {
      const m = (cm + i) % 12;
      const extra = i >= 3 ? 200 * (i - 2) : 0; // projected consultancy income
      return { name: months[m], renda: state.income + extra, gastos: totalSubsBRL, livre: state.income + extra - totalSubsBRL };
    });
  }, [state.income, totalSubsBRL]);

  // ─── HANDLERS ───
  const addTransaction = () => {
    if (!txForm.desc || !txForm.value) return;
    setState(p => ({
      ...p,
      transactions: [...p.transactions, { id: uid(), desc: txForm.desc, value: parseFloat(txForm.value), cat: txForm.cat, date: txForm.date }],
    }));
    setTxForm({ desc: "", value: "", cat: "Alimentação", date: new Date().toISOString().slice(0, 10) });
    setShowAddTx(false);
    notify("Gasto registrado");
  };

  const addCreditTx = () => {
    if (!ccForm.desc || !ccForm.value) return;
    const v = parseFloat(ccForm.value);
    setState(p => ({
      ...p,
      creditTransactions: [...p.creditTransactions, { id: uid(), desc: ccForm.desc, value: v, installments: parseInt(ccForm.installments) || 1, date: ccForm.date, paidInstallments: 0 }],
      reserveBox: p.reserveBox + (v / (parseInt(ccForm.installments) || 1)),
    }));
    setCcForm({ desc: "", value: "", installments: 1, date: new Date().toISOString().slice(0, 10) });
    setShowAddCC(false);
    notify("Compra no crédito registrada → dinheiro separado na Caixa");
  };

  const addSub = () => {
    if (!subForm.name || !subForm.value) return;
    setState(p => ({
      ...p,
      subs: [...p.subs, { id: uid(), name: subForm.name, value: parseFloat(subForm.value), currency: subForm.currency, category: subForm.category, active: true }],
    }));
    setSubForm({ name: "", value: "", currency: "BRL", category: "Ferramentas" });
    setShowAddSub(false);
    notify("Assinatura adicionada");
  };

  const toggleSub = (id) => {
    setState(p => ({ ...p, subs: p.subs.map(s => s.id === id ? { ...s, active: !s.active } : s) }));
  };

  const removeTx = (id) => {
    setState(p => ({ ...p, transactions: p.transactions.filter(t => t.id !== id) }));
  };

  const removeCCTx = (id) => {
    setState(p => ({
      ...p,
      creditTransactions: p.creditTransactions.filter(t => t.id !== id),
    }));
  };

  const removeSub = (id) => {
    setState(p => ({ ...p, subs: p.subs.filter(s => s.id !== id) }));
  };

  const runAI = async () => {
    if (!state.geminiKey) { setTab("ia"); setAiInsight("⚠️ Cole sua chave gratuita do Gemini no campo abaixo antes de rodar a análise."); return; }
    setAiLoading(true);
    try {
      const context = `
PERFIL: Jovem aprendiz CLT, 17-18 anos, renda R$1.090 + VR R$330.
Gastos fixos em assinaturas: R$${Math.round(totalSubsBRL)}
Saldo livre mensal: R$${Math.round(saldoReal)}
VR livre para comida: R$${vrLivre}
Cartão crédito usado: R$${Math.round(ccUsed)} de R$${state.creditLimit} limite
Caixa reserva (float): R$${Math.round(state.reserveBox)}
Health Score: ${healthScore}/100 (${HEALTH_LABELS[healthIdx]})
Gastos variáveis este mês: R$${Math.round(totalTxMonth)}
Categorias: ${catData.map(c => c.name + ": R$" + c.value).join(", ")}
Objetivo: investir em desenvolvimento pessoal/profissional (mentorias, ferramentas IA, consultoria neuro+esporte)
Projeto futuro: consultoria neurociência aplicada ao esporte (ainda sem receita)
Zero custo de sobrevivência (pais cobrem moradia, alimentação base, transporte)
Estratégia: usar float do cartão de crédito para render em CDB enquanto paga na data
`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Você é Nexus, consultor financeiro de elite. Fale de forma direta, incisiva, como um amigo genial. Use gírias naturais (foda, insano, cara). Dê análise em 3 blocos: DIAGNÓSTICO (situação atual em 2-3 linhas), ALERTAS (riscos imediatos), AÇÃO TÁTICA (3 ações específicas numeradas). Seja brutalmente honesto. Nunca use linguagem corporativa. Responda em português BR.

Analise minha situação financeira:
${context}` }] }],
        }),
      });
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Erro ao gerar análise. Verifique a chave.";
      setAiInsight(text);
    } catch (e) {
      setAiInsight("Falha na conexão. Verifique a chave e tente novamente.");
    }
    setAiLoading(false);
  };

  // ─── STYLES ───
  const S = {
    root: { fontFamily: "'Sora', 'SF Pro Display', -apple-system, sans-serif", background: "#09090B", color: "#E4E4E7", minHeight: "100vh", padding: "0", margin: 0, fontSize: 13 },
    header: { padding: "24px 28px 16px", borderBottom: "1px solid rgba(212,168,75,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
    logo: { display: "flex", alignItems: "center", gap: 10 },
    logoIcon: { width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #DC2626 0%, #D4A84B 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#09090B" },
    logoText: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", background: "linear-gradient(90deg, #DC2626, #D4A84B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    tabBar: { display: "flex", gap: 2, background: "#18181B", borderRadius: 10, padding: 3 },
    tab: (active) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: active ? 600 : 400, fontFamily: "inherit", color: active ? "#09090B" : "#71717A", background: active ? "linear-gradient(135deg, #DC2626, #D4A84B)" : "transparent", transition: "all 0.2s" }),
    main: { padding: "20px 28px 40px" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 },
    grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 20 },
    card: { background: "#18181B", borderRadius: 14, padding: "18px 20px", border: "1px solid #27272A" },
    cardGlow: (color) => ({ background: "#18181B", borderRadius: 14, padding: "18px 20px", border: `1px solid ${color}22`, boxShadow: `0 0 30px ${color}08` }),
    label: { fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#71717A", marginBottom: 6 },
    val: { fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em" },
    valSm: { fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" },
    tag: (color) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: `${color}18`, color: color, marginLeft: 6 }),
    btn: { padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", background: "linear-gradient(135deg, #DC2626, #D4A84B)", color: "#09090B", transition: "opacity 0.2s" },
    btnGhost: { padding: "10px 20px", borderRadius: 10, border: "1px solid #27272A", cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "inherit", background: "transparent", color: "#A1A1AA" },
    input: { padding: "10px 14px", borderRadius: 10, border: "1px solid #27272A", background: "#09090B", color: "#E4E4E7", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box", outline: "none" },
    select: { padding: "10px 14px", borderRadius: 10, border: "1px solid #27272A", background: "#09090B", color: "#E4E4E7", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box", outline: "none" },
    modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(8px)" },
    modalBox: { background: "#18181B", borderRadius: 18, padding: "28px", width: "min(90vw, 400px)", border: "1px solid #27272A" },
    progress: (pct, color) => ({ height: 6, borderRadius: 3, background: "#27272A", overflow: "hidden", position: "relative" }),
    progressFill: (pct, color) => ({ height: "100%", borderRadius: 3, width: `${Math.min(pct, 100)}%`, background: pct > 90 ? "#DC2626" : color || "#D4A84B", transition: "width 0.5s" }),
    toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#D4A84B", color: "#09090B", padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit", zIndex: 9999, boxShadow: "0 4px 20px rgba(212,168,75,0.3)" },
    neuralBg: { position: "absolute", top: 0, right: 0, width: 200, height: 200, opacity: 0.03, pointerEvents: "none" },
  };

  const ScoreRing = ({ score, size = 120 }) => {
    const r = (size - 12) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - score / 100);
    return (
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272A" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={HEALTH_COLORS[healthIdx]} strokeWidth={6} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill={HEALTH_COLORS[healthIdx]} fontSize={size * 0.25} fontWeight={800} fontFamily="'Sora', sans-serif" style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>{score}</text>
      </svg>
    );
  };

  const NeuralPattern = () => (
    <svg viewBox="0 0 200 200" style={S.neuralBg}>
      {[...Array(8)].map((_, i) => {
        const x = 40 + Math.cos(i * 0.8) * 60;
        const y = 40 + Math.sin(i * 1.2) * 60;
        const x2 = 100 + Math.cos(i * 1.5) * 70;
        const y2 = 100 + Math.sin(i * 0.9) * 70;
        return <g key={i}><circle cx={x} cy={y} r={3} fill="#D4A84B" /><line x1={x} y1={y} x2={x2} y2={y2} stroke="#D4A84B" strokeWidth={0.5} /><circle cx={x2} cy={y2} r={2} fill="#DC2626" /></g>;
      })}
    </svg>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
        <div style={{ color: "#71717A", marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</div>)}
      </div>
    );
  };

  // ─── TAB: MACRO ───
  const MacroView = () => (
    <div>
      <div style={S.grid}>
        <div style={S.cardGlow("#D4A84B")}>
          <div style={S.label}>Saldo Livre</div>
          <div style={{ ...S.val, color: saldoReal >= 0 ? "#D4A84B" : "#DC2626" }}>{fmt(saldoReal)}</div>
          {editingIncome ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "#71717A" }}>R$</span>
              <input
                type="number"
                value={incomeTemp}
                onChange={e => setIncomeTemp(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const v = parseFloat(incomeTemp);
                    if (!isNaN(v) && v > 0) { setState(p => ({ ...p, income: v })); notify("Salário atualizado para " + fmt(v)); }
                    setEditingIncome(false);
                  }
                  if (e.key === "Escape") setEditingIncome(false);
                }}
                autoFocus
                style={{ ...S.input, width: 100, padding: "4px 8px", fontSize: 12 }}
              />
              <button
                onClick={() => {
                  const v = parseFloat(incomeTemp);
                  if (!isNaN(v) && v > 0) { setState(p => ({ ...p, income: v })); notify("Salário atualizado para " + fmt(v)); }
                  setEditingIncome(false);
                }}
                style={{ background: "none", border: "none", color: "#22C55E", cursor: "pointer", fontSize: 14, padding: 2 }}
              >✓</button>
              <button onClick={() => setEditingIncome(false)} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 14, padding: 2 }}>✕</button>
            </div>
          ) : (
            <div
              onClick={() => { setIncomeTemp(String(state.income)); setEditingIncome(true); }}
              style={{ fontSize: 11, color: "#71717A", marginTop: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              title="Clique para editar o salário"
            >
              de {fmt(state.income)} total <span style={{ fontSize: 10, color: "#3F3F46" }}>✎</span>
            </div>
          )}
        </div>
        <div style={S.cardGlow("#DC2626")}>
          <div style={S.label}>Comprometido Fixo</div>
          <div style={{ ...S.val, color: "#DC2626" }}>{fmt(totalSubsBRL)}</div>
          <div style={{ fontSize: 11, color: "#71717A", marginTop: 4 }}>{pct(totalSubsBRL / state.income * 100)} da renda</div>
        </div>
        <div style={S.card}>
          <div style={S.label}>VR Disponível</div>
          <div style={{ ...S.val, color: vrLivre > 0 ? "#22C55E" : "#DC2626" }}>{fmt(vrLivre)}</div>
          <div style={{ fontSize: 11, color: "#71717A", marginTop: 4 }}>de {fmt(state.vr)} (tablet + mesada)</div>
        </div>
        <div style={S.card}>
          <div style={S.label}>Burn Rate Diário</div>
          <div style={{ ...S.valSm, color: "#E4E4E7" }}>{fmt2(burnRate.daily)}<span style={{ fontSize: 11, color: "#71717A" }}>/dia</span></div>
          <div style={{ fontSize: 11, color: "#71717A", marginTop: 4 }}>{burnRate.daysLeft}d restantes no mês</div>
        </div>
      </div>

      <div style={S.grid2}>
        <div style={{ ...S.card, display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px", position: "relative", overflow: "hidden" }}>
          <NeuralPattern />
          <div style={S.label}>Score de Saúde Financeira</div>
          <div style={{ margin: "12px 0" }}><ScoreRing score={healthScore} /></div>
          <div style={{ ...S.tag(HEALTH_COLORS[healthIdx]), fontSize: 12, padding: "4px 14px" }}>{HEALTH_LABELS[healthIdx]}</div>
          <div style={{ fontSize: 11, color: "#71717A", marginTop: 12, textAlign: "center", lineHeight: 1.5 }}>
            {healthScore >= 65 ? "Situação controlada. Mantenha disciplina." : healthScore >= 45 ? "Margem apertada. Monitore gastos variáveis." : "Alerta: gastos próximos ou acima da renda."}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.label}>Projeção 6 Meses</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gLivre" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4A84B" stopOpacity={0.3} /><stop offset="100%" stopColor="#D4A84B" stopOpacity={0} /></linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: "#71717A", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717A", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="renda" stroke="#22C55E" strokeWidth={1.5} fillOpacity={0} dot={false} name="Renda" />
              <Area type="monotone" dataKey="livre" stroke="#D4A84B" strokeWidth={2} fill="url(#gLivre)" dot={false} name="Livre" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 10, color: "#52525B", marginTop: 4 }}>* Projeção inclui receita estimada da consultoria a partir do mês 4</div>
        </div>
      </div>
    </div>
  );

  // ─── TAB: MESO ───
  const MesoView = () => (
    <div>
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={S.label}>Assinaturas Ativas</div>
            <button style={{ ...S.btn, padding: "6px 14px", fontSize: 11 }} onClick={() => setShowAddSub(true)}>+ Nova</button>
          </div>
          {state.subs.map(s => {
            const v = s.currency === "USD" ? s.value * state.exchangeRate : s.value;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1E1E22" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <div onClick={() => toggleSub(s.id)} style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${s.active ? "#D4A84B" : "#3F3F46"}`, background: s.active ? "#D4A84B18" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#D4A84B" }}>{s.active ? "✓" : ""}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, opacity: s.active ? 1 : 0.4, textDecoration: s.active ? "none" : "line-through" }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: "#52525B" }}>{s.category} {s.currency === "USD" && `· $${s.value} USD`}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: s.active ? "#E4E4E7" : "#52525B", fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</span>
                  <button onClick={() => removeSub(s.id)} style={{ background: "none", border: "none", color: "#3F3F46", cursor: "pointer", fontSize: 14, padding: 2 }}>×</button>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "#DC262610", border: "1px solid #DC262620" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#DC2626" }}>Total Mensal</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#DC2626" }}>{fmt(totalSubsBRL)}</span>
            </div>
            <div style={{ fontSize: 10, color: "#71717A", marginTop: 4 }}>{pct(totalSubsBRL / state.income * 100)} da renda · Câmbio: R$ {state.exchangeRate.toFixed(4)}/USD {state.exchangeLastUpdated ? `· atualizado ${new Date(state.exchangeLastUpdated).toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"})}` : ""}</div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.label}>Distribuição por Categoria</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={catData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {catData.map((entry, i) => <Cell key={i} fill={CAT_COLORS[entry.name] || HEALTH_COLORS[i % 5]} />)}
              </Pie>
              <Tooltip content={({ active, payload }) => active && payload?.[0] ? <div style={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}><span style={{ color: payload[0].payload.fill }}>{payload[0].name}</span>: {fmt(payload[0].value)}</div> : null} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {catData.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[c.name] || HEALTH_COLORS[i % 5] }} />
                <span style={{ color: "#A1A1AA" }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={S.label}>Câmbio USD → BRL</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#71717A", fontSize: 12 }}>R$</span>
            <input type="number" step="0.0001" value={state.exchangeRate} onChange={e => setState(p => ({ ...p, exchangeRate: parseFloat(e.target.value) || 5.70 }))} style={{ ...S.input, width: 110 }} />
            <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "#22C55E18", color: "#22C55E" }}>AUTO</span>
          </div>
          <div style={{ fontSize: 11, color: "#52525B", marginTop: 6 }}>Atualizado a cada 6h via Frankfurter (BCE) · Afeta Notion, TickTick e subs em USD</div>
        </div>
      </div>
    </div>
  );

  // ─── TAB: MICRO ───
  const MicroView = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={S.label}>Gastos Variáveis do Mês</div>
          <div style={{ ...S.valSm, color: totalTxMonth > 0 ? "#DC2626" : "#71717A" }}>{fmt(totalTxMonth)}</div>
        </div>
        <button style={S.btn} onClick={() => setShowAddTx(true)}>+ Registrar Gasto</button>
      </div>

      {txThisMonth.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: "40px 20px", color: "#3F3F46" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>◎</div>
          <div style={{ fontSize: 13 }}>Nenhum gasto variável registrado</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Registre seus gastos para análise micro</div>
        </div>
      ) : (
        <div style={S.card}>
          {txThisMonth.slice().sort((a, b) => b.date.localeCompare(a.date)).map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #1E1E22" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.desc}</div>
                <div style={{ fontSize: 10, color: "#52525B" }}>{t.cat} · {new Date(t.date + "T12:00").toLocaleDateString("pt-BR")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>-{fmt(t.value)}</span>
                <button onClick={() => removeTx(t.id)} style={{ background: "none", border: "none", color: "#3F3F46", cursor: "pointer", fontSize: 14 }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={S.label}>Barras por Categoria (Variáveis)</div>
        {txThisMonth.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={(() => {
              const m = {};
              txThisMonth.forEach(t => { m[t.cat] = (m[t.cat] || 0) + t.value; });
              return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) }));
            })()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: "#71717A", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717A", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#DC2626" radius={[4, 4, 0, 0]} name="Gasto" />
            </BarChart>
          </ResponsiveContainer>
        ) : <div style={{ color: "#3F3F46", textAlign: "center", padding: 30, fontSize: 12 }}>Sem dados ainda</div>}
      </div>
    </div>
  );

  // ─── TAB: CARTÃO ───
  const CartaoView = () => (
    <div>
      <div style={S.grid}>
        <div style={S.cardGlow("#6366F1")}>
          <div style={S.label}>Limite Disponível</div>
          <div style={{ ...S.val, color: ccAvailable > 100 ? "#6366F1" : "#DC2626" }}>{fmt(ccAvailable)}</div>
          <div style={S.progress(ccUsed / state.creditLimit * 100)}>
            <div style={S.progressFill(ccUsed / state.creditLimit * 100, "#6366F1")} />
          </div>
          <div style={{ fontSize: 10, color: "#71717A", marginTop: 6 }}>{fmt(ccUsed)} usado de {fmt(state.creditLimit)}</div>
        </div>
        <div style={S.cardGlow("#D4A84B")}>
          <div style={S.label}>Caixa Reserva (Float)</div>
          <div style={{ ...S.val, color: "#D4A84B" }}>{fmt(state.reserveBox)}</div>
          <div style={{ fontSize: 11, color: "#22C55E", marginTop: 4 }}>+{fmt2(monthlyYield)}/mês rendendo</div>
          <div style={{ fontSize: 10, color: "#52525B" }}>CDI {state.cdiRate}% a.a.</div>
        </div>
        <div style={S.card}>
          <div style={S.label}>Limite do Cartão</div>
          <input type="number" value={state.creditLimit} onChange={e => setState(p => ({ ...p, creditLimit: parseFloat(e.target.value) || 600 }))} style={{ ...S.input, fontSize: 18, fontWeight: 700 }} />
          <div style={{ fontSize: 10, color: "#52525B", marginTop: 4 }}>Atualize quando o Nubank aumentar</div>
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={S.label}>Compras no Crédito</div>
          <button style={{ ...S.btn, padding: "6px 14px", fontSize: 11 }} onClick={() => setShowAddCC(true)}>+ Compra</button>
        </div>
        {state.creditTransactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 20px", color: "#3F3F46", fontSize: 12 }}>
            Nenhuma compra registrada no crédito
          </div>
        ) : state.creditTransactions.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #1E1E22" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{t.desc}</div>
              <div style={{ fontSize: 10, color: "#52525B" }}>{t.installments}x de {fmt(t.value / t.installments)} · {new Date(t.date + "T12:00").toLocaleDateString("pt-BR")}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "#6366F1", fontVariantNumeric: "tabular-nums" }}>{fmt(t.value)}</span>
              <button onClick={() => removeCCTx(t.id)} style={{ background: "none", border: "none", color: "#3F3F46", cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...S.card, marginTop: 16, background: "#18181B", border: "1px solid #D4A84B15" }}>
        <div style={S.label}>⚡ Estratégia Float</div>
        <div style={{ fontSize: 12, color: "#A1A1AA", lineHeight: 1.7, marginTop: 8 }}>
          <strong style={{ color: "#D4A84B" }}>Como funciona:</strong> Cada compra no crédito separa automaticamente o valor da parcela mensal na <strong style={{ color: "#D4A84B" }}>Caixa Reserva</strong>. Esse dinheiro fica rendendo CDI até o vencimento da fatura.
          <br /><br />
          <strong style={{ color: "#D4A84B" }}>Ajuste manual:</strong>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input type="number" value={state.reserveBox} onChange={e => setState(p => ({ ...p, reserveBox: parseFloat(e.target.value) || 0 }))} style={{ ...S.input, width: 120 }} />
            <span style={{ fontSize: 11, color: "#52525B" }}>saldo na caixinha Nubank</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── TAB: IA ───
  const IAView = () => (
    <div>
      <div style={{ ...S.cardGlow("#D4A84B"), position: "relative", overflow: "hidden" }}>
        <NeuralPattern />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #DC2626, #D4A84B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Nexus Financial AI</div>
            <div style={{ fontSize: 10, color: "#71717A" }}>Análise automatizada da sua situação</div>
          </div>
        </div>
        <button onClick={runAI} disabled={aiLoading} style={{ ...S.btn, width: "100%", opacity: aiLoading ? 0.5 : 1, padding: "14px 20px" }}>
          {aiLoading ? "Analisando seus dados..." : "Rodar Análise Inteligente"}
        </button>
        {aiInsight && (
          <div style={{ marginTop: 20, padding: "20px", borderRadius: 12, background: "#09090B", border: "1px solid #27272A", fontSize: 13, lineHeight: 1.8, color: "#D4D4D8", whiteSpace: "pre-wrap" }}>
            {aiInsight}
          </div>
        )}
      </div>

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={S.label}>🔑 Chave Gemini (Gratuita)</div>
        <input type="password" placeholder="Cole sua chave do Google AI Studio aqui" value={state.geminiKey || ""} onChange={e => setState(p => ({ ...p, geminiKey: e.target.value }))} style={S.input} />
        <div style={{ fontSize: 11, color: "#52525B", marginTop: 6 }}>Pegue grátis em <strong style={{ color: "#D4A84B" }}>aistudio.google.com/apikey</strong> · Fica salvo só no seu device</div>
      </div>

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={S.label}>Resumo para IA</div>
        <div style={{ fontSize: 12, color: "#A1A1AA", lineHeight: 1.7, marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>Renda: <strong style={{ color: "#D4A84B" }}>{fmt(state.income)}</strong></div>
            <div>Fixo: <strong style={{ color: "#DC2626" }}>{fmt(totalSubsBRL)}</strong></div>
            <div>Variável: <strong style={{ color: "#DC2626" }}>{fmt(totalTxMonth)}</strong></div>
            <div>Livre: <strong style={{ color: saldoReal >= 0 ? "#22C55E" : "#DC2626" }}>{fmt(saldoReal)}</strong></div>
            <div>CC Usado: <strong style={{ color: "#6366F1" }}>{fmt(ccUsed)}</strong></div>
            <div>Float: <strong style={{ color: "#D4A84B" }}>{fmt(state.reserveBox)}</strong></div>
            <div>Score: <strong style={{ color: HEALTH_COLORS[healthIdx] }}>{healthScore}/100</strong></div>
            <div>VR Livre: <strong style={{ color: vrLivre > 0 ? "#22C55E" : "#DC2626" }}>{fmt(vrLivre)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── MODALS ───
  const AddTxModal = () => (
    <div style={S.modal} onClick={() => setShowAddTx(false)}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Registrar Gasto</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Descrição" value={txForm.desc} onChange={e => setTxForm(p => ({ ...p, desc: e.target.value }))} style={S.input} />
          <input type="number" placeholder="Valor (R$)" value={txForm.value} onChange={e => setTxForm(p => ({ ...p, value: e.target.value }))} style={S.input} />
          <select value={txForm.cat} onChange={e => setTxForm(p => ({ ...p, cat: e.target.value }))} style={S.select}>
            {["Alimentação", "Lazer", "Transporte", "Desenvolvimento", "Ferramentas", "Outros"].map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="date" value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} style={S.input} />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button style={S.btn} onClick={addTransaction}>Salvar</button>
            <button style={S.btnGhost} onClick={() => setShowAddTx(false)}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );

  const AddCCModal = () => (
    <div style={S.modal} onClick={() => setShowAddCC(false)}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Compra no Crédito</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Descrição" value={ccForm.desc} onChange={e => setCcForm(p => ({ ...p, desc: e.target.value }))} style={S.input} />
          <input type="number" placeholder="Valor total (R$)" value={ccForm.value} onChange={e => setCcForm(p => ({ ...p, value: e.target.value }))} style={S.input} />
          <input type="number" placeholder="Parcelas" value={ccForm.installments} min={1} max={12} onChange={e => setCcForm(p => ({ ...p, installments: e.target.value }))} style={S.input} />
          <input type="date" value={ccForm.date} onChange={e => setCcForm(p => ({ ...p, date: e.target.value }))} style={S.input} />
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#D4A84B10", fontSize: 11, color: "#D4A84B" }}>
            {ccForm.value && ccForm.installments ? `Parcela mensal: ${fmt(parseFloat(ccForm.value) / parseInt(ccForm.installments || 1))} → separado na Caixa Reserva` : "Preencha valor e parcelas"}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button style={S.btn} onClick={addCreditTx}>Registrar</button>
            <button style={S.btnGhost} onClick={() => setShowAddCC(false)}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );

  const AddSubModal = () => (
    <div style={S.modal} onClick={() => setShowAddSub(false)}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Nova Assinatura</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Nome" value={subForm.name} onChange={e => setSubForm(p => ({ ...p, name: e.target.value }))} style={S.input} />
          <input type="number" placeholder="Valor" value={subForm.value} onChange={e => setSubForm(p => ({ ...p, value: e.target.value }))} style={S.input} />
          <select value={subForm.currency} onChange={e => setSubForm(p => ({ ...p, currency: e.target.value }))} style={S.select}>
            <option value="BRL">R$ (BRL)</option>
            <option value="USD">$ (USD)</option>
          </select>
          <select value={subForm.category} onChange={e => setSubForm(p => ({ ...p, category: e.target.value }))} style={S.select}>
            {["Ferramentas", "Ferramentas IA", "Desenvolvimento", "Lazer", "Outros"].map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button style={S.btn} onClick={addSub}>Adicionar</button>
            <button style={S.btnGhost} onClick={() => setShowAddSub(false)}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, select:focus { border-color: #D4A84B !important; box-shadow: 0 0 0 2px #D4A84B18; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #27272A; border-radius: 2px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <header style={S.header}>
        <div style={S.logo}>
          <div style={S.logoIcon}>N</div>
          <span style={S.logoText}>NEXUS FINANCE</span>
        </div>
        <nav style={S.tabBar}>
          {[["macro", "MACRO"], ["meso", "MESO"], ["micro", "MICRO"], ["cartao", "CARTÃO"], ["ia", "IA"]].map(([k, v]) => (
            <button key={k} style={S.tab(tab === k)} onClick={() => setTab(k)}>{v}</button>
          ))}
        </nav>
      </header>

      <main style={S.main}>
        {tab === "macro" && <MacroView />}
        {tab === "meso" && <MesoView />}
        {tab === "micro" && <MicroView />}
        {tab === "cartao" && <CartaoView />}
        {tab === "ia" && <IAView />}
      </main>

      {showAddTx && <AddTxModal />}
      {showAddCC && <AddCCModal />}
      {showAddSub && <AddSubModal />}
      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
