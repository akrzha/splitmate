import type { SplitType } from "../../features/expenses/expenseTypes";

interface SplitTypeSelectorProps {
  value: SplitType;
  onChange: (splitType: SplitType) => void;
}

const splitTypes: { value: SplitType; label: string }[] = [
  { value: "equal", label: "Equal" },
  { value: "exact", label: "Exact amounts" },
  { value: "percentage", label: "Percentages" },
];

export default function SplitTypeSelector({
  value,
  onChange,
}: SplitTypeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Split type"
      className="grid grid-cols-3 gap-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
    >
      {splitTypes.map((splitType) => (
        <button
          key={splitType.value}
          type="button"
          aria-pressed={value === splitType.value}
          onClick={() => onChange(splitType.value)}
          className={`rounded-lg px-2 py-2 text-sm font-medium transition ${
            value === splitType.value
              ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          }`}
        >
          {splitType.label}
        </button>
      ))}
    </div>
  );
}