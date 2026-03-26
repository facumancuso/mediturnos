'use client';

import { MoreHorizontal, PlusCircle, Search } from 'lucide-react';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { mockTeamMembers } from '@/lib/mock-data';
import type { TeamMember } from '@/types';
import { AddTeamMemberDialog } from '@/components/add-team-member-dialog';
import { EditPermissionsDialog } from '@/components/edit-permissions-dialog';
import { cn } from '@/lib/utils';

const roleStyles: { [key in TeamMember['role']]: string } = {
  Dueño: 'bg-primary/10 text-primary border-primary/20',
  Profesional: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  Secretaria: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
};

const statusStyles: { [key in TeamMember['status']]: string } = {
    Activo: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    Pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
};

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>(mockTeamMembers);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isEditPermissionsOpen, setIsEditPermissionsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  
  const handleEditPermissions = (member: TeamMember) => {
    setSelectedMember(member);
    setIsEditPermissionsOpen(true);
  };

  const handleRoleChange = (memberId: string, newRole: TeamMember['role']) => {
    setTeam(prevTeam => prevTeam.map(m => m.id === memberId ? { ...m, role: newRole } : m));
  };


  return (
    <>
      <AddTeamMemberDialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen} />
      <EditPermissionsDialog 
        member={selectedMember}
        open={isEditPermissionsOpen}
        onOpenChange={setIsEditPermissionsOpen}
        onRoleChange={handleRoleChange}
      />
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestión de Equipo</h1>
            <p className="text-muted-foreground">Administra los miembros y permisos de tu organización.</p>
          </div>
          <Button onClick={() => setIsAddMemberOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Agregar Miembro
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Miembros del Equipo</CardTitle>
            <CardDescription>Mostrando {team.length} miembros.</CardDescription>
            <div className="relative pt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o email..." className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Rol</TableHead>
                  <TableHead className="hidden md:table-cell">Estado</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member.avatarUrl} alt="Avatar" />
                          <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{member.name}</span>
                          <span className="text-xs text-muted-foreground">{member.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn(roleStyles[member.role], "border-none")}>{member.role}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn(statusStyles[member.status], "border-none")}>{member.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost" disabled={member.role === 'Dueño'}>
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleEditPermissions(member); }}>
                            Editar Permisos
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Eliminar Miembro
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
