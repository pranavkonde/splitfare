import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { supabaseAdmin } from '@/supabase/admin';
import { getSettlements, createSettlement } from '@/app/api/settlements/route';

describe('Group Flow Integration', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const groupId = '550e8400-e29b-41d4-a716-446655440001';
  let mockChain: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = {} as any;
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'single', 'maybeSingle'];
    methods.forEach(m => {
      mockChain[m] = vi.fn().mockReturnValue(mockChain);
    });
    mockChain.then = vi.fn().mockImplementation((onSuccess: any) => onSuccess({ data: null, error: null }));
    (supabaseAdmin.from as any).mockReturnValue(mockChain);
  });

  it('should create a group and add the creator as admin', async () => {
    const mockGroup = { id: groupId, name: 'Trip to NYC', invite_code: 'code123' };
    
    mockChain.single
      .mockResolvedValueOnce({ data: mockGroup, error: null })
      .mockResolvedValueOnce({ data: { id: 'member-1', role: 'admin' }, error: null });

    const { data: newGroup, error: groupError } = await supabaseAdmin
      .from('groups')
      .insert({ name: 'Trip to NYC', created_by: userId })
      .select()
      .single();

    expect(newGroup).toEqual(mockGroup);
    expect(groupError).toBeNull();

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .insert({ group_id: newGroup?.id, user_id: userId, role: 'admin' })
      .select()
      .single();

    expect(membership?.role).toBe('admin');
    expect(memberError).toBeNull();
  });

  it('should allow a user to join a group via invite code', async () => {
    const inviteCode = 'code123';
    
    mockChain.single
      .mockResolvedValueOnce({ data: { id: groupId, name: 'Trip to NYC' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'member-2', role: 'member' }, error: null });

    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('invite_code', inviteCode)
      .single();

    expect(group?.id).toBe(groupId);

    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .insert({ group_id: group?.id, user_id: 'user-789', role: 'member' })
      .select()
      .single();

    expect(membership?.role).toBe('member');
  });

  it('should allow an admin to remove a member', async () => {
    const targetUserId = 'user-789';

    mockChain.single.mockResolvedValueOnce({ data: { role: 'admin' }, error: null });
    
    mockChain.eq.mockReturnThis();
    (mockChain as any).then = vi.fn().mockImplementation((callback) => callback({ error: null }));

    const { data: adminCheck } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    expect(adminCheck?.role).toBe('admin');

    const { error: deleteError } = await (supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId) as any);

    expect(deleteError).toBeNull();
  });

  describe('Settlement Flow', () => {
    it('should fetch settlements for a group', async () => {
      const mockSettlements = [{ id: 's1', amount: 50 }];
      mockChain.single.mockResolvedValueOnce({ data: { id: 'm1' }, error: null });
      (mockChain as any).then = vi.fn().mockImplementation((callback) => callback({ data: mockSettlements, error: null }));

      const req = {
        url: `http://localhost/api/settlements?groupId=${groupId}`,
        user: { id: userId }
      } as any;

      const response = await getSettlements(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual(mockSettlements);
    });

    it('should create a settlement when there is sufficient debt', async () => {
      const from_user_id = userId;
      const to_user_id = 'user-789';
      const amount = 50;

      mockChain.in.mockResolvedValueOnce({ data: [{ user_id: from_user_id }, { user_id: to_user_id }], error: null });
      
      const mockExpenses = [
        { 
          id: 'e1', 
          created_by: to_user_id, 
          total_amount: 100, 
          splits: [{ user_id: from_user_id, amount_owed: 60 }] 
        }
      ];
      mockChain.eq.mockImplementationOnce(() => mockChain); // for group_members eq
      mockChain.eq.mockResolvedValueOnce({ data: mockExpenses, error: null }); // for expenses eq
      
      mockChain.eq.mockImplementationOnce(() => mockChain); // for settlements eq 1
      mockChain.eq.mockResolvedValueOnce({ data: [], error: null }); // for settlements eq 2
      
      const mockSettlement = { id: 's1', amount };
      mockChain.single.mockResolvedValueOnce({ data: mockSettlement, error: null });

      const req = {
        user: { id: userId },
        validatedBody: {
          group_id: groupId,
          from_user_id,
          to_user_id,
          amount,
          transaction_hash: '0x123'
        }
      } as any;

      const response = await createSettlement(req);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data).toEqual(mockSettlement);
    });

    it('should fail if unauthorized payer', async () => {
      const req = {
        user: { id: userId },
        validatedBody: {
          group_id: groupId,
          from_user_id: 'other-user',
          to_user_id: 'user-789',
          amount: 50
        }
      } as any;

      const response = await createSettlement(req);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(true);
      expect(body.data.error).toContain('Unauthorized');
    });

    it('should fail if insufficient debt', async () => {
      const from_user_id = userId;
      const to_user_id = 'user-789';
      const amount = 100;

      mockChain.in.mockResolvedValueOnce({ data: [{ user_id: from_user_id }, { user_id: to_user_id }], error: null });
      
      const mockExpenses = [
        { 
          id: 'e1', 
          created_by: to_user_id, 
          total_amount: 50, 
          splits: [{ user_id: from_user_id, amount_owed: 50 }] 
        }
      ];
      mockChain.eq.mockImplementationOnce(() => mockChain); 
      mockChain.eq.mockResolvedValueOnce({ data: mockExpenses, error: null });
      mockChain.eq.mockImplementationOnce(() => mockChain); 
      mockChain.eq.mockResolvedValueOnce({ data: [], error: null });

      const req = {
        user: { id: userId },
        validatedBody: {
          group_id: groupId,
          from_user_id,
          to_user_id,
          amount,
          transaction_hash: '0x123'
        }
      } as any;

      const response = await createSettlement(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(true);
      expect(body.data.error).toContain('Insufficient debt');
    });
  });
});
