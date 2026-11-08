export interface Profile {
  id: string;
  full_name: string;
  is_admin?: boolean;
  family_count?: number;
  created_at?: string;
}

export interface Trip {
  id: string;
  name: string;
  created_by: string;
  is_completed: boolean;
  created_at: string;
  member_count?: number;
  total_persons?: number;
  total_spent?: number;
  members?: Profile[];
}

export interface TripMember {
  trip_id: string;
  user_id: string;
  family_count?: number;
  profiles?: Profile;
}

export interface Expense {
  id: string;
  trip_id: string;
  paid_by: string;
  user_name?: string;
  amount: number;
  description: string;
  expense_date: string;
  created_at: string;
}

export interface UserTotal {
  user_id?: string;
  user_name: string;
  family_count: number;
  total_spent: number;
  should_pay: number;
  difference: number;
}

export interface ReportExpenseItem {
  id?: string;
  paid_by?: string;
  user_name: string;
  amount: number;
  description: string;
  date: string;
}

export interface SettlementTransaction {
  from_user: string;
  to_user: string;
  amount: number;
  is_paid?: boolean;
  paid_at?: string | null;
}

export interface TripReport {
  trip_id?: string;
  trip_name: string;
  is_completed?: boolean;
  total_spent: number;
  per_person_share: number;
  member_count: number;
  total_persons: number;
  user_totals: UserTotal[];
  expenses: ReportExpenseItem[];
  settlement: SettlementTransaction[];
}
