import { withMiddleware, createResponse, createErrorResponse, AuthenticatedRequest } from '@/lib/api-utils';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { supabaseAdmin } from '@/supabase/admin';
import { toDbUserId } from '@/lib/privy-utils';

/**
 * Debt Simplification Algorithm
 * 1. Calculate net balance for each user (Total Paid - Total Owed)
 * 2. Separate users into creditors (balance > 0) and debtors (balance < 0)
 * 3. Match largest debtor with largest creditor to minimize transactions
 */
function simplifyDebts(memberBalances: Record<string, { userId: string, name: string, balance: number }>) {
  const balances = Object.values(memberBalances)
    .map(m => ({ ...m, balance: Math.round(m.balance * 100) / 100 }))
    .filter(m => Math.abs(m.balance) > 0.01);

  const debtors = balances
    .filter(m => m.balance < 0)
    .sort((a, b) => a.balance - b.balance); // Most negative firs

  const creditors = balances
    .filter(m => m.balance > 0)
    .sort((a, b) => b.balance - a.balance); // Most positive first

  const debts = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
    
    debts.push({
      from: { id: debtor.userId, name: debtor.name },
      to: { id: creditor.userId, name: creditor.name },
      amount: Math.round(amount * 100) / 100,
    });

    debtors[i].balance += amount;
    creditors[j].balance -= amount;

    if (Math.abs(debtors[i].balance) < 0.01) i++;
    if (Math.abs(creditors[j].balance) < 0.01) j++;
  }

  return debts;
}

const getBalances = async (req: AuthenticatedRequest, { params }: { params: { id: string } }) => {
  try {
    const groupId = params.id;
    const userId = toDbUserId(req.user.id);

    // 1. Verify group membership
    const { data: members, error: membersError } = await supabaseAdmin
      .from('group_members')
      .select('user_id, users(id, name, avatar_url)')
      .eq('group_id', groupId);

    if (membersError || !members) {
      return createErrorResponse(new NotFoundError('Group not found or access denied'));
    }

    const isMember = members.some(m => (m.users as any).id === userId);
    if (!isMember) {
      return createErrorResponse(new ForbiddenError('Access denied'));
    }

    // 2. Fetch all expenses and splits for the group
    let { data: expenses, error: expensesError } = await supabaseAdmin
      .from('expenses')
      .select(`
        id,
        created_by,
        total_amount,
        splits:expense_splits(user_id, amount_owed)
      `)
      .eq('group_id', groupId)
      .is('deleted_at', null);

    if (expensesError && (expensesError as any).code === '42703') {
      const fallback = await supabaseAdmin
        .from('expenses')
        .select(`
          id,
          created_by,
          total_amount,
          splits:expense_splits(user_id, amount_owed)
        `)
        .eq('group_id', groupId);
      expenses = fallback.data as any;
      expensesError = fallback.error as any;
    }

    if (expensesError) {
      return createErrorResponse(new AppError('Failed to fetch expenses', 400));
    }

    // 3. Calculate net balances
    const memberBalances: Record<string, { userId: string, name: string, avatarUrl: string | null, balance: number, totalPaid: number, totalOwed: number }> = {};
    
    members.forEach(m => {
      const u = m.users as any;
      memberBalances[u.id] = {
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatar_url,
        balance: 0,
        totalPaid: 0,
        totalOwed: 0
      };
    });

    (expenses || []).forEach(exp => {
      // Add to payer's total paid
      if (memberBalances[exp.created_by]) {
        memberBalances[exp.created_by].totalPaid += Number(exp.total_amount);
        memberBalances[exp.created_by].balance += Number(exp.total_amount);
      }

      // Subtract from each member's total owed
      exp.splits.forEach((split: any) => {
        if (memberBalances[split.user_id]) {
          memberBalances[split.user_id].totalOwed += Number(split.amount_owed);
          memberBalances[split.user_id].balance -= Number(split.amount_owed);
        }
      });
    });

    // 4. Simplify debts
    const simplifiedDebts = simplifyDebts(JSON.parse(JSON.stringify(memberBalances)));

    return createResponse({
      memberBalances: Object.values(memberBalances),
      simplifiedDebts,
      userBalance: memberBalances[userId] || null,
    });
  } catch (error) {
    console.error('Error in GET /api/groups/[id]/balances:', error);
    return createErrorResponse(error);
  }
};

export const GET = withMiddleware(getBalances, { auth: true });
