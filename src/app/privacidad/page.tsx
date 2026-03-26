import { LandingFooter } from '@/components/landing-footer';
import { LandingHeader } from '@/components/landing-header';

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex-1 py-12 md:py-24">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl space-y-8">
           <div>
            <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl">Política de Privacidad</h1>
            <p className="mt-2 text-muted-foreground">Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="space-y-6 text-muted-foreground">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">1. Información que recopilamos</h2>
              <p>
                Recopilamos información que usted nos proporciona directamente, como cuando crea una cuenta, y también información que se recopila automáticamente, como su información de uso del servicio. Esto incluye datos personales de profesionales y datos de pacientes que los profesionales gestionan.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">2. Cómo usamos su información</h2>
              <p>
                Utilizamos la información que recopilamos para operar, mantener y proporcionar las características y funcionalidades del Servicio, para comunicarnos con usted, para procesar pagos y para personalizar su experiencia. Los datos de los pacientes solo son accesibles por el profesional que los gestiona.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">3. Seguridad de los datos</h2>
              <p>
                Nos tomamos muy en serio la seguridad de sus datos. Utilizamos medidas de seguridad como el cifrado de datos en tránsito (HTTPS) y en reposo para proteger su información. Sin embargo, ningún método de transmisión por Internet o de almacenamiento electrónico es 100% seguro.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">4. Sus Derechos</h2>
              <p>
                Usted tiene derecho a acceder, corregir o eliminar su información personal. Si es un profesional, puede gestionar la información de su perfil y la de sus pacientes a través del dashboard. Para la eliminación completa de su cuenta y datos asociados, puede contactarnos.
              </p>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">5. Cambios a esta Política</h2>
              <p>
                Podemos actualizar nuestra Política de Privacidad de vez en cuando. Le notificaremos cualquier cambio publicando la nueva Política de Privacidad en esta página.
              </p>
            </div>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
