'use client';

import { useRef, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types';
import type { MedicalFile } from '@/lib/firebase-storage';
import { uploadMedicalFile, deleteMedicalFile, ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_MB } from '@/lib/firebase-storage';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Paperclip,
  Trash2,
  Download,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Loader2,
  Save,
  XCircle,
} from 'lucide-react';

const statusStyles: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  no_show: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const statusLabels: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
};

const typeLabels: Record<string, string> = {
  first_time: 'Primera vez',
  checkup: 'Control',
  urgent: 'Urgencia',
};

export type MedicalRecord = {
  id: string;
  professionalId: string;
  patientId: string;
  appointmentId: string | null;
  notes: string;
  files: MedicalFile[];
};

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value as string);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500 shrink-0" />;
  if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />;
  if (mimeType.includes('word')) return <FileText className="h-4 w-4 text-blue-700 shrink-0" />;
  return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type AppointmentRecordProps = {
  appointment: Appointment;
  record: MedicalRecord | undefined;
  professionalId: string;
  patientId: string;
  onRecordChange: (record: MedicalRecord) => void;
};

function AppointmentRecord({ appointment, record, professionalId, patientId, onRecordChange }: AppointmentRecordProps) {
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apptDate = safeDate(appointment.date);

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const res = await fetchWithAuth(
        record
          ? `/api/dashboard/medical-records/${record.id}`
          : '/api/dashboard/medical-records',
        {
          method: record ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            record
              ? { notes }
              : { professionalId, patientId, appointmentId: appointment.id, notes }
          ),
        }
      );
      if (res.ok) {
        const updated: MedicalRecord = await res.json();
        onRecordChange(updated);
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    setFileError('');

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`El archivo supera los ${MAX_FILE_SIZE_MB} MB máximos.`);
      return;
    }
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setFileError('Tipo de archivo no permitido. Usa imágenes, PDF, Word o Excel.');
      return;
    }

    setUploadingFile(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadMedicalFile(
        file,
        professionalId,
        patientId,
        appointment.id,
        setUploadProgress
      );

      // Always use POST — handles upsert correctly for both new and existing records
      const res = await fetchWithAuth('/api/dashboard/medical-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalId,
          patientId,
          appointmentId: appointment.id,
          file: uploaded,
        }),
      });

      if (res.ok) {
        const updated: MedicalRecord = await res.json();
        onRecordChange(updated);
      }
    } catch {
      setFileError('Error al subir el archivo. Intenta nuevamente.');
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
    }
  }

  async function deleteFile(fileItem: MedicalFile) {
    setDeletingFileId(fileItem.id);
    try {
      await deleteMedicalFile(fileItem.storagePath);
      if (record) {
        const res = await fetchWithAuth(
          `/api/dashboard/medical-records/${record.id}?fileId=${fileItem.id}`,
          { method: 'DELETE' }
        );
        if (res.ok) {
          const updated: MedicalRecord = await res.json();
          onRecordChange(updated);
        }
      }
    } finally {
      setDeletingFileId(null);
    }
  }

  const files = record?.files ?? [];

  return (
    <div className="space-y-4 pt-1">
      {/* Notes */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Observaciones / Notas clínicas</p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Escribí tus notas clínicas, diagnóstico, indicaciones..."
          rows={4}
          className="resize-none text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={saveNotes}
          disabled={savingNotes || notes === (record?.notes ?? '')}
        >
          {savingNotes ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          Guardar notas
        </Button>
      </div>

      {/* Files */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Archivos adjuntos</p>

        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm min-w-0">
                <FileIcon mimeType={f.mimeType} />
                <span className="flex-1 truncate font-medium min-w-0">{f.name}</span>
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{formatBytes(f.size)}</span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => deleteFile(f)}
                  disabled={deletingFileId === f.id}
                  className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  {deletingFileId === f.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {fileError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> {fileError}
          </p>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MIME_TYPES.join(',')}
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
          >
            {uploadingFile ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Subiendo... {uploadProgress > 0 ? `${uploadProgress}%` : ''}
              </>
            ) : (
              <>
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                Adjuntar archivo
              </>
            )}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Imágenes, PDF, Word, Excel — máx. {MAX_FILE_SIZE_MB} MB
          </p>
        </div>
      </div>
    </div>
  );
}

type MedicalRecordPanelProps = {
  appointments: Appointment[];
  records: MedicalRecord[];
  loading: boolean;
  professionalId: string;
  patientId: string;
  onRecordChange: (record: MedicalRecord) => void;
};

export function MedicalRecordPanel({
  appointments,
  records,
  loading,
  professionalId,
  patientId,
  onRecordChange,
}: MedicalRecordPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No hay turnos registrados para este paciente.
      </div>
    );
  }

  // Exclude cancelled appointments and sort newest first
  const sorted = appointments
    .filter((a) => a.status !== 'cancelled')
    .sort((a, b) => (safeDate(b.date)?.getTime() ?? 0) - (safeDate(a.date)?.getTime() ?? 0));

  return (
    <Accordion type="single" collapsible className="space-y-2">
      {sorted.map((appt) => {
        const record = records.find((r) => r.appointmentId === appt.id);
        const apptDate = safeDate(appt.date);
        const hasFiles = (record?.files?.length ?? 0) > 0;
        const hasNotes = !!record?.notes?.trim();

        return (
          <AccordionItem
            key={appt.id}
            value={appt.id}
            className="border rounded-lg px-4"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex flex-col gap-1 text-left w-full mr-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-snug">
                    {apptDate ? format(apptDate, "dd 'de' MMM yyyy", { locale: es }) : '—'}
                    <span className="text-muted-foreground"> · {appt.time} hs</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{typeLabels[appt.type] ?? appt.type}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasNotes && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">Notas</span>
                  )}
                  {hasFiles && (
                    <span className="text-xs flex items-center gap-0.5 text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      {record!.files.length}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={cn('border-none text-xs', statusStyles[appt.status] ?? '')}
                  >
                    {statusLabels[appt.status] ?? appt.status}
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <AppointmentRecord
                appointment={appt}
                record={record}
                professionalId={professionalId}
                patientId={patientId}
                onRecordChange={onRecordChange}
              />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
