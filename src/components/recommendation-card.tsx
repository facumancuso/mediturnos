'use client';

import { Lightbulb, Info, Wrench } from 'lucide-react';
import type { Recommendation } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Separator } from './ui/separator';

const priorityConfig = {
  high: { label: 'Prioridad Alta', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700' },
  medium: { label: 'Prioridad Media', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700' },
  low: { label: 'Prioridad Baja', className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700' },
};

export function RecommendationCard({ recommendation, onApply }: { recommendation: Recommendation, onApply: (rec: Recommendation) => void }) {
  const config = priorityConfig[recommendation.priority];

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{recommendation.title}</CardTitle>
          <Badge variant="outline" className={config.className}>{config.label}</Badge>
        </div>
        <CardDescription>{recommendation.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 mt-1 text-primary shrink-0" />
          <div>
            <h4 className="font-semibold">Impacto Esperado</h4>
            <p className="text-sm text-muted-foreground">{recommendation.expectedImpact}</p>
          </div>
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="implementation">
            <AccordionTrigger>
                <div className="flex items-center gap-3">
                    <Wrench className="h-5 w-5 text-primary shrink-0" />
                    <h4 className="font-semibold text-left">Cómo Implementarlo</h4>
                </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{recommendation.implementation}</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
      <CardFooter className="bg-muted/50 p-4 border-t">
        <div className="flex w-full justify-end gap-2">
            <Button variant="ghost">Ignorar</Button>
            <Button onClick={() => onApply(recommendation)}>Aplicar Recomendación</Button>
        </div>
      </CardFooter>
    </Card>
  );
}
