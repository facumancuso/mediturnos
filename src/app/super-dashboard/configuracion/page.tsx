'use client'

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

export default function SuperAdminConfigPage() {
    const { toast } = useToast();

    const handleSave = () => {
        toast({
            title: "Configuración guardada",
            description: "Las credenciales de Mercado Pago han sido actualizadas.",
        });
    }

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Image src="/mercadopago.svg" alt="Mercado Pago" width={40} height={40} />
                        <div>
                            <CardTitle>Mercado Pago Argentina</CardTitle>
                            <CardDescription>
                                Conecta tu cuenta de Mercado Pago para procesar suscripciones y pagos.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="mp-public-key">Public Key</Label>
                        <Input id="mp-public-key" placeholder="APP_USR-..." />
                        <p className="text-sm text-muted-foreground">
                            Tu clave pública de Mercado Pago.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mp-access-token">Access Token</Label>
                        <Input id="mp-access-token" type="password" placeholder="••••••••••••••••••••" />
                         <p className="text-sm text-muted-foreground">
                            Tu token de acceso para realizar operaciones.
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                    <Button onClick={handleSave}>Guardar Cambios</Button>
                </CardFooter>
            </Card>
        </div>
    )
}
