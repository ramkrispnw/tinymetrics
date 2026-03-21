import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { getVanillaClient } from "@/lib/trpc";

export async function pickImage(
  source: "camera" | "gallery" = "gallery"
): Promise<{ uri: string; base64: string; mimeType: string } | null> {
  if (source === "camera") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      base64: asset.base64 || "",
      mimeType: asset.mimeType || "image/jpeg",
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    base64: asset.base64 || "",
    mimeType: asset.mimeType || "image/jpeg",
  };
}

export async function getBase64FromUri(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    // On web, fetch the blob and convert
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

/**
 * Uploads a photo to cloud S3 storage via the server upload endpoint.
 * Returns the public cloud URL, or null if upload fails (e.g. not authenticated).
 * 
 * Use this whenever a user attaches a photo to any event or milestone so that
 * all linked accounts in the household can access the image.
 */
export async function uploadPhotoToCloud(
  base64: string,
  mimeType: string = "image/jpeg"
): Promise<string | null> {
  if (!base64) return null;
  try {
    const client = getVanillaClient();
    const result = await client.upload.photo.mutate({ base64, mimeType });
    return result.url;
  } catch {
    // Not authenticated or network error — fall back to local URI gracefully
    return null;
  }
}
