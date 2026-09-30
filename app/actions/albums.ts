"use server";

import { runAdminAction } from "@/app/lib/action-guard";
import {
  createAlbum,
  createPhoto,
  deleteAlbum,
  deletePhoto,
  reorderAlbums,
  reorderPhotos,
  updateAlbum,
  updatePhoto,
} from "@/app/lib/mutations/albums";
import type {
  AlbumInput,
  PhotoInput,
  PhotoReorderInput,
} from "@/app/lib/mutations/albums";
import type { ReorderInput } from "@/app/lib/reorder";

export async function createAlbumAction(input: AlbumInput) {
  return runAdminAction(() => createAlbum(input));
}

export async function updateAlbumAction(id: string, input: AlbumInput) {
  return runAdminAction(() => updateAlbum(id, input));
}

export async function deleteAlbumAction(id: string) {
  return runAdminAction(() => deleteAlbum(id));
}

export async function reorderAlbumsAction(input: ReorderInput) {
  return runAdminAction(async () => {
    await reorderAlbums(input);
    return null;
  });
}

export async function createPhotoAction(input: PhotoInput) {
  return runAdminAction(() => createPhoto(input));
}

export async function updatePhotoAction(id: string, input: PhotoInput) {
  return runAdminAction(() => updatePhoto(id, input));
}

export async function deletePhotoAction(id: string) {
  return runAdminAction(() => deletePhoto(id));
}

export async function reorderPhotosAction(input: PhotoReorderInput) {
  return runAdminAction(async () => {
    await reorderPhotos(input);
    return null;
  });
}
