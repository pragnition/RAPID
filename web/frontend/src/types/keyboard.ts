export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  category: KeyCategory;
  action: () => void;
  when?: () => boolean;
}

export interface KeyCombo {
  keys: string[];
  description: string;
  category: KeyCategory;
}

export type KeyCategory = "navigation" | "global" | "sidebar" | "view";
