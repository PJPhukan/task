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

// Fake Cloudinary storage for testing
const fakeCloudinaryStorage: Record<string, CloudinaryResource> = {};

function isConfigured(): boolean {
  return !!(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);
}

export async function generateUploadSignature(
  folder: string,
  kind: "attachment" | "avatar"
): Promise<CloudinarySignature | null> {
  if (!isConfigured()) {
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

export async function getResourceInfo(publicId: string): Promise<CloudinaryResource | null> {
  if (useFakeCloudinary) {
    return fakeCloudinaryStorage[publicId] || null;
  }

  if (!isConfigured()) {
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

export async function deleteResource(publicId: string): Promise<boolean> {
  if (useFakeCloudinary) {
    if (fakeCloudinaryStorage[publicId]) {
      delete fakeCloudinaryStorage[publicId];
      return true;
    }
    return false;
  }

  if (!isConfigured()) {
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
  return isConfigured();
}

// Test helpers for fake Cloudinary
export function setFakeCloudinaryResource(publicId: string, resource: CloudinaryResource) {
  if (useFakeCloudinary) {
    fakeCloudinaryStorage[publicId] = resource;
  }
}

export function clearFakeCloudinaryResources() {
  if (useFakeCloudinary) {
    Object.keys(fakeCloudinaryStorage).forEach(key => delete fakeCloudinaryStorage[key]);
  }
}

export function getFakeCloudinaryResources() {
  if (useFakeCloudinary) {
    return { ...fakeCloudinaryStorage };
  }
  return {};
}
