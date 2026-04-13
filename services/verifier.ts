import { supabaseAdmin } from '@/supabase/admin';
import { CID } from 'multiformats/cid';
import * as dagCbor from '@ipld/dag-cbor';
import { CarReader } from '@ipld/car';
import { ethers, JsonRpcProvider, Contract } from 'ethers';
import { splitFareCIDRegistryAbi } from '@/lib/contracts/abi';
import { IPLDGroupBundle } from '@/lib/ipld-schema';

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_CID_REGISTRY_ADDRESS as string;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

export interface VerificationReport {
  isValid: boolean;
  groupId: string;
  groupName: string;
  rootCid: string;
  onChainRecordCount: number;
  bundleRecordCount: number;
  timestamp: number;
  checks: {
    name: string;
    status: 'passed' | 'failed';
    details?: string;
  }[];
}

export class VerifierService {
  private provider: JsonRpcProvider;
  private contract: Contract;

  constructor() {
    this.provider = new JsonRpcProvider(RPC_URL);
    this.contract = new Contract(REGISTRY_ADDRESS, splitFareCIDRegistryAbi, this.provider);
  }

  async verifyGroupData(groupId: string): Promise<VerificationReport> {
    const checks: VerificationReport['checks'] = [];
    let isValid = true;

    try {
      // 1. Fetch latest anchor from DB
      const { data: anchor, error: anchorError } = await supabaseAdmin
        .from('cid_anchors')
        .select('*')
        .eq('group_id', groupId)
        .order('anchored_at', { ascending: false })
        .limit(1)
        .single();

      if (anchorError || !anchor) {
        throw new Error('No anchors found for this group');
      }

      const rootCidStr = anchor.root_cid;
      const onChainRecordCount = anchor.record_count;

      // 2. Verify on-chain (optional check to ensure DB matches chain)
      const numericGroupId = BigInt('0x' + groupId.replace(/-/g, ''));
      const onChainAnchor = await this.contract.getLatestAnchor(numericGroupId);
      
      if (onChainAnchor.cid !== rootCidStr) {
        checks.push({
          name: 'On-chain CID Match',
          status: 'failed',
          details: `DB CID (${rootCidStr}) does not match chain CID (${onChainAnchor.cid})`
        });
        isValid = false;
      } else {
        checks.push({ name: 'On-chain CID Match', status: 'passed' });
      }

      // 3. Fetch CAR from Storacha
      const IPFS_GATEWAY = process.env.IPFS_GATEWAY_HOST || 'storacha.link';
      const carUrl = `https://${rootCidStr}.ipfs.${IPFS_GATEWAY}`;
      const response = await fetch(carUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch CAR file from Storacha: ${response.statusText}`);
      }
      const carBuffer = await response.arrayBuffer();
      checks.push({ name: 'Fetch CAR from Storacha', status: 'passed' });

      // 4. Parse CAR and DAG
      const reader = await CarReader.fromBytes(new Uint8Array(carBuffer));
      const roots = await reader.getRoots();
      const rootCid = roots[0];
      
      if (rootCid.toString() !== rootCidStr) {
        throw new Error('CAR root CID mismatch');
      }

      const rootBlock = await reader.get(rootCid);
      if (!rootBlock) throw new Error('Root block not found in CAR');
      
      const bundle = dagCbor.decode<IPLDGroupBundle>(rootBlock.bytes);
      checks.push({ name: 'Parse IPLD DAG', status: 'passed' });

      // 5. Verify record counts
      const bundleRecordCount = bundle.expenses.length + bundle.settlements.length;
      if (bundleRecordCount !== onChainRecordCount) {
        checks.push({
          name: 'Record Count Match',
          status: 'failed',
          details: `Bundle count (${bundleRecordCount}) does not match on-chain count (${onChainRecordCount})`
        });
        isValid = false;
      } else {
        checks.push({ name: 'Record Count Match', status: 'passed' });
      }

      // 6. Verify nested CIDs (Receipts & Manifests)
      let missingCids = 0;
      for (const expense of bundle.expenses) {
        if (expense.receiptCid) {
          const exists = await this.checkCidExists(expense.receiptCid.toString());
          if (!exists) missingCids++;
        }
      }
      for (const settlement of bundle.settlements) {
        if (settlement.manifestCid) {
          const exists = await this.checkCidExists(settlement.manifestCid.toString());
          if (!exists) missingCids++;
        }
      }

      if (missingCids > 0) {
        checks.push({
          name: 'Nested CID Integrity',
          status: 'failed',
          details: `${missingCids} nested CIDs (receipts/manifests) could not be resolved`
        });
        isValid = false;
      } else {
        checks.push({ name: 'Nested CID Integrity', status: 'passed' });
      }

      return {
        isValid,
        groupId,
        groupName: bundle.groupName,
        rootCid: rootCidStr,
        onChainRecordCount,
        bundleRecordCount,
        timestamp: Date.now(),
        checks
      };

    } catch (error: any) {
      checks.push({
        name: 'Verification Pipeline',
        status: 'failed',
        details: error.message
      });
      return {
        isValid: false,
        groupId,
        groupName: 'Unknown',
        rootCid: '',
        onChainRecordCount: 0,
        bundleRecordCount: 0,
        timestamp: Date.now(),
        checks
      };
    }
  }

  private async checkCidExists(cid: string): Promise<boolean> {
    try {
      const gateway = process.env.IPFS_GATEWAY_HOST || 'storacha.link';
      const response = await fetch(`https://${cid}.ipfs.${gateway}`, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getAuditTrail(groupId: string) {
    // Fetch all related data to build the timeline
    const [expenses, settlements, anchors] = await Promise.all([
      supabaseAdmin
        .from('expenses')
        .select('*, media:shared_media(cid)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('settlements')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('cid_anchors')
        .select('*')
        .eq('group_id', groupId)
        .order('anchored_at', { ascending: false })
    ]);

    const timeline: any[] = [];

    expenses.data?.forEach(e => {
      timeline.push({
        id: e.id,
        type: 'expense',
        title: e.description,
        timestamp: e.created_at,
        amount: e.total_amount,
        currency: e.currency,
        cid: e.media?.[0]?.cid,
        status: 'recorded'
      });
      if (e.media?.[0]?.cid) {
        timeline.push({
          id: `receipt-${e.id}`,
          type: 'receipt',
          title: `Receipt for ${e.description}`,
          timestamp: e.created_at,
          cid: e.media[0].cid,
          parentId: e.id,
          status: 'stored'
        });
      }
    });

    settlements.data?.forEach(s => {
      timeline.push({
        id: s.id,
        type: 'settlement',
        title: `Settlement: ${s.amount} ${s.currency}`,
        timestamp: s.created_at,
        amount: s.amount,
        currency: s.currency,
        cid: s.manifest_cid,
        status: 'confirmed'
      });
      if (s.manifest_cid) {
        timeline.push({
          id: `manifest-${s.id}`,
          type: 'manifest',
          title: `Manifest for settlement ${s.id}`,
          timestamp: s.created_at,
          cid: s.manifest_cid,
          parentId: s.id,
          status: 'anchored'
        });
      }
    });

    anchors.data?.forEach(a => {
      timeline.push({
        id: a.id,
        type: 'anchor',
        title: `Group Bundle Anchored`,
        timestamp: a.anchored_at || a.created_at,
        cid: a.root_cid,
        txHash: a.anchor_tx_hash,
        status: a.status
      });
    });

    return timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
