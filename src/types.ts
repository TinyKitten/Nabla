export type WidgetSize = 'sm' | 'md' | 'lg';

export type WidgetType = 'weather' | 'storeRating' | 'feedback' | 'performance' | 'tasks';

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
  ranking: number;
  country: string;
}

export interface FeedbackEntry {
  stars: number;
  text: string;
  author: string;
  when: string;
}

export interface FeedbackData {
  items: FeedbackEntry[];
  unread: number;
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
}

export interface TasksData {
  items: TaskEntry[];
}

export type WidgetData =
  | WeatherData
  | StoreRatingData
  | FeedbackData
  | PerformanceData
  | TasksData;

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
}

export interface DragHandleProps {
  draggable: boolean;
  onDragStart?: (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLElement>) => void;
}
