export interface AlertInput {
  label: string;
  fireAt: string; // ISO 8601
}

export interface AlertRecord extends AlertInput {
  id: number;
  reminderId: number;
  sent: boolean;
  sentAt: string | null;
}

export interface ReminderInput {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  alerts: AlertInput[];
}

export interface ReminderRecord {
  id: number;
  title: string;
  date: string;
  time: string;
  createdAt: string;
  alerts: AlertRecord[];
}
