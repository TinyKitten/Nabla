export interface ReviewSample {
  rating: number;
  createdAt: number;
  title?: string;
  body?: string;
  reviewer?: string;
  territory?: string;
}

export interface StoreRatingResponse {
  stars: number;
  reviews: number;
  delta: string;
  trend: number[];
  breakdown: number[];
  sources: { appStore: boolean };
}

export interface TasksResponse {
  items: {
    id: string;
    identifier: string;
    text: string;
    description: string;
    url: string;
    priority: number;
    dueDate: string | null;
    stateName: string;
    stateType: string;
  }[];
  sources: { linear: boolean };
}

export interface PerformanceResponse {
  crashFree: number;
  delta: string;
  coldStart: number;
  sparkline: number[];
  sessions: number;
  anr: number;
  sources: { sentry: boolean };
}

export type FeedbackSource = 'github' | 'appStore' | 'googlePlay';

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface FeedbackEntrySnapshot {
  title?: string;
  text: string;
  author: string;
  createdAt: number;
  stars: number;
  source: FeedbackSource;
  labels?: GitHubLabel[];
  images?: string[];
}

export interface FeedbackResponse {
  items: FeedbackEntrySnapshot[];
  unread: number;
  hasMore: boolean;
  sources: { github: boolean };
}

export interface ReviewsResponse {
  items: FeedbackEntrySnapshot[];
  sources: { appStore: boolean; googlePlay: boolean };
}

export interface WeatherHourly {
  temp: number;
  at: number;
}

export interface WeatherResponse {
  location: string;
  temp: number;
  feels: number;
  humidity: number;
  cond: string;
  hourly: WeatherHourly[];
  precip: number;
  sources: { openWeather: boolean };
}
