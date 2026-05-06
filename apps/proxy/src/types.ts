export interface ReviewSample {
  rating: number;
  createdAt: number;
}

export interface StoreSnapshot {
  source: 'appStore' | 'googlePlay';
  reviews: ReviewSample[];
}

export interface StoreRatingResponse {
  stars: number;
  reviews: number;
  delta: string;
  trend: number[];
  breakdown: number[];
  sources: { appStore: boolean; googlePlay: boolean };
}
