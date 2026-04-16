'use client';

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Star, XCircle } from 'lucide-react';

import { LandingFooter } from '@/components/landing-footer';
import { LandingHeader } from '@/components/landing-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type RatingState = 'loading' | 'available' | 'expired' | 'used' | 'invalid' | 'submitted' | 'error';

type RatingContext = {
  state: 'available';
  appointment: {
    id: string;
    patientName: string;
    date: string;
    time: string;
    type: string;
  };
  professional: {
    id: string;
    name: string;
    slug: string | null;
    specialty: string;
  };
  expiresAt: string | null;
};

const typeLabels: Record<string, string> = {
  first_time: 'Primera vez',
  checkup: 'Control',
  urgent: 'Urgencia',
};

export default function CalificarAtencionPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('');
  const [viewState, setViewState] = useState<RatingState>('loading');
  const [context, setContext] = useState<RatingContext | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    params.then(({ token: routeToken }) => {
      if (!active) {
        return;
      }
      setToken(routeToken);
    });

    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadContext() {
      setViewState('loading');
      setError('');

      try {
        const response = await fetch(`/api/patient/rating/${token}`, { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok) {
          if (!cancelled) {
            setContext(null);
            setError(payload?.error || 'No se pudo cargar la calificación.');
            setViewState(payload?.state || 'error');
          }
          return;
        }

        if (!cancelled) {
          setContext(payload as RatingContext);
          setViewState('available');
        }
      } catch {
        if (!cancelled) {
          setContext(null);
          setError('No se pudo cargar la calificación.');
          setViewState('error');
        }
      }
    }

    loadContext();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit() {
    if (!token) {
      return;
    }

    if (rating < 1 || rating > 5) {
      setError('Seleccioná una calificación entre 1 y 5 estrellas.');
      return;
    }

    if (comment.trim().length < 10) {
      setError('El comentario debe tener al menos 10 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/patient/rating/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error || 'No se pudo guardar la calificación.');
        setViewState(payload?.state || 'error');
        return;
      }

      setViewState('submitted');
    } catch {
      setError('No se pudo guardar la calificación.');
      setViewState('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const dateLabel = context
    ? new Date(context.appointment.date).toLocaleDateString('es-AR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const expiryLabel = context?.expiresAt
    ? new Date(context.expiresAt).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden py-14 md:py-20">
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-amber-100/70 via-background to-background" />
          <div aria-hidden className="absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-100/70">
                <Star className="h-8 w-8 text-amber-600 fill-amber-500" />
              </div>
              <Badge variant="outline" className="mb-4 border-amber-300/60 bg-amber-50 text-amber-700 font-semibold px-3 py-1">
                Opinión del paciente
              </Badge>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                Calificá tu atención médica
              </h1>
              <p className="mt-4 text-muted-foreground md:text-lg">
                Tu reseña se vincula a una única consulta y el enlace se desactiva al usarlo o al vencer.
              </p>
            </div>
          </div>
        </section>

        <section className="pb-20 md:pb-28">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl">
              {viewState === 'loading' && (
                <Card className="shadow-lg">
                  <CardContent className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Cargando calificación...
                  </CardContent>
                </Card>
              )}

              {viewState === 'available' && context && (
                <Card className="shadow-lg border-border/60">
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle>Calificar a {context.professional.name}</CardTitle>
                        <CardDescription>
                          {context.professional.specialty || 'Profesional de la salud'}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                        Enlace activo
                      </Badge>
                    </div>

                    <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
                      <div className="flex items-start gap-2 text-sm">
                        <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium capitalize">{dateLabel}</p>
                          <p className="text-muted-foreground">{typeLabels[context.appointment.type] ?? context.appointment.type}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <Clock className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium">{context.appointment.time} hs</p>
                          <p className="text-muted-foreground">
                            {expiryLabel ? `Válido hasta ${expiryLabel}` : 'Válido por 24 horas'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Tu calificación</p>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            aria-label={`Calificar con ${value} estrellas`}
                            onClick={() => setRating(value)}
                            className="rounded-md p-1 transition-transform hover:scale-105"
                          >
                            <Star
                              className={cn(
                                'h-9 w-9 transition-colors',
                                rating >= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/35'
                              )}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Comentario</p>
                      <Textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Contanos brevemente cómo fue la atención recibida."
                        className="min-h-32"
                      />
                      <p className="text-xs text-muted-foreground">
                        Mínimo 10 caracteres. Solo se admite una reseña por atención.
                      </p>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {error}
                      </div>
                    )}

                    <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full gap-2 h-11">
                      {isSubmitting ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                      Enviar calificación
                    </Button>
                  </CardContent>
                </Card>
              )}

              {(viewState === 'expired' || viewState === 'used' || viewState === 'invalid' || viewState === 'submitted' || viewState === 'error') && (
                <Card className="shadow-lg border-border/60">
                  <CardContent className="py-14">
                    <div className="mx-auto flex max-w-md flex-col items-center text-center">
                      {viewState === 'submitted' ? (
                        <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-600" />
                      ) : (
                        <XCircle className="mb-4 h-12 w-12 text-amber-600" />
                      )}
                      <h2 className="text-2xl font-bold">
                        {viewState === 'submitted' && 'Calificación enviada'}
                        {viewState === 'used' && 'Enlace ya utilizado'}
                        {viewState === 'expired' && 'Enlace vencido'}
                        {viewState === 'invalid' && 'Enlace inválido'}
                        {viewState === 'error' && 'No se pudo completar la acción'}
                      </h2>
                      <p className="mt-3 text-muted-foreground">
                        {viewState === 'submitted' && 'Gracias por tu opinión. La atención ya quedó calificada y este enlace fue desactivado.'}
                        {viewState === 'used' && (error || 'Esta consulta ya recibió una calificación previa.')}
                        {viewState === 'expired' && (error || 'Pasaron más de 24 horas desde que se generó el enlace de calificación.')}
                        {viewState === 'invalid' && (error || 'El enlace no corresponde a una solicitud de calificación válida.')}
                        {viewState === 'error' && (error || 'Intentá nuevamente en unos minutos.')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}