export type Category = 'FACTURABLE' | 'NON_FACTURABLE';

export interface Task {
  id: string;
  dateISO: string; // YYYY-MM-DD
  startHour: number; // 7, 7.5, 8, 8.5, ... 19.5
  endHour: number;   // startHour+duration, <=20
  category: Category;
  client?: string;   // if FACTURABLE
  project?: string;  // if FACTURABLE
  quote?: string;    // optional, if FACTURABLE (Devis)
  type?: string;     // if NON_FACTURABLE
  description?: string;
  billed?: boolean;  // if FACTURABLE
}
