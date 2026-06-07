import { useState } from "react";
import { usePolling, postJSON } from "../api";

// Citizen comments / opinions board.
export default function Comments() {
  const { data, refresh } = usePolling("/api/comments", 5000, []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = data || [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await postJSON("/api/comments", { text });
      setText("");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>เสียงประชาชน (แสดงความคิดเห็น)</h2>
      <form className="complaint-form" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)}
               placeholder="แสดงความคิดเห็นเกี่ยวกับการจราจร…" maxLength={280} />
        <button className="btn" disabled={busy}>{busy ? "…" : "ส่ง"}</button>
      </form>
      <div className="comment-list">
        {list.map((c: any) => (
          <div className="comment" key={c.id}>
            <div className="comment-user">{c.user}</div>
            <div className="comment-text">{c.text}</div>
          </div>
        ))}
        {list.length === 0 && <p className="muted">ยังไม่มีความคิดเห็น</p>}
      </div>
    </div>
  );
}
