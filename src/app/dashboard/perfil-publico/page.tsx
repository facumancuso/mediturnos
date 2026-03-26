'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, Camera } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import type { Professional } from '@/types';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

type ProfileFormState = {
  name: string;
  dni?: string;
  specialty: string;
  address: string;
  whatsappNumber: string;
  photoURL: string;
  coverImageUrl: string;
  publicProfile: {
    enabled: boolean;
    slug: string;
    bio: string;
    insurances: string;
    mapUrl: string;
    rating: number;
    reviewCount: number;
    verified: boolean;
  };
};

const fallbackForm: ProfileFormState = {
  name: 'Profesional',
  dni: '',
  specialty: 'No especificada',
  address: 'No especificada',
  whatsappNumber: '',
  photoURL: 'https://picsum.photos/seed/prof-avatar-fallback/100/100',
  coverImageUrl: 'https://picsum.photos/seed/prof-banner-fallback/600/200',
  publicProfile: {
    enabled: true,
    slug: 'profesional',
    bio: '',
    insurances: '',
    mapUrl: '',
    rating: 0,
    reviewCount: 0,
    verified: false,
  },
};

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export default function PublicProfilePage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [professionalId, setProfessionalId] = useState<string>('');
  const [form, setForm] = useState<ProfileFormState>(fallbackForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setProfessionalId('');
      setForm(fallbackForm);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProfessional() {
      try {
        setIsLoading(true);
        const response = await fetchWithAuth(`/api/dashboard/professional?professionalId=${uid}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('No se pudo cargar el perfil profesional.');
        }

        const data = (await response.json()) as Professional & { coverImageUrl?: string };
        const profile = data.publicProfile || ({} as Professional['publicProfile']);

        if (!cancelled) {
          setProfessionalId((data.id ?? uid) as string);
          setForm({
            name: data.name || fallbackForm.name,
            dni: data.dni || '',
            specialty: data.specialty || fallbackForm.specialty,
            address: data.address || fallbackForm.address,
            whatsappNumber: data.whatsappNumber || '',
            photoURL: data.photoURL || fallbackForm.photoURL,
            coverImageUrl: data.coverImageUrl || fallbackForm.coverImageUrl,
            publicProfile: {
              enabled: profile.enabled ?? true,
              slug: profile.slug || slugify(data.name || fallbackForm.name),
              bio: profile.bio || '',
              insurances: (profile.insurances || []).join(', '),
              mapUrl: profile.mapUrl || '',
              rating: profile.rating || 0,
              reviewCount: profile.reviewCount || 0,
              verified: profile.verified || false,
            },
          });
        }
      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Error cargando perfil',
          description: 'No se pudieron cargar tus datos de perfil.',
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProfessional();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, toast]);

  async function handleSave() {
    if (!professionalId) {
      toast({
        variant: 'destructive',
        title: 'Sin sesión',
        description: 'Debes iniciar sesión para guardar cambios.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetchWithAuth('/api/dashboard/professional', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalId,
          name: form.name,
          dni: form.dni,
          specialty: form.specialty,
          address: form.address,
          whatsappNumber: form.whatsappNumber,
          photoURL: form.photoURL,
          coverImageUrl: form.coverImageUrl,
          publicProfile: {
            enabled: form.publicProfile.enabled,
            slug: form.publicProfile.slug || slugify(form.name),
            bio: form.publicProfile.bio,
            insurances: form.publicProfile.insurances
              .split(',')
              .map((insurance) => insurance.trim())
              .filter(Boolean),
            mapUrl: form.publicProfile.mapUrl,
          },
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo guardar el perfil.');
      }

      const updated = payload as Professional & { coverImageUrl?: string };
      const updatedProfile = updated.publicProfile || ({} as Professional['publicProfile']);

      setForm((current) => ({
        ...current,
        name: updated.name || current.name,
        specialty: updated.specialty || current.specialty,
        address: updated.address || current.address,
        whatsappNumber: updated.whatsappNumber || current.whatsappNumber,
        photoURL: updated.photoURL || current.photoURL,
        coverImageUrl: updated.coverImageUrl || current.coverImageUrl,
        publicProfile: {
          ...current.publicProfile,
          enabled: updatedProfile.enabled ?? current.publicProfile.enabled,
          slug: updatedProfile.slug || current.publicProfile.slug,
          bio: updatedProfile.bio || current.publicProfile.bio,
          insurances: (updatedProfile.insurances || [])
            .join(', '),
          mapUrl: updatedProfile.mapUrl || current.publicProfile.mapUrl,
          rating: updatedProfile.rating || current.publicProfile.rating,
          reviewCount: updatedProfile.reviewCount || current.publicProfile.reviewCount,
          verified: updatedProfile.verified || current.publicProfile.verified,
        },
      }));

      toast({
        title: 'Perfil actualizado',
        description: 'Tus cambios se guardaron correctamente.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: error instanceof Error ? error.message : 'No se pudo guardar el perfil.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAvatarChange(file?: File) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((current) => ({ ...current, photoURL: dataUrl }));
  }

  async function handleCoverChange(file?: File) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((current) => ({ ...current, coverImageUrl: dataUrl }));
  }

  const profileUrl = `/profesional/${form.publicProfile.slug || slugify(form.name)}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Perfil Público</h1>
        <p className="text-muted-foreground">Así te verán los pacientes en el directorio de MediTurnos.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Editar Perfil</CardTitle>
              <CardDescription>Completa tu información para atraer más pacientes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="public-profile-switch" className="text-base">Aparecer en el directorio público</Label>
                  <p className="text-sm text-muted-foreground">Permite que nuevos pacientes te encuentren y soliciten turnos.</p>
                </div>
                <Switch
                  id="public-profile-switch"
                  checked={form.publicProfile.enabled}
                  onCheckedChange={(enabled) =>
                    setForm((current) => ({
                      ...current,
                      publicProfile: { ...current.publicProfile, enabled },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nombre profesional</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name: value,
                      publicProfile: {
                        ...current.publicProfile,
                        slug: slugify(value || 'profesional'),
                      },
                    }));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dni">DNI (sin puntos)</Label>
                <Input
                  id="dni"
                  value={form.dni || ''}
                  onChange={(event) => setForm((current) => ({ ...current, dni: event.target.value }))}
                  placeholder="12345678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialty">Especialidad Principal</Label>
                <Input
                  id="specialty"
                  value={form.specialty}
                  onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección del Consultorio</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp de contacto</Label>
                <Input
                  id="whatsapp"
                  value={form.whatsappNumber}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, whatsappNumber: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Biografía Profesional</Label>
                <Textarea
                  id="bio"
                  className="min-h-[120px]"
                  value={form.publicProfile.bio}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      publicProfile: { ...current.publicProfile, bio: event.target.value },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insurances">Obras Sociales Aceptadas</Label>
                <Input
                  id="insurances"
                  value={form.publicProfile.insurances}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      publicProfile: { ...current.publicProfile, insurances: event.target.value },
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">Separalas por coma.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mapUrl">Enlace de Google Maps (Embed)</Label>
                <Input
                  id="mapUrl"
                  value={form.publicProfile.mapUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      publicProfile: { ...current.publicProfile, mapUrl: event.target.value },
                    }))
                  }
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSave} disabled={isLoading || isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estado del Perfil</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={form.publicProfile.enabled ? 'default' : 'secondary'} className={form.publicProfile.enabled ? 'bg-green-600' : ''}>
                {form.publicProfile.enabled ? 'Visible en directorio' : 'Oculto del directorio'}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">
                {form.publicProfile.enabled
                  ? 'Tu perfil está activo y se muestra en el directorio público.'
                  : 'Tu perfil está oculto y no aparece en el directorio.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Vista Previa</CardTitle>
                  <CardDescription>Así se ve tu tarjeta en el directorio.</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={profileUrl} target="_blank">
                    Ver <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Card className="overflow-hidden">
                <div className="relative h-32 bg-primary/20 group">
                  <Image src={form.coverImageUrl} alt="Portada" fill className="object-cover" />
                  <label htmlFor="cover-photo-upload" className="absolute inset-0 bg-black/50 items-center justify-center cursor-pointer hidden group-hover:flex">
                    <Camera className="h-6 w-6 text-white" />
                    <span className="ml-2 text-white font-medium">Cambiar portada</span>
                  </label>
                  <input
                    id="cover-photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleCoverChange(event.target.files?.[0])}
                  />
                </div>

                <div className="p-4 relative">
                  <div className="absolute -top-10 left-4 h-16 w-16 rounded-full border-4 border-background bg-muted overflow-hidden group">
                    <Image src={form.photoURL} alt="Avatar" fill className="object-cover" />
                    <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/50 items-center justify-center cursor-pointer hidden group-hover:flex">
                      <Camera className="h-5 w-5 text-white" />
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => void handleAvatarChange(event.target.files?.[0])}
                    />
                  </div>

                  <div className="pt-8">
                    <h3 className="text-lg font-bold">{form.name}</h3>
                    <p className="text-sm text-primary font-medium">{form.specialty}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-sm text-muted-foreground">{form.publicProfile.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
