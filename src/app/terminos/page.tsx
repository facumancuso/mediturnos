import { LandingFooter } from '@/components/landing-footer';
import { LandingHeader } from '@/components/landing-header';

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex-1 py-12 md:py-24">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl space-y-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl">Términos y condiciones del servicio</h1>
            <p className="mt-2 text-muted-foreground">Última actualización: {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <div className="space-y-6 text-muted-foreground">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">1. Aceptación de los Términos</h2>
              <p>
                Al acceder y utilizar MediTurnos ("el Servicio"), usted acepta estar sujeto a estos Términos y Condiciones ("Términos"). Si no está de acuerdo con alguna parte de los términos, no podrá acceder al Servicio.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">2. Descripción del Servicio</h2>
              <p>
                MediTurnos proporciona una plataforma SaaS para que los profesionales de la salud gestionen turnos, pacientes y comunicaciones. Las características y funcionalidades están sujetas a cambios y pueden variar según el plan de suscripción.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">3. Cuentas de Usuario</h2>
              <p>
                Usted es responsable de salvaguardar la contraseña que utiliza para acceder al Servicio y de cualquier actividad o acción bajo su contraseña. MediTurnos no se hace responsable de ninguna pérdida o daño que surja de su incumplimiento de esta obligación de seguridad.
              </p>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">4. Limitación de Responsabilidad</h2>
              <p>
                En ningún caso MediTurnos, ni sus directores, empleados, socios, agentes, proveedores o afiliados, serán responsables de daños indirectos, incidentales, especiales, consecuentes o punitivos, incluidos, entre otros, la pérdida de beneficios, datos, uso, buena voluntad u otras pérdidas intangibles.
              </p>
            </div>

             <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">5. Cambios</h2>
              <p>
                Nos reservamos el derecho, a nuestra sola discreción, de modificar o reemplazar estos Términos en cualquier momento. Le notificaremos cualquier cambio publicando los nuevos Términos en esta página.
              </p>
            </div>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
