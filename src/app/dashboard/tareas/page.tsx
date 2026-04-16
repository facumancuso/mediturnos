'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Filter,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type TaskPriority = 'low' | 'medium' | 'high';
type TaskStatus = 'pending' | 'completed';

type TaskItem = {
  id: string;
  title: string;
  description?: string;
  dueAt?: string | null;
  remindAt?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: string | null;
  createdAt?: string | null;
};

type FormState = {
  title: string;
  description: string;
  dueAt: string;
  remindAt: string;
  priority: TaskPriority;
};

const priorityBadgeClass: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  high: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};

const priorityLabel: Record<TaskPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const emptyForm: FormState = {
  title: '',
  description: '',
  dueAt: '',
  remindAt: '',
  priority: 'medium',
};

function isoToLocalInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export default function TareasPage() {
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<'all' | TaskPriority>('all');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    void loadTasks();
  }, [user?.uid]);

  async function loadTasks() {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth('/api/dashboard/tasks', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as TaskItem[];
      setTasks(data);
    } catch {
      setTasks([]);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las tareas.' });
    } finally {
      setIsLoading(false);
    }
  }

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
      if (!query) return true;
      return (
        task.title.toLowerCase().includes(query) ||
        String(task.description || '').toLowerCase().includes(query)
      );
    });
  }, [tasks, search, filterPriority]);

  const pendingTasks = filteredTasks.filter((task) => task.status === 'pending');
  const completedTasks = filteredTasks.filter((task) => task.status === 'completed');

  const dueSoonCount = useMemo(() => {
    const now = Date.now();
    const next24h = now + 24 * 60 * 60 * 1000;
    return tasks.filter((task) => {
      if (task.status === 'completed' || !task.dueAt) return false;
      const due = new Date(task.dueAt).getTime();
      return due >= now && due <= next24h;
    }).length;
  }, [tasks]);

  async function handleCreateTask() {
    if (!form.title.trim()) {
      toast({ variant: 'destructive', title: 'Titulo requerido', description: 'Completa el titulo de la tarea.' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetchWithAuth('/api/dashboard/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          dueAt: localInputToIso(form.dueAt),
          remindAt: localInputToIso(form.remindAt),
          priority: form.priority,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast({ variant: 'destructive', title: 'Error', description: payload?.error || 'No se pudo crear la tarea.' });
        return;
      }

      setTasks((current) => [payload as TaskItem, ...current]);
      setForm(emptyForm);
      setIsDialogOpen(false);
      toast({ title: 'Tarea creada', description: 'La tarea se agrego correctamente.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear la tarea.' });
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(task: TaskItem) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description || '',
      dueAt: isoToLocalInput(task.dueAt),
      remindAt: isoToLocalInput(task.remindAt),
      priority: task.priority,
    });
    setIsDialogOpen(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(false);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    if (!form.title.trim()) {
      toast({ variant: 'destructive', title: 'Titulo requerido', description: 'Completa el titulo de la tarea.' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetchWithAuth('/api/dashboard/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          title: form.title,
          description: form.description,
          dueAt: localInputToIso(form.dueAt),
          remindAt: localInputToIso(form.remindAt),
          priority: form.priority,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast({ variant: 'destructive', title: 'Error', description: payload?.error || 'No se pudo actualizar la tarea.' });
        return;
      }

      setTasks((current) => current.map((task) => (task.id === editingId ? (payload as TaskItem) : task)));
      setEditingId(null);
      setForm(emptyForm);
      setIsDialogOpen(false);
      toast({ title: 'Tarea actualizada', description: 'Los cambios fueron guardados.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar la tarea.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleTaskStatus(task: TaskItem) {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const response = await fetchWithAuth('/api/dashboard/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast({ variant: 'destructive', title: 'Error', description: payload?.error || 'No se pudo actualizar el estado.' });
        return;
      }
      setTasks((current) => current.map((item) => (item.id === task.id ? (payload as TaskItem) : item)));
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estado.' });
    }
  }

  async function deleteTask(id: string) {
    try {
      const response = await fetchWithAuth('/api/dashboard/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        toast({ variant: 'destructive', title: 'Error', description: payload?.error || 'No se pudo eliminar la tarea.' });
        return;
      }
      setTasks((current) => current.filter((task) => task.id !== id));
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la tarea.' });
    }
  }

  if (isUserLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tareas y recordatorios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organiza pendientes del consultorio y controla vencimientos en un solo lugar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => startCreate()} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva tarea
          </Button>
          <Button onClick={() => void loadTasks()} variant="outline" size="sm">Actualizar</Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Pendientes</p>
            <p className="mt-2 text-3xl font-bold">{tasks.filter((task) => task.status === 'pending').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Completadas</p>
            <p className="mt-2 text-3xl font-bold">{tasks.filter((task) => task.status === 'completed').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Vencen en 24h</p>
            <p className="mt-2 text-3xl font-bold">{dueSoonCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Tus tareas
            </CardTitle>
            <div className="flex w-full max-w-md items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por titulo o descripcion"
                  className="pl-9"
                />
              </div>
              <Select value={filterPriority} onValueChange={(value) => setFilterPriority(value as 'all' | TaskPriority)}>
                <SelectTrigger className="w-36">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, idx) => <Skeleton key={idx} className="h-24 w-full" />)}
            </div>
          ) : (
            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">Pendientes ({pendingTasks.length})</TabsTrigger>
                <TabsTrigger value="completed">Completadas ({completedTasks.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="space-y-3 mt-4">
                {pendingTasks.length === 0 ? (
                  <EmptyState message="No hay tareas pendientes con ese filtro." />
                ) : (
                  pendingTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => void toggleTaskStatus(task)}
                      onEdit={() => startEdit(task)}
                      onDelete={() => void deleteTask(task.id)}
                    />
                  ))
                )}
              </TabsContent>
              <TabsContent value="completed" className="space-y-3 mt-4">
                {completedTasks.length === 0 ? (
                  <EmptyState message="No hay tareas completadas con ese filtro." />
                ) : (
                  completedTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => void toggleTaskStatus(task)}
                      onEdit={() => startEdit(task)}
                      onDelete={() => void deleteTask(task.id)}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          cancelEdit();
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar nota o tarea' : 'Nueva nota o tarea'}</DialogTitle>
            <DialogDescription>
              Escribe la tarea como una nota completa y define, si quieres, prioridad, vencimiento y recordatorio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Titulo</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ej: Revisar turnos cancelados y recontactar pacientes"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Nota</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Escribe todo el detalle que necesites, como si fuera una nota interna del consultorio..."
                className="min-h-48 resize-y"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm((current) => ({ ...current, priority: value as TaskPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label>Fecha limite</Label>
                <Input
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label>Recordatorio</Label>
                <Input
                  type="datetime-local"
                  value={form.remindAt}
                  onChange={(event) => setForm((current) => ({ ...current, remindAt: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>Cancelar</Button>
            {editingId ? (
              <Button onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            ) : (
              <Button onClick={handleCreateTask} disabled={isSaving} className="gap-2">
                <Plus className="h-4 w-4" />
                {isSaving ? 'Creando...' : 'Crear tarea'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: TaskItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCompleted = task.status === 'completed';

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isCompleted ? 'bg-muted/40 border-muted' : 'bg-card'
    )}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('font-semibold', isCompleted && 'line-through text-muted-foreground')}>{task.title}</p>
            <Badge className={priorityBadgeClass[task.priority]}>{priorityLabel[task.priority]}</Badge>
          </div>
          {task.description && (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{task.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {task.dueAt && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Vence: {new Date(task.dueAt).toLocaleString('es-AR')}
              </span>
            )}
            {task.remindAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Recordar: {new Date(task.remindAt).toLocaleString('es-AR')}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant={isCompleted ? 'outline' : 'default'} size="sm" onClick={onToggle} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isCompleted ? 'Reabrir' : 'Completar'}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>Editar</Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}