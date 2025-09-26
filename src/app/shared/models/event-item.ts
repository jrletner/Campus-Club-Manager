export interface EventItem {
  id: string;
  title: string;
  dateIso: string; // ISO date string
  capacity: number;
  description?: string;
}
