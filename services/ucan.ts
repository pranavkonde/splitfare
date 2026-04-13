import { StorachaService } from "@/lib/storacha";

export interface DelegationProof {
  cid: string;
  audience: string;
  abilities: string[];
  expiration: number;
}

export class UCANService {
  constructor(private storacha: StorachaService) {}

  /**
   * Standard Storacha abilities.
   * See: https://docs.storacha.network/concepts/architecture-options/#delegated
   */
  static ABILITIES = {
    MEMBER: [
      "space/blob/add",
      "space/index/add",
      "filecoin/offer",
      "upload/add",
      "space/blob/list",
      "upload/list",
    ],
    ADMIN: [
      "space/blob/add",
      "space/index/add",
      "filecoin/offer",
      "upload/add",
      "space/blob/list",
      "upload/list",
    ],
    OWNER: ["*"], // Full access
  };

  /**
   * Create a delegation for a user based on their role
   */
  async delegateAccess(
    spaceDid: string,
    audienceDid: string,
    role: "member" | "admin" | "owner" = "member"
  ): Promise<DelegationProof> {
    const abilities = this.getAbilitiesForRole(role);
    const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365; // 1 year

    try {
      const delegation = await this.storacha.createDelegation(audienceDid, abilities, {
        expiration,
        resource: spaceDid,
      }) as any;

      return {
        cid: delegation.cid?.toString() || delegation.toString(),
        audience: audienceDid,
        abilities,
        expiration,
      };
    } catch (error) {
      console.error("Failed to create UCAN delegation:", error);
      throw new Error(`Delegation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Verify if a user has the required access (simulated check or actual UCAN chain verification)
   */
  async verifyAccess(
    proofs: DelegationProof[],
    requiredAbilities: string[]
  ): Promise<boolean> {
    if (!proofs || proofs.length === 0) return false;

    const now = Math.floor(Date.now() / 1000);
    return proofs.some((proof) => {
      const hasAbilities = requiredAbilities.every((req) => 
        proof.abilities.includes(req) || proof.abilities.includes("*")
      );
      const isNotExpired = proof.expiration > now;
      return hasAbilities && isNotExpired;
    });
  }

  private getAbilitiesForRole(role: string): string[] {
    switch (role) {
      case "owner":
        return UCANService.ABILITIES.OWNER;
      case "admin":
        return UCANService.ABILITIES.ADMIN;
      default:
        return UCANService.ABILITIES.MEMBER;
    }
  }
}
