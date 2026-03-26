'use client';

import { MapPin, Search, Star, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { Professional } from '@/types';

function ProfessionalCard({ professional }: { professional: Professional }) {
  const publicProfile = professional.publicProfile || {};
  const coverImage =
    professional.coverImageUrl ||
    `https://picsum.photos/seed/${professional.id}-cover/600/200`;

  return (
    <Card className="overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/60">
      <CardContent className="p-0">
        {/* Cover image */}
        <div className="relative h-28 bg-gradient-to-br from-primary/20 to-sky-200/40">
          <Image
            src={coverImage}
            alt="Portada del profesional"
            fill
            className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
          />
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                publicProfile.verified === true ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span
              className={`text-[10px] font-semibold ${
                publicProfile.verified === true ? 'text-emerald-700' : 'text-slate-600'
              }`}
            >
              {publicProfile.verified === true ? 'Perfil verificado' : 'Perfil no verificado'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 pt-0">
          {/* Avatar + rating row */}
          <div className="flex items-end justify-between -mt-10 mb-3">
            <Avatar className="h-20 w-20 border-4 border-background shadow-md">
              <AvatarImage src={professional.photoURL} alt={professional.name} />
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/50 text-primary font-bold text-xl">
                {professional.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 mb-1">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="font-bold text-sm text-amber-700">
                {publicProfile.rating?.toFixed(1) || 'N/A'}
              </span>
              <span className="text-xs text-amber-600/70">({publicProfile.reviewCount || 0})</span>
            </div>
          </div>

          <h3 className="text-lg font-bold leading-tight">{professional.name}</h3>
          <p className="text-primary font-semibold text-sm mt-0.5">{professional.specialty}</p>

          <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs truncate">{professional.address}</span>
          </div>

          {publicProfile.insurances?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {publicProfile.insurances.slice(0, 2).map((insurance: string) => (
                <Badge key={insurance} variant="secondary" className="text-xs">
                  {insurance}
                </Badge>
              ))}
              {publicProfile.insurances.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{publicProfile.insurances.length - 2} más
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <div className="px-4 pb-4">
        <Button className="w-full gap-2 shadow-sm" asChild>
          <Link href={`/profesional/${publicProfile.slug}`}>Ver perfil y sacar turno</Link>
        </Button>
      </div>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Skeleton className="h-28 w-full" />
        <div className="px-4 pb-4 pt-0">
          <div className="flex items-end justify-between -mt-10 mb-3">
            <Skeleton className="h-20 w-20 rounded-full border-4 border-background" />
            <Skeleton className="h-7 w-20 rounded-full mb-1" />
          </div>
          <Skeleton className="h-5 w-3/4 mb-1.5" />
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-4 w-2/3 mb-4" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DirectoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfessionals() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/professionals', { cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudieron cargar los profesionales.');
        const data = (await response.json()) as Professional[];
        if (!cancelled) setProfessionals(data);
      } catch (error) {
        console.error(error);
        if (!cancelled) setProfessionals([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadProfessionals();
    return () => { cancelled = true; };
  }, []);

  const specialties = useMemo(
    () => [...new Set(professionals?.map((p) => p.specialty) || [])],
    [professionals]
  );
  const locations = useMemo(
    () => [...new Set(professionals?.map((p) => p.address) || [])],
    [professionals]
  );

  const filteredProfessionals = useMemo(() => {
    if (!professionals) return [];
    return professionals.filter((p) => {
      const matchesSearch =
        searchTerm === '' ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.specialty.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSpecialty = selectedSpecialty === '' || p.specialty === selectedSpecialty;
      const matchesLocation = selectedLocation === '' || p.address === selectedLocation;
      return matchesSearch && matchesSpecialty && matchesLocation;
    });
  }, [professionals, searchTerm, selectedSpecialty, selectedLocation]);

  const hasFilters = searchTerm || selectedSpecialty || selectedLocation;

  function clearFilters() {
    setSearchTerm('');
    setSelectedSpecialty('');
    setSelectedLocation('');
  }

  return (
    <>
      {/* ── HERO ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
        />
        <div
          aria-hidden
          className="absolute -top-20 right-0 -z-10 w-[500px] h-[500px] bg-sky-200/20 rounded-full blur-3xl"
        />

        <div className="container px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="outline"
              className="mb-4 border-primary/40 bg-primary/5 text-primary font-semibold px-3 py-1 gap-1.5"
            >
              <Users className="h-3.5 w-3.5" /> Directorio de Profesionales
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Encontrá al profesional{' '}
              <span className="text-primary">ideal para vos</span>
            </h1>
            <p className="mt-4 max-w-[600px] mx-auto text-lg text-muted-foreground md:text-xl">
              Explorá nuestra red de profesionales de la salud verificados y agendá tu turno hoy mismo.
            </p>
          </div>

          {/* Search card */}
          <Card className="max-w-4xl mx-auto mt-10 shadow-xl border-border/60">
            <CardContent className="p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-center">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o especialidad..."
                    className="pl-10 h-11"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select
                  value={selectedSpecialty}
                  onValueChange={(value) => setSelectedSpecialty(value === 'all' ? '' : value)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las especialidades</SelectItem>
                    {specialties.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedLocation}
                  onValueChange={(value) => setSelectedLocation(value === 'all' ? '' : value)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Ubicación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las ubicaciones</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── RESULTS ─────────────────────────────────────── */}
      <section className="pb-20 md:pb-28">
        <div className="container px-4 md:px-6">
          {/* Result count + clear */}
          {!isLoading && (
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">
                {filteredProfessionals.length === 0
                  ? 'Sin resultados'
                  : `${filteredProfessionals.length} profesional${filteredProfessionals.length !== 1 ? 'es' : ''} encontrado${filteredProfessionals.length !== 1 ? 's' : ''}`}
              </p>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading ? (
              [...Array(8)].map((_, i) => <CardSkeleton key={i} />)
            ) : filteredProfessionals.length > 0 ? (
              filteredProfessionals.map((professional) => (
                <ProfessionalCard key={professional.id} professional={professional} />
              ))
            ) : (
              <div className="col-span-full py-20 text-center">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Search className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">Sin resultados</h3>
                <p className="mt-2 text-muted-foreground max-w-sm mx-auto">
                  No encontramos profesionales que coincidan con tu búsqueda. Probá con otros filtros.
                </p>
                {hasFilters && (
                  <Button variant="outline" className="mt-5" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
