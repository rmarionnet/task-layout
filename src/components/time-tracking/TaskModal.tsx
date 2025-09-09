import { useEffect, useMemo, useState } from 'react';
import { Task, Category } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

const START_HOUR = 7;
const END_HOUR = 20; // exclusive
const HEADER_H = 40; // px
const HOUR_H = 48;   // px

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatTime(hour: number): string {
  const h = Math.floor(hour);
  const m = (hour % 1) * 60;
  return `${pad(h)}:${pad(m)}`;
}

function timeSlotsArray() {
  const arr: number[] = [];
  for (let h = START_HOUR; h < END_HOUR; h += 0.5) {
    arr.push(h);
  }
  return arr;
}

function getDurationOptions(startHour: number) {
  const max = Math.min(24, (END_HOUR - startHour) * 2); // max 24 slots of 30min
  return Array.from({ length: max }, (_, i) => (i + 1) * 0.5);
}

function titleForCategory(c: Category) {
  return c === 'FACTURABLE' ? 'Facturable' : 'Non facturable';
}

export interface TaskModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  dateISO: string;
  startHour: number;
  existingTask?: Task;
  clients: string[];
  projectsByClient: Record<string, string[]>;
  quotesByClient: Record<string, string[]>;
  types: string[];
  onClose: () => void;
  onSave: (task: Task) => { ok: true } | { ok: false; error: string };
  onDelete?: (id: string) => void;
}

export default function TaskModal(props: TaskModalProps) {
  const {
    open,
    mode,
    dateISO,
    startHour,
    existingTask,
    clients,
    projectsByClient,
    quotesByClient,
    types,
    onClose,
    onSave,
    onDelete,
  } = props;

  const [category, setCategory] = useState<Category>(existingTask?.category ?? 'FACTURABLE');
  const [client, setClient] = useState<string>(existingTask?.client ?? '');
  const [project, setProject] = useState<string>(existingTask?.project ?? '');
  const [quote, setQuote] = useState<string>(existingTask?.quote ?? '');
  const [type, setType] = useState<string>(existingTask?.type ?? '');
  const [description, setDescription] = useState<string>(existingTask?.description ?? '');
  const [billed, setBilled] = useState<boolean>(existingTask?.billed ?? false);
  const [duration, setDuration] = useState<number>(existingTask ? (existingTask.endHour - existingTask.startHour) : 1);
  const [error, setError] = useState<string | null>(null);

  const [localDateISO, setLocalDateISO] = useState<string>(dateISO);
  const [localStartHour, setLocalStartHour] = useState<number>(startHour);

  useEffect(() => {
    if (!open) return;
    // Reset when opening
    setCategory(existingTask?.category ?? 'FACTURABLE');
    setClient(existingTask?.client ?? '');
    setProject(existingTask?.project ?? '');
    setQuote(existingTask?.quote ?? '');
    setType(existingTask?.type ?? '');
    setDescription(existingTask?.description ?? '');
    setBilled(existingTask?.billed ?? false);
    setDuration(existingTask ? (existingTask.endHour - existingTask.startHour) : 1);
    setLocalDateISO(dateISO);
    setLocalStartHour(startHour);
    setError(null);
  }, [open, existingTask, dateISO, startHour]);

  const availableProjects = useMemo(() => {
    return client ? (projectsByClient[client] ?? []) : [];
  }, [client, projectsByClient]);

  const availableQuotes = useMemo(() => {
    return client ? (quotesByClient[client] ?? []) : [];
  }, [client, quotesByClient]);

  const durationOptions = useMemo(() => getDurationOptions(localStartHour), [localStartHour]);
  const endHour = localStartHour + duration;

  const handleCategoryChange = (value: Category) => {
    setCategory(value);
    if (value === 'NON_FACTURABLE') {
      setClient('');
      setProject('');
      setQuote('');
      setBilled(false);
    } else {
      setType('');
    }
  };

  const handleSave = () => {
    setError(null);
    if (category === 'FACTURABLE' && !client.trim()) {
      setError('Client requis.');
      return;
    }
    if (category === 'NON_FACTURABLE' && !type.trim()) {
      setError('Type requis.');
      return;
    }
    if (endHour > END_HOUR) {
      setError('La durée dépasse 20:00.');
      return;
    }

    const task: Task = {
      id: existingTask?.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`),
      dateISO: localDateISO,
      startHour: localStartHour,
      endHour,
      category,
      client: category === 'FACTURABLE' ? (client.trim() || undefined) : undefined,
      project: category === 'FACTURABLE' ? (project.trim() || undefined) : undefined,
      quote: category === 'FACTURABLE' ? (quote.trim() || undefined) : undefined,
      type: category === 'NON_FACTURABLE' ? (type.trim() || undefined) : undefined,
      description: description.trim() ? description.trim() : undefined,
      billed: category === 'FACTURABLE' ? billed : undefined,
    };

    const res = onSave(task);
    if ('error' in res) {
      setError(res.error);
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nouvelle tâche' : 'Éditer la tâche'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <RadioGroup value={category} onValueChange={(v) => handleCategoryChange(v as Category)} className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="FACTURABLE" id="facturable" />
                <Label htmlFor="facturable">FACTURABLE</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="NON_FACTURABLE" id="non_facturable" />
                <Label htmlFor="non_facturable">NON_FACTURABLE</Label>
              </div>
            </RadioGroup>
          </div>

          {category === 'FACTURABLE' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client (obligatoire)</Label>
                <Input id="client" value={client} list="clients-dl" onChange={(e) => setClient(e.target.value)} placeholder="Ex: Client X" />
                <datalist id="clients-dl">
                  {clients.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project">Projet (optionnel)</Label>
                <Input id="project" value={project} list="projects-dl" onChange={(e) => setProject(e.target.value)} placeholder="Ex: Projet Y" />
                <datalist id="projects-dl">
                  {availableProjects.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote">Devis (optionnel)</Label>
                <Input id="quote" value={quote} list="quotes-dl" onChange={(e) => setQuote(e.target.value)} placeholder="Ex: DV-2025-001" />
                <datalist id="quotes-dl">
                  {availableQuotes.map((q) => (
                    <option key={q} value={q} />
                  ))}
                </datalist>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="billed" checked={billed} onCheckedChange={(v) => setBilled(Boolean(v))} />
                <Label htmlFor="billed">Facturée</Label>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="type">Type (obligatoire)</Label>
              <Input id="type" value={type} list="types-dl" onChange={(e) => setType(e.target.value)} placeholder="Ex: Formation" />
              <datalist id="types-dl">
                {types.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (140 caractères max)</Label>
            <Input id="description" value={description} maxLength={140} onChange={(e) => setDescription(e.target.value)} placeholder="Description courte" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={localDateISO} onChange={(e) => setLocalDateISO(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Début</Label>
              <select
                className="w-full h-10 border rounded-md px-3"
                value={localStartHour}
                onChange={(e) => setLocalStartHour(parseFloat(e.target.value))}
              >
                {timeSlotsArray().filter(h => h + duration <= END_HOUR).map((h) => (
                  <option key={h} value={h}>{formatTime(h)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Durée (h)</Label>
              <select className="w-full h-10 border rounded-md px-3" value={duration} onChange={(e) => setDuration(parseFloat(e.target.value))}>
                {durationOptions.map((d) => (
                  <option key={d} value={d}>{d === Math.floor(d) ? `${d}h` : `${d}h`}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="text-sm text-destructive-foreground bg-destructive/15 rounded px-3 py-2">{error}</div>}
        </div>

        <DialogFooter className="justify-between">
          {mode === 'edit' && existingTask && onDelete ? (
            <Button variant="destructive" onClick={() => onDelete(existingTask.id)}>Supprimer</Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </div>
        </DialogFooter>

        {/* Accessibility helpers */}
        <div className="sr-only">Fin: {formatTime(endHour)}</div>
      </DialogContent>
    </Dialog>
  );
}
