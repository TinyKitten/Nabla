export interface ReviewSample {
  rating: number;
  createdAt: number;
}

export interface StoreRatingResponse {
  stars: number;
  reviews: number;
  delta: string;
  trend: number[];
  breakdown: number[];
  sources: { appStore: boolean };
}

export interface FeedbackEntrySnapshot {
  text: string;
  author: string;
  createdAt: number;
  stars: number;
}

export interface FeedbackResponse {
  items: FeedbackEntrySnapshot[];
  sources: { github: boolean };
}
