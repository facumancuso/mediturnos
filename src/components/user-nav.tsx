'use client';

import { CreditCard, LogOut, PlusCircle, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Skeleton } from './ui/skeleton';

export function UserNav({ sidebar = false }: { sidebar?: boolean }) {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('');
  }

  if (isUserLoading) {
    return sidebar
      ? <div className="flex items-center gap-2.5"><Skeleton className="h-8 w-8 rounded-full shrink-0" /><Skeleton className="h-4 flex-1 rounded" /></div>
      : <Skeleton className="h-8 w-8 rounded-full" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {sidebar ? (
          <button className="flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left hover:bg-secondary transition-colors duration-150 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8 shrink-0 ring-2 ring-border group-hover:ring-primary/30 transition-all duration-150">
              <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'Avatar del usuario'} />
              <AvatarFallback className="text-xs font-semibold">{getInitials(user?.displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium truncate leading-tight">{user?.displayName || 'Usuario'}</span>
              <span className="text-xs text-muted-foreground truncate leading-tight">{user?.email || ''}</span>
            </div>
            <Settings className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
          </button>
        ) : (
          <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-border hover:ring-primary/40 transition-all duration-200">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'Avatar del usuario'} />
              <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
            </Avatar>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 rounded-xl border-border/40 bg-card/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]" align={sidebar ? 'start' : 'end'} side={sidebar ? 'top' : 'bottom'} sideOffset={8} forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2.5 py-0.5">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'Avatar del usuario'} />
              <AvatarFallback className="text-xs">{getInitials(user?.displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-medium leading-none truncate">{user?.displayName || 'Usuario'}</p>
              <p className="text-xs leading-none text-muted-foreground mt-1 truncate">{user?.email || 'Sin correo electrónico'}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/perfil-publico">
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
              <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Facturación</span>
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/configuracion">
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración</span>
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            <span>Nuevo equipo</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar sesión</span>
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
