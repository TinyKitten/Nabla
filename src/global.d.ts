import type { WidgetType } from './types';

declare global {
  interface Window {
    __draggingGridWidgetType?: WidgetType | null;
    __draggingInlineWidgetType?: WidgetType | null;
  }
}

export {};
