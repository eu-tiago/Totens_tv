import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Clock, Monitor, Pencil, CalendarIcon, Grid3x3, Globe, Copy } from 'lucide-react';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
];

type Mode = 'recurring' | 'oneoff';

const defaultForm = {
  mode: 'recurring' as Mode,
  playlistId: '',
  priority: 0,
  active: true,
  label: '',
  startTime: '08:00',
  endTime: '18:00',
  daysOfWeek: [1, 2, 3, 4, 5] as number[],
  startDate: undefined as Date | undefined,
  endDate: undefined as Date | undefined,
  startDateTime: '08:00',
  endDateTime: '18:00',
};

function combineToISO(date: Date, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function isoToLocalDate(iso?: string | null) { return iso ? new Date(iso) : undefined; }
function isoToLocalTime(iso?: string | null) {
  if (!iso) return '08:00';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

export default function Agendamento() {
  const [devices, setDevices] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const [deviceSchedule, setDeviceSchedule] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  // Estados do Dialog de Cópia
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [copyReplace, setCopyReplace] = useState(true);
  const [copying, setCopying] = useState(false);

  // Relógio em tempo real para verificar blocos ativos
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Carrega dispositivos e playlists iniciais
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [devRes, playRes] = await Promise.all([
          supabase.from('devices').select('*').order('name'),
          supabase.from('playlists').select('*').order('name')
        ]);
        if (devRes.data) {
          setDevices(devRes.data);
          if (devRes.data.length > 0) setSelectedDeviceId(devRes.data[0].id);
        }
        if (playRes.data) setPlaylists(playRes.data);
      } catch (e) {
        console.error("Erro ao buscar dados iniciais:", e);
      }
    }
    fetchInitialData();
  }, []);

  // Carrega ou garante o schedule do dispositivo selecionado
  useEffect(() => {
    if (!selectedDeviceId) return;
    fetchDeviceScheduleAndBlocks(selectedDeviceId);
  }, [selectedDeviceId]);

  async function fetchDeviceScheduleAndBlocks(deviceId: string) {
    setLoadingBlocks(true);
    try {
      // 1. Busca ou cria o device_schedule para o totem/TV
      let { data: dsData, error: dsError } = await supabase
        .from('device_schedules')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (!dsData) {
        const { data: newDs, error: insErr } = await supabase
          .from('device_schedules')
          .insert([{ device_id: deviceId, timezone: 'America/Sao_Paulo', active: true }])
          .select()
          .single();
        if (insErr) throw insErr;
        dsData = newDs;
      }

      setDeviceSchedule(dsData);

      // 2. Busca os blocos vinculados a este schedule incluindo o nome da playlist
      const { data: blockData, error: blockErr } = await supabase
        .from('schedule_blocks')
        .select('*, playlists(name)')
        .eq('device_schedule_id', dsData.id)
        .order('priority', { ascending: false });

      if (blockErr) throw blockErr;
      setBlocks(blockData || []);
    } catch (err) {
      console.error("Erro ao carregar programação:", err);
    } finally {
      setLoadingBlocks(false);
    }
  }

  const timezone = deviceSchedule?.timezone ?? 'America/Sao_Paulo';

  const handleUpdateTimezone = async (tz: string) => {
    if (!deviceSchedule) return;
    await supabase.from('device_schedules').update({ timezone: tz }).eq('id', deviceSchedule.id);
    setDeviceSchedule((prev: any) => ({ ...prev, timezone: tz }));
  };

  const handleToggleScheduleActive = async (activeState: boolean) => {
    if (!deviceSchedule) return;
    await supabase.from('device_schedules').update({ active: activeState }).eq('id', deviceSchedule.id);
    setDeviceSchedule((prev: any) => ({ ...prev, active: activeState }));
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...defaultForm, playlistId: playlists[0]?.id ?? '' });
    setDialogOpen(true);
  };

  const openEdit = (b: any) => {
    setEditingId(b.id);
    setForm({
      mode: b.kind,
      playlistId: b.playlist_id,
      priority: b.priority,
      active: b.active,
      label: b.label ?? '',
      startTime: b.start_time?.slice(0, 5) ?? '08:00',
      endTime: b.end_time?.slice(0, 5) ?? '18:00',
      daysOfWeek: b.days_of_week ?? [1, 2, 3, 4, 5],
      startDate: isoToLocalDate(b.start_datetime_utc),
      endDate: isoToLocalDate(b.end_datetime_utc),
      startDateTime: isoToLocalTime(b.start_datetime_utc),
      endDateTime: isoToLocalTime(b.end_datetime_utc),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!deviceSchedule) return alert('Selecione um dispositivo.');
    if (!form.playlistId) return alert('Selecione uma playlist.');

    const base = {
      device_schedule_id: deviceSchedule.id,
      playlist_id: form.playlistId,
      priority: Number(form.priority) || 0,
      active: form.active,
      label: form.label?.trim() || null,
      kind: form.mode,
    };

    let payload: any;
    if (form.mode === 'recurring') {
      if (!form.daysOfWeek.length) return alert('Selecione ao menos um dia da semana.');
      if (form.endTime <= form.startTime) return alert('Hora fim deve ser maior que hora início.');
      payload = {
        ...base,
        days_of_week: form.daysOfWeek,
        start_time: form.startTime,
        end_time: form.endTime,
        start_datetime_utc: null,
        end_datetime_utc: null,
      };
    } else {
      if (!form.startDate || !form.endDate) return alert('Selecione datas de início e fim.');
      const s = combineToISO(form.startDate, form.startDateTime);
      const e = combineToISO(form.endDate, form.endDateTime);
      if (new Date(e) <= new Date(s)) return alert('A data/hora de fim deve ser posterior à de início.');
      payload = {
        ...base,
        days_of_week: null,
        start_time: null,
        end_time: null,
        start_datetime_utc: s,
        end_datetime_utc: e,
      };
    }

    try {
      setSaving(true);
      if (editingId) {
        const { error } = await supabase.from('schedule_blocks').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('schedule_blocks').insert([payload]);
        if (error) throw error;
      }
      setDialogOpen(false);
      setEditingId(null);
      fetchDeviceScheduleAndBlocks(selectedDeviceId);
    } catch (err: any) {
      alert("Erro ao salvar bloco: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('schedule_blocks').delete().eq('id', deletingId);
      if (error) throw error;
      setDeletingId(null);
      fetchDeviceScheduleAndBlocks(selectedDeviceId);
    } catch (err: any) {
      alert("Erro ao excluir bloco: " + err.message);
    }
  };

  const toggleActiveStatus = async (b: any) => {
    try {
      const { error } = await supabase
        .from('schedule_blocks')
        .update({ active: !b.active })
        .eq('id', b.id);
      if (error) throw error;
      fetchDeviceScheduleAndBlocks(selectedDeviceId);
    } catch (err: any) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  const toggleDay = (day: number) => setForm(f => ({
    ...f,
    daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter(d => d !== day) : [...f.daysOfWeek, day],
  }));

  // Validador simples de bloco ativo no momento atual
  const isBlockActiveNow = (b: any) => {
    if (!b.active || !deviceSchedule?.active) return false;
    const currentDay = now.getDay();
    const currentTimeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

    if (b.kind === 'recurring') {
      if (!b.days_of_week?.includes(currentDay)) return false;
      return currentTimeStr >= b.start_time?.slice(0,5) && currentTimeStr <= b.end_time?.slice(0,5);
    } else {
      if (!b.start_datetime_utc || !b.end_datetime_utc) return false;
      const start = new Date(b.start_datetime_utc);
      const end = new Date(b.end_datetime_utc);
      return now >= start && now <= end;
    }
  };

  const winningId = (() => {
    const activeBlocks = blocks.filter(isBlockActiveNow);
    if (!activeBlocks.length) return null;
    activeBlocks.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.kind !== b.kind) return a.kind === 'oneoff' ? -1 : 1;
      return 0;
    });
    return activeBlocks[0].id;
  })();

  const toggleCopyTarget = (id: string) =>
    setCopyTargets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCopy = async () => {
    if (!deviceSchedule || !blocks.length || !copyTargets.length) return;
    setCopying(true);
    let ok = 0;
    try {
      for (const targetId of copyTargets) {
        // Garante que o device_schedule do destino existe
        let { data: targetDs } = await supabase
          .from('device_schedules')
          .select('*')
          .eq('device_id', targetId)
          .maybeSingle();

        if (!targetDs) {
          const { data: newDs } = await supabase
            .from('device_schedules')
            .insert([{ device_id: targetId, timezone: timezone, active: true }])
            .select()
            .single();
          targetDs = newDs;
        }

        if (targetDs) {
          if (copyReplace) {
            await supabase.from('schedule_blocks').delete().eq('device_schedule_id', targetDs.id);
          }

          const rowsToCopy = blocks.map((b: any) => ({
            device_schedule_id: targetDs.id,
            playlist_id: b.playlist_id,
            kind: b.kind,
            priority: b.priority,
            active: b.active,
            label: b.label ?? null,
            days_of_week: b.days_of_week ?? null,
            start_time: b.start_time ?? null,
            end_time: b.end_time ?? null,
            start_datetime_utc: b.start_datetime_utc ?? null,
            end_datetime_utc: b.end_datetime_utc ?? null,
          }));

          if (rowsToCopy.length > 0) {
            await supabase.from('schedule_blocks').insert(rowsToCopy);
          }
          ok++;
        }
      }
      alert(`Programação copiada com sucesso para ${ok} dispositivo(s)!`);
      setCopyOpen(false);
    } catch (err: any) {
      alert("Erro ao copiar programação: " + err.message);
    } finally {
      setCopying(false);
    }
  };

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Grid3x3 className="w-5 h-5 text-[#8b75f6]" />
            Grade de Programação
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Gerencie os blocos de exibição por horário, dia da semana ou eventos únicos nos totens.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { setCopyTargets([]); setCopyReplace(true); setCopyOpen(true); }}
            size="sm"
            variant="outline"
            className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50"
            disabled={!deviceSchedule || blocks.length === 0}
          >
            <Copy className="w-4 h-4 mr-2" /> Copiar para Dispositivos
          </Button>
          <Button onClick={openNew} size="sm" className="rounded-xl bg-[#8b75f6] text-white hover:bg-[#7860f4]" disabled={!deviceSchedule}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar Bloco
          </Button>
        </div>
      </div>

      {/* Barra de Seleção de Dispositivo e Fuso */}
      <div className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-zinc-700 uppercase">Dispositivo Alvo</Label>
          <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
            <SelectTrigger className="rounded-xl border-purple-100 bg-[#f8f7fc]"><SelectValue placeholder="Selecione um dispositivo" /></SelectTrigger>
            <SelectContent>
              {devices.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}{d.location ? ` (${d.location})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-zinc-700 uppercase flex items-center gap-1">
            <Globe className="w-3 h-3 text-[#8b75f6]" /> Timezone
          </Label>
          <Select value={timezone} onValueChange={handleUpdateTimezone} disabled={!deviceSchedule}>
            <SelectTrigger className="rounded-xl border-purple-100 bg-[#f8f7fc] min-w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 self-center pb-1">
          <Switch
            checked={deviceSchedule?.active ?? false}
            onCheckedChange={handleToggleScheduleActive}
            disabled={!deviceSchedule}
          />
          <span className="text-sm font-medium text-zinc-700">Programação Ativa</span>
        </div>
      </div>

      {/* Tabela de Blocos */}
      <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-purple-50 bg-purple-50/40">
                {['Tipo / Rótulo', 'Dias / Datas', 'Início', 'Fim', 'Playlist', 'Prioridade', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              {!selectedDeviceId ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-zinc-400">Selecione um dispositivo acima.</td></tr>
              ) : loadingBlocks ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-zinc-400">Carregando programação...</td></tr>
              ) : blocks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-400">
                    <Grid3x3 className="w-8 h-8 mx-auto mb-2 text-purple-300" />
                    Nenhum bloco cadastrado. Clique em "Adicionar Bloco".
                  </td>
                </tr>
              ) : blocks.map((b) => {
                const winning = winningId === b.id;
                return (
                  <tr key={b.id} className={cn('hover:bg-purple-50/30 transition-colors', winning && 'bg-emerald-50/50')}>
                    <td className="px-5 py-4">
                      <span className={cn(
                        'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                        b.kind === 'oneoff' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                      )}>
                        {b.kind === 'oneoff' ? 'Evento' : 'Recorrente'}
                      </span>
                      {b.label && <div className="text-xs font-semibold text-zinc-800 mt-1">{b.label}</div>}
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-zinc-600">
                      {b.kind === 'oneoff' ? (
                        <span className="font-mono">
                          {b.start_datetime_utc ? format(new Date(b.start_datetime_utc), 'dd/MM HH:mm', { locale: ptBR }) : '—'} a{' '}
                          {b.end_datetime_utc ? format(new Date(b.end_datetime_utc), 'dd/MM HH:mm', { locale: ptBR }) : '—'}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(b.days_of_week ?? []).sort().map((d: number) => (
                            <span key={d} className="text-[10px] font-semibold bg-purple-50 text-[#8b75f6] border border-purple-100 px-1.5 py-0.5 rounded">
                              {DAYS[d]}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-700">
                      {b.kind === 'oneoff' ? (b.start_datetime_utc ? format(new Date(b.start_datetime_utc), 'HH:mm') : '—') : b.start_time?.slice(0,5)}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-700">
                      {b.kind === 'oneoff' ? (b.end_datetime_utc ? format(new Date(b.end_datetime_utc), 'HH:mm') : '—') : b.end_time?.slice(0,5)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-zinc-900">{b.playlists?.name ?? '—'}</td>
                    <td className="px-5 py-4"><span className="text-xs font-mono font-bold bg-zinc-100 px-2 py-1 rounded">P{b.priority}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Switch checked={b.active} onCheckedChange={() => toggleActiveStatus(b)} />
                        {winning && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Em Execução
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 hover:text-[#8b75f6]" onClick={() => openEdit(b)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-600" onClick={() => setDeletingId(b.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação / Edição de Bloco */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null); }}>
        <DialogContent className="max-w-lg rounded-2xl border border-purple-100 bg-white shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">{editingId ? 'Editar Bloco' : 'Novo Bloco de Horário'}</DialogTitle>
            <DialogDescription className="text-sm text-zinc-500">Configure a recorrência semanal ou o evento pontual na grade.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Tabs value={form.mode} onValueChange={(v) => setForm(f => ({ ...f, mode: v as Mode }))}>
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-purple-50 p-1">
                <TabsTrigger value="recurring" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#8b75f6] data-[state=active]:shadow-sm">Recorrente</TabsTrigger>
                <TabsTrigger value="oneoff" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#8b75f6] data-[state=active]:shadow-sm">Evento Único</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700">Playlist Vinculada</Label>
              <Select value={form.playlistId} onValueChange={(v) => setForm(f => ({ ...f, playlistId: v }))}>
                <SelectTrigger className="rounded-xl border-purple-100"><SelectValue placeholder="Selecione uma playlist" /></SelectTrigger>
                <SelectContent>
                  {playlists.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-700">Prioridade</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: Number(e.target.value) }))} className="rounded-xl border-purple-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-700">Rótulo (Opcional)</Label>
                <Input value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Manhã / Campanha" className="rounded-xl border-purple-100" />
              </div>
            </div>

            {form.mode === 'recurring' ? (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-zinc-700">Dias da Semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                          form.daysOfWeek.includes(i)
                            ? 'bg-[#8b75f6] text-white border-[#8b75f6] shadow-sm'
                            : 'bg-zinc-50 text-zinc-600 border-purple-100 hover:bg-purple-50'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-700">Hora Início</Label>
                    <Input type="time" value={form.startTime} onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))} className="rounded-xl border-purple-100" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-700">Hora Fim</Label>
                    <Input type="time" value={form.endTime} onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))} className="rounded-xl border-purple-100" />
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-700">Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal rounded-xl border-purple-100', !form.startDate && 'text-zinc-400')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.startDate ? format(form.startDate, 'dd/MM/yyyy') : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker mode="single" selected={form.startDate} onSelect={(d) => setForm(f => ({ ...f, startDate: d ?? undefined }))} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-700">Hora Início</Label>
                  <Input type="time" value={form.startDateTime} onChange={(e) => setForm(f => ({ ...f, startDateTime: e.target.value }))} className="rounded-xl border-purple-100" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-700">Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal rounded-xl border-purple-100', !form.endDate && 'text-zinc-400')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.endDate ? format(form.endDate, 'dd/MM/yyyy') : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker mode="single" selected={form.endDate} onSelect={(d) => setForm(f => ({ ...f, endDate: d ?? undefined }))} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-700">Hora Fim</Label>
                  <Input type="time" value={form.endDateTime} onChange={(e) => setForm(f => ({ ...f, endDateTime: e.target.value }))} className="rounded-xl border-purple-100" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm(f => ({ ...f, active: v }))} />
              <Label className="cursor-pointer text-sm font-medium text-zinc-700">Bloco ativo para exibição</Label>
            </div>
          </div>

          <DialogFooter className="border-t border-purple-50 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-[#8b75f6] text-white hover:bg-[#7860f4]">
              {saving ? 'Salvando...' : 'Salvar Bloco'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alerta de Exclusão */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja excluir este bloco?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação removerá o agendamento deste totem permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Cópia em Massa */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-purple-100 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900">
              <Copy className="w-4 h-4 text-[#8b75f6]" /> Copiar Programação
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500">
              Copia os {blocks.length} bloco(s) de <span className="font-semibold text-zinc-800">{selectedDevice?.name ?? '—'}</span> para outros dispositivos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-xl border border-purple-100 p-3 bg-purple-50/50">
              <Switch checked={copyReplace} onCheckedChange={setCopyReplace} id="replace" />
              <div className="flex-1">
                <Label htmlFor="replace" className="cursor-pointer text-xs font-semibold text-zinc-800">Substituir grade existente no destino</Label>
                <p className="text-[11px] text-zinc-500">Se ativo, apaga os blocos antigos dos totens selecionados antes de colar.</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-700 uppercase">Dispositivos de Destino</Label>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-[#8b75f6] hover:underline font-semibold" onClick={() => setCopyTargets(devices.filter(d => d.id !== selectedDeviceId).map(d => d.id))}>Todos</button>
                <span className="text-zinc-300">·</span>
                <button type="button" className="text-zinc-500 hover:underline" onClick={() => setCopyTargets([])}>Limpar</button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-purple-100 divide-y divide-purple-50 bg-zinc-50 p-2">
              {devices.filter(d => d.id !== selectedDeviceId).length === 0 ? (
                <div className="p-4 text-xs text-zinc-400 text-center">Nenhum outro dispositivo disponível.</div>
              ) : devices.filter(d => d.id !== selectedDeviceId).map((d) => (
                <label key={d.id} className="flex items-center gap-3 px-3 py-2 hover:bg-purple-100/40 rounded-lg cursor-pointer">
                  <Checkbox checked={copyTargets.includes(d.id)} onCheckedChange={() => toggleCopyTarget(d.id)} />
                  <Monitor className="w-3.5 h-3.5 text-zinc-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-zinc-800 truncate">{d.name}</div>
                    {d.location && <div className="text-[11px] text-zinc-400 truncate">{d.location}</div>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-purple-50 pt-4">
            <Button variant="outline" onClick={() => setCopyOpen(false)} disabled={copying} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleCopy} disabled={copying || copyTargets.length === 0} className="rounded-xl bg-[#8b75f6] text-white hover:bg-[#7860f4]">
              {copying ? 'Copiando...' : `Copiar para (${copyTargets.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}