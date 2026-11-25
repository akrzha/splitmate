
export type SplitType = "equal" | "exact" | "percentage";

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount_minor: number;
  currency: string;
  paid_by: string;
  category: string;
  expense_date: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_by: string;
  created_at: string;
}

export interface ExpenseSplit {
  id?: string;
  expense_id?: string;
  user_id: string;
  owed_amount_minor: number;
  split_type: SplitType;
}

export interface ExpenseWithSplits extends Expense {
  expense_splits: ExpenseSplit[];
}

export interface ExpenseParticipant {
  user_id: string;
  full_name: string;
  avatar_url?: string;
}
