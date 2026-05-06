import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Icon } from './Icon';
import { fetchWeather } from '../data/weather';
import type {
  DragHandleProps,
  FeedbackData,
  HourlyForecast,
  PerformanceData,
  StoreRatingData,
  TasksData,
  WeatherData,
  WidgetData,
  WidgetItem,
  WidgetSize,
  WidgetType,
} from '../types';

interface WidgetDef {
  title: string;
  icon: string;
  fetch: () => Promise<WidgetData>;
}

export const WIDGET_DEFS: Record<WidgetType, WidgetDef> = {
  weather: {
    title: '天気',
    icon: 'cloud-sun',
    fetch: fetchWeather,
  },
  storeRating: {
    title: 'TrainLCD · ストア評価',
    icon: 'star-line',
    fetch: async (): Promise<StoreRatingData> => ({
      stars: 4.7,
      reviews: 1284 + Math.floor(Math.random() * 5),
      delta: '+12 今週',
      trend: [4.5, 4.5, 4.6, 4.6, 4.6, 4.7, 4.7],
      breakdown: [62, 21, 10, 4, 3],
      ranking: 14,
      country: 'JP',
    }),
  },
  feedback: {
    title: 'TrainLCD · 新着フィードバック',
    icon: 'message-dots',
    fetch: async (): Promise<FeedbackData> => ({
      items: [
        { stars: 5, text: '通勤で毎日使ってます。乗換案内よりこっちが好き。', author: 'たけし', when: '2時間前' },
        { stars: 4, text: '中央線の英語表示お願いします', author: 'A. Chen', when: '5時間前' },
        { stars: 5, text: 'デザインが綺麗で見やすい!', author: 'みーゆ', when: '今日' },
      ],
      unread: 3,
    }),
  },
  performance: {
    title: 'TrainLCD · パフォーマンス',
    icon: 'activity',
    fetch: async (): Promise<PerformanceData> => ({
      crashFree: 99.84,
      delta: '+0.05%',
      coldStart: 1.21,
      sparkline: [99.6, 99.7, 99.7, 99.75, 99.78, 99.8, 99.84],
      sessions: 28430,
      anr: 0.12,
    }),
  },
  tasks: {
    title: '今日のタスク',
    icon: 'check-square',
    fetch: async (): Promise<TasksData> => ({
      items: [
        { id: 't1', text: 'TrainLCD v3.4 のリリースノート作成', done: false },
        { id: 't2', text: 'デザインレビュー @ 15:00', done: false },
        { id: 't3', text: '請求書の確認', done: true },
        { id: 't4', text: 'ストア返信を3件返す', done: false },
      ],
    }),
  },
};

interface SparklineProps {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
  fill?: boolean;
}

export function Sparkline({
  values,
  color = 'currentColor',
  height = 28,
  width = 200,
  fill = false,
}: SparklineProps) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = 4;
  const w = width;
  const h = height;
  const pts: [number, number][] = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = padY + (1 - (v - min) / range) * (h - padY * 2);
    return [x, y];
  });
  const linePath = pts
    .map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1))
    .join(' ');
  const areaPath = linePath + ` L ${w} ${h} L 0 ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
    >
      {fill && <path d={areaPath} fill={color} opacity="0.14" />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}

export function useWidget(type: WidgetType, intervalSec: number) {
  const [data, setData] = useState<WidgetData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const def = WIDGET_DEFS[type];
    if (!def) return;
    try {
      const d = await def.fetch();
      setData(d);
      setLastRefresh(new Date());
    } catch (err) {
      console.warn(`[widget:${type}] fetch failed`, err);
    }
  }, [type]);

  useEffect(() => {
    refresh();
    if (!intervalSec) return undefined;
    const id = window.setInterval(refresh, intervalSec * 1000);
    return () => window.clearInterval(id);
  }, [refresh, intervalSec]);

  return { data, lastRefresh, refresh };
}

interface MenuItemProps {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, onClick, danger }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="jp-text"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '7px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'left',
        color: danger ? '#e63946' : 'var(--ink-2)',
        fontSize: 12.5,
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}

interface WidgetShellProps {
  size: WidgetSize;
  title: string;
  icon?: string;
  accent?: string;
  children: ReactNode;
  onOpen?: () => void;
  onRemove?: () => void;
  onRefresh?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  isPinned?: boolean;
  lastRefresh?: Date | null;
  dragHandleProps?: DragHandleProps;
}

export function WidgetShell({
  size,
  title,
  icon,
  accent,
  children,
  onOpen,
  onRemove,
  onRefresh,
  onPin,
  isPinned,
  lastRefresh,
  dragHandleProps,
}: WidgetShellProps) {
  const [hovered, setHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuId = useRef(Math.random().toString(36).slice(2));
  useEffect(() => {
    if (!showMenu) return undefined;
    const onOther = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce.detail !== menuId.current) setShowMenu(false);
    };
    window.addEventListener('widget-menu-open', onOther);
    return () => window.removeEventListener('widget-menu-open', onOther);
  }, [showMenu]);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    if (!showMenu) {
      setMenuPos(null);
      return undefined;
    }
    const update = () => {
      const btn = moreBtnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const menuW = 140;
      let left = r.right - menuW;
      if (left < 8) left = 8;
      if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
      setMenuPos({ top: r.bottom + 4, left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showMenu]);
  useEffect(() => {
    if (!showMenu) return undefined;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-widget-control]')) return;
      setShowMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  const w = size === 'lg' ? 280 : size === 'md' ? 280 : 132;
  const h = size === 'lg' ? 352 : size === 'md' ? 168 : 132;

  const refreshLabel = lastRefresh
    ? (() => {
        const s = Math.round((Date.now() - lastRefresh.getTime()) / 1000);
        if (s < 60) return `${s}秒前`;
        if (s < 3600) return `${Math.round(s / 60)}分前`;
        return `${Math.round(s / 3600)}時間前`;
      })()
    : '…';

  const wholeWidgetDrag = dragHandleProps
    ? {
        draggable: dragHandleProps.draggable,
        onDragStart: dragHandleProps.onDragStart,
        onDragEnd: dragHandleProps.onDragEnd,
        onMouseDown: dragHandleProps.onMouseDown,
      }
    : {};

  return (
    <div
      {...wholeWidgetDrag}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: w,
        ...(size === 'sm' ? { height: h } : null),
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: 14,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        cursor: hovered ? 'grab' : onOpen ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s',
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('[data-widget-control]')) return;
        if (onOpen) onOpen();
      }}
    >
      {dragHandleProps && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 22,
            height: 3,
            borderRadius: 2,
            background: 'var(--ink-5)',
            opacity: hovered ? 0.5 : 0,
            transition: 'opacity 0.12s',
            pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, minHeight: 14 }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 6,
            minWidth: 0,
            paddingRight: 24,
          }}
        >
          {icon && (
            <span
              style={{
                color: accent || 'var(--ink-3)',
                display: 'inline-flex',
                alignItems: 'center',
                opacity: 0.85,
                flexShrink: 0,
              }}
            >
              <Icon name={icon} size={size === 'sm' ? 11 : 12} stroke={1.8} />
            </span>
          )}
          <span
            className="jp-text"
            style={{
              fontSize: size === 'sm' ? 10 : 11,
              color: accent || 'var(--ink-3)',
              fontWeight: 600,
              letterSpacing: '0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {title}
          </span>
        </div>
        <button
          data-widget-control
          className="btn-icon"
          ref={moreBtnRef}
          onClick={(e) => {
            e.stopPropagation();
            const next = !showMenu;
            setShowMenu(next);
            if (next)
              window.dispatchEvent(
                new CustomEvent('widget-menu-open', { detail: menuId.current }),
              );
          }}
          style={{
            width: 22,
            height: 22,
            opacity: 1,
            transition: 'background 0.12s',
            position: 'absolute',
            top: 8,
            right: 8,
            background: hovered || showMenu ? 'var(--bg-elev)' : 'transparent',
            color: hovered || showMenu ? 'var(--ink-2)' : 'var(--ink-4)',
          }}
        >
          <Icon name="more" size={12} />
        </button>
        {showMenu && menuPos && (
          <div
            data-widget-control
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              zIndex: 1000,
              background: 'var(--bg)',
              border: '1px solid var(--line-strong)',
              borderRadius: 10,
              padding: 4,
              boxShadow: 'var(--shadow-lg)',
              minWidth: 140,
              fontSize: 12,
            }}
          >
            <MenuItem
              icon="refresh"
              label="今すぐ更新"
              onClick={() => {
                if (onRefresh) onRefresh();
                setShowMenu(false);
              }}
            />
            {onPin && !isPinned && (
              <MenuItem
                icon="pin"
                label="ピン留め"
                onClick={() => {
                  onPin();
                  setShowMenu(false);
                }}
              />
            )}
            <MenuItem
              icon="x"
              label="削除"
              onClick={() => {
                if (onRemove) onRemove();
                setShowMenu(false);
              }}
              danger
            />
          </div>
        )}
      </div>

      <div
        style={{
          ...(size === 'sm' ? { flex: 1 } : null),
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>

      {size === 'lg' && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--ink-4)',
            marginTop: 12,
            paddingTop: 6,
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span
            style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }}
          />
          {refreshLabel} に更新
        </div>
      )}
    </div>
  );
}

function weatherIcon(cond: string | undefined) {
  if (!cond) return 'wx-sun';
  if (cond.includes('雨')) return 'wx-rain';
  if (cond.includes('曇') && cond.includes('晴')) return 'wx-partly';
  if (cond.includes('曇')) return 'wx-cloud';
  return 'wx-sun';
}

function Skeleton({ size }: { size: WidgetSize }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
      <div style={{ height: 12, width: '60%', background: 'var(--bg-hover)', borderRadius: 4 }} />
      <div
        style={{ height: 24, width: '40%', background: 'var(--bg-hover)', borderRadius: 4, marginTop: 4 }}
      />
      {size !== 'sm' && (
        <div
          style={{ height: 8, width: '80%', background: 'var(--bg-hover)', borderRadius: 4, marginTop: 4 }}
        />
      )}
    </div>
  );
}

function WeatherWidget({ size, data }: { size: WidgetSize; data: WeatherData | null }) {
  if (!data) return <Skeleton size={size} />;
  const wxIcon = weatherIcon(data.cond);
  if (size === 'sm') {
    return (
      <>
        <div className="jp-text" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
          {data.location.split('・')[1] || data.location}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {data.temp}°
          </span>
          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
            <Icon name={wxIcon} size={20} stroke={1.6} />
          </span>
        </div>
        <div
          className="jp-text"
          style={{
            fontSize: 10,
            color: 'var(--ink-3)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {data.cond} · 降水 {data.precip}%
        </div>
      </>
    );
  }
  return (
    <>
      <div className="jp-text" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
        {data.location}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span
          style={{
            fontSize: 38,
            fontWeight: 500,
            letterSpacing: '-0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {data.temp}°
        </span>
        <span style={{ color: 'var(--accent)', display: 'inline-flex', alignSelf: 'center' }}>
          <Icon name={wxIcon} size={26} stroke={1.6} />
        </span>
        <span
          className="jp-text"
          style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}
        >
          {data.cond}
        </span>
      </div>
      <div className="jp-text" style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 4 }}>
        体感 {data.feels}° · 降水 {data.precip}% · 湿度 62%
      </div>
      <div style={{ flex: 1 }} />
      <HourlyTempChart values={data.hourly} height={56} compact />
    </>
  );
}

interface HourlyTempChartProps {
  values: HourlyForecast[];
  height?: number;
  compact?: boolean;
}

function HourlyTempChart({ values, height = 80, compact = false }: HourlyTempChartProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(252);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 252));
    ro.observe(el);
    setWidth(el.clientWidth || 252);
    return () => ro.disconnect();
  }, []);
  if (!values || values.length < 2) return null;
  const temps = values.map((v) => v.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;
  const padX = 14;
  const padTop = compact ? 16 : 22;
  const padBottom = compact ? 14 : 18;
  const innerH = height - padTop - padBottom;
  const w = width;
  const pts = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * (w - padX * 2);
    const y = padTop + (1 - (v.temp - min) / range) * innerH;
    return { x, y, temp: v.temp, at: v.at };
  });
  const linePath = pts
    .map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(2) + ' ' + p.y.toFixed(2))
    .join(' ');
  const areaPath = linePath + ` L ${w - padX} ${padTop + innerH} L ${padX} ${padTop + innerH} Z`;
  const formatHour = (i: number, at: number) => {
    if (i === 0) return '今';
    return `${new Date(at * 1000).getHours()}時`;
  };
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={w} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <line
          x1={padX}
          x2={w - padX}
          y1={padTop + innerH}
          y2={padTop + innerH}
          stroke="var(--line)"
          strokeWidth="1"
        />
        <path d={areaPath} fill="var(--accent)" opacity="0.12" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => {
          const showLabel = compact ? i === 0 || i === pts.length - 1 || i % 2 === 0 : true;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="2" fill="var(--accent)" />
              {showLabel && (
                <text
                  x={p.x}
                  y={p.y - 7}
                  textAnchor="middle"
                  className="jp-text"
                  style={{
                    fontSize: 10,
                    fill: 'var(--ink-2)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {p.temp}°
                </text>
              )}
              {showLabel && (
                <text
                  x={p.x}
                  y={padTop + innerH + (compact ? 11 : 13)}
                  textAnchor="middle"
                  className="jp-text"
                  style={{ fontSize: 9.5, fill: 'var(--ink-4)' }}
                >
                  {formatHour(i, p.at)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function renderStars(rating: number, starSize = 12) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const filled = hasHalf ? full : Math.round(rating);
  const total = 5;
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: 'var(--accent)' }}>
      {Array.from({ length: total }).map((_, i) => {
        if (i < filled) {
          return (
            <svg
              key={i}
              width={starSize}
              height={starSize}
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ display: 'block' }}
            >
              <path d="M12 3l2.7 6.3L21 10l-5 4.6 1.5 6.4L12 17.8 6.5 21 8 14.6 3 10l6.3-.7z" />
            </svg>
          );
        }
        if (i === filled && hasHalf) {
          const id = 'half-' + starSize;
          return (
            <svg
              key={i}
              width={starSize}
              height={starSize}
              viewBox="0 0 24 24"
              style={{ display: 'block' }}
            >
              <defs>
                <linearGradient id={id}>
                  <stop offset="50%" stopColor="currentColor" />
                  <stop offset="50%" stopColor="currentColor" stopOpacity="0.22" />
                </linearGradient>
              </defs>
              <path
                d="M12 3l2.7 6.3L21 10l-5 4.6 1.5 6.4L12 17.8 6.5 21 8 14.6 3 10l6.3-.7z"
                fill={`url(#${id})`}
              />
            </svg>
          );
        }
        return (
          <svg
            key={i}
            width={starSize}
            height={starSize}
            viewBox="0 0 24 24"
            fill="currentColor"
            fillOpacity="0.22"
            style={{ display: 'block' }}
          >
            <path d="M12 3l2.7 6.3L21 10l-5 4.6 1.5 6.4L12 17.8 6.5 21 8 14.6 3 10l6.3-.7z" />
          </svg>
        );
      })}
    </span>
  );
}

function StoreRatingWidget({
  size,
  data,
}: {
  size: WidgetSize;
  data: StoreRatingData | null;
}) {
  if (!data) return <Skeleton size={size} />;
  if (size === 'sm') {
    return (
      <>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {data.stars}
          </span>
          {renderStars(data.stars, 10)}
        </div>
        <div className="jp-text" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
          {data.reviews}件
        </div>
      </>
    );
  }
  if (size === 'md') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 32,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.03em',
            }}
          >
            {data.stars}
          </span>
          {renderStars(data.stars, 12)}
        </div>
        <div className="jp-text" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          {data.reviews.toLocaleString()} 件 · ナビ #{data.ranking}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, color: 'var(--accent)' }}>
            <Sparkline values={data.trend} height={24} fill />
          </div>
          <span
            style={{
              fontSize: 10,
              color: 'var(--accent)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {data.delta}
          </span>
        </div>
      </>
    );
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 44,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {data.stars}
        </span>
        {renderStars(data.stars, 14)}
        <span
          className="jp-text"
          style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginLeft: 'auto' }}
        >
          {data.delta}
        </span>
      </div>
      <div className="jp-text" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
        {data.reviews.toLocaleString()} 件 · 過去7日 · {data.country} #{data.ranking}
      </div>
      <div style={{ height: 32, marginTop: 10, color: 'var(--accent)', flexShrink: 0 }}>
        <Sparkline values={data.trend} height={32} fill />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginTop: 12,
          flexShrink: 0,
        }}
      >
        {data.breakdown.map((pct, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
            <span
              style={{ color: 'var(--ink-4)', width: 16, fontVariantNumeric: 'tabular-nums' }}
            >
              {5 - i}★
            </span>
            <div
              style={{
                flex: 1,
                height: 4,
                background: 'var(--bg-sunken)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  opacity: 0.3 + (5 - i) * 0.16,
                }}
              />
            </div>
            <span
              style={{
                color: 'var(--ink-3)',
                width: 26,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {pct}%
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function starsText(n: number) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function FeedbackWidget({ size, data }: { size: WidgetSize; data: FeedbackData | null }) {
  if (!data) return <Skeleton size={size} />;
  if (size === 'sm') {
    return (
      <>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 32, fontWeight: 500 }}>{data.unread}</span>
          <span className="jp-text" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
            未読フィードバック
          </span>
        </div>
      </>
    );
  }
  if (size === 'md') {
    const top = data.items[0];
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: '0.04em' }}>
            {starsText(top.stars)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>{top.when}</span>
        </div>
        <div
          className="jp-text"
          style={{
            fontSize: 12.5,
            color: 'var(--ink)',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {top.text}
        </div>
        <div style={{ flex: 1 }} />
        <div className="jp-text" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
          — {top.author} · 他 {data.unread - 1} 件
        </div>
      </>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
      {data.items.map((it, i) => (
        <div
          key={i}
          style={{
            paddingBottom: i < data.items.length - 1 ? 8 : 0,
            borderBottom: i < data.items.length - 1 ? '1px solid var(--line)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ color: 'var(--accent)', fontSize: 10, letterSpacing: '0.05em' }}>
              {starsText(it.stars)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>· {it.when}</span>
          </div>
          <div
            className="jp-text"
            style={{
              fontSize: 12,
              color: 'var(--ink-2)',
              lineHeight: 1.5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {it.text}
          </div>
          <div className="jp-text" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>
            — {it.author}
          </div>
        </div>
      ))}
    </div>
  );
}

function PerfWidget({ size, data }: { size: WidgetSize; data: PerformanceData | null }) {
  if (!data) return <Skeleton size={size} />;
  if (size === 'sm') {
    return (
      <>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {data.crashFree}
            <span style={{ fontSize: 12 }}>%</span>
          </span>
        </div>
        <div className="jp-text" style={{ fontSize: 10, color: 'var(--accent)' }}>
          {data.delta}
        </div>
      </>
    );
  }
  const sparkH = size === 'lg' ? 56 : 28;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {data.crashFree}
          <span style={{ fontSize: 13 }}>%</span>
        </span>
        <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>
          {data.delta}
        </span>
      </div>
      <div className="jp-text" style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 2 }}>
        クラッシュフリー · 起動 {data.coldStart}s · ANR {data.anr}%
      </div>
      <div className="jp-text" style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 1 }}>
        {data.sessions.toLocaleString()} セッション / 24h
      </div>
      <div style={{ flex: 1, minHeight: 4 }} />
      <div
        style={{
          height: sparkH,
          color: 'var(--accent)',
          pointerEvents: 'none',
          flexShrink: 0,
        }}
      >
        <Sparkline values={data.sparkline} height={sparkH} fill />
      </div>
    </>
  );
}

function TasksWidget({
  size,
  data,
  onToggle,
}: {
  size: WidgetSize;
  data: TasksData | null;
  onToggle?: (id: string) => void;
}) {
  const [localItems, setLocalItems] = useState<TasksData['items'] | null>(null);
  useEffect(() => {
    if (data) setLocalItems(data.items);
  }, [data]);
  if (!data || !localItems) return <Skeleton size={size} />;
  const items = localItems;
  const handleToggle = (id: string) => {
    setLocalItems((prev) =>
      prev ? prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) : prev,
    );
    if (onToggle) onToggle(id);
  };
  const undone = items.filter((i) => !i.done).length;
  if (size === 'sm') {
    return (
      <>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 500 }}>{undone}</span>
        </div>
        <div className="jp-text" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
          残り {undone} 件
        </div>
      </>
    );
  }
  const visible = size === 'md' ? items.slice(0, 3) : items;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        flex: 1,
        overflow: 'hidden',
      }}
    >
      {visible.map((t) => (
        <div
          key={t.id}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(t.id);
          }}
        >
          <span
            data-widget-control
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              border: '1.5px solid ' + (t.done ? 'var(--accent)' : 'var(--ink-5)'),
              background: t.done ? 'var(--accent)' : 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 1,
              cursor: 'pointer',
            }}
          >
            {t.done && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <path d="m5 12 5 5L20 7" />
              </svg>
            )}
          </span>
          <span
            className="jp-text"
            style={{
              fontSize: 12.5,
              color: t.done ? 'var(--ink-4)' : 'var(--ink)',
              textDecoration: t.done ? 'line-through' : 'none',
              lineHeight: 1.4,
            }}
          >
            {t.text}
          </span>
        </div>
      ))}
    </div>
  );
}

interface WidgetProps {
  widget: WidgetItem;
  onOpen?: () => void;
  onRemove?: () => void;
  onRefresh?: () => void;
  onToggleTask?: (id: string) => void;
  onPin?: () => void;
  onUnpin?: () => void;
  isPinned?: boolean;
  dragHandleProps?: DragHandleProps;
  accent?: string;
}

export function Widget({
  widget,
  onOpen,
  onRemove,
  onRefresh,
  onToggleTask,
  onPin,
  onUnpin,
  isPinned,
  dragHandleProps,
  accent,
}: WidgetProps) {
  const { data, lastRefresh, refresh } = useWidget(widget.type, widget.refreshInterval);
  const def = WIDGET_DEFS[widget.type];

  const renderBody = () => {
    switch (widget.type) {
      case 'weather':
        return <WeatherWidget size={widget.size} data={data as WeatherData | null} />;
      case 'storeRating':
        return <StoreRatingWidget size={widget.size} data={data as StoreRatingData | null} />;
      case 'feedback':
        return <FeedbackWidget size={widget.size} data={data as FeedbackData | null} />;
      case 'performance':
        return <PerfWidget size={widget.size} data={data as PerformanceData | null} />;
      case 'tasks':
        return (
          <TasksWidget
            size={widget.size}
            data={data as TasksData | null}
            onToggle={onToggleTask}
          />
        );
    }
  };

  return (
    <WidgetShell
      size={widget.size}
      title={def.title}
      icon={def.icon}
      accent={accent}
      onOpen={onOpen}
      onRemove={onRemove}
      onRefresh={() => {
        refresh();
        if (onRefresh) onRefresh();
      }}
      onPin={onPin}
      onUnpin={onUnpin}
      isPinned={isPinned}
      lastRefresh={lastRefresh}
      dragHandleProps={dragHandleProps}
    >
      {renderBody()}
    </WidgetShell>
  );
}
