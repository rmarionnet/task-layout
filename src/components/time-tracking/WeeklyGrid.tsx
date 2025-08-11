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
  quotesByClient: Record<string, string[]>;
  types: string[];
  onUpsert: (task: Task) => { ok: true } | { ok: false; error: string };
  onDelete: (id: string) => void;
}

export default function WeeklyGrid(props: WeeklyGridProps) {
  const { weekStart, tasks, filteredTasks, clients, projectsByClient, quotesByClient, types, onUpsert, onDelete } = props;
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
          <div className="h-10 box-border flex items-center justify-center text-sm font-medium border-b">Heures</div>
          {weekDays.map((d) => (
            <div key={isoDate(d)} className="h-10 box-border flex items-center justify-center text-sm font-medium border-b">
              {dayLabel(d)}
            </div>
          ))}
        </div>

        {/* Body rows (hours) */}
        <div className="grid box-border" style={{ gridTemplateColumns: '120px repeat(6, 1fr)' }}>
          {/* Hours column */}
          <div className="grid" style={{ gridTemplateRows: `repeat(${hours.length}, ${HOUR_H}px)` }}>
            {hours.map((h) => (
              <div key={h} className="box-border border-b text-sm flex items-center justify-center">
                {pad(h)}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((d, dayIdx) => {
            const dateISO = isoDate(d);
            const dayTasks = filteredTasks.filter((t) => t.dateISO === dateISO);
            return (
              <div key={dateISO} className="relative box-border border-l grid" style={{ gridTemplateRows: `repeat(${hours.length}, ${HOUR_H}px)` }}>
                {/* Clickable hour cells */}
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="w-full box-border border-0 border-b hover:bg-accent/40 transition-colors"
                    aria-label={`Créer tâche à ${pad(h)}:00`}
                    onClick={() => openCreate(dateISO, h)}
                  />
                ))}

                {/* Overlay tasks with DnD */}
                {dayTasks.map((t) => {
                  const top = (t.startHour - START_HOUR) * HOUR_H + HEADER_H;
                  const height = (t.endHour - t.startHour) * HOUR_H - 1;
                  const isBillable = t.category === 'FACTURABLE';

                  // DnD state per task (via closures)
                  let isDragging = false;
                  let moved = false;

                  const onMouseDown = (e: any) => {
                    e.stopPropagation();
                    const target = e.currentTarget as HTMLDivElement;
                    const gridEl = target.parentElement as HTMLElement; // day column
                    const gridRect = gridEl.getBoundingClientRect();
                    const colWidth = gridRect.width;
                    const durationH = t.endHour - t.startHour;
                    const origDayIdx = dayIdx;
                    const startClientX = e.clientX;
                    const startClientY = e.clientY;

                    let dx = 0;
                    let dy = 0;

                    isDragging = true;
                    moved = false;

                    const handleMove = (me: MouseEvent) => {
                      if (!isDragging) return;
                      dx = me.clientX - startClientX;
                      dy = me.clientY - startClientY;
                      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

                      // Visual move via transform
                      target.style.zIndex = '50';
                      target.style.transform = `translate(${dx}px, ${dy}px)`;
                      target.style.pointerEvents = 'none';
                      document.body.style.cursor = 'grabbing';
                    };

                    const handleUp = (me: MouseEvent) => {
                      if (!isDragging) return;
                      isDragging = false;
                      document.body.style.cursor = '';

                      // Compute target snapped slots
                      const shiftDays = Math.round(dx / colWidth);
                      const newDayIdx = Math.min(5, Math.max(0, origDayIdx + shiftDays));
                      const shiftHours = Math.round(dy / HOUR_H);
                      const newStart = Math.min(END_HOUR - durationH, Math.max(START_HOUR, t.startHour + shiftHours));

                      const newDate = isoDate(addDays(weekStart, newDayIdx));
                      const updated: Task = { ...t, dateISO: newDate, startHour: newStart, endHour: newStart + durationH };

                      // Reset visuals
                      target.style.transform = '';
                      target.style.pointerEvents = '';
                      target.style.zIndex = '';

                      if (!moved) {
                        openEdit(t);
                      } else {
                        const res = onUpsert(updated);
                        if ('error' in res) {
                          // Revert implicitly; optionally show toast
                        }
                      }

                      window.removeEventListener('mousemove', handleMove);
                      window.removeEventListener('mouseup', handleUp);
                    };

                    window.addEventListener('mousemove', handleMove);
                    window.addEventListener('mouseup', handleUp);
                  };

                  // Resize handles
                  const onResize = (pos: 'top' | 'bottom') => (e: React.MouseEvent) => {
                    e.stopPropagation();
                    const target = (e.currentTarget.parentElement as HTMLDivElement) || (e.currentTarget as any);
                    const durationH = t.endHour - t.startHour;
                    const startClientY = e.clientY;
                    let dy = 0;
                    let isResizing = true;

                    const handleMove = (me: MouseEvent) => {
                      if (!isResizing) return;
                      dy = me.clientY - startClientY;
                      const snap = Math.round(dy / HOUR_H);

                      let newStart = t.startHour;
                      let newDuration = durationH;
                      if (pos === 'bottom') {
                        newDuration = Math.max(1, Math.min(END_HOUR - t.startHour, durationH + snap));
                      } else {
                        newStart = Math.max(START_HOUR, Math.min(t.endHour - 1, t.startHour + snap));
                        newDuration = t.endHour - newStart;
                      }

                      const newTopPx = (newStart - START_HOUR) * HOUR_H;
                      const newHeightPx = newDuration * HOUR_H - 1;
                      target.style.zIndex = '50';
                      target.style.top = `${newTopPx}px`;
                      target.style.height = `${newHeightPx}px`;
                      document.body.style.cursor = 'ns-resize';
                    };

                    const handleUp = () => {
                      if (!isResizing) return;
                      isResizing = false;
                      document.body.style.cursor = '';

                      const snap = Math.round(dy / HOUR_H);
                      let newStart = t.startHour;
                      let newDuration = durationH;
                      if (pos === 'bottom') {
                        newDuration = Math.max(1, Math.min(END_HOUR - t.startHour, durationH + snap));
                      } else {
                        newStart = Math.max(START_HOUR, Math.min(t.endHour - 1, t.startHour + snap));
                        newDuration = t.endHour - newStart;
                      }

                      const updated: Task = { ...t, startHour: newStart, endHour: newStart + newDuration };
                      const res = onUpsert(updated);
                      if ('error' in res) {
                        // onUpsert failed -> let DOM revert on state re-render
                      }

                      window.removeEventListener('mousemove', handleMove);
                      window.removeEventListener('mouseup', handleUp);
                    };

                    window.addEventListener('mousemove', handleMove);
                    window.addEventListener('mouseup', handleUp);
                  };

                  return (
                    <div
                      key={t.id}
                      className={`absolute left-1 right-1 rounded-md border shadow-sm cursor-move ${isBillable ? 'bg-emerald-100 border-emerald-300' : 'bg-gray-100 border-gray-300'} hover:shadow-md select-none`}
                      style={{ top: (t.startHour - START_HOUR) * HOUR_H, height }}
                      onMouseDown={onMouseDown}
                    >
                      {/* Resize handles */}
                      <div className="absolute left-0 right-0 h-2 -top-1 cursor-ns-resize" onMouseDown={onResize('top')} />
                      <div className="absolute left-0 right-0 h-2 -bottom-1 cursor-ns-resize" onMouseDown={onResize('bottom')} />

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
                            <span>{t.client}{t.project ? ` — ${t.project}` : ''}{t.quote ? ` — Devis ${t.quote}` : ''}</span>
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
          quotesByClient={quotesByClient}
          types={types}
          onClose={() => setModalOpen(false)}
          onSave={onUpsert}
          onDelete={onDelete}
        />
    </div>
  );
}
