
import { supabase } from "../../lib/supabase";
import type { CalculatedSplit } from "./expenseCalculations";
import type {
  ExpenseWithSplits,
} from "./expenseTypes";

interface CreateExpenseInput {
  groupId: string;
  description: string;
  amountMinor: number;
  currency: string;
  paidBy: string;
  category: string;
  expenseDate: string;
  splits: CalculatedSplit[];
}

export async function createExpense(
  expense: CreateExpenseInput
) {
  const { data, error } = await supabase.rpc(
    "create_group_expense",
    {
      p_group_id: expense.groupId,
      p_description: expense.description,
      p_amount_minor: expense.amountMinor,
      p_currency: expense.currency,
      p_paid_by: expense.paidBy,
      p_category: expense.category,
      p_expense_date: expense.expenseDate,
      p_splits: expense.splits
    }
  );

  if (error) {
    throw error;
  }

  return data as string;
}

export async function updateExpense(
  expenseId: string,
  expense: CreateExpenseInput
): Promise<void> {
  const { error } = await supabase.rpc("update_group_expense", {
    p_expense_id: expenseId,
    p_group_id: expense.groupId,
    p_description: expense.description,
    p_amount_minor: expense.amountMinor,
    p_currency: expense.currency,
    p_paid_by: expense.paidBy,
    p_category: expense.category,
    p_expense_date: expense.expenseDate,
    p_splits: expense.splits,
  });

  if (error) throw error;
}

export async function deleteExpense(
  groupId: string,
  expenseId: string
): Promise<void> {
  const { error } = await supabase.rpc("delete_group_expense", {
    p_group_id: groupId,
    p_expense_id: expenseId,
  });

  if (error) throw error;
}

export async function getGroupExpenses(
  groupId: string
): Promise<ExpenseWithSplits[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select(`
      *,
      expense_splits (*)
    `)
    .eq("group_id", groupId)
    .eq("is_deleted", false)
    .order("expense_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ExpenseWithSplits[];
}
