import { useEffect, useRef, useState } from "react";
import { postJSON } from "../api.js";
import { IconChat, IconClose, IconSend, IconSpark } from "../icons.jsx";

const SUGGESTIONS = [
  "ระบบประหยัดงบยังไง",
  "ตอนนี้แยกไหนรถติดสุด",
  "โหมด Manual คืออะไร",
  "ข้อมูล PDPA เป็นยังไง",
];

const GREETING = {
  role: "bot",
  text: "สวัสดีค่ะ ฉันคือผู้ช่วย AI ของ Urban IntelliFlow 🚦 ถามเรื่องระบบจราจร ต้นทุน เหตุการณ์ หรือสถานะเรียลไทม์ได้เลยค่ะ",
  sources: [],
};

// Floating RAG-powered assistant (grounded in docs + live state).
export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([GREETING]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  const ask = async (q) => {
    const query = (q ?? text).trim();
    if (!query || busy) return;
    setText("");
    setMsgs((m) => [...m, { role: "user", text: query }]);
    setBusy(true);
    try {
      const r = await postJSON("/api/assistant", { query });
      setMsgs((m) => [...m, { role: "bot", text: r.answer, sources: r.sources || [], model: r.model }]);
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "ขออภัย เชื่อมต่อผู้ช่วยไม่ได้ในขณะนี้", sources: [] }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className={`assistant-fab ${open ? "hidden" : ""}`} onClick={() => setOpen(true)}
              aria-label="เปิดผู้ช่วย AI" title="ผู้ช่วย AI">
        <IconChat size={22} />
      </button>

      {open && (
        <div className="assistant-panel">
          <div className="assistant-head">
            <div className="ah-title"><IconSpark size={18} /> ผู้ช่วย AI <span className="ah-rag">RAG</span></div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="ปิด"><IconClose size={16} /></button>
          </div>

          <div className="assistant-body">
            {msgs.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                <div className="bubble-text">{m.text}</div>
                {m.sources?.length > 0 && (
                  <div className="bubble-src">
                    อ้างอิง: {m.sources.map((s) => s.title.split(" · ")[0]).join(" · ")}
                    {m.model && m.model !== "extractive" ? ` · ${m.model}` : ""}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="bubble bot"><div className="bubble-text typing">กำลังคิด…</div></div>}
            <div ref={endRef} />
          </div>

          {msgs.length <= 1 && (
            <div className="assistant-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          )}

          <form className="assistant-input" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <input value={text} onChange={(e) => setText(e.target.value)}
                   placeholder="ถามเกี่ยวกับระบบจราจร…" />
            <button className="btn gold" disabled={busy} aria-label="ส่ง"><IconSend size={18} /></button>
          </form>
        </div>
      )}
    </>
  );
}
