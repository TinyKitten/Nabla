import { useEffect } from 'react';
import { ChatLayout } from './components/ChatLayout';
import {
  TweaksPanel,
  TweakSection,
  TweakRadio,
  TweakColor,
  useTweaks,
} from './components/TweaksPanel';

const TWEAK_DEFAULTS = {
  theme: 'light' as 'light' | 'dark',
  accent: '#008ffe',
};

export default function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
    document.documentElement.style.setProperty('--accent', tweaks.accent);
  }, [tweaks.theme, tweaks.accent]);

  return (
    <>
      <div
        className="artboard-chat"
        data-screen-label="Chat"
        style={{ width: '100vw', height: '100vh' }}
      >
        <ChatLayout />
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="テーマ">
          <TweakRadio
            label="モード"
            value={tweaks.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <TweakColor
            label="アクセント"
            value={tweaks.accent}
            onChange={(v) => setTweak('accent', v)}
            options={['#008ffe', '#0a66c2', '#5b6cff', '#1a1a1a']}
          />
        </TweakSection>
        <TweakSection title="ヒント">
          <div
            className="jp-text"
            style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}
          >
            チャットで「天気」「ストア評価」「レビュー」「パフォーマンス」などと聞くと、
            ツール呼び出し → ストリーミング応答 → ウィジェット表示の流れを体験できます。
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}
