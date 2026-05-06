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

export type FeedbackSource = 'appStore' | 'googlePlay';

export interface FeedbackEntry {
  stars: number;
  text: string;
  author: string;
  when: string;
  source: FeedbackSource;
}

export interface StoreReviewsResponse {
  items: FeedbackEntry[];
  sources: { appStore: boolean; googlePlay: boolean };
}
