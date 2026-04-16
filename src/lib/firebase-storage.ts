'use client';

import { getApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

export type MedicalFile = {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const MAX_FILE_SIZE_MB = 10;

export async function uploadMedicalFile(
  file: File,
  professionalId: string,
  patientId: string,
  appointmentId: string,
  onProgress?: (pct: number) => void
): Promise<MedicalFile> {
  const storage = getStorage(getApp());
  const fileId = crypto.randomUUID();
  const ext = file.name.split('.').pop() ?? 'bin';
  const storagePath = `medical-records/${professionalId}/${patientId}/${appointmentId}/${fileId}.${ext}`;
  const storageRef = ref(storage, storagePath);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
    task.on(
      'state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      () => resolve()
    );
  });

  const url = await getDownloadURL(storageRef);

  return {
    id: fileId,
    name: file.name,
    url,
    storagePath,
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteMedicalFile(storagePath: string): Promise<void> {
  const storage = getStorage(getApp());
  await deleteObject(ref(storage, storagePath));
}
