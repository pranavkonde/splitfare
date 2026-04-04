import * as StorachaClient from "@storacha/client";
import { parse as parseProof } from "@storacha/client/proof";
import { StoreMemory } from "@storacha/client/stores/memory";
import * as Ed25519 from "@ucanto/principal/ed25519";
import { StorachaService } from "./storacha";

type StorachaServiceOptions = {
  gatewayHost?: string;
};

let envBackedService: Promise<StorachaService> | undefined;
let defaultService: Promise<StorachaService> | undefined;

function readPrincipalRaw(): string | undefined {
  const key = process.env.STORACHA_KEY?.trim();
  const alt = process.env.STORACHA_PRINCIPAL?.trim();
  return key || alt || undefined;
}

function readProofRaw(): string | undefined {
  const p = process.env.STORACHA_PROOF?.trim();
  return p || undefined;
}

function parsePrincipalSecret(raw: string) {
  const s = raw.trim();
  if (s.startsWith("{")) {
    const j = JSON.parse(s) as { id: string; keys: Record<string, string | number[]> };
    const id = j.id as `did:key:${string}`;
    const entry = j.keys[id];
    if (typeof entry === "string") {
      const signer = Ed25519.parse(entry);
      return Ed25519.from({ id, keys: { [id]: signer } } as never);
    }
    if (Array.isArray(entry)) {
      return Ed25519.from({
        id,
        keys: { [id]: Ed25519.decode(new Uint8Array(entry)) },
      } as never);
    }
    throw new Error("Invalid STORACHA_KEY JSON: expected string or number[] for principal key material");
  }
  return Ed25519.parse(s);
}

function assertEnvPairConsistent(): void {
  const hasKey = Boolean(readPrincipalRaw());
  const hasProof = Boolean(readProofRaw());
  if (hasKey !== hasProof) {
    throw new Error(
      "Storacha is misconfigured: set both STORACHA_KEY (or STORACHA_PRINCIPAL) and STORACHA_PROOF, or leave both unset to use the local w3up agent store"
    );
  }
}

async function createFromEnvCredentials(options?: StorachaServiceOptions): Promise<StorachaService> {
  const keyRaw = readPrincipalRaw()!;
  const proofRaw = readProofRaw()!;
  const principal = parsePrincipalSecret(keyRaw);
  const store = new StoreMemory();
  const client = await StorachaClient.create({ store, principal });
  const proof = await parseProof(proofRaw);
  await client.addSpace(proof);
  const spaceDid = process.env.STORACHA_SPACE_DID?.trim();
  if (spaceDid) {
    await client.setCurrentSpace(spaceDid as `did:${string}:${string}`);
  }
  return new StorachaService(client as unknown as ConstructorParameters<typeof StorachaService>[0], options);
}

/**
 * Server-side Storacha client.
 *
 * If `STORACHA_KEY` (or `STORACHA_PRINCIPAL`) and `STORACHA_PROOF` are set, uses an in-memory
 * agent with that principal and space proof (recommended for deploys).
 * Otherwise falls back to the default persisted w3up store (local CLI login).
 */
export async function createServerStorachaService(
  options?: StorachaServiceOptions
): Promise<StorachaService> {
  assertEnvPairConsistent();
  const useEnv = Boolean(readPrincipalRaw() && readProofRaw());
  if (useEnv) {
    if (!envBackedService) {
      envBackedService = createFromEnvCredentials(options);
    }
    return envBackedService;
  }
  if (!defaultService) {
    defaultService = (async () => {
      const client = await StorachaClient.create();
      return new StorachaService(client as unknown as ConstructorParameters<typeof StorachaService>[0], options);
    })();
  }
  return defaultService;
}
