import { supabase } from "./supabase";

const BUCKET = "avatars";

// Photos off a phone camera are several megabytes; the bucket caps at 2MB and
// the avatar renders at ~52px. Resizing before upload keeps uploads fast on
// the school's patchy connection and keeps storage costs near zero.
const MAX_EDGE = 512;
const QUALITY = 0.7;

/**
 * Storage path for a user's avatar. The first path segment is the auth user
 * id, which is what the storage RLS policy checks — so a user can only ever
 * write inside their own folder.
 */
const pathFor = (authUserId, ext) => `${authUserId}/avatar.${ext}`;

/** Downscale and re-encode a picked File as a JPEG Blob, square-cropped. */
async function compressToBlob(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const edge = Math.min(MAX_EDGE, side);
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  canvas
    .getContext("2d")
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, edge, edge);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Could not read the selected image.");
  return blob;
}

/**
 * Uploads a picked image File as the signed-in user's avatar and records the URL on
 * their staff row. Returns the public URL.
 *
 * Overwrites the existing file at the same path rather than creating a new
 * one, so replacing a photo can never orphan the old file in storage.
 */
export async function uploadAvatar(file, staffId) {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new Error("You need to be signed in to change your photo.");

  const bytes = await compressToBlob(file);

  // Guard against the silent-empty-upload failure mode: better to fail loudly
  // here than to store a 0-byte file and show the user a blank avatar.
  if (!bytes || bytes.size === 0) {
    throw new Error("The image came back empty. Try another photo.");
  }

  const path = pathFor(authUser.id, "jpg");
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Cache-bust: the path is stable across replacements, so without a unique
  // query the phone and CDN would keep serving the previous image.
  const url = `${publicUrl}?v=${Date.now()}`;

  const { error: dbError } = await supabase
    .from("staff")
    .update({ photo_url: url })
    .eq("id", staffId);
  if (dbError) throw new Error(dbError.message);

  return url;
}

/** Removes the photo from storage and clears it on the staff row. */
export async function removeAvatar(staffId) {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new Error("You need to be signed in to change your photo.");

  // Storage removal is best-effort — clearing the database reference is what
  // actually takes the photo out of the app, so a storage hiccup must not
  // leave the user stuck with an image they asked to delete.
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([pathFor(authUser.id, "jpg")]);
  if (storageError) console.warn("Avatar file not removed:", storageError.message);

  const { error: dbError } = await supabase
    .from("staff")
    .update({ photo_url: null })
    .eq("id", staffId);
  if (dbError) throw new Error(dbError.message);
}
