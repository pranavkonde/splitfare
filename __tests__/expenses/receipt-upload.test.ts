import { describe, expect, it, vi, beforeEach } from "vitest";
import { uploadReceipt, UploadProgress } from "@/services/receipt-upload";

if (typeof window === "undefined") {
  (global as any).window = {
    navigator: { vibrate: vi.fn() },
    URL: { createObjectURL: vi.fn(() => "mock-url") },
  };
  (global as any).document = {
    createElement: vi.fn((tag) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (cb: any) => cb(new Blob(["compressed"], { type: "image/jpeg" })),
        };
      }
      return {};
    }),
  };
  (global as any).Image = class {
    onload: any;
    src: string = "";
    width: number = 100;
    height: number = 100;
    constructor() {
      setTimeout(() => this.onload && this.onload(), 0);
    }
  };
}

describe("Receipt Upload Service", () => {
  const mockFile = new File(["receipt-content"], "receipt.jpg", { type: "image/jpeg" });
  const mockCid = "bafybeigdyrztxw3r5v7rrf5f2lqf3e7l7xootm5qdn7x6zq7j5l3z5d2uy";
  const getToken = vi.fn().mockResolvedValue("test-token");

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("should upload receipt successfully and track progress", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { cid: mockCid } }),
    } as Response);

    const progressUpdates: UploadProgress[] = [];
    const onProgress = (p: UploadProgress) => progressUpdates.push(p);

    const result = await uploadReceipt(mockFile, onProgress, getToken);

    expect(result).toBe(mockCid);
    expect(getToken).toHaveBeenCalled();
    expect(progressUpdates).toContainEqual(expect.objectContaining({ status: "compressing" }));
    expect(progressUpdates).toContainEqual(expect.objectContaining({ status: "uploading" }));
    expect(progressUpdates).toContainEqual(expect.objectContaining({ status: "success", cid: mockCid }));
    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/upload",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      })
    );
  });

  it("should throw error for unsupported file types", async () => {
    const invalidFile = new File(["text"], "test.txt", { type: "text/plain" });
    const onProgress = vi.fn();

    await expect(uploadReceipt(invalidFile, onProgress, getToken)).rejects.toThrow("Unsupported file type");
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should handle upload failures and report error status", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: { message: "Network failure" } }),
    } as Response);

    const onProgress = vi.fn();

    await expect(uploadReceipt(mockFile, onProgress, getToken)).rejects.toThrow("Network failure");
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ status: "error", error: "Network failure" }));
  });
});
