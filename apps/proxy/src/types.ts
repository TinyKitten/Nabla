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

export type FeedbackSource = 'github' | 'appStore' | 'googlePlay';

export interface FeedbackEntrySnapshot {
  text: string;
  author: string;
  createdAt: number;
  stars: number;
  source: FeedbackSource;
}

export interface FeedbackResponse {
  items: FeedbackEntrySnapshot[];
  unread: number;
  hasMore: boolean;
  sources: { github: boolean; appStore: boolean; googlePlay: boolean };
}
