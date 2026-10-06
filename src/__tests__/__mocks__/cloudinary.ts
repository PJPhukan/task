// Fake Cloudinary implementation for testing
const fakeCloudinaryStorage: Record<string, any> = {};

export interface CloudinaryResource {
  public_id: string;
  resource_type: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

export async function getResourceInfo(publicId: string): Promise<CloudinaryResource | null> {
  return fakeCloudinaryStorage[publicId] || null;
}

export async function deleteResource(publicId: string): Promise<boolean> {
  if (fakeCloudinaryStorage[publicId]) {
    delete fakeCloudinaryStorage[publicId];
    return true;
  }
  return false;
}

export function buildImageUrl(publicId: string, width?: number): string {
  return `https://fake-cloudinary.com/${publicId}${width ? `?w=${width}` : ""}`;
}

export async function generateUploadSignature(): Promise<any> {
  return null;
}

export function isCloudinaryConfigured(): boolean {
  return false;
}

// Test helpers
export function setFakeResource(publicId: string, resource: CloudinaryResource) {
  fakeCloudinaryStorage[publicId] = resource;
}

export function clearFakeResources() {
  Object.keys(fakeCloudinaryStorage).forEach(key => delete fakeCloudinaryStorage[key]);
}

export function getFakeResources() {
  return { ...fakeCloudinaryStorage };
}
