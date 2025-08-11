import { useEffect, useMemo, useState } from 'react';
import WeeklyGrid from '@/components/time-tracking/WeeklyGrid';
import { Task, Category } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'tt.tasks';
const START_HOUR = 7;
const END_HOUR = 20; // exclusive

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // 0 if already Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0,0,0,0);
  return d;
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad(m)}-${pad(day)}`;
}

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export default function Index() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));

  // Filters
  const [filterCategory, setFilterCategory] = useState<'ALL' | Category>('ALL');
  const [filterClient, setFilterClient] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    document.title = 'Time Tracking · Agenda hebdo';
  }, []);

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Task[] = JSON.parse(raw);
        setTasks(Array.isArray(parsed) ? parsed : []);
      }
    } catch {}
  }, []);

  // Save
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  // Options for datalists & filters
  const clients = useMemo(() => Array.from(new Set(tasks.filter(t => t.client).map(t => t.client!))).sort(), [tasks]);
  const types = useMemo(() => Array.from(new Set(tasks.filter(t => t.type).map(t => t.type!))).sort(), [tasks]);
  const projectsByClient = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    tasks.forEach(t => {
      if (t.category === 'FACTURABLE' && t.client && t.project) {
        if (!map[t.client]) map[t.client] = new Set();
        map[t.client].add(t.project);
      }
    });
    const out: Record<string, string[]> = {};
    Object.entries(map).forEach(([k, v]) => out[k] = Array.from(v).sort());
    return out;
  }, [tasks]);

  const quotesByClient = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    tasks.forEach(t => {
      if (t.category === 'FACTURABLE' && t.client && t.quote) {
        if (!map[t.client]) map[t.client] = new Set();
        map[t.client].add(t.quote);
      }
    });
    const out: Record<string, string[]> = {};
    Object.entries(map).forEach(([k, v]) => out[k] = Array.from(v).sort());
    return out;
  }, [tasks]);

  const weekDatesISO = useMemo(() => Array.from({ length: 6 }, (_, i) => isoDate(addDays(weekStart, i))), [weekStart]);
  const weekEnd = useMemo(() => addDays(weekStart, 5), [weekStart]);
  const weekLabel = useMemo(() => `${isoDate(weekStart)} → ${isoDate(weekEnd)}`, [weekStart, weekEnd]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!weekDatesISO.includes(t.dateISO)) return false;
      if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
      if (filterClient && t.client !== filterClient) return false;
      if (filterType && t.type !== filterType) return false;
      return true;
    });
  }, [tasks, weekDatesISO, filterCategory, filterClient, filterType]);

  // Overlap check
  function overlaps(a: Task, b: Task) {
    return a.dateISO === b.dateISO && a.startHour < b.endHour && b.startHour < a.endHour && a.id !== b.id;
  }

  const upsertTask = (task: Task): { ok: true } | { ok: false; error: string } => {
    if (task.startHour < START_HOUR || task.endHour > END_HOUR) {
      return { ok: false, error: 'Plage horaire invalide (07:00 → 20:00).' };
    }
    // Anti-chevauchement
    const conflict = tasks.some(t => overlaps(task, t));
    if (conflict) {
      return { ok: false, error: 'Chevauchement détecté.' };
    }

    setTasks(prev => {
      const exists = prev.some(t => t.id === task.id);
      const next = exists ? prev.map(t => t.id === task.id ? task : t) : [...prev, task];
      return next;
    });

    toast({ title: 'Sauvegardé', description: `${task.dateISO} ${pad(task.startHour)}:00 → ${pad(task.endHour)}:00` });
    return { ok: true };
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    toast({ title: 'Supprimé' });
  };

  const resetFilters = () => {
    setFilterCategory('ALL');
    setFilterClient('');
    setFilterType('');
  };

  const anyFilter = filterCategory !== 'ALL' || !!filterClient || !!filterType;

  // CSV export
  function escapeCSV(val: string | number | boolean | undefined | null) {
    const s = val === undefined || val === null ? '' : String(val);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function toCSV(list: Task[]) {
    const header = 'date;heure_debut;heure_fin;categorie;client;projet;devis;type;description;duree_h;facturee';
    const rows = list
      .slice()
      .sort((a,b) => a.dateISO.localeCompare(b.dateISO) || a.startHour - b.startHour)
      .map(t => [
        t.dateISO,
        `${pad(t.startHour)}:00`,
        `${pad(t.endHour)}:00`,
        t.category,
        t.client ?? '',
        t.project ?? '',
        t.quote ?? '',
        t.type ?? '',
        t.description ?? '',
        (t.endHour - t.startHour),
        t.category === 'FACTURABLE' ? (t.billed ? 'oui' : 'non') : ''
      ].map(escapeCSV).join(';'));
    return [header, ...rows].join('\n');
  }

  const exportWeek = () => {
    const data = tasks.filter(t => weekDatesISO.includes(t.dateISO));
    downloadCSV(toCSV(data), `export_semaine_${isoDate(weekStart)}.csv`);
  };

  const exportAll = () => {
    downloadCSV(toCSV(tasks), 'export_complet.csv');
  };

  function downloadCSV(csv: string, filename: string) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container py-6">
          <h1 className="text-2xl font-semibold">Time Tracking — Agenda hebdomadaire</h1>
          <p className="text-muted-foreground mt-1">Lundi → Samedi, 07:00 → 20:00</p>

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <Button variant="secondary" onClick={() => setWeekStart(prev => addDays(prev, -7))}>Semaine précédente</Button>
            <div className="px-3 py-1 border rounded-md text-sm">{weekLabel}</div>
            <Button onClick={() => setWeekStart(prev => addDays(prev, 7))}>Semaine suivante</Button>
          </div>

          {/* Filters */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <select className="h-10 w-full border rounded-md px-3" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)}>
                <option value="ALL">Toutes</option>
                <option value="FACTURABLE">FACTURABLE</option>
                <option value="NON_FACTURABLE">NON_FACTURABLE</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Client</Label>
              <select className="h-10 w-full border rounded-md px-3" value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
                <option value="">Tous</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select className="h-10 w-full border rounded-md px-3" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">Tous</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              {anyFilter && <Button variant="secondary" onClick={resetFilters}>Réinitialiser</Button>}
              <Button onClick={exportWeek}>Export CSV (semaine)</Button>
              <Button variant="secondary" onClick={exportAll}>Export CSV (tout)</Button>
            </div>
          </div>
        </div>
      </header>

      <section className="container py-6">
        <WeeklyGrid
          weekStart={weekStart}
          tasks={tasks}
          filteredTasks={filteredTasks}
          clients={clients}
          projectsByClient={projectsByClient}
          quotesByClient={quotesByClient}
          types={types}
          onUpsert={upsertTask}
          onDelete={deleteTask}
        />
      </section>
    </main>
  );
}
