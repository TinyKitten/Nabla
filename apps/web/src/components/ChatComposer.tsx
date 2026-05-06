import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

interface VoiceOverlayProps {
  onCommit: (text: string) => void;
  onCancel: () => void;
}

const fmtSeconds = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

function VoiceOverlay({ onCommit, onCancel }: VoiceOverlayProps) {
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const phrases = useRef<string[]>([
    'TrainLCD ',
    'TrainLCD の今週の ',
    'TrainLCD の今週のレビュー ',
    'TrainLCD の今週のレビューを要約して',
  ]);
  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    let i = 0;
    const interval = window.setInterval(() => {
      if (i < phrases.current.length) {
        setTranscript(phrases.current[i]);
        i++;
      }
    }, 700);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 'auto 0 calc(100% + 10px) 0',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line-strong)',
        borderRadius: 16,
        padding: '14px 16px',
        boxShadow: '0 12px 28px rgba(0,0,0,0.10)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: 2.5,
              borderRadius: 2,
              background: 'var(--accent)',
              animation: `voice-bar 0.9s ease-in-out ${i * 0.05}s infinite alternate`,
              height: 8 + ((i * 7) % 18),
            }}
          />
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="jp-text"
          style={{
            fontSize: 14,
            color: 'var(--ink-2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minHeight: 20,
          }}
        >
          {transcript || <span style={{ color: 'var(--ink-4)' }}>聞き取り中…</span>}
          <span className="caret-blink" />
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 2,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#e63946',
              animation: 'pulse 1.2s ease-in-out infinite',
            }}
          />
          録音中 · {fmtSeconds(seconds)}
        </div>
      </div>
      <button className="btn-icon" title="キャンセル" onClick={onCancel}>
        <Icon name="x" size={15} />
      </button>
      <button
        onClick={() => onCommit(transcript)}
        disabled={!transcript}
        style={{
          background: transcript ? 'var(--accent)' : 'var(--bg-hover)',
          color: transcript ? '#fff' : 'var(--ink-4)',
          border: 'none',
          borderRadius: 12,
          padding: '8px 14px',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: transcript ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
        }}
      >
        送信
      </button>
    </div>
  );
}

interface ChatComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
}

export function ChatComposer({ value, onChange, onSend, onStop, streaming }: ChatComposerProps) {
  const [recording, setRecording] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      {recording && (
        <VoiceOverlay
          onCancel={() => setRecording(false)}
          onCommit={(text) => {
            setRecording(false);
            onChange(text);
            setTimeout(() => onSend(), 0);
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px 6px 16px',
          background: 'var(--bg-elev)',
          border: '1px solid var(--line-strong)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <input
          className="input-bare jp-text"
          placeholder="Nabla に何でも聞いてください…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSend();
            }
          }}
          style={{ flex: 1, padding: '12px 0', fontSize: 14 }}
        />
        <button className="btn-icon">
          <Icon name="attach" size={15} />
        </button>
        <button
          className="btn-icon"
          onClick={() => setRecording((r) => !r)}
          title={recording ? '録音を停止' : '音声入力'}
          style={recording ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
        >
          <Icon name="mic" size={15} />
        </button>
        {streaming ? (
          <button className="btn-send" onClick={onStop} style={{ background: 'var(--ink-2)' }}>
            <Icon name="stop" size={13} stroke={0} />
          </button>
        ) : (
          <button className="btn-send" onClick={onSend} disabled={!value.trim()}>
            <Icon name="arrow-up" size={15} stroke={2} />
          </button>
        )}
      </div>
    </div>
  );
}
