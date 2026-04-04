import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupBundleService } from '../services/bundle';
import { StorachaService } from '../lib/storacha';
import { supabaseAdmin } from '../supabase/admin';
import { CID } from 'multiformats/cid';
import * as dagCbor from '@ipld/dag-cbor';

// Mock Supabase
vi.mock('../supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn(),
  },
}));

// Mock Storacha
vi.mock('../lib/storacha', () => ({
  StorachaService: vi.fn().mockImplementation(() => ({
    uploadCar: vi.fn().mockResolvedValue('bagbaier...'),
  })),
}));

describe('GroupBundleService', () => {
  let bundleService: GroupBundleService;
  let mockStoracha: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoracha = new StorachaService({} as any);
    bundleService = new GroupBundleService(mockStoracha);
  });

  it('should create a bundle for a group with expenses and settlements', async () => {
    const groupId = 'group-123';
    
    // Mock group data
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          if (table === 'groups') return { data: { name: 'Test Group' }, error: null };
          return { data: null, error: null };
        }),
        then: (resolve: any) => {
          if (table === 'group_members') {
            resolve({ data: [{ users: { id: 'user1', name: 'Alice' } }], error: null });
          } else if (table === 'expenses') {
            resolve({
              data: [{
                id: 'exp-1',
                description: 'Lunch',
                total_amount: 30,
                currency: 'USDC',
                created_at: '2024-01-01T12:00:00Z',
                created_by: 'user1',
                category: 'food',
                splits: [{ user_id: 'user1', amount_owed: 30 }],
                media: []
              }],
              error: null
            });
          } else if (table === 'settlements' || table === 'shared_media') {
            resolve({ data: [], error: null });
          }
        }
      };
    });

    const rootCid = await bundleService.createBundle(groupId);
    
    expect(rootCid).toBeDefined();
    expect(mockStoracha.uploadCar).toHaveBeenCalled();
    
    // Verify it's a valid CID
    expect(() => CID.parse(rootCid)).not.toThrow();
  });

  it('should handle groups with 0 expenses', async () => {
    const groupId = 'group-empty';
    
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          if (table === 'groups') return { data: { name: 'Empty Group' }, error: null };
          return { data: null, error: null };
        }),
        then: (resolve: any) => {
          if (table === 'group_members') {
            resolve({ data: [], error: null });
          } else if (table === 'expenses') {
            resolve({ data: [], error: null });
          } else if (table === 'settlements' || table === 'shared_media') {
            resolve({ data: [], error: null });
          }
        }
      };
    });

    const rootCid = await bundleService.createBundle(groupId);
    expect(rootCid).toBeDefined();
    expect(mockStoracha.uploadCar).toHaveBeenCalled();
  });

  it('should be deterministic for the same data', async () => {
    const groupId = 'group-det';
    const mockData = {
      group: { data: { name: 'Det Group' }, error: null },
      members: { data: [{ users: { id: 'u1', name: 'A' } }], error: null },
      expenses: {
        data: [{
          id: 'e1',
          description: 'E',
          total_amount: 10,
          currency: 'USDC',
          created_at: '2024-01-01T12:00:00Z',
          created_by: 'u1',
          category: 'C',
          splits: [],
          media: []
        }],
        error: null
      },
      settlements: { data: [], error: null }
    };

    const mockSupabase = (table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnValue(table === 'groups' ? mockData.group : { data: null }),
      then: (resolve: any) => {
        if (table === 'group_members') resolve(mockData.members);
        if (table === 'expenses') resolve(mockData.expenses);
        if (table === 'settlements') resolve(mockData.settlements);
        if (table === 'shared_media') resolve({ data: [], error: null });
      }
    });

    (supabaseAdmin.from as any).mockImplementation(mockSupabase);
    const rootCid1 = await bundleService.createBundle(groupId);

    (supabaseAdmin.from as any).mockImplementation(mockSupabase);
    const rootCid2 = await bundleService.createBundle(groupId);

    expect(rootCid1).toBe(rootCid2);
  });
});
