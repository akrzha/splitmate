import {
  CalendarDays,
  ChevronDown,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import type {
  ExpenseParticipant,
  ExpenseWithSplits,
} from "../../features/expenses/expenseTypes";
import { formatMinorUnits } from "../../features/expenses/money";
import SplitBreakdown from "./SplitBreakdown";

interface ExpenseCardProps {
  expense: ExpenseWithSplits;
  members: ExpenseParticipant[];
  onEdit: (expense: ExpenseWithSplits) => void;
  onDelete: (expense: ExpenseWithSplits) => void;
}

export default function ExpenseCard({
  expense,
  members,
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  const paidByName =
    members.find((member) => member.user_id === expense.paid_by)?.full_name ??
    "Group member";

  return (
    <details className="group rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <summary className="list-none cursor-pointer rounded-xl p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-gray-900 dark:text-white">
              {expense.description}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden="true" />
                {new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString()}
              </span>
              <span className="inline-flex items-center gap-1.5 capitalize">
                <Tag size={14} aria-hidden="true" />
                {expense.category || "Other"}
              </span>
              <span>Paid by {paidByName}</span>
            </div>
          </div>
          <p className="shrink-0 text-lg font-semibold text-gray-900 dark:text-white">
            {formatMinorUnits(expense.amount_minor, expense.currency)}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-indigo-600 dark:text-indigo-400">
          <span>
            View full breakdown · {expense.expense_splits.length} participant
            {expense.expense_splits.length === 1 ? "" : "s"}
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="shrink-0 transition-transform group-open:rotate-180"
          />
        </div>
      </summary>

      <div className="border-t border-gray-100 px-5 pb-4 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Participant shares
          </h4>
          <div className="flex items-center gap-2">
            {expense.expense_splits[0] && (
              <span className="mr-1 text-xs capitalize text-gray-500">
                {expense.expense_splits[0].split_type} split
              </span>
            )}
            <button
              type="button"
              onClick={() => onEdit(expense)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Pencil size={14} aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(expense)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
        {expense.expense_splits.length > 0 ? (
          <div className="mt-1">
            <SplitBreakdown
              splits={expense.expense_splits}
              members={members}
              currency={expense.currency}
            />
          </div>
        ) : (
          <p className="py-2 text-sm text-gray-500">
            No participant shares were recorded.
          </p>
        )}
      </div>
    </details>
  );
}