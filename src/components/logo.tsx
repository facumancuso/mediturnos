import { HeartPulse } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2" aria-label="MediTurnos Logo">
      <HeartPulse className="h-7 w-7 text-primary" />
      <span className="text-xl font-bold tracking-tight">MediTurnos</span>
    </div>
  );
}
