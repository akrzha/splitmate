
import type { SplitType } from "./expenseTypes";

export interface SplitInput {
  user_id: string;
  value?: number;
}

export interface CalculatedSplit {
  user_id: string;
  owed_amount_minor: number;
  split_type: SplitType;
}

// Allocate integer money units using the largest-remainder method.
function allocate(
  total: number,
  weights: number[]
): number[] {
  const totalBigInt = BigInt(total);
  const bigWeights = weights.map(BigInt);
  const weightTotal = bigWeights.reduce(
    (sum, weight) => sum + weight,
    0n
  );

  if (weightTotal <= 0n) {
    throw new Error("Invalid split weights");
  }

  const exactShares = bigWeights.map((weight) => ({
    share: (totalBigInt * weight) / weightTotal,
    remainder: (totalBigInt * weight) % weightTotal,
  }));
  const shares = exactShares.map(({ share }) => Number(share));
  const remaining =
    totalBigInt -
    shares.reduce((sum, share) => sum + BigInt(share), 0n);
  const order = exactShares
    .map(({ remainder }, index) => ({ index, remainder }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.index - b.index
        : a.remainder > b.remainder
          ? -1
          : 1
  );
  for (let i = 0n; i < remaining; i++) {
    shares[order[Number(i)].index]++;
  }

  return shares;
}

export function calculateSplits(
  total: number,
  participants: SplitInput[],
  splitType: SplitType
): CalculatedSplit[] {
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new Error("Invalid expense amount");
  }

  if (participants.length === 0) {
    throw new Error("Select at least one participant");
  }

  if (
    new Set(participants.map(p => p.user_id)).size !==
    participants.length
  ) {
    throw new Error("Duplicate participants are not allowed");
  }

  let shares: number[];

  if (splitType === "equal") {
    shares = allocate(
      total,
      participants.map(() => 1)
    );
  } else if (splitType === "exact") {
    shares = participants.map(p => {
      if (
        typeof p.value !== "number" ||
        !Number.isSafeInteger(p.value) ||
        p.value < 0
      ) {
        throw new Error("Invalid exact share");
      }
      return p.value;
    });

    if (
      shares.reduce((sum, share) => sum + BigInt(share), 0n) !==
      BigInt(total)
    ) {
      throw new Error("Exact shares must equal total expense");
    }
  } else {
    // Percentages are stored as basis points.
    // 50% = 5000, 25.50% = 2550.
    const weights = participants.map(p => {
      if (
        typeof p.value !== "number" ||
        !Number.isSafeInteger(p.value) ||
        p.value < 0
      ) {
        throw new Error("Invalid percentage");
      }
      return p.value;
    });

    if (
      weights.reduce((sum, weight) => sum + BigInt(weight), 0n) !==
      10000n
    ) {
      throw new Error("Percentages must total 100%");
    }

    shares = allocate(total, weights);
  }

  return participants.map((participant, index) => ({
    user_id: participant.user_id,
    owed_amount_minor: shares[index],
    split_type: splitType,
  }));
}

export function derivePercentageValues(
  total: number,
  shares: number[]
): number[] {
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    shares.length === 0 ||
    shares.some((share) => !Number.isSafeInteger(share) || share < 0) ||
    shares.reduce((sum, share) => sum + BigInt(share), 0n) !== BigInt(total)
  ) {
    throw new Error("Cannot derive percentages from invalid shares.");
  }

  return allocate(10000, shares);
}
