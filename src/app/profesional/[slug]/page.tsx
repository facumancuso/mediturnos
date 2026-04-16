'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, MapPin, MessageCircle, Star, Calendar, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import type { Review, Professional } from "@/types";
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ProfileQrCode } from "@/components/profile-qr-code";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { PROFESSIONAL_BRAND_COVER_URL } from "@/lib/branding";

type ProfessionalWithReviews = Professional & {
    reviews?: Review[];
};

const PROFILE_CACHE_TTL_MS = 2 * 60_000;

function buildMapsEmbedUrl(mapUrl?: string, address?: string) {
    const trimmedMapUrl = String(mapUrl || '').trim();
    const trimmedAddress = String(address || '').trim();

    if (trimmedMapUrl) {
        try {
            const parsed = new URL(trimmedMapUrl);
            const host = parsed.hostname.toLowerCase();

            if (host.includes('google.com') && parsed.pathname.includes('/maps/embed')) {
                return parsed.toString();
            }

            const query =
                parsed.searchParams.get('q') ||
                parsed.searchParams.get('query') ||
                parsed.searchParams.get('destination') ||
                trimmedAddress;

            if (query) {
                return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
            }
        } catch {
            // Ignorar URL inválida y usar la dirección como fallback.
        }
    }

    if (trimmedAddress) {
        return `https://www.google.com/maps?q=${encodeURIComponent(trimmedAddress)}&output=embed`;
    }

    return null;
}

function buildMapsOpenUrl(mapUrl?: string, address?: string) {
    const trimmedMapUrl = String(mapUrl || '').trim();
    const trimmedAddress = String(address || '').trim();
    if (trimmedMapUrl) return trimmedMapUrl;
    if (trimmedAddress) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedAddress)}`;
    }
    return null;
}


function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="border-t py-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{review.authorName}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: es })}
        </p>
      </div>
      <div className="flex items-center gap-1 my-2">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-5 w-5 ${review.rating > i ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{review.comment}</p>
    </div>
  );
}


export default function ProfessionalProfilePage() {
    const params = useParams();
    const { slug } = params as { slug: string };
        const [professional, setProfessional] = useState<ProfessionalWithReviews | null>(null);
        const [isLoading, setIsLoading] = useState(true);
        const cacheKey = `profile:${slug}`;

        useEffect(() => {
            let cancelled = false;

            try {
                const rawCached = sessionStorage.getItem(cacheKey);
                if (rawCached) {
                    const cached = JSON.parse(rawCached) as { savedAt?: number; data?: ProfessionalWithReviews };
                    if (cached?.data && Date.now() - Number(cached.savedAt || 0) < PROFILE_CACHE_TTL_MS) {
                        setProfessional(cached.data);
                        setIsLoading(false);
                    }
                }
            } catch {
                // Ignorar cache inválida.
            }

            async function loadProfessional() {
                try {
                    setIsLoading(true);
                    const response = await fetch(`/api/professionals/${slug}`);

                    if (response.status === 404) {
                        if (!cancelled) {
                            setProfessional(null);
                        }
                        return;
                    }

                    if (!response.ok) {
                        throw new Error('No se pudo cargar el perfil profesional.');
                    }

                    const data = (await response.json()) as ProfessionalWithReviews;
                    if (!cancelled) {
                        setProfessional(data);
                        try {
                            sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
                        } catch {
                            // Storage no disponible o lleno.
                        }
                    }
                } catch (error) {
                    console.error(error);
                    if (!cancelled) {
                        setProfessional(null);
                    }
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
        }, [cacheKey, slug]);

    if (isLoading) {
        return (
            <div className="container max-w-5xl mx-auto py-12 md:py-16">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <div className="md:col-span-1 space-y-6">
                        <Skeleton className="h-80 w-full" />
                        <Skeleton className="h-40 w-full" />
                     </div>
                      <div className="md:col-span-2 space-y-8">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-64 w-full" />
                        <Skeleton className="h-96 w-full" />
                     </div>
                 </div>
            </div>
        );
    }
    
    if (!professional) {
        notFound();
    }

        const approvedReviews = Array.isArray(professional.reviews)
            ? professional.reviews.filter((review) => review.status === 'approved')
            : [];
    const publicProfile = professional.publicProfile || {};
    const coverImage = professional.coverImageUrl || PROFESSIONAL_BRAND_COVER_URL;
        const mapsEmbedUrl = buildMapsEmbedUrl(publicProfile.mapUrl, professional.address);
        const mapsOpenUrl = buildMapsOpenUrl(publicProfile.mapUrl, professional.address);
    const cardTheme = {
      primaryColor: publicProfile.cardTheme?.primaryColor || '#0d6efd',
      accentColor: publicProfile.cardTheme?.accentColor || '#0f172a',
      backgroundColor: publicProfile.cardTheme?.backgroundColor || '#ffffff',
    };

    return (
        <div className="container max-w-5xl mx-auto py-12 md:py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="md:col-span-1 space-y-6">
                    <Card className="overflow-hidden" style={{ backgroundColor: cardTheme.backgroundColor }}>
                        <CardContent className="p-0">
                            <div className="relative h-40" style={{ backgroundColor: `${cardTheme.primaryColor}22` }}>
                                <Image src={coverImage} alt="Banner" fill className="object-cover" data-ai-hint="abstract background"/>
                            </div>
                            <div className="flex justify-center -mt-16">
                                <Avatar className="h-32 w-32 border-4 border-background">
                                    <AvatarImage src={professional.photoURL} alt={professional.name} />
                                    <AvatarFallback>{professional.name.slice(0, 2)}</AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="text-center p-4">
                                <h1 className="text-2xl font-bold" style={{ color: cardTheme.accentColor }}>{professional.name}</h1>
                                <p className="font-medium text-lg" style={{ color: cardTheme.primaryColor }}>{professional.specialty}</p>
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">{professional.address}</span>
                                </div>
                                {publicProfile.verified && (
                                    <Badge variant="secondary" className="mt-4">
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                        Perfil Verificado
                                    </Badge>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Compartir Perfil</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center">
                            <ProfileQrCode />
                            <p className="text-xs text-muted-foreground mt-2">Escanea para compartir</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column */}
                <div className="md:col-span-2 space-y-8">
                    <div className="flex flex-col md:flex-row gap-2">
                         <Button size="lg" className="w-full" asChild>
                                <Link href={`/profesional/${slug}/solicitar-turno`}>
                                <Calendar className="mr-2 h-5 w-5" />
                                Solicitar Turno Online
                            </Link>
                        </Button>
                         <Button size="lg" className="w-full" variant="outline" asChild>
                            <Link href={`https://wa.me/${professional.whatsappNumber}?text=Hola%20${professional.name.replace(' ', '%20')},%20quisiera%20solicitar%20un%20turno.`} target="_blank">
                                <MessageCircle className="mr-2 h-5 w-5" />
                                Contactar por WhatsApp
                            </Link>
                        </Button>
                    </div>
                     <Card>
                        <CardHeader>
                            <CardTitle>Sobre mí</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-line">{publicProfile.bio}</p>
                        </CardContent>
                    </Card>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                         <Card>
                            <CardHeader>
                                <CardTitle>Obras Sociales</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2">
                                {publicProfile.insurances?.map((insurance: string) => (
                                    <Badge key={insurance} variant="outline">{insurance}</Badge>
                                ))}
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader>
                                <CardTitle>Ubicación</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground mb-2">{professional.address}</p>
                                                                {mapsOpenUrl && (
                                                                    <div className="mb-3">
                                                                        <Button variant="outline" size="sm" asChild>
                                                                            <Link href={mapsOpenUrl} target="_blank" rel="noopener noreferrer">
                                                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                                                Abrir en Google Maps
                                                                            </Link>
                                                                        </Button>
                                                                    </div>
                                                                )}
                                <div className="h-48 bg-muted rounded-md overflow-hidden">
                                                                         {mapsEmbedUrl ? (
                                        <iframe
                                                                                        src={mapsEmbedUrl}
                                            width="100%"
                                            height="100%"
                                            style={{ border: 0 }}
                                            allowFullScreen={true}
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            title="Mapa de ubicación del consultorio"
                                        ></iframe>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <p>Mapa no disponible</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                     </div>
                     
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Opiniones de Pacientes ({publicProfile.reviewCount || 0})</CardTitle>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex items-center">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} className={`h-5 w-5 ${publicProfile.rating > i ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`} />
                                            ))}
                                        </div>
                                        <span className="font-bold text-lg">{publicProfile.rating?.toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                           {approvedReviews.length > 0 ? (
                                approvedReviews.map(review => <ReviewCard key={review.id} review={review} />)
                           ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">Este profesional aún no tiene opiniones.</p>
                           )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
