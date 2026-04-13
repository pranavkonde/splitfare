import { formatCidUrl, isValidCid } from "./cid-utils";

export function resolveMediaUrl(cidOrUrl: string): string {
  const value = (cidOrUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:") || value.startsWith("/")) {
    return value;
  }
  // Use subdomain-style URL: https://{cid}.ipfs.storacha.link
  // This is recommended by Storacha docs for same-origin isolation
  if (isValidCid(value)) {
    return formatCidUrl(value);
  }
  // Fallback for non-CID strings (shouldn't happen in normal flow)
  return `https://storacha.link/ipfs/${value}`;
}

