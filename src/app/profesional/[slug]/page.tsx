'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, MapPin, MessageCircle, Star, Calendar } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import type { Review, Professional } from "@/types";
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ProfileQrCode } from "@/components/profile-qr-code";
import { AddReviewDialog } from "@/components/add-review-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { mockReviews } from "@/lib/mock-data";
import { useEffect, useState } from "react";


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
        const [professional, setProfessional] = useState<Professional | null>(null);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            let cancelled = false;

            async function loadProfessional() {
                try {
                    setIsLoading(true);
                    const response = await fetch(`/api/professionals/${slug}`, { cache: 'no-store' });

                    if (response.status === 404) {
                        if (!cancelled) {
                            setProfessional(null);
                        }
                        return;
                    }

                    if (!response.ok) {
                        throw new Error('No se pudo cargar el perfil profesional.');
                    }

                    const data = (await response.json()) as Professional;
                    if (!cancelled) {
                        setProfessional(data);
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
        }, [slug]);

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

    const approvedReviews = mockReviews.filter(r => r.status === 'approved');
    const publicProfile = professional.publicProfile || {};
    const coverImage = professional.coverImageUrl || `https://picsum.photos/seed/${professional.id}-cover/600/200`;

    return (
        <div className="container max-w-5xl mx-auto py-12 md:py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="md:col-span-1 space-y-6">
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="relative h-40 bg-primary/10">
                                <Image src={coverImage} alt="Banner" fill className="object-cover" data-ai-hint="abstract background"/>
                            </div>
                            <div className="flex justify-center -mt-16">
                                <Avatar className="h-32 w-32 border-4 border-background">
                                    <AvatarImage src={professional.photoURL} alt={professional.name} />
                                    <AvatarFallback>{professional.name.slice(0, 2)}</AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="text-center p-4">
                                <h1 className="text-2xl font-bold">{professional.name}</h1>
                                <p className="text-primary font-medium text-lg">{professional.specialty}</p>
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
                            <Link href={`/profesional/${publicProfile.slug}/solicitar-turno`}>
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
                                <div className="h-48 bg-muted rounded-md overflow-hidden">
                                     {publicProfile.mapUrl ? (
                                        <iframe
                                            src={publicProfile.mapUrl}
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
