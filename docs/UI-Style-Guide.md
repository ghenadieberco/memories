# Memories — UI Style Guide

| | |
|---|---|
| **Product** | Memories |
| **Derived from** | `memories-prototype.jsx` |
| **Version** | 1.0 |
| **Date** | 9 August 2026 |

The look is **playful glassmorphism**: a warm creamy canvas, soft purple-and-orange light drifting behind frosted-white panels, and a bold rounded wordmark. Purple is the identity; orange is the accent that highlights, never the lead. Keep one bold thing per screen (usually the wordmark or a cover) and let everything else stay quiet.

---

## 1. Brand identity

- **Wordmark:** `MEMORIES`, set in a bold rounded display face, in **bright purple**, paired with a small orange camera glyph tilted ~-8°.
- **Personality:** warm, personal, unfussy. Little albums for days worth keeping.
- **Signature element:** frosted-glass panels floating over ambient purple/orange light-orbs on a cream base. This is the one memorable device — don't dilute it with additional heavy effects.

---

## 2. Color

Design tokens (CSS custom properties, copy verbatim):

```css
:root{
  --cream:#FAF5EC;   --cream2:#F3EADA;         /* canvas */
  --purple:#7A2FF2;  --purple-d:#6420D6;  --purple-l:#9B5CFF;   /* identity */
  --orange:#FF8A3D;  --orange-d:#F6731F;        /* accent */
  --ink:#2C1A4A;     --muted:#7C6C92;           /* text */
  --glass:rgba(255,255,255,0.55);  --glass-2:rgba(255,255,255,0.70);
  --border:rgba(255,255,255,0.72);
  --shadow:0 12px 40px rgba(108,43,217,0.14);
}
```

| Token | Hex / value | Role |
|---|---|---|
| `--cream` | `#FAF5EC` | Page background base |
| `--purple` | `#7A2FF2` | Primary brand, wordmark, primary buttons, active states |
| `--purple-d` | `#6420D6` | Gradient end for primary fills, hover depth |
| `--purple-l` | `#9B5CFF` | Focus glow, soft accents, empty-state icons |
| `--orange` | `#FF8A3D` | Accent — dates, camera glyph, toggle gradient end |
| `--orange-d` | `#F6731F` | Orange text/emphasis on light surfaces |
| `--ink` | `#2C1A4A` | Headings and primary text |
| `--muted` | `#7C6C92` | Secondary text, labels, captions |

**Usage rules**
- Purple leads; orange accents. Never let orange cover more area than purple on a screen.
- Body text is `--ink` on light glass; secondary text is `--muted`.
- Reserve the **purple→orange gradient** for one thing only: the "on" toggle and the avatar. Don't spread it across buttons.
- Primary action fill is the **purple→purple-d** gradient, not the purple→orange one.

**Canvas background** (ambient wash used app-wide):
```css
background:
  radial-gradient(1200px 700px at 80% -10%, #F6ECFF 0%, transparent 55%),
  radial-gradient(900px 600px at -5% 100%, #FFEBDC 0%, transparent 55%),
  var(--cream);
```

---

## 3. Typography

Two families, loaded from Google Fonts:

```css
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap');
```

| Role | Family | Weights | Used for |
|---|---|---|---|
| **Display** | `Fredoka` | 600 / 700 | Wordmark, `h1`, card titles, modal titles, avatars, viewer counter |
| **Body / UI** | `Nunito` | 400 / 600 / 700 / 800 | Everything else — labels, buttons, body, captions |

Fallback stack: `'Nunito', system-ui, sans-serif` for body; `'Fredoka', sans-serif` for display.

**Type scale (from the prototype)**

| Element | Size | Weight | Family | Color |
|---|---|---|---|---|
| Wordmark (hero) | 52px | 700 | Fredoka | `--purple` |
| Wordmark (nav) | 24px | 700 | Fredoka | `--purple` |
| Page title `h1` | 30px | 700 | Fredoka | `--ink` |
| Card / memory title | 17px | 600 | Fredoka | `--ink` |
| Modal title | 19px | 600 | Fredoka | `--ink` |
| Body / inputs | 14–14.5px | 400–600 | Nunito | `--ink` |
| Buttons | 14px | 700 | Nunito | — |
| Label (`.lbl`) | 12.5px | 700 | Nunito | `--muted` |
| Caption / sub | 12.5–13px | 600 | Nunito | `--muted` |
| Section eyebrow (`.seg-h`) | 13px | 800, uppercase, `.05em` | Nunito | `--purple` |

Dates render in orange (`--orange-d`, 700) as a deliberate accent, e.g. `(14 Jul 2026)`.

---

## 4. Glassmorphism surfaces

The core recipe — every panel, bar, card, and modal uses it:

```css
.glass{
  background: var(--glass);                    /* rgba(255,255,255,0.55) */
  backdrop-filter: blur(22px) saturate(150%);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
  border: 1px solid var(--border);             /* rgba(255,255,255,0.72) */
  box-shadow: var(--shadow);                   /* purple-tinted soft shadow */
}
```

Rules:
- Glass only reads as glass when **colorful light sits behind it** — always keep the ambient orbs (Section 8) or a gradient beneath glass panels.
- Panel corner radius is large: **26px** for cards/modals, **22px** for bars and memory cards.
- Shadows are **purple-tinted**, never neutral grey: `rgba(108,43,217,0.14)` resting, deeper on hover.

---

## 5. Spacing, radius & elevation

**Radius scale**

| Token (px) | Applied to |
|---|---|
| 10–13 | Buttons, inputs, small controls, icon buttons |
| 16 | Photo thumbnails |
| 18–22 | Covers, detail cover, tabs |
| 22–26 | Glass cards, memory cards, modals |
| 50% | Avatars, viewer nav circles |

**Spacing:** an 8px rhythm. Common gaps: control gap `8px`, grid gap `12–18px`, section padding `18–22px`, page padding `26px 22px`.

**Elevation:** rest `0 12px 40px rgba(108,43,217,.14)`; primary button `0 8px 20px rgba(122,47,242,.32)`; hover lifts translate `-4px` and deepen the shadow.

---

## 6. Components

### Buttons
| Variant | Fill | Text | Notes |
|---|---|---|---|
| `.btn.primary` | linear-gradient(135°, `--purple` → `--purple-d`) | white | Default action; purple shadow; hover deepens shadow |
| `.btn.ghost` | glass (white .6 + border) | `--purple` | Secondary; hover → solid white |
| `.btn.danger` | `rgba(255,138,61,.14)` | `--orange-d` | Destructive (delete) |
| Sizes | `.sm` (9×13px) · default (11×18px) · `.big` (14px) | | radius 13px, weight 700, active nudges down 1px |

Icons sit left of the label at 15px, gap 7px. Disabled: opacity .45, no shadow, `not-allowed`.

### Inputs & select
- Field: `background rgba(255,255,255,.72)`, `1px` border `rgba(122,47,242,.14)`, radius 13px, 12–14px padding.
- Focus: border `--purple-l` + `0 0 0 3px rgba(122,47,242,.13)` glow.
- Placeholder: `#B3A8C4`.
- Icon inputs (`.in-icon`): purple leading icon, input flexes with `min-width:0` so long values (URLs) truncate rather than overflow.
- **Select:** native chrome removed (`appearance:none`) with a custom purple chevron so it matches the glass inputs. Never leave a raw OS-styled `<select>`.

### Toggle
- Track 50×29px, radius 20px; off `#D9CFE6`, **on = purple→orange gradient**; white knob (23px) slides 21px. Disabled toggles (e.g. the always-on image-optimization setting) keep the on look at full opacity with `cursor:default`.

### Pills / badges
- Default pill: `rgba(122,47,242,.12)` bg, `--purple-d` text.
- Orange pill (`.pill-o`): `rgba(255,138,61,.16)` bg, `--orange-d` text — used for the "contributor" role.
- Photo-count chip: translucent dark `rgba(0,0,0,.28)` + blur over covers.

### Tabs
- Glass pill row; inactive `--muted` on faint white; active = solid white, `--purple` text, soft purple shadow.

### Cards
- **Memory card:** glass, radius 22px, cover with 4:3 aspect gradient + count chip; meta strip below (`Title` in Fredoka, `(Date)` in orange). Hover lifts `-4px`.
- **Glass card:** general container for auth, detail header, settings, modals.

### Modal
- Overlay: `rgba(44,26,74,.32)` + `blur(6px)`, centered, fades in.
- Panel: glass card, max-width 440px, radius 26px, `max-height:88vh; overflow:auto`.
- Header: Fredoka title with a purple leading icon + a glass icon-button close.
- Multi-control rows stack on narrow widths (email on its own line; role select + action beneath) rather than cramming three controls across.

### Toast
- Bottom-center, purple→purple-d gradient, white 700 text, radius 14px, rises in and auto-dismisses (~1.8s).

### Avatar
- Circle, gradient fill (purple→orange), white Fredoka initial. Sizes 40px (nav) / 30px (lists).

### Thumbnails & viewer
- Thumbnail: 1:1, radius 16px, soft purple shadow; hover scales to 1.035.
- Fullscreen viewer: dark glass scrim `rgba(30,16,54,.72)` + `blur(16px)`; large image up to `min(78vw,760px)`; circular translucent prev/next controls that **disable (opacity .28) at the ends** — no wraparound; white counter in Fredoka.

---

## 7. Iconography

- **lucide-react**, stroke ~2, sizes 13–22px depending on context.
- Icons inherit the local text color: purple on controls, orange only for the camera glyph and accents, white on dark/colored fills.

---

## 8. Motion

- **Ambient orbs:** four blurred radial circles (purple + orange) drifting on 18–26s ease-in-out loops behind the glass. This is the atmosphere that makes the blur meaningful — keep it, keep it slow.
- **Transitions:** 0.12–0.18s on hover/press for lifts, shadows, and background shifts.
- **Entrances:** overlays fade (.18–.2s); toast rises 10px.
- **Restraint:** motion is subtle and purposeful. Don't animate everything — scattered effects read as generated.
- **Reduced motion:** `@media (prefers-reduced-motion:reduce)` disables the orb drift. Honor it.

---

## 9. Accessibility & responsive

- **Focus:** visible ring on every interactive element — `outline:3px solid rgba(122,47,242,.4); outline-offset:2px`.
- **Keyboard:** the fullscreen viewer responds to arrow keys and Esc; all actions are real `<button>`s.
- **Contrast:** body text uses `--ink` (not `--muted`) on glass; avoid placing `--muted` text on the lightest fills for essential content.
- **Responsive:** single breakpoint at `640px` — the wordmark shrinks, page/detail headers stack, the detail cover goes full-width, and the photo grid tightens to ~104px cells. Grids use `auto-fill / minmax` so they reflow without fixed columns.

---

## 10. Voice & copy

- **Active voice, sentence case, plain verbs.** "Send invite," "Create memory," "Update password" — not "Submit."
- **An action keeps its name through the flow:** the button that says "Create memory" leads to a toast that says "Memory created."
- **Name things by what people control,** not the system underneath: "Can view" / "Can add photos" for share roles, not "viewer/contributor DB enum."
- **Empty states invite action** ("Create your first album and drop in the photos from a day you want to keep"), and errors give direction rather than apologize.
- Keep microcopy short and specific; let each label do exactly one job.

---

## 11. Do / don't

- **Do** keep one bold element per screen (wordmark or a cover) and quiet everything around it.
- **Do** keep colorful light behind every glass panel.
- **Do** use orange sparingly — dates, the camera glyph, the active toggle, the contributor pill.
- **Don't** use the purple→orange gradient on primary buttons (that gradient is reserved for the toggle/avatar).
- **Don't** ship raw native selects or let long strings overflow a panel — truncate with `min-width:0`.
- **Don't** stack multiple heavy effects; the glass + orbs are the signature, everything else stays disciplined.

---

*End of style guide.*
