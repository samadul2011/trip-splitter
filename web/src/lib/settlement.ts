import { SettlementTransaction, UserTotal } from "@/types/database";

export interface SettlementComputationResult {
  total_spent: number;
  per_person_share: number;
  member_count: number;
  total_persons: number;
  user_totals: UserTotal[];
  settlement: SettlementTransaction[];
}

/**
 * Rounds a number to 2 decimal places safely.
 */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Computes the complete trip expense breakdown and minimum-transaction settlement plan
 * supporting family/group member multipliers (e.g., 1, 2, 3, 4 persons under one user's name):
 *
 * - total_persons = sum of each member's `family_count` (defaults to 1 per user)
 * - per_person_share = total_spent / total_persons (cost for 1 single person)
 * - For each user:
 *     should_pay = per_person_share * family_count
 *     balance (difference) = their_spent - should_pay
 *       * balance > 0 -> creditor (gets money back)
 *       * balance < 0 -> debtor (owes money)
 * - Greedily matches largest debtors with largest creditors to minimize transactions.
 */
export function calculateTripSettlement(
  members: { id: string; full_name: string; family_count?: number }[],
  expenses: { paid_by: string; amount: number }[]
): SettlementComputationResult {
  const memberCount = members.length;
  const totalPersons = members.reduce(
    (sum, m) => sum + Math.max(1, Number(m.family_count) || 1),
    0
  );

  // Sum how much each member spent
  const spentByUserId = new Map<string, number>();
  for (const member of members) {
    spentByUserId.set(member.id, 0);
  }

  let totalSpent = 0;
  for (const exp of expenses) {
    const numericAmount = Number(exp.amount) || 0;
    totalSpent += numericAmount;
    spentByUserId.set(
      exp.paid_by,
      (spentByUserId.get(exp.paid_by) || 0) + numericAmount
    );
  }

  totalSpent = roundCurrency(totalSpent);
  const rawPerPersonShare = totalPersons > 0 ? totalSpent / totalPersons : 0;
  const perPersonShare = roundCurrency(rawPerPersonShare);

  const userTotals: UserTotal[] = members.map((member) => {
    const familyCount = Math.max(1, Number(member.family_count) || 1);
    const userSpent = roundCurrency(spentByUserId.get(member.id) || 0);
    const rawShouldPay = rawPerPersonShare * familyCount;
    const shouldPay = roundCurrency(rawShouldPay);
    const difference = roundCurrency(userSpent - rawShouldPay);

    return {
      user_id: member.id,
      user_name: member.full_name,
      family_count: familyCount,
      total_spent: userSpent,
      should_pay: shouldPay,
      difference,
    };
  });

  // Sort user_totals by highest spender first, then name
  userTotals.sort(
    (a, b) =>
      b.total_spent - a.total_spent || a.user_name.localeCompare(b.user_name)
  );

  interface BalanceNode {
    user_name: string;
    amount: number;
  }

  const creditors: BalanceNode[] = [];
  const debtors: BalanceNode[] = [];

  for (const member of members) {
    const familyCount = Math.max(1, Number(member.family_count) || 1);
    const userSpent = spentByUserId.get(member.id) || 0;
    const shouldPay = rawPerPersonShare * familyCount;
    const balance = userSpent - shouldPay;

    if (balance > 0.005) {
      creditors.push({ user_name: member.full_name, amount: balance });
    } else if (balance < -0.005) {
      debtors.push({ user_name: member.full_name, amount: Math.abs(balance) });
    }
  }

  // Sort descending by amount to minimize transaction count
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlement: SettlementTransaction[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const payment = Math.min(debtor.amount, creditor.amount);
    const roundedPayment = roundCurrency(payment);

    if (roundedPayment > 0) {
      settlement.push({
        from_user: debtor.user_name,
        to_user: creditor.user_name,
        amount: roundedPayment,
      });
    }

    debtor.amount -= payment;
    creditor.amount -= payment;

    if (debtor.amount <= 0.005) i++;
    if (creditor.amount <= 0.005) j++;
  }

  return {
    total_spent: totalSpent,
    per_person_share: perPersonShare,
    member_count: memberCount,
    total_persons: totalPersons,
    user_totals: userTotals,
    settlement,
  };
}
