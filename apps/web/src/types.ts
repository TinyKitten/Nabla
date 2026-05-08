export type WidgetSize = 'sm' | 'md' | 'lg';

export type WidgetType =
  | 'weather'
  | 'storeRating'
  | 'reviews'
  | 'feedback'
  | 'performance'
  | 'tasks'
  | 'clock';

export interface WidgetItem {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  refreshInterval: number;
}

export interface HourlyForecast {
  temp: number;
  at: number;
}

export interface WeatherData {
  location: string;
  temp: number;
  feels: number;
  humidity: number;
  cond: string;
  hourly: HourlyForecast[];
  precip: number;
}

export interface StoreRatingData {
  stars: number;
  reviews: number;
  delta: string;
  trend: number[];
  breakdown: number[];
}

export type FeedbackSource = 'github' | 'appStore' | 'googlePlay';

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface FeedbackEntry {
  stars: number;
  title?: string;
  text: string;
  author: string;
  when: string;
  source: FeedbackSource;
  labels?: GitHubLabel[];
  images?: string[];
}

export interface FeedbackData {
  items: FeedbackEntry[];
  unread: number;
  hasMore?: boolean;
}

export interface ReviewsData {
  items: FeedbackEntry[];
}

export interface PerformanceData {
  crashFree: number;
  delta: string;
  coldStart: number;
  sparkline: number[];
  sessions: number;
  anr: number;
}

export interface TaskEntry {
  id: string;
  text: string;
  done: boolean;
  source: 'linear' | 'local';
  identifier?: string;
  url?: string;
  description?: string;
}

export interface TasksData {
  items: TaskEntry[];
}

export interface ClockData {
  now: number;
}

export const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土'] as const;

export type WidgetData =
  | WeatherData
  | StoreRatingData
  | FeedbackData
  | ReviewsData
  | PerformanceData
  | TasksData
  | ClockData;

export interface ToolCall {
  name: string;
  label: string;
  icon: string;
  status?: 'running' | 'done';
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  time: string;
  streaming?: boolean;
  tools?: ToolCall[];
  actions?: boolean;
  widget?: WidgetType | null;
  labels?: GitHubLabel[];
  images?: string[];
  format?: 'plain' | 'markdown';
}

export interface DragHandleProps {
  draggable: boolean;
  onDragStart?: (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLElement>) => void;
}
