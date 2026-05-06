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
