import type {
  ExpenseParticipant,
  ExpenseSplit,
} from "../../features/expenses/expenseTypes";
import { formatMinorUnits } from "../../features/expenses/money";

interface SplitBreakdownProps {
  splits: Pick<ExpenseSplit, "user_id" | "owed_amount_minor">[];
  members: ExpenseParticipant[];
  currency: string;
}

export default function SplitBreakdown({
  splits,
  members,
  currency,
}: SplitBreakdownProps) {
  const memberNames = new Map(
    members.map((member) => [member.user_id, member.full_name])
  );

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {splits.map((split) => (
        <li
          key={split.user_id}
          className="flex items-center justify-between gap-3 py-2 text-sm"
        >
          <span className="truncate text-gray-600 dark:text-gray-300">
            {memberNames.get(split.user_id) || "Group member"}
          </span>
          <span className="shrink-0 font-medium text-gray-900 dark:text-white">
            {formatMinorUnits(split.owed_amount_minor, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}