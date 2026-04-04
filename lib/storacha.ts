import { formatCidUrl, normalizeCid } from "./cid-utils";

type BlobLike = Blob;

type StorachaClientType = {
  uploadFile(file: BlobLike, options?: Record<string, unknown>): Promise<{ toString(): string }>;
  uploadCAR(car: BlobLike, options?: Record<string, unknown>): Promise<{ toString(): string }>;
  createSpace(name?: string, options?: Record<string, unknown>): Promise<{ did(): string }>;
  currentSpace?: () => { did(): string } | string | undefined | null;
  setCurrentSpace?: (spaceDid: string) => Promise<void> | void;
  createDelegation?(
    audience: { did(): string },
    abilities: string[],
    options?: Record<string, unknown>
  ): Promise<{ archive(): Promise<Uint8Array> }>;
};

type StorachaServiceOptions = {
  gatewayHost?: string;
};

function cidToString(value: unknown): string {
  if (typeof value === "string") {
    return normalizeCid(value);
  }
  if (value && typeof value === "object" && "toString" in value) {
    const result = (value as { toString: () => string }).toString();
    return normalizeCid(result);
  }
  return normalizeCid(String(value));
}

export class StorachaService {
  private readonly client: StorachaClientType;
  private readonly gatewayHost: string;
  private readonly defaultSpaceName: string;

  constructor(client: StorachaClientType, options?: StorachaServiceOptions) {
    this.client = client;
    this.gatewayHost = options?.gatewayHost ?? "storacha.link";
    this.defaultSpaceName = "splitfare-default-space";
  }

  async uploadFile(file: BlobLike): Promise<string> {
    await this.ensureCurrentSpace();
    const cid = await this.client.uploadFile(file);
    return cidToString(cid);
  }

  async uploadJson(value: unknown): Promise<string> {
    const encoded = JSON.stringify(value);
    const blob = new Blob([encoded], { type: "application/json" });
    return this.uploadFile(blob);
  }

  async uploadCar(car: BlobLike): Promise<string> {
    await this.ensureCurrentSpace();
    const cid = await this.client.uploadCAR(car);
    return cidToString(cid);
  }

  private async ensureCurrentSpace(): Promise<void> {
    // Older/mock clients may not expose space-management APIs.
    if (!this.client.currentSpace && !this.client.setCurrentSpace) {
      return;
    }

    const currentSpace = this.client.currentSpace?.();
    if (currentSpace) return;

    const createdSpace = await this.client.createSpace(this.defaultSpaceName);
    const createdDid = typeof createdSpace?.did === "function" ? createdSpace.did() : String(createdSpace?.did ?? "");
    if (!createdDid) return;

    if (this.client.setCurrentSpace) {
      await this.client.setCurrentSpace(createdDid);
    }
  }

  gatewayUrl(cid: string, path?: string): string {
    return formatCidUrl(cid, path, this.gatewayHost);
  }

  async createSpace(name?: string, options?: unknown): Promise<unknown> {
    const space = await this.client.createSpace(name, options as never);
    return space;
  }

  async createDelegation(
    audience: unknown,
    abilities: unknown[],
    options?: unknown
  ): Promise<unknown> {
    if (!this.client.createDelegation) {
      throw new Error("Storacha client does not support delegations");
    }
    const delegation = await this.client.createDelegation(
      audience as { did(): string },
      abilities as string[],
      options as Record<string, unknown>
    );
    return delegation;
  }
}

