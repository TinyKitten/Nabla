import { useCallback, useEffect, useRef, useState } from 'react';

const TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}
  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2}
  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.15)}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
  .twk-toggle-btn{position:fixed;right:16px;bottom:16px;z-index:2147483645;
    background:rgba(20,20,22,.86);color:#fff;border:0;border-radius:999px;
    padding:8px 14px;font:600 11px/1.2 ui-sans-serif,system-ui,sans-serif;
    cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 4px 14px rgba(0,0,0,.18)}
  .twk-toggle-btn:hover{background:rgba(20,20,22,.96)}
`;

export function useTweaks(defaults) {
  const [values, setValues] = useState(defaults);
  const setTweak = useCallback((keyOrEdits, val) => {
    const edits =
      typeof keyOrEdits === 'object' && keyOrEdits !== null
        ? keyOrEdits
        : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
  }, []);
  return [values, setTweak];
}

export function TweaksPanel({ title = 'Tweaks', children }) {
  const [open, setOpen] = useState(false);
  const dragRef = useRef(null);
  const offsetRef = useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [open, clampToViewport]);

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <>
      <style>{TWEAKS_STYLE}</style>
      {!open && (
        <button className="twk-toggle-btn" onClick={() => setOpen(true)}>
          Tweaks
        </button>
      )}
      {open && (
        <div
          ref={dragRef}
          className="twk-panel"
          style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}
        >
          <div className="twk-hd" onMouseDown={onDragStart}>
            <b>{title}</b>
            <button
              className="twk-x"
              aria-label="Close"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="twk-body">{children}</div>
        </div>
      )}
    </>
  );
}

export function TweakSection({ title, children }) {
  return (
    <>
      <div className="twk-sect">{title}</div>
      {children}
    </>
  );
}

function TweakRow({ label, children }) {
  return (
    <div className="twk-row">
      <div className="twk-lbl">
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

export function TweakRadio({ label, value, options, onChange }) {
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;
  return (
    <TweakRow label={label}>
      <div role="radiogroup" className="twk-seg">
        <div
          className="twk-seg-thumb"
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`,
          }}
        />
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function isLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

function Check({ light }) {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3 7.2 5.8 10 11 4.2"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={light ? 'rgba(0,0,0,.78)' : '#fff'}
      />
    </svg>
  );
}

export function TweakColor({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              className="twk-chip"
              role="radio"
              aria-checked={on}
              data-on={on ? '1' : '0'}
              aria-label={o}
              title={o}
              style={{ background: o }}
              onClick={() => onChange(o)}
            >
              {on && <Check light={isLight(o)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}
