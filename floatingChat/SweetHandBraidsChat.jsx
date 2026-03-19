import { useState, useEffect, useRef, useCallback } from "react";

/* ═══ CONFIG ═══ */
const N8N_BASE = "https://czar-olla.app.n8n.cloud/webhook";
const VAPI_PHONE = "+19292029714";
const VAPI_PUBLIC_KEY = "6fcc3026-29a2-4e01-a19b-e5eebd88da88";
const DAILY_ROOM_ENDPOINT = `${N8N_BASE}/create-video-room`;

const STYLES = [
  { id: "knotless_box_braids", label: "Knotless Box Braids", emoji: "✨", time: "4-8 hrs", price: "$150-350" },
  { id: "goddess_locs", label: "Goddess Locs", emoji: "👑", time: "5-8 hrs", price: "$180-350" },
  { id: "passion_twists", label: "Passion Twists", emoji: "💫", time: "3-6 hrs", price: "$140-280" },
  { id: "butterfly_locs", label: "Butterfly Locs", emoji: "🦋", time: "5-8 hrs", price: "$180-320" },
  { id: "cornrows", label: "Feed-In Cornrows", emoji: "💎", time: "2-5 hrs", price: "$80-200" },
  { id: "fulani_braids", label: "Fulani Braids", emoji: "🌺", time: "3-6 hrs", price: "$120-250" },
  { id: "tribal_braids", label: "Tribal Braids", emoji: "🔥", time: "4-7 hrs", price: "$150-300" },
  { id: "crochet_braids", label: "Crochet Braids", emoji: "🌀", time: "2-4 hrs", price: "$80-180" },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const dur = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

/* ═══ FETCH WITH TIMEOUT + ABORT ═══ */
const fetchWithTimeout = (url, opts = {}, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
};

/* ═══ DESIGN TOKENS ═══ */
const T = {
  font: "'Cormorant Garamond', Georgia, serif",
  body: "'DM Sans', system-ui, sans-serif",
  gold: "#C48B5C", goldL: "#D4A574", cream: "#FFF9F3", creamD: "#F5EDE3",
  esp: "#2A1810", gray: "#6B5E55", rose: "#C9A08F", green: "#2D8B5E", red: "#E05555",
};

/* ═══ FAB + WINDOW STYLES ═══ */
const s = {
  fab: {
    position: "fixed", bottom: 24, right: 24, width: 64, height: 64, borderRadius: "50%",
    background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 8px 32px rgba(196,139,92,.4)", zIndex: 9998,
    animation: "fabP 3s ease-in-out infinite",
    transition: "transform .2s cubic-bezier(.34,1.56,.64,1)",
  },
  window: {
    position: "fixed", bottom: 100, right: 24, width: 400, maxWidth: "calc(100vw - 32px)",
    height: 620, maxHeight: "calc(100vh - 120px)", borderRadius: 24, overflow: "hidden",
    display: "flex", flexDirection: "column",
    background: T.cream, boxShadow: "0 20px 60px rgba(42,24,16,.2), 0 0 0 1px rgba(42,24,16,.05)",
    zIndex: 9999, transition: "all .35s cubic-bezier(.22,1,.36,1)",
  },
};

export default function SweetHandBraidsChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("welcome");
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sid] = useState(() => `sess_${uid()}`);
  const [cust, setCust] = useState({ name: "", phone: "", email: "" });
  const [styles, setStyles] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [unread, setUnread] = useState(0);
  const [imgPrev, setImgPrev] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [connError, setConnError] = useState(null);

  /* Voice Call */
  const [vStatus, setVStatus] = useState("idle");
  const [vDur, setVDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const vapiRef = useRef(null);
  const vTimer = useRef(null);

  /* Video Call */
  const [vidStatus, setVidStatus] = useState("idle");
  const [vidDur, setVidDur] = useState(0);
  const [camOn, setCamOn] = useState(true);
  const [vidMuted, setVidMuted] = useState(false);
  const [snapFlash, setSnapFlash] = useState(false);
  const dailyRef = useRef(null);
  const vidTimer = useRef(null);
  const videoEl = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const endRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  const scroll = useCallback(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), []);
  useEffect(() => { scroll(); }, [msgs, typing, scroll]);
  useEffect(() => { if (isOpen) { setUnread(0); setPulse(false); } }, [isOpen]);
  useEffect(() => {
    const goOnline = () => { setOnline(true); setConnError(null); };
    const goOffline = () => { setOnline(false); setConnError("You're offline. Check your internet connection."); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);
  useEffect(() => () => {
    [vTimer, vidTimer].forEach(t => t.current && clearInterval(t.current));
    streamRef.current?.getTracks().forEach(t => t.stop());
    dailyRef.current?.destroy();
  }, []);

  const addMsg = (role, text, extra = {}) => {
    const m = { id: uid(), role, text, time: new Date(), ...extra };
    setMsgs(p => [...p, m]);
    if (!isOpen && role === "assistant") setUnread(p => p + 1);
  };

  const send = async (msg, type = "text", styleId = null, extra = {}) => {
    if (!online) { addMsg("assistant", "You're offline right now. Please check your connection and try again."); return; }
    setTyping(true); setConnError(null);
    try {
      const r = await fetchWithTimeout(`${N8N_BASE}/web-chat-intake`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, customer_phone: cust.phone, customer_name: cust.name, customer_email: cust.email, message: msg, message_type: type, style_id: styleId, attachments: [], timestamp: new Date().toISOString(), ...extra }),
      }, 30000);
      if (!r.ok) {
        throw new Error(`Server error (${r.status})`);
      }
      const d = await r.json();
      setTyping(false);
      addMsg("assistant", d.response || "I'm here to help! What style are you thinking about?", { images: d.images || [], bookingPrompt: d.booking_prompt || null });
    } catch (err) {
      setTyping(false);
      if (err.name === "AbortError") {
        setConnError("Connection timed out");
        addMsg("assistant", "That took too long — our AI stylist is busy! Please try again in a moment.");
      } else if (!navigator.onLine) {
        setConnError("You're offline");
        addMsg("assistant", "Looks like you lost internet connection. Please reconnect and try again.");
      } else {
        setConnError("Connection issue");
        addMsg("assistant", `Couldn't reach our stylist right now. Try again or call us at ${VAPI_PHONE}!`);
      }
    }
  };

  const doSend = () => { const t = input.trim(); if (!t) return; addMsg("user", t); setInput(""); send(t); };
  const pickStyle = (st) => { setStyles(false); addMsg("user", `I'm interested in ${st.label}`, { chip: st }); send(`I want ${st.label}`, "style_selection", st.id); };

  const handleImg = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = URL.createObjectURL(f); setImgPrev(url); setUploading(true);
    addMsg("user", "📸 Uploaded a photo for style recommendations", { image: url });
    try { const r = new FileReader(); r.onload = async () => { await send("Please analyze my hair and recommend styles", "video_frame"); setUploading(false); setImgPrev(null); }; r.readAsDataURL(f); }
    catch { setUploading(false); setImgPrev(null); addMsg("assistant", "I had trouble with that photo — could you try another? 📸"); }
  };

  const identify = (e) => {
    e.preventDefault(); if (!cust.name.trim()) return; setView("chat");
    addMsg("assistant", `Hey ${cust.name.split(" ")[0]}! 💕 Welcome to Sweet Hand Braids! I'm your AI stylist.\n\nI can help you:\n✨ Find your perfect braiding style\n📸 Analyze your hair from a photo\n📹 Video call me so I can see your hair\n📅 Book an appointment right here\n\nWhat are you looking for today?`);
  };

  /* ═══ VOICE CALL (VAPI Web SDK) ═══ */
  const startVoice = async () => {
    if (!online) { addMsg("assistant", "You're offline. Please check your connection before starting a call."); return; }
    setView("voiceCall"); setVStatus("connecting"); setVDur(0);
    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      const v = new Vapi(VAPI_PUBLIC_KEY); vapiRef.current = v;
      v.on("call-start", () => { setVStatus("active"); setConnError(null); vTimer.current = setInterval(() => setVDur(p => p + 1), 1000); });
      v.on("call-end", () => { setVStatus("ended"); vTimer.current && clearInterval(vTimer.current); });
      v.on("error", (e) => { setVStatus("ended"); vTimer.current && clearInterval(vTimer.current); setConnError("Voice call disconnected"); addMsg("assistant", `Voice call dropped${e?.message ? `: ${e.message}` : ""}. Chat with me here or try again!`); });
      v.on("speech-end", () => {}); // keep-alive
      await v.start({ model: { provider: "openai", model: "gpt-4o", systemMessage: `You are SweetHand, the AI hair braiding stylist. Customer: ${cust.name}. Be warm, expert. 2-3 sentences max.` }, voice: { provider: "11labs", voiceId: "EXAVITQu4vr4xnSDxMaL" }, firstMessage: `Hey ${cust.name?.split(" ")[0] || "love"}! So great to hear from you! What style are you thinking about?`, serverUrl: `${N8N_BASE}/vapi-server-url` });
    } catch (err) { setVStatus("ended"); setConnError("Couldn't connect voice call"); addMsg("assistant", `Couldn't start voice call${err?.message ? ` (${err.message})` : ""}. Call us at ${VAPI_PHONE}!`); }
  };

  const endVoice = () => { vapiRef.current?.stop(); vapiRef.current = null; vTimer.current && clearInterval(vTimer.current); setVStatus("ended"); };
  const toggleMute = () => { vapiRef.current?.setMuted(!muted); setMuted(!muted); };

  /* ═══ VIDEO CALL (Daily.co + local camera fallback) ═══ */
  const startVideo = async () => {
    if (!online) { addMsg("assistant", "You're offline. Please check your connection before starting a video call."); return; }
    setView("videoCall"); setVidStatus("connecting"); setVidDur(0);
    try {
      let roomUrl, token;
      try {
        const res = await fetchWithTimeout(DAILY_ROOM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid, customer_name: cust.name, customer_phone: cust.phone }) }, 15000);
        if (res.ok) {
          const data = await res.json(); roomUrl = data.room_url; token = data.token;
        }
      } catch { /* fallback to local camera only */ }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: true });
      streamRef.current = stream;
      if (videoEl.current) videoEl.current.srcObject = stream;

      if (roomUrl) {
        const { default: DailyIframe } = await import("@daily-co/daily-js");
        const call = DailyIframe.createCallObject({ url: roomUrl, token, userName: cust.name || "Customer" });
        dailyRef.current = call;
        call.on("joined-meeting", () => { setVidStatus("active"); setConnError(null); vidTimer.current = setInterval(() => setVidDur(p => p + 1), 1000); });
        call.on("left-meeting", () => { setVidStatus("ended"); vidTimer.current && clearInterval(vidTimer.current); streamRef.current?.getTracks().forEach(t => t.stop()); });
        call.on("error", (e) => { setVidStatus("ended"); vidTimer.current && clearInterval(vidTimer.current); setConnError("Video call disconnected"); addMsg("assistant", `Video call dropped${e?.error ? `: ${e.error}` : ""}. Try reconnecting or upload a photo instead!`); });
        call.on("network-connection", (ev) => { if (ev?.type === "interrupted") { setConnError("Weak connection — video may be unstable"); } else if (ev?.type === "connected") { setConnError(null); } });
        await call.join();
      } else {
        setVidStatus("active");
        vidTimer.current = setInterval(() => setVidDur(p => p + 1), 1000);
        addMsg("assistant", "I've opened your camera! Tap 📸 Capture Snapshot so I can see your hair and recommend the perfect style. 💕");
      }
    } catch {
      setVidStatus("ended");
      addMsg("assistant", "Couldn't access your camera. Try uploading a photo instead! 📸");
      setView("chat");
    }
  };

  const endVideo = () => {
    dailyRef.current?.leave(); dailyRef.current?.destroy(); dailyRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    vidTimer.current && clearInterval(vidTimer.current);
    if (videoEl.current) videoEl.current.srcObject = null;
    setVidStatus("ended");
  };

  const toggleCam = () => {
    const vt = streamRef.current?.getVideoTracks()[0];
    if (vt) { vt.enabled = !vt.enabled; setCamOn(vt.enabled); }
    dailyRef.current?.setLocalVideo(!camOn);
  };

  const toggleVidMute = () => {
    const at = streamRef.current?.getAudioTracks()[0];
    if (at) { at.enabled = !at.enabled; setVidMuted(!at.enabled); }
    dailyRef.current?.setLocalAudio(vidMuted);
  };

  const snapshot = async () => {
    if (!videoEl.current || !canvasRef.current) return;
    const v = videoEl.current, c = canvasRef.current;
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    setSnapFlash(true); setTimeout(() => setSnapFlash(false), 600);
    addMsg("user", "📸 Captured a video snapshot for hair analysis", { image: dataUrl });
    await send("I just sent you a snapshot from my camera. Please analyze my hair and recommend braiding styles.", "video_frame", null, { attachments: [dataUrl] });
  };

  const backToChat = () => {
    if (vStatus === "active") endVoice();
    if (vidStatus === "active") endVideo();
    setView("chat"); setVStatus("idle"); setVidStatus("idle"); setVDur(0); setVidDur(0);
  };

  /* ═══ STYLES ═══ */
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
    @keyframes fabP{0%,100%{transform:scale(1);box-shadow:0 8px 32px rgba(196,139,92,.4)}50%{transform:scale(1.08);box-shadow:0 12px 40px rgba(196,139,92,.55)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    @keyframes msgIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes tBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
    @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes ring{0%{box-shadow:0 0 0 0 rgba(196,139,92,.5)}70%{box-shadow:0 0 0 20px rgba(196,139,92,0)}100%{box-shadow:0 0 0 0 rgba(196,139,92,0)}}
    @keyframes flash{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
    @keyframes wave{0%,100%{height:8px}50%{height:24px}}
    .shb-sb::-webkit-scrollbar{width:5px}.shb-sb::-webkit-scrollbar-thumb{background:#D4CCC4;border-radius:10px}
    .shb-i:focus{border-color:${T.gold}!important;box-shadow:0 0 0 3px ${T.gold}15!important}
    .shb-sc:hover{border-color:${T.gold}60!important;transform:translateY(-2px);box-shadow:0 6px 20px rgba(196,139,92,.15)}
    .shb-tb:hover{background:${T.gold}12!important;color:${T.gold}!important}
    .shb-cl:hover{background:rgba(255,255,255,.22)!important;color:#FFF!important}
    .shb-cb:hover{transform:scale(1.1)!important}.shb-cb:active{transform:scale(.95)!important}
  `;

  const bubble = (u) => ({
    maxWidth: "82%", padding: "12px 16px", fontSize: 14, lineHeight: 1.6, fontFamily: T.body,
    borderRadius: u ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
    background: u ? `linear-gradient(135deg,${T.gold},${T.goldL})` : "#FFF",
    color: u ? "#FFF" : T.esp, wordBreak: "break-word", whiteSpace: "pre-wrap",
    boxShadow: u ? "0 4px 16px rgba(196,139,92,.3)" : "0 2px 12px rgba(42,24,16,.06)",
    border: u ? "none" : "1px solid rgba(42,24,16,.04)",
  });

  const ava = {
    width: 32, height: 32, borderRadius: "50%", marginRight: 8, flexShrink: 0,
    background: `linear-gradient(135deg,${T.goldL},${T.rose})`,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
    boxShadow: "0 2px 8px rgba(196,139,92,.25)",
  };

  const ctrl = (bg, sz = 52) => ({
    width: sz, height: sz, borderRadius: "50%", border: "none", background: bg,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all .2s cubic-bezier(.34,1.56,.64,1)", boxShadow: `0 4px 16px ${bg}60`,
  });

  const toolBtn = (active = false, accent = false) => ({
    background: active ? `${T.gold}15` : accent ? `${T.green}10` : "transparent",
    border: active ? `1.5px solid ${T.gold}40` : accent ? `1.5px solid ${T.green}30` : "1.5px solid transparent",
    borderRadius: 10, padding: "6px 10px", fontSize: 12, cursor: "pointer",
    color: active ? T.gold : accent ? T.green : T.gray, fontFamily: T.body,
    fontWeight: accent ? 600 : 500, transition: "all .2s", display: "flex", alignItems: "center", gap: 4,
  });

  /* ═══ SUB-RENDERS ═══ */

  const Header = () => (
    <div style={{ background: `linear-gradient(135deg,${T.esp} 0%,#3D2820 60%)`, padding: "20px 20px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, opacity: .06, backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(255,255,255,.5) 8px,rgba(255,255,255,.5) 9px)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
        <div>
          <h2 style={{ fontFamily: T.font, fontSize: 22, fontWeight: 600, color: "#FFF", letterSpacing: ".02em", lineHeight: 1.2, margin: 0 }}>Sweet Hand Braids</h2>
          <p style={{ fontFamily: T.body, fontSize: 12, color: online ? T.rose : "#FF8A8A", marginTop: 4, letterSpacing: ".04em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: online ? "#5CD67B" : "#E05555", display: "inline-block", marginRight: 6, boxShadow: online ? "0 0 6px rgba(92,214,123,.6)" : "0 0 6px rgba(224,85,85,.6)", animation: "pulse 2s ease-in-out infinite" }} />
            {online ? "AI Stylist • Online Now" : "Offline • Reconnecting..."}
          </p>
        </div>
        <button className="shb-cl" style={{ background: "rgba(255,255,255,.12)", border: "none", borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,.7)", fontSize: 18, backdropFilter: "blur(8px)" }} onClick={() => setIsOpen(false)}>✕</button>
      </div>
      {connError && (
        <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, background: "rgba(224,85,85,.15)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          <span style={{ fontSize: 11, color: "#FF8A8A", fontFamily: T.body, fontWeight: 500 }}>{connError}</span>
          <button onClick={() => setConnError(null)} style={{ background: "none", border: "none", color: "#FF8A8A", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      )}
    </div>
  );

  /* ─── CALL PICKER ─── */
  const CallPicker = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: `linear-gradient(180deg,${T.cream},#FFFCF8)`, animation: "slideUp .35s cubic-bezier(.22,1,.36,1)" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
      <h3 style={{ fontFamily: T.font, fontSize: 24, fontWeight: 600, color: T.esp, marginBottom: 8, textAlign: "center" }}>Talk to Your Stylist</h3>
      <p style={{ fontSize: 14, color: T.gray, textAlign: "center", lineHeight: 1.6, marginBottom: 32, maxWidth: 280 }}>Choose how you'd like to connect. Video calls let me see your hair for personalized recs!</p>

      {[
        { icon: "🎤", title: "Voice Call", sub: "Talk hands-free with your AI stylist", onClick: startVoice, accent: false },
        { icon: "📹", title: "Video Call", sub: "I can see your hair and give better advice!", onClick: startVideo, accent: true, badge: "RECOMMENDED" },
      ].map((opt, i) => (
        <button key={i} onClick={opt.onClick} style={{
          width: "100%", maxWidth: 320, padding: "18px 20px", borderRadius: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 16, transition: "all .25s", marginBottom: 12, textAlign: "left", fontFamily: T.body,
          border: opt.accent ? `2px solid ${T.gold}40` : `1.5px solid ${T.creamD}`,
          background: opt.accent ? `linear-gradient(135deg,${T.cream},#FFF)` : "#FFF",
          boxShadow: opt.accent ? `0 2px 12px ${T.gold}12` : "none",
        }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: opt.accent ? `${T.gold}15` : `${T.green}12`, fontSize: 24, flexShrink: 0 }}>{opt.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.esp }}>
              {opt.title}
              {opt.badge && <span style={{ fontSize: 10, fontWeight: 700, color: T.gold, background: `${T.gold}14`, padding: "2px 8px", borderRadius: 6, marginLeft: 8, verticalAlign: "middle" }}>{opt.badge}</span>}
            </div>
            <div style={{ fontSize: 12, color: T.gray, marginTop: 2 }}>{opt.sub}</div>
          </div>
        </button>
      ))}

      <button onClick={() => window.open(`tel:${VAPI_PHONE.replace(/\D/g, "")}`, "_self")} style={{ width: "100%", maxWidth: 320, padding: "14px 20px", borderRadius: 16, border: `1.5px solid ${T.creamD}`, background: "transparent", cursor: "pointer", fontSize: 13, color: T.gray, fontWeight: 500, fontFamily: T.body, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        📱 Or dial {VAPI_PHONE} directly
      </button>
      <button onClick={() => setView("chat")} style={{ marginTop: 16, background: "none", border: "none", color: T.gold, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.body }}>← Back to chat</button>
    </div>
  );

  /* ─── VOICE CALL ─── */
  const VoiceCall = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: `linear-gradient(180deg,${T.esp},#3D2820)`, animation: "slideUp .35s cubic-bezier(.22,1,.36,1)" }}>
      <div style={{ width: 100, height: 100, borderRadius: "50%", marginBottom: 24, background: `linear-gradient(135deg,${T.gold},${T.goldL})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, animation: vStatus === "connecting" ? "ring 1.5s ease-in-out infinite" : "none", boxShadow: `0 8px 32px ${T.gold}40` }}>👑</div>
      <h3 style={{ fontFamily: T.font, fontSize: 22, fontWeight: 600, color: "#FFF", marginBottom: 4 }}>Sweet Hand Braids</h3>
      <p style={{ fontSize: 13, color: T.rose, marginBottom: 8 }}>AI Stylist — Voice Call</p>
      <p style={{ fontSize: 14, color: vStatus === "active" ? "#5CD67B" : T.rose, marginBottom: 24, fontWeight: 500 }}>
        {vStatus === "connecting" && "Connecting..."}{vStatus === "active" && dur(vDur)}{vStatus === "ended" && "Call ended"}
      </p>
      {vStatus === "active" && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", height: 32, marginBottom: 32 }}>
          {[0,1,2,3,4,5,6,7].map(i => <div key={i} style={{ width: 4, borderRadius: 2, background: T.goldL, animation: `wave ${.4+Math.random()*.6}s ease-in-out ${i*.08}s infinite alternate` }} />)}
        </div>
      )}
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        {vStatus === "active" && <>
          <button className="shb-cb" style={ctrl(muted ? "#FFF" : "rgba(255,255,255,.15)", 48)} onClick={toggleMute}><span style={{ fontSize: 20 }}>{muted ? "🔇" : "🎤"}</span></button>
          <button className="shb-cb" style={ctrl(T.red, 60)} onClick={endVoice}><span style={{ fontSize: 24 }}>📞</span></button>
        </>}
        {vStatus === "ended" && <button className="shb-cb" style={ctrl(T.gold, 60)} onClick={backToChat}><span style={{ fontSize: 18, color: "#FFF", fontWeight: 600 }}>✕</span></button>}
      </div>
      {vStatus === "ended" && <button onClick={backToChat} style={{ marginTop: 24, background: "none", border: "1.5px solid rgba(255,255,255,.2)", borderRadius: 12, padding: "10px 24px", color: "#FFF", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.body }}>← Back to chat</button>}
    </div>
  );

  /* ─── VIDEO CALL ─── */
  const VideoCall = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#1A1210", position: "relative", overflow: "hidden", animation: "slideUp .35s cubic-bezier(.22,1,.36,1)" }}>
      <div style={{ flex: 1, position: "relative", background: "#000" }}>
        <video ref={videoEl} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {snapFlash && <div style={{ position: "absolute", inset: 0, background: "#FFF", animation: "flash .5s ease-out forwards", pointerEvents: "none" }} />}
        {vidStatus === "connecting" && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: `linear-gradient(135deg,${T.gold},${T.goldL})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, animation: "ring 1.5s ease-in-out infinite", marginBottom: 16 }}>📹</div>
            <p style={{ color: "#FFF", fontSize: 14, fontWeight: 500 }}>Setting up your camera...</p>
          </div>
        )}
        {!camOn && vidStatus === "active" && (
          <div style={{ position: "absolute", inset: 0, background: T.esp, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg,${T.gold},${T.goldL})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 12 }}>👑</div>
            <p style={{ color: T.rose, fontSize: 13 }}>Camera off</p>
          </div>
        )}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(180deg,rgba(0,0,0,.5),transparent)" }}>
          <button onClick={backToChat} style={{ background: "rgba(255,255,255,.15)", backdropFilter: "blur(8px)", border: "none", borderRadius: 10, padding: "6px 12px", color: "#FFF", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.body }}>← Chat</button>
          <div style={{ background: vidStatus === "active" ? "rgba(92,214,123,.2)" : "rgba(255,255,255,.15)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "6px 12px", color: vidStatus === "active" ? "#5CD67B" : "#FFF", fontSize: 13, fontWeight: 600, fontFamily: T.body }}>
            {vidStatus === "connecting" ? "Connecting..." : dur(vidDur)}
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>👑</span>
          <span style={{ color: "#FFF", fontSize: 12, fontWeight: 500 }}>AI Stylist analyzing</span>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5CD67B", animation: "pulse 2s ease-in-out infinite" }} />
        </div>
      </div>
      <div style={{ padding: "16px 20px 20px", background: `linear-gradient(180deg,#1A1210,${T.esp})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        {vidStatus === "active" && (
          <button className="shb-cb" onClick={snapshot} style={{
            width: "100%", maxWidth: 280, padding: 12, borderRadius: 14,
            border: `2px solid ${T.gold}`, background: `${T.gold}15`, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: T.body, color: T.goldL, fontSize: 14, fontWeight: 600,
          }}>📸 Capture Snapshot for Hair Analysis</button>
        )}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button className="shb-cb" style={ctrl(vidMuted ? "#FFF" : "rgba(255,255,255,.15)", 48)} onClick={toggleVidMute}><span style={{ fontSize: 18 }}>{vidMuted ? "🔇" : "🎤"}</span></button>
          <button className="shb-cb" style={ctrl(camOn ? "rgba(255,255,255,.15)" : "#FFF", 48)} onClick={toggleCam}><span style={{ fontSize: 18 }}>{camOn ? "📹" : "🚫"}</span></button>
          <button className="shb-cb" style={ctrl(T.red, 56)} onClick={endVideo}><span style={{ fontSize: 22, color: "#FFF" }}>✕</span></button>
        </div>
      </div>
    </div>
  );

  /* ─── WELCOME ─── */
  const Welcome = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 20px 20px", overflowY: "auto", background: `linear-gradient(180deg,transparent,${T.cream})` }} className="shb-sb">
      <div style={{ textAlign: "center", padding: "24px 0 20px" }}>
        <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>👑</span>
        <h3 style={{ fontFamily: T.font, fontSize: 26, color: T.esp, fontWeight: 600, lineHeight: 1.2, margin: "0 0 8px" }}>Your Personal<br/>Hair Stylist</h3>
        <p style={{ fontSize: 14, color: T.gray, lineHeight: 1.6, margin: "0 0 20px" }}>Chat, voice call, or video call — your stylist is ready via any medium.</p>
      </div>
      <form onSubmit={identify}>
        {[{ label: "Your Name *", ph: "e.g. Tasha", key: "name", type: "text", req: true }, { label: "Phone Number", ph: "+1 (555) 000-0000", key: "phone", type: "tel" }, { label: "Email", ph: "you@email.com", key: "email", type: "email" }].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.gray, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, display: "block" }}>{f.label}</label>
            <input className="shb-i" style={{ width: "100%", border: `1.5px solid ${T.creamD}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, fontFamily: T.body, background: "#FFF", color: T.esp, outline: "none", boxSizing: "border-box" }}
              placeholder={f.ph} type={f.type} value={cust[f.key]} onChange={(e) => setCust(p => ({ ...p, [f.key]: e.target.value }))} required={f.req} />
          </div>
        ))}
        <button type="submit" style={{ width: "100%", padding: 14, border: "none", borderRadius: 14, background: `linear-gradient(135deg,${T.gold},${T.goldL})`, color: "#FFF", fontSize: 15, fontWeight: 600, fontFamily: T.body, cursor: "pointer", boxShadow: "0 6px 24px rgba(196,139,92,.35)", marginTop: 6 }}>✨ Chat with AI Stylist</button>
      </form>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0", color: "#C5B8AD", fontSize: 12, fontWeight: 500 }}>
        <div style={{ flex: 1, height: 1, background: T.creamD }} /><span>OR</span><div style={{ flex: 1, height: 1, background: T.creamD }} />
      </div>
      <button onClick={() => { if (!cust.name.trim()) return; identify({ preventDefault: () => {} }); setTimeout(() => setView("callPicker"), 300); }}
        style={{ width: "100%", padding: 13, border: `2px solid ${T.creamD}`, borderRadius: 14, background: "transparent", color: T.esp, fontSize: 14, fontWeight: 600, fontFamily: T.body, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        📹 Video or Voice Call with Stylist
      </button>
      <div style={{ textAlign: "center", padding: "12px 0 2px", fontSize: 10, color: "#C5B8AD", letterSpacing: ".04em" }}>Powered by SweetHand AI</div>
    </div>
  );

  /* ─── CHAT ─── */
  const Chat = () => (
    <>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", background: `linear-gradient(180deg,${T.cream},#FFFCF8)` }} className="shb-sb">
        {msgs.map(m => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12, animation: "msgIn .35s cubic-bezier(.22,1,.36,1)" }}>
            {m.role === "assistant" && <div style={ava}>👑</div>}
            <div>
              {m.image && <div style={{ borderRadius: 14, overflow: "hidden", marginBottom: 6 }}><img src={m.image} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block" }} /></div>}
              {m.chip && <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${T.gold}12`, borderRadius: 10, padding: "5px 12px", marginBottom: 6, fontSize: 12, color: T.gold, fontWeight: 600 }}>{m.chip.emoji} {m.chip.label}</div>}
              <div style={bubble(m.role === "user")}>{m.text}</div>
              {m.images?.length > 0 && <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", paddingBottom: 4 }}>{m.images.map((img, i) => <img key={i} src={img.image_urls?.[0] || img} alt="" style={{ width: 100, height: 100, borderRadius: 12, objectFit: "cover", border: `2px solid ${T.creamD}`, flexShrink: 0, cursor: "pointer" }} />)}</div>}
              {m.bookingPrompt && (
                <div style={{ background: `linear-gradient(135deg,${T.cream},#FFF)`, border: `1.5px solid ${T.gold}30`, borderRadius: 14, padding: 14, marginTop: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.esp, marginBottom: 8 }}>📅 Available Slots</div>
                  <div style={{ display: "flex", flexWrap: "wrap" }}>
                    {(m.bookingPrompt.available_slots || []).map((sl, i) => <span key={i} style={{ display: "inline-block", padding: "6px 12px", borderRadius: 8, background: `${T.gold}12`, border: `1px solid ${T.gold}30`, fontSize: 12, fontWeight: 600, color: T.gold, cursor: "pointer", margin: "4px 4px 0 0" }} onClick={() => { addMsg("user", `Book me for ${sl.date} at ${sl.time}`); send(`Please book for ${sl.date} at ${sl.time}`); }}>{sl.date} • {sl.time}</span>)}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 10, marginTop: 5, color: m.role === "user" ? "rgba(255,255,255,.7)" : "#B5A99A", textAlign: m.role === "user" ? "right" : "left" }}>{fmt(m.time)}</div>
            </div>
          </div>
        ))}
        {typing && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", animation: "msgIn .3s ease" }}><div style={ava}>👑</div><div style={{ background: "#FFF", borderRadius: "20px 20px 20px 6px", padding: "14px 20px", display: "flex", gap: 5, boxShadow: "0 2px 12px rgba(42,24,16,.06)", border: "1px solid rgba(42,24,16,.04)" }}>{[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.rose, animation: `tBounce 1.4s ease-in-out ${i*.16}s infinite` }} />)}</div></div>}
        <div ref={endRef} />
      </div>
      {styles && (
        <div style={{ padding: "8px 16px 0", background: "#FFFDF9", borderTop: `1px solid ${T.creamD}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.esp }}>Pick a Style ✨</span>
            <button onClick={() => setStyles(false)} style={{ background: "none", border: "none", color: T.gray, cursor: "pointer", fontSize: 18 }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingBottom: 8 }}>
            {STYLES.map(st => <div key={st.id} className="shb-sc" style={{ background: "#FFF", borderRadius: 14, padding: 12, border: `1.5px solid ${T.creamD}`, cursor: "pointer", textAlign: "center", transition: "all .25s cubic-bezier(.34,1.56,.64,1)" }} onClick={() => pickStyle(st)}>
              <div style={{ fontSize: 22, marginBottom: 3 }}>{st.emoji}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.esp, lineHeight: 1.3 }}>{st.label}</div>
              <div style={{ fontSize: 10, color: T.gray, marginTop: 2 }}>{st.time} • {st.price}</div>
            </div>)}
          </div>
        </div>
      )}
      {imgPrev && <div style={{ padding: "0 16px" }}><div style={{ position: "relative", marginBottom: 10, borderRadius: 14, overflow: "hidden", border: `2px solid ${T.gold}40` }}><img src={imgPrev} alt="" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />{!uploading && <button onClick={() => setImgPrev(null)} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "none", color: "#FFF", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>}{uploading && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: 13, fontWeight: 600 }}>Analyzing... ✨</div>}</div></div>}
      <div style={{ padding: "12px 16px 16px", borderTop: `1px solid ${T.creamD}`, background: "#FFFDF9" }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
          <button className="shb-tb" style={toolBtn(styles)} onClick={() => setStyles(!styles)}>💇‍♀️ Styles</button>
          <button className="shb-tb" style={toolBtn()} onClick={() => fileRef.current?.click()}>📸 Photo</button>
          <button className="shb-tb" style={toolBtn()} onClick={() => { addMsg("user", "What appointments are available this week?"); send("What appointments are available this week?"); }}>📅 Book</button>
          <button className="shb-tb" style={toolBtn(false, true)} onClick={() => setView("callPicker")}>📞 Call</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImg} />
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea ref={inputRef} className="shb-i" style={{ flex: 1, border: `1.5px solid ${T.creamD}`, borderRadius: 16, padding: "12px 16px", fontSize: 14, fontFamily: T.body, background: "#FFF", color: T.esp, outline: "none", resize: "none", minHeight: 44, maxHeight: 120, lineHeight: 1.5 }}
            placeholder="Ask about a style, send a photo..." value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }} rows={1} />
          <button style={{ width: 44, height: 44, borderRadius: 14, border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() ? `linear-gradient(135deg,${T.gold},${T.goldL})` : T.creamD, transition: "all .3s cubic-bezier(.34,1.56,.64,1)", transform: input.trim() ? "scale(1)" : "scale(.92)", boxShadow: input.trim() ? "0 4px 16px rgba(196,139,92,.35)" : "none", flexShrink: 0 }}
            onClick={doSend} disabled={!input.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 5l7 7-7 7" stroke={input.trim() ? "#FFF" : "#B5A99A"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <div style={{ textAlign: "center", padding: "8px 0 2px", fontSize: 10, color: "#C5B8AD" }}>Sweet Hand Braids AI • Available 24/7</div>
      </div>
    </>
  );

  /* ═══ MAIN ═══ */
  return (
    <>
      <style>{CSS}</style>
      {!isOpen && (
        <button style={s.fab} onClick={() => setIsOpen(true)} aria-label="Open chat">
          <span style={{ fontSize: 28, color: "#FFF", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.2))" }}>✨</span>
          {unread > 0 && <span style={{ position: "absolute", top: -4, right: -4, minWidth: 22, height: 22, borderRadius: 11, background: "#E25555", color: "#FFF", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px", border: "2px solid #FFF" }}>{unread}</span>}
        </button>
      )}
      {isOpen && (
        <div style={s.window}>
          {Header()}
          {view === "welcome" && Welcome()}
          {view === "chat" && Chat()}
          {view === "callPicker" && CallPicker()}
          {view === "voiceCall" && VoiceCall()}
          {view === "videoCall" && VideoCall()}
        </div>
      )}
    </>
  );
}
