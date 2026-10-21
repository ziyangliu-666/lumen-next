import { useEffect, useState, type JSX } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { request } from './api';

// The models a new session may think with, as the server allows them
// (GET /api/models), the default first. The default is named "Auto": it is
// the server's choice, and the cheapest model on a demo. The others keep
// their real names. With one model the field says "Auto" and has no picker.

/** The allowed models; empty until read, and when signed out or on failure. */
export function useModels(enabled: boolean): readonly string[] {
  const [models, setModels] = useState<readonly string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    request<{ items?: string[] }>('/api/models').then(
      (body) => active && setModels(body.items ?? []),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [enabled]);
  return enabled ? models : [];
}

/** How the field names a model: the default (the first) is "Auto". */
export function modelLabel(models: readonly string[], model: string | undefined): string {
  return model === undefined || model === models[0] ? 'Auto' : model;
}

/** A quiet picker for the field's toolbar, the way chat products name the model there. */
export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: readonly string[];
  value: string | undefined;
  onChange: (model: string) => void;
}): JSX.Element | null {
  if (models.length === 0) return null;
  if (models.length === 1) return <span className="px-2 text-sm text-ink-2">Auto</span>;
  return (
    <Select value={value ?? models[0] ?? ''} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Model"
        size="sm"
        className="h-8! w-auto gap-1 border-transparent bg-transparent px-2 text-sm text-ink-2 hover:text-ink"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model} value={model}>
            {modelLabel(models, model)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
