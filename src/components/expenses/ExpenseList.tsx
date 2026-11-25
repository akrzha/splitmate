import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  ExpenseParticipant,
  ExpenseWithSplits,
} from "../../features/expenses/expenseTypes";
import {
  deleteExpense,
  getGroupExpenses,
} from "../../features/expenses/expenseService";
import { supabase } from "../../lib/supabase";
import ExpenseCard from "./ExpenseCard";

interface ExpenseListProps {
  groupId: string;
  refreshKey: number;
  onEdit: (expense: ExpenseWithSplits) => void;
  onChanged: () => void;
}

export default function ExpenseList({
  groupId,
  refreshKey,
  onEdit,
  onChanged,
}: ExpenseListProps) {
  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>([]);
  const [members, setMembers] = useState<ExpenseParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<ExpenseWithSplits | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadExpenses() {
      setLoading(true);
      setError("");

      try {
        const expenseData = await getGroupExpenses(groupId);
        const userIds = [
          ...new Set(
            expenseData.flatMap((expense) => [
              expense.paid_by,
              ...expense.expense_splits.map((split) => split.user_id),
            ])
          ),
        ];
        const { data: profiles, error: profileError } =
          userIds.length > 0
            ? await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", userIds)
            : { data: [], error: null };

        if (profileError) throw profileError;
        if (!active) return;

        setExpenses(expenseData);
        setMembers(
          (profiles ?? []).map((profile) => ({
            user_id: profile.id,
            full_name: profile.full_name || "Unnamed member",
          }))
        );
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load group expenses.";
        setError(message);
        toast.error("Unable to load expenses", { description: message });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadExpenses();
    return () => {
      active = false;
    };
  }, [groupId, refreshKey]);

  async function confirmDelete() {
    if (!deleteTarget || deletingRef.current) return;

    deletingRef.current = true;
    setDeleting(true);
    setDeleteError("");
    const notificationId = toast.loading("Deleting expense...");

    try {
      await deleteExpense(groupId, deleteTarget.id);
      toast.success("Expense deleted", {
        id: notificationId,
        description: "The group expense list has been updated.",
      });
      setDeleteTarget(null);
      onChanged();
    } catch (deleteFailure) {
      const message =
        deleteFailure instanceof Error
          ? deleteFailure.message
          : "Unable to delete this expense.";
      setDeleteError(message);
      toast.error("Unable to delete expense", {
        id: notificationId,
        description: message,
      });
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <p className="mt-5 text-sm text-gray-500" role="status">
        Loading expenses...
      </p>
    );
  }

  if (error) {
    return (
      <p
        className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
        <p className="font-medium text-gray-900 dark:text-white">
          No expenses yet
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Add the first expense to start tracking this group.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 space-y-3">
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            members={members}
            onEdit={onEdit}
            onDelete={(selectedExpense) => {
              setDeleteError("");
              setDeleteTarget(selectedExpense);
            }}
          />
        ))}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-expense-title"
            aria-describedby="delete-expense-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900"
          >
            <h2
              id="delete-expense-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              Delete this expense?
            </h2>
            <p
              id="delete-expense-description"
              className="mt-2 text-sm text-gray-600 dark:text-gray-300"
            >
              “{deleteTarget.description}” will be hidden from the group.
              Its expense history and participant shares will be retained.
            </p>
            {deleteError && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete expense"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}