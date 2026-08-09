import { useState, useEffect } from "react";
import {
  Plus, Share2, X, ChevronLeft, ChevronRight, Settings as SettingsIcon,
  LogOut, Users, Link2, Check, Copy, Lock, ArrowLeft, Eye, Camera,
  Grid, Calendar, Trash2, Sparkles, ImagePlus
} from "lucide-react";

/* ------------------------------------------------------------------ *
 *  MEMORIES — glassmorphism UI prototype
 *  Cream base · bright-purple wordmark · purple + orange glass accents
 * ------------------------------------------------------------------ */

const GRADS = [
  "linear-gradient(135deg,#a06bff,#ff9a5a)",
  "linear-gradient(135deg,#ffb37a,#ff6f91)",
  "linear-gradient(135deg,#7c5cff,#4bc6ff)",
  "linear-gradient(135deg,#ff8fa3,#a06bff)",
  "linear-gradient(135deg,#ffd08a,#ff8a3d)",
  "linear-gradient(135deg,#8b7bff,#c9a0ff)",
  "linear-gradient(135deg,#5ad1c9,#7c5cff)",
  "linear-gradient(135deg,#ffb26b,#e86a92)",
  "linear-gradient(135deg,#b18bff,#ffb37a)",
  "linear-gradient(135deg,#ff9a5a,#c86bff)",
  "linear-gradient(135deg,#7cc6ff,#b18bff)",
  "linear-gradient(135deg,#ffcf8a,#ff6f91)",
];
const photo = (i) => ({ id: "p" + i + "-" + Math.random().toString(36).slice(2, 6), grad: GRADS[i % GRADS.length] });
const makePhotos = (n, off = 0) => Array.from({ length: n }, (_, i) => photo(i + off));

const INITIAL = [
  { id: "m1", title: "Beach Weekend", date: "14 Jul 2026", mine: true, photos: makePhotos(8, 0) },
  { id: "m2", title: "Emma's Birthday", date: "2 Jun 2026", mine: true, photos: makePhotos(12, 3) },
  { id: "m3", title: "Mountain Hike", date: "21 May 2026", mine: true, photos: makePhotos(5, 6) },
  { id: "m4", title: "City Nights", date: "9 Apr 2026", mine: true, photos: makePhotos(6, 2) },
  { id: "m5", title: "Family Reunion", date: "30 Mar 2026", mine: false, sharedBy: "Sofia", photos: makePhotos(9, 4) },
  { id: "m6", title: "Road Trip 2026", date: "12 Feb 2026", mine: false, sharedBy: "Marco", photos: makePhotos(7, 1) },
];

const token = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
const todayStr = () => {
  const d = new Date();
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
};

export default function App() {
  const [screen, setScreen] = useState("auth");        // auth | home | detail | settings | public
  const [authMode, setAuthMode] = useState("login");
  const [tab, setTab] = useState("mine");               // mine | shared
  const [memories, setMemories] = useState(INITIAL);
  const [links] = useState(() => Object.fromEntries(INITIAL.map((m) => [m.id, token()])));
  const [selId, setSelId] = useState(null);
  const [viewer, setViewer] = useState({ open: false, i: 0, source: "detail" });
  const [showCreate, setShowCreate] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [linkActive, setLinkActive] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);
  const [name, setName] = useState("Alex Rivera");
  const [members, setMembers] = useState([{ n: "Sofia Chen", r: "contributor" }, { n: "Marco Diaz", r: "viewer" }]);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(todayStr());
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");

  const sel = memories.find((m) => m.id === selId);
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  useEffect(() => {
    const onKey = (e) => {
      if (!viewer.open) return;
      if (e.key === "Escape") setViewer((v) => ({ ...v, open: false }));
      if (e.key === "ArrowRight") setViewer((v) => ({ ...v, i: Math.min(v.i + 1, (sel?.photos.length || 1) - 1) }));
      if (e.key === "ArrowLeft") setViewer((v) => ({ ...v, i: Math.max(v.i - 1, 0) }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer.open, sel]);

  const openMemory = (id) => { setSelId(id); setScreen("detail"); };
  const createMemory = () => {
    const t = newTitle.trim() || "Untitled Memory";
    const id = "m" + Date.now();
    const m = { id, title: t, date: newDate, mine: true, photos: makePhotos(4, Math.floor(Math.random() * 6)) };
    setMemories((prev) => [m, ...prev]);
    links[id] = token();
    setShowCreate(false); setNewTitle(""); setNewDate(todayStr());
    setSelId(id); setScreen("detail"); setTab("mine");
    flash("Memory created — public link ready");
  };
  const deleteMemory = (id) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    setScreen("home"); flash("Memory deleted");
  };
  const copyLink = () => { setCopied(true); flash("Public link copied"); setTimeout(() => setCopied(false), 1400); };
  const addMember = () => {
    if (!inviteEmail.trim()) return;
    setMembers((prev) => [...prev, { n: inviteEmail.trim(), r: inviteRole }]);
    setInviteEmail(""); flash("Invitation sent");
  };

  const shown = memories.filter((m) => (tab === "mine" ? m.mine : !m.mine));

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* ambient light behind the glass */}
      <div className="orbs" aria-hidden="true">
        <span className="orb orb-p1" /><span className="orb orb-o1" />
        <span className="orb orb-p2" /><span className="orb orb-o2" />
      </div>

      {screen === "auth" && (
        <Auth mode={authMode} setMode={setAuthMode} enter={() => setScreen("home")} />
      )}

      {(screen === "home" || screen === "detail" || screen === "settings") && (
        <>
          <TopBar
            onLogo={() => setScreen("home")}
            onSettings={() => setScreen("settings")}
            onLogout={() => setScreen("auth")}
            name={name}
          />
          <main className="wrap">
            {screen === "home" && (
              <Home
                tab={tab} setTab={setTab} shown={shown}
                links={links} open={openMemory} onNew={() => setShowCreate(true)}
              />
            )}
            {screen === "detail" && sel && (
              <Detail
                m={sel} link={links[sel.id]}
                onBack={() => setScreen("home")}
                onShare={() => setShowShare(true)}
                onDelete={() => deleteMemory(sel.id)}
                openViewer={(i) => setViewer({ open: true, i, source: "detail" })}
              />
            )}
            {screen === "settings" && (
              <SettingsView name={name} setName={setName} flash={flash} />
            )}
          </main>
        </>
      )}

      {screen === "public" && sel && (
        <PublicView
          m={sel}
          openViewer={(i) => setViewer({ open: true, i, source: "public" })}
          exit={() => setScreen("detail")}
        />
      )}

      {/* fullscreen viewer */}
      {viewer.open && sel && (
        <Viewer
          m={sel} i={viewer.i}
          set={(i) => setViewer((v) => ({ ...v, i }))}
          close={() => setViewer((v) => ({ ...v, open: false }))}
        />
      )}

      {/* create modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="New memory" icon={<Sparkles size={18} />}>
          <label className="lbl">Title</label>
          <input className="in" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Summer in Lisbon" autoFocus />
          <label className="lbl">Date</label>
          <div className="in in-icon"><Calendar size={16} /><input value={newDate} onChange={(e) => setNewDate(e.target.value)} /></div>
          <p className="hint"><Link2 size={13} /> A shareable public link is created automatically.</p>
          <div className="row-end">
            <button className="btn ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn primary" onClick={createMemory}>Create memory</button>
          </div>
        </Modal>
      )}

      {/* share modal */}
      {showShare && sel && (
        <Modal onClose={() => setShowShare(false)} title={`Share “${sel.title}”`} icon={<Share2 size={18} />}>
          <div className="seg-h">Public link</div>
          <div className="pub-row">
            <div className="in in-icon grow" style={{ opacity: linkActive ? 1 : 0.5 }}>
              <Link2 size={16} />
              <input readOnly value={`memories.app/m/${links[sel.id]}`} />
            </div>
            <button className="btn primary sm" onClick={copyLink} disabled={!linkActive}>
              {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="toggle-row">
            <div>
              <div className="tg-title">Link active</div>
              <div className="tg-sub">{linkActive ? "Anyone with the link can view this album." : "Link revoked — the album is private again."}</div>
            </div>
            <Toggle on={linkActive} set={setLinkActive} />
          </div>
          <button className="btn ghost full" onClick={() => { setShowShare(false); setScreen("public"); }} disabled={!linkActive}>
            <Eye size={15} /> Preview public view
          </button>

          <div className="seg-h mt">Invite people</div>
          <input className="in" placeholder="name@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <div className="invite-row">
            <select className="in sel grow" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="viewer">Can view</option>
              <option value="contributor">Can add photos</option>
            </select>
            <button className="btn primary sm" onClick={addMember}>Send invite</button>
          </div>
          <div className="members">
            {members.map((mem, k) => (
              <div className="member" key={k}>
                <div className="ava sm" style={{ background: GRADS[k % GRADS.length] }}>{mem.n[0]}</div>
                <span className="m-name">{mem.n}</span>
                <span className={"pill " + (mem.r === "contributor" ? "pill-o" : "")}>{mem.r}</span>
              </div>
            ))}
          </div>
          <div className="row-end">
            <button className="btn primary" onClick={() => { setShowShare(false); flash("Sharing updated"); }}>Done</button>
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ----------------------------- WORDMARK ---------------------------- */
function Wordmark({ size = "big" }) {
  return (
    <div className={"wordmark " + size}>
      <span className="wm-text">MEMORIES</span>
      <Camera className="wm-cam" size={size === "big" ? 34 : 18} />
    </div>
  );
}

/* ------------------------------- AUTH ------------------------------ */
function Auth({ mode, setMode, enter }) {
  return (
    <div className="auth">
      <div className="glass card auth-card">
        <Wordmark size="big" />
        <p className="tagline">Little albums for the days worth keeping.</p>
        <div className="switch">
          <button className={"sw " + (mode === "login" ? "on" : "")} onClick={() => setMode("login")}>Log in</button>
          <button className={"sw " + (mode === "register" ? "on" : "")} onClick={() => setMode("register")}>Register</button>
        </div>
        {mode === "register" && (<><label className="lbl">Name</label><input className="in" placeholder="Your name" /></>)}
        <label className="lbl">Email</label>
        <input className="in" placeholder="you@email.com" />
        <label className="lbl">Password</label>
        <div className="in in-icon"><Lock size={16} /><input type="password" placeholder="••••••••" /></div>
        <button className="btn primary full big" onClick={enter}>
          {mode === "login" ? "Log in" : "Create account"}
        </button>
        {mode === "register" && <p className="fine">We'll email a link to verify your account.</p>}
      </div>
    </div>
  );
}

/* ------------------------------ TOPBAR ----------------------------- */
function TopBar({ onLogo, onSettings, onLogout, name }) {
  return (
    <header className="glass topbar">
      <button className="logo-btn" onClick={onLogo}><Wordmark size="small" /></button>
      <div className="tb-right">
        <button className="icon-btn" onClick={onSettings} title="Settings"><SettingsIcon size={19} /></button>
        <button className="icon-btn" onClick={onLogout} title="Log out"><LogOut size={19} /></button>
        <div className="ava" style={{ background: "linear-gradient(135deg,#7c5cff,#ff8a3d)" }}>{name[0]}</div>
      </div>
    </header>
  );
}

/* ------------------------------- HOME ------------------------------ */
function Home({ tab, setTab, shown, links, open, onNew }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Your memories</h1>
          <p className="sub">Pick a day. Relive it.</p>
        </div>
        <button className="btn primary" onClick={onNew}><Plus size={17} /> New memory</button>
      </div>

      <div className="tabs">
        <button className={"tab " + (tab === "mine" ? "on" : "")} onClick={() => setTab("mine")}><Grid size={15} /> My memories</button>
        <button className={"tab " + (tab === "shared" ? "on" : "")} onClick={() => setTab("shared")}><Users size={15} /> Shared with me</button>
      </div>

      {shown.length === 0 ? (
        <div className="glass card empty">
          <ImagePlus size={30} />
          <h3>No memories here yet</h3>
          <p>Create your first album and drop in the photos from a day you want to keep.</p>
          <button className="btn primary" onClick={onNew}><Plus size={16} /> New memory</button>
        </div>
      ) : (
        <div className="grid-mem">
          {shown.map((m) => (
            <button className="glass mem-card" key={m.id} onClick={() => open(m.id)}>
              <div className="cover" style={{ background: m.photos[0]?.grad }}>
                <span className="count"><Camera size={13} /> {m.photos.length}</span>
                {!m.mine && <span className="shared-by">from {m.sharedBy}</span>}
              </div>
              <div className="mem-meta">
                <div className="mem-title">{m.title}</div>
                <div className="mem-date">({m.date})</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------ DETAIL ----------------------------- */
function Detail({ m, link, onBack, onShare, onDelete, openViewer }) {
  return (
    <>
      <button className="back" onClick={onBack}><ArrowLeft size={16} /> All memories</button>
      <div className="glass card detail-head">
        <div className="dh-cover" style={{ background: m.photos[0]?.grad }} />
        <div className="dh-info">
          <h1 className="h1">{m.title}</h1>
          <div className="dh-date"><Calendar size={15} /> {m.date} · {m.photos.length} photos</div>
          <div className="dh-actions">
            <button className="btn primary" onClick={onShare}><Share2 size={15} /> Share</button>
            <button className="btn ghost" onClick={() => openViewer(0)}><Eye size={15} /> Slideshow</button>
            {m.mine && <button className="btn danger" onClick={onDelete}><Trash2 size={15} /> Delete</button>}
          </div>
          <div className="link-chip"><Link2 size={13} /> memories.app/m/{link}</div>
        </div>
      </div>

      <div className="grid-photo">
        {m.photos.map((p, i) => (
          <button className="thumb" key={p.id} style={{ background: p.grad }} onClick={() => openViewer(i)} aria-label={`Open photo ${i + 1}`} />
        ))}
      </div>
    </>
  );
}

/* ------------------------------ VIEWER ----------------------------- */
function Viewer({ m, i, set, close }) {
  const last = m.photos.length - 1;
  return (
    <div className="viewer">
      <div className="v-top">
        <span className="v-count">{i + 1} / {m.photos.length}</span>
        <button className="v-x" onClick={close} aria-label="Close"><X size={22} /></button>
      </div>
      <div className="v-stage">
        <button className="v-nav" onClick={() => set(Math.max(0, i - 1))} disabled={i === 0} aria-label="Previous"><ChevronLeft size={26} /></button>
        <div className="v-photo" style={{ background: m.photos[i].grad }} />
        <button className="v-nav" onClick={() => set(Math.min(last, i + 1))} disabled={i === last} aria-label="Next"><ChevronRight size={26} /></button>
      </div>
      <div className="v-cap">{m.title} · ({m.date})</div>
    </div>
  );
}

/* --------------------------- PUBLIC VIEW --------------------------- */
function PublicView({ m, openViewer, exit }) {
  return (
    <main className="wrap public">
      <div className="glass guest-banner">
        <span><Eye size={15} /> You're viewing a shared memory — read only</span>
        <button className="btn ghost sm" onClick={exit}>Back to app</button>
      </div>
      <div className="pub-head"><Wordmark size="small" /></div>
      <div className="glass card detail-head">
        <div className="dh-cover" style={{ background: m.photos[0]?.grad }} />
        <div className="dh-info">
          <h1 className="h1">{m.title}</h1>
          <div className="dh-date"><Calendar size={15} /> {m.date} · {m.photos.length} photos</div>
          <div className="link-chip"><Users size={13} /> Shared album</div>
        </div>
      </div>
      <div className="grid-photo">
        {m.photos.map((p, i) => (
          <button className="thumb" key={p.id} style={{ background: p.grad }} onClick={() => openViewer(i)} aria-label={`Open photo ${i + 1}`} />
        ))}
      </div>
    </main>
  );
}

/* ----------------------------- SETTINGS ---------------------------- */
function SettingsView({ name, setName, flash }) {
  const [pw, setPw] = useState({ a: "", b: "" });
  return (
    <>
      <h1 className="h1">Settings</h1>
      <p className="sub">Manage your profile and preferences.</p>

      <div className="glass card set-card">
        <h3 className="set-h">Profile</h3>
        <label className="lbl">Display name</label>
        <input className="in" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="lbl">Email</label>
        <input className="in" value="alex@email.com" readOnly style={{ opacity: 0.6 }} />
        <div className="row-end"><button className="btn primary" onClick={() => flash("Profile saved")}>Save changes</button></div>
      </div>

      <div className="glass card set-card">
        <h3 className="set-h">Password</h3>
        <label className="lbl">Current password</label>
        <div className="in in-icon"><Lock size={15} /><input type="password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} placeholder="••••••••" /></div>
        <label className="lbl">New password</label>
        <div className="in in-icon"><Lock size={15} /><input type="password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} placeholder="••••••••" /></div>
        <div className="row-end"><button className="btn primary" onClick={() => { setPw({ a: "", b: "" }); flash("Password changed"); }}>Update password</button></div>
      </div>

      <div className="glass card set-card">
        <h3 className="set-h">Photos</h3>
        <div className="toggle-row">
          <div>
            <div className="tg-title">Image optimization</div>
            <div className="tg-sub">Always on — keeps your library fast and light.</div>
          </div>
          <Toggle on={true} disabled />
        </div>
      </div>
    </>
  );
}

/* --------------------------- SMALL PARTS --------------------------- */
function Toggle({ on, set, disabled }) {
  return (
    <button
      className={"toggle " + (on ? "on " : "") + (disabled ? "disabled" : "")}
      onClick={() => !disabled && set && set(!on)}
      aria-pressed={on} disabled={disabled}
    ><span className="knob" /></button>
  );
}

function Modal({ children, onClose, title, icon }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="glass card modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{icon}{title}</span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------- CSS ------------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap');

:root{
  --cream:#FAF5EC; --cream2:#F3EADA;
  --purple:#7A2FF2; --purple-d:#6420d6; --purple-l:#9B5CFF;
  --orange:#FF8A3D; --orange-d:#f6731f;
  --ink:#2C1A4A; --muted:#7c6c92;
  --glass:rgba(255,255,255,0.55); --glass-2:rgba(255,255,255,0.7);
  --border:rgba(255,255,255,0.72);
  --shadow:0 12px 40px rgba(108,43,217,0.14);
}
*{box-sizing:border-box}
.app{min-height:100vh;font-family:'Nunito',system-ui,sans-serif;color:var(--ink);
  background:
    radial-gradient(1200px 700px at 80% -10%, #F6ECFF 0%, transparent 55%),
    radial-gradient(900px 600px at -5% 100%, #FFEBDC 0%, transparent 55%),
    var(--cream);
  position:relative;overflow-x:hidden}
button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
input,select{font-family:inherit}

/* ambient orbs */
.orbs{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.orb{position:absolute;border-radius:50%;filter:blur(60px);opacity:.55}
.orb-p1{width:340px;height:340px;background:#a26bff;top:-60px;left:8%;animation:drift 18s ease-in-out infinite}
.orb-o1{width:300px;height:300px;background:#ffa85c;top:30%;right:-40px;animation:drift 22s ease-in-out infinite reverse}
.orb-p2{width:260px;height:260px;background:#c49bff;bottom:-40px;left:30%;animation:drift 20s ease-in-out infinite}
.orb-o2{width:220px;height:220px;background:#ff8f6b;bottom:20%;right:28%;animation:drift 26s ease-in-out infinite reverse}
@keyframes drift{0%,100%{transform:translate(0,0)}50%{transform:translate(28px,-34px)}}

/* glass */
.glass{background:var(--glass);backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%);
  border:1px solid var(--border);box-shadow:var(--shadow)}
.card{border-radius:26px}
.wrap{position:relative;z-index:1;max-width:1080px;margin:0 auto;padding:26px 22px 80px}

/* wordmark */
.wordmark{display:inline-flex;align-items:center;gap:.35em;font-family:'Fredoka',sans-serif;font-weight:700;
  color:var(--purple);letter-spacing:.01em;line-height:1}
.wordmark.big .wm-text{font-size:52px}
.wordmark.small .wm-text{font-size:24px}
.wm-cam{color:var(--orange);transform:rotate(-8deg)}

/* auth */
.auth{position:relative;z-index:1;min-height:100vh;display:grid;place-items:center;padding:24px}
.auth-card{width:100%;max-width:420px;padding:38px 34px;text-align:center}
.tagline{margin:6px 0 22px;color:var(--muted);font-weight:600}
.switch{display:flex;gap:6px;background:rgba(122,47,242,.08);padding:5px;border-radius:14px;margin-bottom:18px}
.sw{flex:1;padding:9px;border-radius:10px;font-weight:700;color:var(--muted)}
.sw.on{background:#fff;color:var(--purple);box-shadow:0 4px 14px rgba(122,47,242,.15)}
.fine{margin-top:12px;font-size:12.5px;color:var(--muted)}

/* inputs */
.lbl{display:block;text-align:left;font-size:12.5px;font-weight:700;color:var(--muted);margin:12px 0 6px}
.in{width:100%;background:rgba(255,255,255,.72);border:1px solid rgba(122,47,242,.14);border-radius:13px;
  padding:12px 14px;font-size:14.5px;color:var(--ink);outline:none;transition:border .15s, box-shadow .15s}
.in:focus,.in:focus-within{border-color:var(--purple-l);box-shadow:0 0 0 3px rgba(122,47,242,.13)}
.in::placeholder{color:#b3a8c4}
.in-icon{display:flex;align-items:center;gap:9px;color:var(--purple)}
.in-icon input{border:none;background:none;outline:none;flex:1;min-width:0;font-size:14.5px;color:var(--ink);text-overflow:ellipsis}
.in-icon input:read-only{color:var(--muted);cursor:default}
.sel{padding:12px 36px 12px 13px;appearance:none;-webkit-appearance:none;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237A2FF2' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 13px center}
.grow{flex:1;min-width:0}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-weight:700;font-size:14px;
  padding:11px 18px;border-radius:13px;transition:transform .12s, box-shadow .15s, background .15s}
.btn:active{transform:translateY(1px)}
.btn.primary{background:linear-gradient(135deg,var(--purple),var(--purple-d));color:#fff;box-shadow:0 8px 20px rgba(122,47,242,.32)}
.btn.primary:hover{box-shadow:0 10px 26px rgba(122,47,242,.42)}
.btn.primary:disabled{opacity:.45;box-shadow:none;cursor:not-allowed}
.btn.ghost{background:rgba(255,255,255,.6);border:1px solid var(--border);color:var(--purple)}
.btn.ghost:hover{background:#fff}
.btn.danger{background:rgba(255,138,61,.14);color:var(--orange-d)}
.btn.danger:hover{background:rgba(255,138,61,.22)}
.btn.full{width:100%}
.btn.big{padding:14px;font-size:15px;margin-top:8px}
.btn.sm{padding:9px 13px;font-size:13px}

/* topbar */
.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;
  padding:12px 22px;border-radius:0 0 22px 22px;border-top:none}
.logo-btn{border-radius:12px}
.tb-right{display:flex;align-items:center;gap:10px}
.icon-btn{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:var(--purple);
  background:rgba(255,255,255,.5);border:1px solid var(--border);transition:background .15s}
.icon-btn:hover{background:#fff}
.ava{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-family:'Fredoka';font-size:16px}
.ava.sm{width:30px;height:30px;font-size:13px}

/* page head */
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:8px 2px 18px}
.h1{font-family:'Fredoka';font-weight:700;font-size:30px;color:var(--ink);margin:0}
.sub{color:var(--muted);font-weight:600;margin:3px 0 0}
.tabs{display:flex;gap:8px;margin-bottom:20px}
.tab{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:12px;font-weight:700;font-size:13.5px;
  color:var(--muted);background:rgba(255,255,255,.45);border:1px solid var(--border)}
.tab.on{color:var(--purple);background:#fff;box-shadow:0 6px 16px rgba(122,47,242,.14)}

/* memory grid */
.grid-mem{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}
.mem-card{padding:0;overflow:hidden;text-align:left;border-radius:22px;transition:transform .16s, box-shadow .16s}
.mem-card:hover{transform:translateY(-4px);box-shadow:0 18px 44px rgba(108,43,217,.22)}
.cover{position:relative;aspect-ratio:4/3;display:flex;align-items:flex-start;justify-content:space-between;padding:11px}
.count{display:inline-flex;align-items:center;gap:5px;background:rgba(0,0,0,.28);color:#fff;font-weight:700;font-size:12px;
  padding:4px 9px;border-radius:20px;backdrop-filter:blur(6px)}
.shared-by{background:rgba(255,255,255,.85);color:var(--purple-d);font-weight:700;font-size:11.5px;padding:4px 9px;border-radius:20px}
.mem-meta{padding:12px 14px 14px;background:rgba(255,255,255,.35)}
.mem-title{font-family:'Fredoka';font-weight:600;font-size:17px;color:var(--ink)}
.mem-date{color:var(--orange-d);font-weight:700;font-size:13px}

/* empty */
.empty{padding:46px 30px;text-align:center;color:var(--muted);display:grid;justify-items:center;gap:8px}
.empty svg{color:var(--purple-l)}
.empty h3{font-family:'Fredoka';color:var(--ink);margin:4px 0 0;font-size:19px}
.empty p{max-width:340px;font-weight:600}
.empty .btn{margin-top:8px}

/* detail */
.back{display:inline-flex;align-items:center;gap:6px;color:var(--purple);font-weight:700;font-size:14px;margin:2px 2px 14px}
.detail-head{display:flex;gap:20px;padding:18px;margin-bottom:22px}
.dh-cover{width:190px;flex:none;border-radius:18px;aspect-ratio:1}
.dh-info{display:flex;flex-direction:column;gap:8px;padding-top:4px}
.dh-date{display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-weight:700;font-size:14px}
.dh-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:6px}
.link-chip{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;margin-top:6px;
  background:rgba(122,47,242,.09);color:var(--purple-d);font-weight:700;font-size:12.5px;padding:6px 11px;border-radius:20px}

/* photo grid */
.grid-photo{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
.thumb{aspect-ratio:1;border-radius:16px;transition:transform .14s, box-shadow .14s;box-shadow:0 6px 16px rgba(108,43,217,.1)}
.thumb:hover{transform:scale(1.035);box-shadow:0 12px 26px rgba(108,43,217,.24)}

/* viewer */
.viewer{position:fixed;inset:0;z-index:60;background:rgba(30,16,54,.72);backdrop-filter:blur(16px);
  display:flex;flex-direction:column;animation:fade .2s ease}
@keyframes fade{from{opacity:0}to{opacity:1}}
.v-top{display:flex;align-items:center;justify-content:space-between;padding:16px 20px}
.v-count{color:#fff;font-weight:800;font-family:'Fredoka';letter-spacing:.04em}
.v-x{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:#fff;background:rgba(255,255,255,.14)}
.v-x:hover{background:rgba(255,255,255,.26)}
.v-stage{flex:1;display:flex;align-items:center;justify-content:center;gap:16px;padding:0 16px 8px;min-height:0}
.v-photo{width:min(78vw,760px);height:min(72vh,760px);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.4)}
.v-nav{width:52px;height:52px;flex:none;border-radius:50%;display:grid;place-items:center;color:#fff;background:rgba(255,255,255,.16)}
.v-nav:hover:not(:disabled){background:rgba(255,255,255,.3)}
.v-nav:disabled{opacity:.28;cursor:not-allowed}
.v-cap{text-align:center;color:rgba(255,255,255,.9);font-weight:700;padding:6px 0 22px}

/* public */
.public{max-width:1080px}
.guest-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:18px;padding:12px 16px;
  margin-bottom:16px;font-weight:700;color:var(--purple-d)}
.guest-banner span{display:inline-flex;align-items:center;gap:8px}
.pub-head{margin:2px 2px 16px}

/* settings */
.set-card{padding:22px;margin-top:16px}
.set-h{font-family:'Fredoka';font-size:18px;margin:0 0 6px;color:var(--ink)}

/* toggle */
.toggle{width:50px;height:29px;border-radius:20px;background:#d9cfe6;position:relative;transition:background .18s;flex:none}
.toggle.on{background:linear-gradient(135deg,var(--purple),var(--orange))}
.toggle.disabled{opacity:.9;cursor:default}
.knob{position:absolute;top:3px;left:3px;width:23px;height:23px;border-radius:50%;background:#fff;transition:transform .18s;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.toggle.on .knob{transform:translateX(21px)}
.toggle-row{display:flex;align-items:center;justify-content:space-between;gap:14px;
  background:rgba(255,255,255,.5);border:1px solid var(--border);border-radius:16px;padding:14px 16px}
.tg-title{font-weight:800}
.tg-sub{font-size:12.5px;color:var(--muted);font-weight:600;margin-top:2px}

/* modal */
.overlay{position:fixed;inset:0;z-index:50;background:rgba(44,26,74,.32);backdrop-filter:blur(6px);
  display:grid;place-items:center;padding:20px;animation:fade .18s ease}
.modal{width:100%;max-width:440px;padding:22px 22px 20px;max-height:88vh;overflow:auto}
.modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.modal-title{display:inline-flex;align-items:center;gap:9px;font-family:'Fredoka';font-size:19px;color:var(--ink)}
.modal-title svg{color:var(--purple)}
.hint{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);font-weight:600;margin:12px 0 4px}
.row-end{display:flex;justify-content:flex-end;gap:9px;margin-top:16px}
.seg-h{font-weight:800;font-size:13px;color:var(--purple);text-transform:uppercase;letter-spacing:.05em;margin-bottom:9px}
.seg-h.mt{margin-top:20px}
.pub-row{display:flex;gap:8px;align-items:stretch}
.pub-row .in{padding:10px 12px;min-width:0}
.pub-row .btn{white-space:nowrap}
.invite-row{display:flex;gap:8px;align-items:stretch;margin-top:8px}
.invite-row .btn{white-space:nowrap}
.full{width:100%;margin-top:12px}
.members{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.member{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.5);border:1px solid var(--border);border-radius:13px;padding:8px 11px}
.m-name{flex:1;font-weight:700;font-size:14px}
.pill{font-size:11.5px;font-weight:800;text-transform:capitalize;color:var(--purple-d);background:rgba(122,47,242,.12);padding:4px 10px;border-radius:20px}
.pill-o{color:var(--orange-d);background:rgba(255,138,61,.16)}

/* toast */
.toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:70;
  background:linear-gradient(135deg,var(--purple),var(--purple-d));color:#fff;font-weight:700;font-size:14px;
  padding:12px 20px;border-radius:14px;box-shadow:0 14px 34px rgba(122,47,242,.4);animation:up .25s ease}
@keyframes up{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}

:focus-visible{outline:3px solid rgba(122,47,242,.4);outline-offset:2px;border-radius:8px}

@media (max-width:640px){
  .wordmark.big .wm-text{font-size:42px}
  .page-head{flex-direction:column;align-items:stretch}
  .detail-head{flex-direction:column}
  .dh-cover{width:100%;aspect-ratio:16/9}
  .grid-photo{grid-template-columns:repeat(auto-fill,minmax(104px,1fr))}
}
@media (prefers-reduced-motion:reduce){.orb{animation:none}}
`;
