import "server-only";
import crypto from "crypto";

export interface CloudinarySignature {
  signature: string;
  timestamp: number;
  apiKey: string;
}

export interface CloudinaryResource {
  public_id: string;
  resource_type: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

export interface CloudinaryError {
  error?: {
    message: string;
  };
}


const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const cloudinaryApiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
const useFakeCloudinary = process.env.USE_FAKE_CLOUDINARY === "true";

let activeCloudinaryClient: CloudinaryClient | null = null;

class CloudinaryClient {
  private storage: Record<string, CloudinaryResource> = {};
  private useFake: boolean;

  constructor(useFake: boolean = false) {
    this.useFake = useFake;
  }

  async getResourceInfo(publicId: string): Promise<CloudinaryResource | null> {
    if (this.useFake) {
      return this.storage[publicId] || null;
    }

    if (!this.isConfigured()) {
      return null;
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/resources/image,video/${publicId}`;
    const auth = Buffer.from(`${cloudinaryApiKey}:${cloudinaryApiSecret}`).toString("base64");

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as CloudinaryResource;
      return {
        public_id: data.public_id,
        resource_type: data.resource_type,
        format: data.format,
        bytes: data.bytes,
        width: data.width,
        height: data.height,
      };
    } catch {
      return null;
    }
  }

  async deleteResource(publicId: string): Promise<boolean> {
    if (this.useFake) {
      if (this.storage[publicId]) {
        delete this.storage[publicId];
        return true;
      }
      return false;
    }

    if (!this.isConfigured()) {
      return false;
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/resources/image,video/${publicId}`;
    const auth = Buffer.from(`${cloudinaryApiKey}:${cloudinaryApiSecret}`).toString("base64");

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Basic ${auth}` },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  generateUploadSignature(
    folder: string,
    _kind: "attachment" | "avatar"
  ): CloudinarySignature | null {
    if (!this.isConfigured()) {
      return null;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const allowedFormats = ["jpg", "png", "webp", "gif", "pdf"];
    const paramsToSign = {
      timestamp,
      folder,
      allowed_formats: allowedFormats.join(","),
      eager: "c_limit,w_2000/c_fill,w_200,h_200",
    };

    const paramsString = Object.entries(paramsToSign)
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("&");

    const signature = crypto
      .createHash("sha256")
      .update(paramsString + cloudinaryApiSecret)
      .digest("hex");

    return {
      signature,
      timestamp,
      apiKey: cloudinaryApiKey!,
    };
  }

  private isConfigured(): boolean {
    return !!(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);
  }

  isFake(): boolean {
    return this.useFake;
  }

  // Test helpers
  setFakeResource(publicId: string, resource: CloudinaryResource): void {
    if (this.useFake) {
      this.storage[publicId] = resource;
    }
  }

  getFakeStorage(): Record<string, CloudinaryResource> {
    if (this.useFake) {
      return { ...this.storage };
    }
    return {};
  }

  clearFakeStorage(): void {
    if (this.useFake) {
      Object.keys(this.storage).forEach(key => delete this.storage[key]);
    }
  }
}

export function getCloudinaryClient(): CloudinaryClient {
  if (!activeCloudinaryClient) {
    activeCloudinaryClient = new CloudinaryClient(useFakeCloudinary);
  }
  return activeCloudinaryClient;
}

export function setCloudinaryClient(client: CloudinaryClient): void {
  activeCloudinaryClient = client;
}

export function createFakeCloudinaryClient(): CloudinaryClient {
  return new CloudinaryClient(true);
}

// Backward compatibility exports
export async function generateUploadSignature(
  folder: string,
  kind: "attachment" | "avatar"
): Promise<CloudinarySignature | null> {
  return getCloudinaryClient().generateUploadSignature(folder, kind);
}

export async function getResourceInfo(publicId: string): Promise<CloudinaryResource | null> {
  return getCloudinaryClient().getResourceInfo(publicId);
}

export async function deleteResource(publicId: string): Promise<boolean> {
  return getCloudinaryClient().deleteResource(publicId);
}

export function buildImageUrl(publicId: string, width?: number): string {
  if (!cloudinaryCloudName) {
    return "";
  }

  const transformations = [];
  if (width) {
    transformations.push(`w_${width},c_limit,q_auto,f_auto`);
  } else {
    transformations.push("q_auto,f_auto");
  }

  const transform = transformations.join("/");
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${transform}/v1/${publicId}`;
}

export function isCloudinaryConfigured(): boolean {
  return !!(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);
}

// Test helpers for fake Cloudinary
export function setFakeCloudinaryResource(publicId: string, resource: CloudinaryResource) {
  getCloudinaryClient().setFakeResource(publicId, resource);
}

export function clearFakeCloudinaryResources() {
  getCloudinaryClient().clearFakeStorage();
}

export function getFakeCloudinaryResources() {
  return getCloudinaryClient().getFakeStorage();
}
