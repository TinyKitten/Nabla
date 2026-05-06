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

export interface TasksResponse {
  items: {
    id: string;
    identifier: string;
    text: string;
    url: string;
    priority: number;
    dueDate: string | null;
    stateName: string;
    stateType: string;
  }[];
  sources: { linear: boolean };
}
