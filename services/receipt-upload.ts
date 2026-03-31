const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export type GetAccessToken = () => Promise<string | null | undefined>;

export interface UploadProgress {
  status: "idle" | "compressing" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  cid?: string;
}

async function compressImage(file: File): Promise<Blob> {
  if (file.type === "application/pdf" || file.size <= MAX_FILE_SIZE) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      const MAX_DIMENSION = 2000;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = (height / width) * MAX_DIMENSION;
          width = MAX_DIMENSION;
        } else {
          width = (width / height) * MAX_DIMENSION;
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Compression failed"));
        },
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Image load failed"));
    };
  });
}


export async function uploadReceipt(
  file: File,
  onProgress: (p: UploadProgress) => void,
  getAccessToken: GetAccessToken
): Promise<string> {
  try {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Unsupported file type. Please use JPEG, PNG, HEIC, or PDF.");
    }

    const token = await getAccessToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    onProgress({ status: "compressing", progress: 10 });
    const compressedBlob = await compressImage(file);
    
    onProgress({ status: "uploading", progress: 30 });
    const fileToUpload = new File([compressedBlob], file.name, {
      type: compressedBlob.type || file.type || "application/octet-stream",
    });
    const formData = new FormData();
    formData.append("file", fileToUpload);

    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const uploadPayload = await uploadRes.json();
    if (!uploadRes.ok || !uploadPayload?.success || !uploadPayload?.data?.cid) {
      const errMsg =
        uploadPayload?.error?.message ||
        (uploadPayload?.data && typeof uploadPayload.data === "object" && "error" in uploadPayload.data
          ? String((uploadPayload.data as { error?: string }).error)
          : "") ||
        "Upload failed";
      throw new Error(errMsg || "Upload failed");
    }
    const cid = uploadPayload.data.cid as string;
    
    onProgress({ status: "success", progress: 100, cid });
    return cid;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    onProgress({ status: "error", progress: 0, error: message });
    throw error;
  }
}
