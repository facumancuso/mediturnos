import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  HeartPulse,
  LayoutGrid,
  MapPin,
  Search,
  Shield,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { LandingFooter } from '@/components/landing-footer';
import { LandingHeader } from '@/components/landing-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function DashboardMockup() {
  const appointments = [
    { time: '09:00', name: 'Ana García', badge: 'Consulta', badgeClass: 'bg-sky-100 text-sky-700' },
    { time: '10:30', name: 'Carlos López', badge: 'Control', badgeClass: 'bg-emerald-100 text-emerald-700' },
    { time: '11:45', name: 'María Díaz', badge: 'Urgencia', badgeClass: 'bg-red-100 text-red-700' },
    { time: '14:00', name: 'Luis Torres', badge: 'Consulta', badgeClass: 'bg-sky-100 text-sky-700' },
  ];

  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const highlightedDays = [9, 12, 14, 17, 21, 24, 28];

  return (
    <div className="relative w-full select-none">
      {/* Ambient glow */}
      <div className="absolute -inset-6 bg-gradient-to-r from-primary/25 via-sky-300/15 to-primary/10 blur-3xl rounded-full -z-10" />

      {/* Main dashboard card */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[11px] font-semibold text-primary">MediTurnos · Panel Principal</span>
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-slate-400" />
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-[9px] font-bold text-primary">DR</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 grid grid-cols-5 gap-3">
          {/* Mini Calendar */}
          <div className="col-span-2 bg-slate-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-700">Mar 2026</span>
              <Calendar className="w-3 h-3 text-primary" />
            </div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {days.map((d, i) => (
                <div key={i} className="text-[7px] font-bold text-slate-400">{d}</div>
              ))}
              {/* 6 empty cells — March 1, 2026 is Sunday (7th col, Mon-first) */}
              {[...Array(6)].map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {[...Array(31)].map((_, i) => {
                const day = i + 1;
                const isToday = day === 17;
                const hasAppt = highlightedDays.includes(day);
                return (
                  <div
                    key={day}
                    className={`text-[8px] w-4 h-4 mx-auto flex items-center justify-center rounded-full font-medium ${
                      isToday
                        ? 'bg-primary text-white font-bold'
                        : hasAppt
                        ? 'bg-primary/15 text-primary font-semibold'
                        : 'text-slate-600'
                    }`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Appointment list */}
          <div className="col-span-3">
            <div className="text-[10px] font-bold text-slate-700 mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3 text-primary" /> Turnos de hoy
            </div>
            <div className="space-y-1.5">
              {appointments.map((apt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 shadow-sm border border-slate-100"
                >
                  <span className="text-[9px] font-mono font-bold text-primary shrink-0">{apt.time}</span>
                  <span className="text-[9px] font-medium flex-1 truncate text-slate-700">{apt.name}</span>
                  <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${apt.badgeClass}`}>
                    {apt.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {[
            { icon: '📅', val: '12', label: 'Turnos hoy' },
            { icon: '👥', val: '248', label: 'Pacientes' },
            { icon: '⭐', val: '4.9', label: 'Calificación' },
          ].map((s, i) => (
            <div
              key={i}
              className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-2 text-center border border-primary/10"
            >
              <div className="text-base leading-none mb-0.5">{s.icon}</div>
              <div className="text-sm font-extrabold text-primary">{s.val}</div>
              <div className="text-[8px] text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating: confirmed notification */}
      <div className="absolute -top-5 right-2 bg-white rounded-xl shadow-xl border border-slate-200 px-3 py-2 flex items-center gap-2 [animation:bounce_3s_ease-in-out_infinite]">
        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-800">Turno confirmado</p>
          <p className="text-[8px] text-slate-500">Ana García · 09:00</p>
        </div>
      </div>

      {/* Floating: professional rating */}
      <div className="absolute -bottom-5 -left-3 bg-white rounded-xl shadow-xl border border-slate-200 px-3 py-2">
        <div className="flex items-center gap-0.5 mb-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
          ))}
        </div>
        <p className="text-[9px] font-bold text-slate-800">Dr. Ramírez</p>
        <p className="text-[8px] text-slate-500">Cardiólogo · 128 reseñas</p>
      </div>
    </div>
  );
}

export default function Home() {
  const professionals = [
    {
      initials: 'AR',
      name: 'Dr. Alejandro Ramírez',
      specialty: 'Cardiología',
      rating: 4.9,
      reviews: 128,
      location: 'Buenos Aires',
    },
    {
      initials: 'VG',
      name: 'Dra. Valentina García',
      specialty: 'Pediatría',
      rating: 4.8,
      reviews: 94,
      location: 'Córdoba',
    },
    {
      initials: 'SL',
      name: 'Lic. Santiago López',
      specialty: 'Psicología',
      rating: 5.0,
      reviews: 67,
      location: 'Rosario',
    },
  ];

  const features = [
    {
      icon: LayoutGrid,
      title: 'Calendario Centralizado',
      desc: 'Vista diaria, semanal y mensual de todos tus turnos. Nunca más superposición de horarios.',
      colorClass: 'bg-blue-50 text-blue-600',
    },
    {
      icon: HeartPulse,
      title: 'Gestión de Pacientes',
      desc: 'Historial completo, datos de contacto y seguimiento de cada paciente en un solo lugar.',
      colorClass: 'bg-rose-50 text-rose-600',
    },
    {
      icon: Users,
      title: 'Perfil Público Profesional',
      desc: 'Aumentá tu visibilidad con un perfil verificado en nuestro directorio. Nuevos pacientes cada semana.',
      colorClass: 'bg-violet-50 text-violet-600',
    },
    {
      icon: CheckCircle,
      title: 'Integración Google Calendar',
      desc: 'Sincronizá tus turnos automáticamente con tu calendario personal de Google.',
      colorClass: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: Bell,
      title: 'Recordatorios Automáticos',
      desc: 'Reducí ausentismos con notificaciones automáticas a tus pacientes antes de cada turno.',
      colorClass: 'bg-amber-50 text-amber-600',
    },
    {
      icon: Shield,
      title: 'Seguridad y Privacidad',
      desc: 'Datos cifrados, autenticación de dos factores y cumplimiento de normativas de salud.',
      colorClass: 'bg-sky-50 text-sky-600',
    },
  ];

  const testimonials = [
    {
      quote:
        'MediTurnos cambió por completo la gestión de mi consultorio. La organización de turnos es mucho más sencilla ahora. No puedo imaginar volver a las agendas en papel.',
      name: 'Dr. Juan Pérez',
      role: 'Cardiólogo',
      initials: 'JP',
    },
    {
      quote:
        'La interfaz es súper intuitiva y me ahorra horas de trabajo administrativo a la semana. Mis pacientes también lo encuentran fácil de usar.',
      name: 'Lic. María Gómez',
      role: 'Psicóloga',
      initials: 'MG',
    },
    {
      quote:
        '¡Increíble! El perfil público me trajo 5 pacientes nuevos en la primera semana. El soporte técnico también es de primera clase.',
      name: 'Dra. Carla Rodríguez',
      role: 'Dermatóloga',
      initials: 'CR',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex-1">

        {/* ── HERO ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 md:py-32">
          <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-primary/8 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-sky-200/25 rounded-full blur-3xl" />
          </div>

          <div className="container px-4 md:px-6">
            <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
              {/* Text */}
              <div className="flex flex-col items-start justify-center">
                <Badge
                  variant="outline"
                  className="mb-5 border-primary/40 bg-primary/5 text-primary font-semibold px-3 py-1 gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Gestión Inteligente de Turnos
                </Badge>
                <h1 className="text-4xl font-extrabold tracking-tight leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl">
                  La agenda médica{' '}
                  <span className="text-primary">que trabaja</span>{' '}
                  por vos.
                </h1>
                <p className="mt-5 max-w-[520px] text-lg text-muted-foreground md:text-xl leading-relaxed">
                  MediTurnos centraliza tus turnos, pacientes y calendario en una sola plataforma. Más tiempo para lo que importa.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button size="lg" className="shadow-lg shadow-primary/30 gap-2" asChild>
                    <Link href="/auth/register">
                      Registra tu consultorio <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="gap-2" asChild>
                    <Link href="/directorio">
                      <Search className="h-4 w-4" /> Buscar un profesional
                    </Link>
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-primary" /> Sin tarjeta de crédito
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-primary" /> 14 días gratis
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-primary" /> Cancela cuando quieras
                  </span>
                </div>
              </div>

              {/* Dashboard mockup */}
              <div className="relative hidden md:block pt-6 pb-8">
                <DashboardMockup />
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS BAR ─────────────────────────────────────────── */}
        <section className="border-y bg-muted/40">
          <div className="container px-4 md:px-6 py-10">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { value: '+500', label: 'Profesionales activos' },
                { value: '+10.000', label: 'Turnos gestionados' },
                { value: '4.9 ★', label: 'Calificación promedio' },
                { value: '98%', label: 'Satisfacción de usuarios' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl md:text-4xl font-extrabold text-primary">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── DIRECTORIO PREVIEW ────────────────────────────────── */}
        <section id="directorio" className="py-20 md:py-28">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center mb-12">
              <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/5 text-primary">
                Directorio de Profesionales
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Encontrá al profesional ideal
              </h2>
              <p className="mt-4 max-w-2xl text-muted-foreground md:text-xl">
                Explorá nuestro directorio de profesionales verificados con calificaciones reales de pacientes.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {professionals.map((pro, i) => (
                <Card
                  key={i}
                  className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-border/60"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14 border-2 border-primary/20">
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-bold text-lg">
                          {pro.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{pro.name}</CardTitle>
                        <CardDescription className="text-primary font-medium">{pro.specialty}</CardDescription>
                        <div className="mt-1.5 flex items-center gap-1">
                          {[...Array(5)].map((_, j) => (
                            <Star
                              key={j}
                              className={`h-3.5 w-3.5 ${
                                Math.round(pro.rating) > j
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">
                            {pro.rating} ({pro.reviews})
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {pro.location}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="outline"
                      className="w-full group-hover:border-primary group-hover:text-primary transition-colors"
                      asChild
                    >
                      <Link href="/directorio">Ver perfil y turnos disponibles</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Button variant="outline" size="lg" className="gap-2" asChild>
                <Link href="/directorio">
                  Ver todos los profesionales <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── ESTADO DE TURNO ───────────────────────────────────── */}
        <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-sky-100/60 py-16">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-3xl flex flex-col items-center gap-6 text-center md:flex-row md:text-left md:gap-10">
              <div className="flex-1">
                <Badge variant="outline" className="mb-3 border-primary/40 bg-white text-primary">
                  Para Pacientes
                </Badge>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Verificá el estado de tu turno
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Ingresá tu código y consultá la fecha, hora y estado de tu turno en tiempo real.
                </p>
              </div>
              <div className="shrink-0">
                <Button size="lg" className="gap-2 shadow-lg shadow-primary/20" asChild>
                  <Link href="/estado-turno">
                    <Search className="h-4 w-4" /> Consultar mi turno
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────── */}
        <section id="how-it-works" className="py-20 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/5 text-primary">
                Simple y rápido
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">¿Cómo funciona?</h2>
              <p className="mt-4 text-muted-foreground md:text-xl">
                Empezá a gestionar tu consultorio en menos de 10 minutos.
              </p>
            </div>

            <div className="relative grid gap-10 md:grid-cols-3">
              {/* Connecting line */}
              <div className="absolute top-8 left-[calc(16.6%+2rem)] right-[calc(16.6%+2rem)] hidden h-0.5 bg-gradient-to-r from-primary/30 via-primary to-primary/30 md:block" />

              {[
                {
                  step: '01',
                  icon: Sparkles,
                  title: 'Configurá tu perfil',
                  desc: 'Registrá tu consultorio, definí tus horarios de atención y personalizá tus servicios en minutos.',
                },
                {
                  step: '02',
                  icon: Calendar,
                  title: 'Gestioná tus turnos',
                  desc: 'Visualizá todos tus turnos en un calendario intuitivo. Confirmá, reprogramá o cancelá con un clic.',
                },
                {
                  step: '03',
                  icon: HeartPulse,
                  title: 'Enfocate en tus pacientes',
                  desc: 'Menos papeleo, más atención. MediTurnos se encarga de los recordatorios y la logística por vos.',
                },
              ].map((item, i) => (
                <div key={i} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 mb-5">
                    <item.icon className="h-7 w-7" />
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ──────────────────────────────────────────── */}
        <section id="features" className="bg-muted/40 py-20 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <Badge variant="outline" className="mb-4 border-primary/40 bg-background text-primary">
                Funcionalidades
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Una plataforma, todo lo que necesitás
              </h2>
              <p className="mt-4 text-muted-foreground md:text-xl">
                Herramientas diseñadas para potenciar tu práctica profesional.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => (
                <Card
                  key={i}
                  className="border-border/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  <CardHeader className="pb-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${feature.colorClass}`}
                    >
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ───────────────────────────────────────────── */}
        <section id="pricing" className="py-20 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/5 text-primary">
                Precios
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Planes para cada necesidad
              </h2>
              <p className="mt-4 text-muted-foreground md:text-xl">
                Empezá gratis y elegí el plan que crece con vos. Sin contratos, cancelá cuando quieras.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3 items-start">
              {/* Básico */}
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle>Básico</CardTitle>
                  <CardDescription>Para profesionales que recién comienzan.</CardDescription>
                  <div className="flex items-baseline gap-2 pt-4">
                    <span className="text-4xl font-extrabold">$20</span>
                    <span className="text-muted-foreground">/mes</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {['Hasta 100 turnos/mes', 'Calendario y gestión de turnos', 'Historial de pacientes'].map(
                      (f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary shrink-0" /> {f}
                        </li>
                      )
                    )}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/auth/register">Comenzar prueba gratis</Link>
                  </Button>
                </CardFooter>
              </Card>

              {/* Profesional - destacado */}
              <Card className="relative border-0 bg-gradient-to-b from-primary to-sky-600 text-primary-foreground shadow-2xl shadow-primary/40 scale-[1.03]">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-amber-400 text-amber-900 hover:bg-amber-400 font-bold px-3 py-1 shadow-lg">
                    ⭐ Más popular
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-primary-foreground">Profesional</CardTitle>
                  <CardDescription className="text-primary-foreground/70">
                    La solución completa para consultorios establecidos.
                  </CardDescription>
                  <div className="flex items-baseline gap-2 pt-4">
                    <span className="text-4xl font-extrabold text-primary-foreground">$40</span>
                    <span className="text-primary-foreground/70">/mes</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {[
                      'Turnos ilimitados',
                      'Todo lo del plan Básico',
                      'Perfil público en directorio',
                      'Integración con Google Calendar',
                      'Recordatorios automáticos',
                    ].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-primary-foreground">
                        <CheckCircle className="h-4 w-4 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-white text-primary hover:bg-white/90 font-bold" asChild>
                    <Link href="/auth/register">Comenzar prueba gratis</Link>
                  </Button>
                </CardFooter>
              </Card>

              {/* Clínica */}
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle>Clínica</CardTitle>
                  <CardDescription>Para equipos y clínicas con múltiples profesionales.</CardDescription>
                  <div className="flex items-baseline gap-2 pt-4">
                    <span className="text-4xl font-extrabold">$90</span>
                    <span className="text-muted-foreground">/mes</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {[
                      'Múltiples profesionales',
                      'Todo lo del plan Profesional',
                      'Panel de administración',
                      'Reportes y analíticas',
                      'Soporte prioritario 24/7',
                    ].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/auth/register">Comenzar prueba gratis</Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ──────────────────────────────────────── */}
        <section id="testimonials" className="bg-muted/40 py-20 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <Badge variant="outline" className="mb-4 border-primary/40 bg-background text-primary">
                Testimonios
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Lo que dicen nuestros profesionales
              </h2>
              <p className="mt-4 text-muted-foreground md:text-xl">
                Miles de profesionales confían en MediTurnos para gestionar su día a día.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <Card key={i} className="relative border-border/50 flex flex-col">
                  <CardContent className="pt-8 flex-1">
                    <div className="absolute top-3 left-5 text-6xl font-serif text-primary/15 leading-none select-none">
                      &ldquo;
                    </div>
                    <div className="flex mb-3">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80 italic">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  </CardContent>
                  <CardFooter className="mt-2 flex items-center gap-3 border-t pt-4">
                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-semibold text-xs">
                        {t.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-24 md:py-32">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-br from-primary via-sky-500 to-primary/80"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-10 bg-[radial-gradient(circle_at_30%_20%,white,transparent_60%)]"
          />

          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-4xl text-center text-primary-foreground">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
                ¿Listo para transformar tu práctica médica?
              </h2>
              <p className="mt-5 text-lg text-primary-foreground/80 md:text-xl max-w-2xl mx-auto">
                Únete a miles de profesionales que ya están optimizando su tiempo y mejorando la experiencia de sus
                pacientes.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 shadow-xl font-bold gap-2"
                  asChild
                >
                  <Link href="/auth/register">
                    Comenzar prueba gratis de 14 días <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white/10 gap-2"
                  asChild
                >
                  <Link href="/directorio">
                    <Search className="h-4 w-4" /> Explorar directorio
                  </Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-primary-foreground/60">
                Sin tarjeta de crédito · Cancelá cuando quieras · Soporte en español
              </p>
            </div>
          </div>
        </section>

      </main>
      <LandingFooter />
    </div>
  );
}
