import { useMemo, useState } from 'react';
import { Task, Category } from '@/types';
import TaskModal from './TaskModal';
import { Badge } from '@/components/ui/badge';

const START_HOUR = 7;
const END_HOUR = 20; // exclusive
const HEADER_H = 40; // px
const HOUR_H = 48;   // px

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad(m)}-${pad(day)}`;
}

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function dayLabel(date: Date) {
  const weekdays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return `${weekdays[date.getDay()]} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

export interface WeeklyGridProps {
  weekStart: Date; // Monday
  tasks: Task[];
  filteredTasks: Task[];
  clients: string[];
  projectsByClient: Record<string, string[]>;
  types: string[];
  onUpsert: (task: Task) => { ok: true } | { ok: false; error: string };
  onDelete: (id: string) => void;
}

export default function WeeklyGrid(props: WeeklyGridProps) {
  const { weekStart, tasks, filteredTasks, clients, projectsByClient, types, onUpsert, onDelete } = props;
  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = useMemo(() => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalDateISO, setModalDateISO] = useState('');
  const [modalStartHour, setModalStartHour] = useState(START_HOUR);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const openCreate = (dateISO: string, startHour: number) => {
    setModalMode('create');
    setEditingTask(undefined);
    setModalDateISO(dateISO);
    setModalStartHour(startHour);
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setModalMode('edit');
    setEditingTask(task);
    setModalDateISO(task.dateISO);
    setModalStartHour(task.startHour);
    setModalOpen(true);
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header row */}
        <div className="grid" style={{ gridTemplateColumns: '120px repeat(6, 1fr)' }}>
          <div className="h-10 flex items-center justify-center text-sm font-medium border-b">Heures</div>
          {weekDays.map((d) => (
            <div key={isoDate(d)} className="h-10 flex items-center justify-center text-sm font-medium border-b">
              {dayLabel(d)}
            </div>
          ))}
        </div>

        {/* Body rows (hours) */}
        <div className="grid box-border" style={{ gridTemplateColumns: '120px repeat(6, 1fr)' }}>
          {/* Hours column */}
          <div>
            {hours.map((h, idx) => (
              <div key={h} className={`h-12 border-b text-sm flex items-center justify-center ${idx === hours.length - 1 ? '' : ''}`}>
                {pad(h)}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((d) => {
            const dateISO = isoDate(d);
            const dayTasks = filteredTasks.filter((t) => t.dateISO === dateISO);
            return (
              <div key={dateISO} className="relative border-l">
                {/* Clickable hour cells */}
                {hours.map((h, i) => (
                  <button
                    key={h}
                    type="button"
                    className="h-12 w-full border-b hover:bg-accent/40 transition-colors"
                    aria-label={`Créer tâche à ${pad(h)}:00`}
                    onClick={() => openCreate(dateISO, h)}
                  />
                ))}

                {/* Overlay tasks */}
                {dayTasks.map((t) => {
                  const top = (t.startHour - START_HOUR) * HOUR_H + HEADER_H;
                  const height = (t.endHour - t.startHour) * HOUR_H - 1;
                  const isBillable = t.category === 'FACTURABLE';
                  return (
                    <div
                      key={t.id}
                      className={`absolute left-1 right-1 rounded-md border shadow-sm cursor-pointer ${isBillable ? 'bg-emerald-100 border-emerald-300' : 'bg-gray-100 border-gray-300'} hover:shadow-md`}
                      style={{ top: top - HEADER_H, height }}
                      onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                    >
                      <div className="p-2 text-xs leading-5 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{isBillable ? 'Facturable' : 'Non facturable'}</div>
                          {isBillable && (
                            <Badge variant="secondary" className={`${t.billed ? 'bg-emerald-200' : 'bg-yellow-200'} text-foreground`}>
                              {t.billed ? 'Facturée' : 'À facturer'}
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground">
                          {isBillable ? (
                            <span>{t.client}{t.project ? ` — ${t.project}` : ''}</span>
                          ) : (
                            <span>{t.type}</span>
                          )}
                        </div>
                        {t.description && (
                          <div className="truncate">{t.description}</div>
                        )}
                        <div className="text-[11px] text-muted-foreground">{pad(t.startHour)}:00 → {pad(t.endHour)}:00</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <TaskModal
        open={modalOpen}
        mode={modalMode}
        dateISO={modalDateISO}
        startHour={modalStartHour}
        existingTask={editingTask}
        clients={clients}
        projectsByClient={projectsByClient}
        types={types}
        onClose={() => setModalOpen(false)}
        onSave={onUpsert}
        onDelete={onDelete}
      />
    </div>
  );
}
