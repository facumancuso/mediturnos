# MediTurnos

Proyecto Next.js para gestión de turnos médicos.

## Configuración con MongoDB local

1. Instalá y levantá MongoDB Community Edition en tu máquina.
2. Copiá `.env.example` a `.env.local`.
3. Configurá las variables:
	- `MONGODB_URI` (por defecto `mongodb://127.0.0.1:27017`)
	- `MONGODB_DB_NAME` (por defecto `mediturnos`)
4. Instalá dependencias y ejecutá desarrollo:

```bash
npm install
npm run dev
```

## Endpoints Mongo habilitados

- `GET /api/professionals` → lista de profesionales públicos.
- `GET /api/professionals/[slug]` → detalle de profesional público.
- `GET /api/dashboard/professional?professionalId=...` → perfil del profesional logueado.
- `GET /api/dashboard/patients?professionalId=...` → listado de pacientes.
- `POST /api/dashboard/patients` → alta/actualización de paciente.
- `GET /api/dashboard/appointments?professionalId=...&day=YYYY-MM-DD` → turnos por día.
- `POST /api/dashboard/appointments` → alta de turno.

## Nota de migración

La migración a MongoDB está activa para:

- Módulo público (`/directorio` y `/profesional/[slug]`).
- Dashboard en lecturas/escrituras principales (`/dashboard`, `/dashboard/pacientes`, `/dashboard/calendario`, alta de paciente y alta de turno).

La autenticación todavía usa Firebase Auth y puede migrarse en una siguiente etapa.
