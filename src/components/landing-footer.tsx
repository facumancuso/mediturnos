import Link from 'next/link';
import { Logo } from './logo';

export function LandingFooter() {
  return (
    <footer className="border-t">
      <div className="container grid items-start gap-8 py-12 md:grid-cols-4">
        <div className="flex flex-col gap-4">
          <Link href="/">
            <Logo />
          </Link>
          <p className="text-sm text-muted-foreground">
            Revolucionando la gestión de turnos para profesionales de la salud.
          </p>
        </div>
        <div className="grid gap-4">
          <h4 className="font-semibold">Producto</h4>
          <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground">
            Beneficios
          </Link>
          <Link href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground">
            Precios
          </Link>
          <Link href="/directorio" className="text-sm text-muted-foreground hover:text-foreground">
            Directorio
          </Link>
        </div>
        <div className="grid gap-4">
          <h4 className="font-semibold">Empresa</h4>
          <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
            Sobre Nosotros
          </Link>
          <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
            Contacto
          </Link>
        </div>
        <div className="grid gap-4">
          <h4 className="font-semibold">Legal</h4>
          <Link href="/terminos" className="text-sm text-muted-foreground hover:text-foreground">
            Términos de Servicio
          </Link>
          <Link href="/privacidad" className="text-sm text-muted-foreground hover:text-foreground">
            Política de Privacidad
          </Link>
        </div>
      </div>
      <div className="border-t">
        <div className="container flex items-center justify-between py-6">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} MediTurnos. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
