import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from '@/lib/supabase'
import { Wifi, WifiOff, ListMusic, Image as ImageIcon, Activity, AlertTriangle, Clock, Monitor, Tv, Plus, Film, FileImage, Trash2, Eye, Sparkles, CheckCircle2, Shield, Repeat, RefreshCw, ArrowUp, ArrowDown, X, Pencil, Globe, Copy, Grid3x3, CalendarIcon, Terminal } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

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

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')

  const [devices, setDevices] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [media, setMedia] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])

  const [isAddingDevice, setIsAddingDevice] = useState(false)
  const [newDeviceName, setNewDeviceName] = useState('')
  const [newDeviceType, setNewDeviceType] = useState('totem_windows')
  const [newDeviceLocation, setNewDeviceLocation] = useState('')

  const [isAddingMedia, setIsAddingMedia] = useState(false)
  const [newMediaTitle, setNewMediaTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetPlaylistForUpload, setTargetPlaylistForUpload] = useState<string>('none')

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false)
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null)
  const [playlistForm, setPlaylistForm] = useState({
    name: '',
    loop: true,
    is_fallback: true,
    orderedMedia: [] as string[]
  })

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [deviceSchedule, setDeviceSchedule] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [savingBlock, setSavingBlock] = useState(false);

  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [copyReplace, setCopyReplace] = useState(true);
  const [copying, setCopying] = useState(false);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session])

  async function fetchData() {
    try {
      const [devRes, playRes, mediaRes, eventRes, itemsRes] = await Promise.all([
        supabase.from('devices').select('*'),
        supabase.from('playlists').select('*'),
        supabase.from('media').select('*'),
        supabase.from('status_events').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('playlist_items').select('*')
      ])

      if (devRes.data) {
        setDevices(devRes.data)
        if (devRes.data.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(devRes.data[0].id)
        }
      }
      if (mediaRes.data) setMedia(mediaRes.data)
      if (eventRes.data) setEvents(eventRes.data)

      if (playRes.data) {
        const items = itemsRes.data || []
        const formattedPlaylists = playRes.data.map(pl => {
          const matchedItems = items
            .filter((item: any) => item.playlist_id === pl.id)
            .sort((a: any, b: any) => (a.order_index ?? a.position ?? 0) - (b.order_index ?? b.position ?? 0))
          
          return {
            ...pl,
            media_ids: matchedItems.map((item: any) => item.media_id)
          }
        })
        setPlaylists(formattedPlaylists)
      }
    } catch (e) {
      console.error("Erro ao buscar dados do Supabase:", e)
    }
  }

  useEffect(() => {
    if (selectedDeviceId && session) {
      fetchDeviceScheduleAndBlocks(selectedDeviceId);
    }
  }, [selectedDeviceId, session]);

  async function fetchDeviceScheduleAndBlocks(deviceId: string) {
    setLoadingBlocks(true);
    try {
      let { data: dsData } = await supabase
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErrorMsg(error.message)
    } catch (err: any) {
      setErrorMsg("Erro ao conectar com o Supabase.")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('devices').insert([
        {
          name: newDeviceName,
          type: newDeviceType,
          location: newDeviceLocation,
          status: 'offline'
        }
      ])
      if (error) throw error
      setNewDeviceName('')
      setNewDeviceLocation('')
      setIsAddingDevice(false)
      fetchData()
    } catch (err: any) {
      alert("Erro ao cadastrar dispositivo: " + err.message)
    }
  }

  const handleDeleteDevice = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este dispositivo?")) return
    try {
      const { error } = await supabase.from('devices').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err: any) {
      alert("Erro ao excluir dispositivo: " + err.message)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert("ID do dispositivo copiado para a área de transferência!")
  }

  const handleCreateMedia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      alert("Por favor, selecione um arquivo de imagem ou vídeo.")
      return
    }

    try {
      setLoading(true)
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, selectedFile)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('media')
        .getPublicUrl(filePath)

      const publicUrl = data.publicUrl

      const { data: insertedMedia, error: dbError } = await supabase.from('media').insert([
        {
          title: newMediaTitle,
          type: selectedFile.type.startsWith('video') ? 'video' : 'image',
          url: publicUrl,
          storage_path: filePath
        }
      ]).select().single()

      if (dbError) throw dbError

      if (targetPlaylistForUpload !== 'none' && insertedMedia) {
        const { data: existingItems } = await supabase
          .from('playlist_items')
          .select('order_index')
          .eq('playlist_id', targetPlaylistForUpload)

        const nextIndex = existingItems ? existingItems.length : 0

        const { error: itemError } = await supabase.from('playlist_items').insert([
          {
            playlist_id: targetPlaylistForUpload,
            media_id: insertedMedia.id,
            order_index: nextIndex
          }
        ])

        if (itemError) {
          console.error("Erro ao associar mídia à playlist:", itemError)
          alert("Mídia salva, mas houve um erro ao vincular na playlist: " + itemError.message)
        }
      }

      setNewMediaTitle('')
      setSelectedFile(null)
      setTargetPlaylistForUpload('none')
      setIsAddingMedia(false)
      fetchData()
      alert("Mídia enviada e associada com sucesso!")
    } catch (err: any) {
      alert("Erro ao enviar arquivo para o Storage: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMedia = async (id: string, storagePath: string) => {
    if (!confirm("Tem certeza que deseja excluir esta mídia permanentemente?")) return

    try {
      if (storagePath) {
        await supabase.storage.from('media').remove([storagePath])
      }
      const { error } = await supabase.from('media').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err: any) {
      alert("Erro ao excluir mídia: " + err.message)
    }
  }

  const handleAutoCleanOldMedia = async () => {
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const oldItems = media.filter(m => new Date(m.created_at) < twoWeeksAgo)

    if (oldItems.length === 0) {
      alert("Nenhum arquivo com mais de 2 semanas encontrado para limpeza.")
      return
    }

    if (!confirm(`Foram encontrados ${oldItems.length} arquivos com mais de 2 semanas. Deseja removê-los para liberar espaço?`)) return

    try {
      setLoading(true)
      for (const item of oldItems) {
        if (item.storage_path) {
          await supabase.storage.from('media').remove([item.storage_path])
        }
        await supabase.from('media').delete().eq('id', item.id)
      }
      alert("Limpeza automática concluída com sucesso!")
      fetchData()
    } catch (err: any) {
      alert("Erro durante a limpeza automática: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const openNewPlaylist = () => {
    setEditingPlaylistId(null)
    setPlaylistForm({ name: '', loop: true, is_fallback: true, orderedMedia: [] })
    setIsPlaylistModalOpen(true)
  }

  const openEditPlaylist = (pl: any) => {
    setEditingPlaylistId(pl.id)
    setPlaylistForm({
      name: pl.name,
      loop: pl.loop ?? true,
      is_fallback: pl.is_fallback ?? true,
      orderedMedia: pl.media_ids || []
    })
    setIsPlaylistModalOpen(true)
  }

  const handleSavePlaylist = async () => {
    if (!playlistForm.name.trim()) {
      alert("Digite um nome para a playlist.")
      return
    }

    try {
      setLoading(true)
      const playlistPayload = {
        name: playlistForm.name,
        loop: playlistForm.loop,
        is_fallback: playlistForm.is_fallback
      }

      let targetPlaylistId = editingPlaylistId

      if (editingPlaylistId) {
        const { error } = await supabase.from('playlists').update(playlistPayload).eq('id', editingPlaylistId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('playlists').insert([playlistPayload]).select()
        if (error) throw error
        if (data && data.length > 0) {
          targetPlaylistId = data[0].id
        }
      }

      if (targetPlaylistId) {
        await supabase.from('playlist_items').delete().eq('playlist_id', targetPlaylistId)

        if (playlistForm.orderedMedia.length > 0) {
          const itemsPayload = playlistForm.orderedMedia.map((mediaId, index) => ({
            playlist_id: targetPlaylistId,
            media_id: mediaId,
            order_index: index
          }))
          
          await supabase.from('playlist_items').insert(itemsPayload)
        }
      }

      setIsPlaylistModalOpen(false)
      fetchData()
    } catch (err: any) {
      alert("Erro ao salvar playlist: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta playlist?")) return

    try {
      await supabase.from('playlist_items').delete().eq('playlist_id', id)
      const { error } = await supabase.from('playlists').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err: any) {
      alert("Erro ao excluir playlist: " + err.message)
    }
  }

  const toggleMediaSelection = (id: string) => {
    setPlaylistForm(f => {
      if (f.orderedMedia.includes(id)) {
        return { ...f, orderedMedia: f.orderedMedia.filter(x => x !== id) }
      }
      return { ...f, orderedMedia: [...f.orderedMedia, id] }
    })
  }

  const moveMediaOrder = (index: number, direction: 'up' | 'down') => {
    setPlaylistForm(f => {
      const arr = [...f.orderedMedia]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= arr.length) return f
      [arr[index], arr[target]] = [arr[target], arr[index]]
      return { ...f, orderedMedia: arr }
    })
  }

  const getMediaTitle = (id: string) => {
    const m = media.find((item: any) => item.id === id)
    return m ? m.title : 'Mídia não encontrada'
  }

  const forceRefreshDevices = async (playlistId: string, playlistName: string) => {
    try {
      await supabase.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', playlistId)
      alert(`Sinal de atualização enviado para a playlist "${playlistName}". Os totens e TVs sincronizarão em instantes.`)
    } catch (e: any) {
      alert('Erro ao forçar atualização: ' + e.message)
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

  const openNewBlock = () => {
    setEditingId(null);
    setForm({ ...defaultForm, playlistId: playlists[0]?.id ?? '' });
    setDialogOpen(true);
  };

  const openEditBlock = (b: any) => {
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

  const handleSaveBlock = async () => {
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
      setSavingBlock(true);
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
      setSavingBlock(false);
    }
  };

  const handleDeleteBlock = async () => {
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

  const toggleActiveStatusBlock = async (b: any) => {
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

  const handleCopySchedule = async () => {
    if (!deviceSchedule || !blocks.length || !copyTargets.length) return;
    setCopying(true);
    let ok = 0;
    try {
      for (const targetId of copyTargets) {
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

  if (!session) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f2fc] px-4">
        <Card className="w-full max-w-md rounded-2xl border border-purple-100 bg-white shadow-xl shadow-purple-950/5">
          <CardHeader className="space-y-3 text-center pt-8 pb-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#8b75f6] text-white shadow-md shadow-purple-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <line x1="8" x2="16" y1="21" y2="21" />
                <line x1="12" x2="12" y1="17" y2="21" />
              </svg>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">Painel MIP</CardTitle>
              <CardDescription className="text-zinc-500 text-sm font-medium">Digital Signage Platform</CardDescription>
            </div>
          </CardHeader>
          
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 px-8">
              {errorMsg && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">{errorMsg}</div>
              )}
              <div className="space-y-2">
                <Label className="text-zinc-700 text-xs font-semibold uppercase tracking-wide">E-mail</Label>
                <Input type="email" placeholder="admin@vntv.com.br" className="rounded-xl border-purple-100 bg-[#f8f7fc] text-zinc-900 h-12 px-4 shadow-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-700 text-xs font-semibold uppercase tracking-wide">Senha</Label>
                <Input type="password" placeholder="••••••••" className="rounded-xl border-purple-100 bg-[#f8f7fc] text-zinc-900 h-12 px-4 shadow-sm" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 px-8 pb-8 pt-4">
              <Button className="w-full rounded-xl bg-[#8b75f6] text-white hover:bg-[#7860f4] h-12 font-medium text-base shadow-md">
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    )
  }

  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.status === 'online' || d.online).length;
  const offlineDevices = totalDevices - onlineDevices;
  const activePlaylists = playlists.length;
  const totalMedia = media.length;

  const stats = [
    { label: 'Online', value: onlineDevices, icon: Wifi, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Ativos agora' },
    { label: 'Offline', value: offlineDevices, icon: WifiOff, color: 'text-red-600', bg: 'bg-red-50', sub: 'Sem conexão' },
    { label: 'Playlists', value: activePlaylists, icon: ListMusic, color: 'text-purple-600', bg: 'bg-purple-50', sub: 'Cadastradas' },
    { label: 'Mídias', value: totalMedia, icon: ImageIcon, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'Biblioteca' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f2fc] flex">
      <aside className="w-64 bg-white border-r border-purple-100 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="p-6 flex items-center space-x-3 border-b border-purple-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8b75f6] text-white font-bold shadow-sm">
              MIP
            </div>
            <div>
              <h1 className="font-bold text-zinc-900 text-base leading-tight">Painel MIP</h1>
              <span className="text-xs text-zinc-400 font-medium">Gestão de Totens</span>
            </div>
          </div>
          
          <nav className="p-4 space-y-1">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${activeTab === 'dashboard' ? 'bg-[#f4f2fc] text-[#8b75f6]' : 'text-zinc-600 hover:bg-zinc-50'}`}>
              <span>📊 Visão Geral</span>
            </button>
            <button onClick={() => setActiveTab('totens')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${activeTab === 'totens' ? 'bg-[#f4f2fc] text-[#8b75f6]' : 'text-zinc-600 hover:bg-zinc-50'}`}>
              <span>🖥️ Totens / Dispositivos</span>
            </button>
            <button onClick={() => setActiveTab('midias')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${activeTab === 'midias' ? 'bg-[#f4f2fc] text-[#8b75f6]' : 'text-zinc-600 hover:bg-zinc-50'}`}>
              <span>🖼️ Mídias e Banners</span>
            </button>
            <button onClick={() => setActiveTab('playlists')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${activeTab === 'playlists' ? 'bg-[#f4f2fc] text-[#8b75f6]' : 'text-zinc-600 hover:bg-zinc-50'}`}>
              <span>📋 Playlists</span>
            </button>
            <button onClick={() => setActiveTab('agendamentos')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${activeTab === 'agendamentos' ? 'bg-[#f4f2fc] text-[#8b75f6]' : 'text-zinc-600 hover:bg-zinc-50'}`}>
              <span>📅 Agendamentos</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-purple-50">
          <div className="mb-3 px-4 text-xs text-zinc-400 truncate">{session.user.email}</div>
          <Button onClick={handleLogout} variant="outline" className="w-full rounded-xl border-purple-100 text-zinc-700 hover:bg-red-50 hover:text-red-600 transition-colors">
            Sair da Plataforma
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-20 bg-white border-b border-purple-100 flex items-center justify-between px-8">
          <h2 className="text-xl font-bold text-zinc-900">
            {activeTab === 'dashboard' && 'Visão Geral do Sistema'}
            {activeTab === 'totens' && 'Gerenciamento de Totens e TVs'}
            {activeTab === 'midias' && 'Biblioteca de Mídias e Banners'}
            {activeTab === 'playlists' && 'Gerenciamento de Playlists'}
            {activeTab === 'agendamentos' && 'Grade de Programação e Agendamentos'}
          </h2>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            ● Sistema Online
          </span>
        </header>

        <div className="p-8 space-y-6">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">{stat.label}</span>
                        <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                          <Icon className="w-5 h-5" strokeWidth={2.5} />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-zinc-900">{stat.value}</p>
                      <p className="text-xs text-zinc-500 mt-1">{stat.sub}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="rounded-2xl border border-purple-100 bg-white shadow-sm">
                  <CardHeader className="border-b border-purple-50 pb-4">
                    <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Status Recente
                    </CardTitle>
                    <CardDescription>Monitore os dispositivos em tempo real</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {devices.length === 0 ? (
                      <p className="text-sm text-zinc-400 text-center py-6">Nenhum dispositivo cadastrado.</p>
                    ) : (
                      <div className="space-y-3">
                        {devices.map(d => (
                          <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                            <div className="flex items-center gap-3">
                              <span className={`w-2.5 h-2.5 rounded-full ${d.status === 'online' || d.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              <div>
                                <p className="text-sm font-semibold text-zinc-800">{d.name}</p>
                                <p className="text-xs text-zinc-400">{d.location || 'Sem local'} • {d.type === 'android_tv' ? '📺 AndroidTV' : '🖥️ Totem Windows'}</p>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-zinc-500 uppercase">{d.status || 'offline'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-purple-100 bg-white shadow-sm">
                  <CardHeader className="border-b border-purple-50 pb-4">
                    <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" /> Feed de Atividades
                    </CardTitle>
                    <CardDescription>Últimos eventos do sistema</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {events.length === 0 ? (
                      <p className="text-sm text-zinc-400 text-center py-6">Nenhum evento recente.</p>
                    ) : (
                      <div className="space-y-4">
                        {events.map((ev) => (
                          <div key={ev.id} className="flex items-start gap-3 pb-3 border-b border-zinc-50 last:border-0">
                            <Clock className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm text-zinc-800">{ev.message}</p>
                              <span className="text-xs text-zinc-400">{new Date(ev.created_at).toLocaleTimeString('pt-BR')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {activeTab === 'totens' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Dispositivos Cadastrados</h3>
                  <p className="text-sm text-zinc-500">Visualize os IDs de pareamento para configurar os apps Windows e Android.</p>
                </div>
                <Button onClick={() => setIsAddingDevice(!isAddingDevice)} className="rounded-xl bg-[#8b75f6] text-white hover:bg-[#7860f4]">
                  <Plus className="w-4 h-4 mr-2" /> Novo Dispositivo
                </Button>
              </div>

              {isAddingDevice && (
                <Card className="rounded-2xl border border-purple-200 bg-purple-50/50 shadow-sm p-6">
                  <form onSubmit={handleCreateDevice} className="space-y-4">
                    <h4 className="font-bold text-zinc-800">Cadastrar Novo Equipamento</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs font-semibold text-zinc-700">Nome do Aparelho</Label>
                        <Input placeholder="Ex: Totem Entrada / TV Recepção" value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} required className="bg-white" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-zinc-700">Tipo de Sistema</Label>
                        <select value={newDeviceType} onChange={e => setNewDeviceType(e.target.value)} className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
                          <option value="totem_windows">🖥️ Totem Windows</option>
                          <option value="android_tv">📺 TV AndroidTV</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-zinc-700">Localização</Label>
                        <Input placeholder="Ex: Hall Principal" value={newDeviceLocation} onChange={e => setNewDeviceLocation(e.target.value)} className="bg-white" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddingDevice(false)}>Cancelar</Button>
                      <Button type="submit" className="bg-[#8b75f6] text-white">Salvar Dispositivo</Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {devices.map(d => (
                  <Card key={d.id} className="rounded-2xl border border-purple-100 bg-white shadow-sm p-6 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${d.type === 'android_tv' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {d.type === 'android_tv' ? <Tv className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                          </div>
                          <div>
                            <h4 className="font-bold text-zinc-900">{d.name}</h4>
                            <span className="text-xs text-zinc-400">{d.location || 'Local não definido'}</span>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${d.status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {d.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className="bg-[#f8f7fc] border border-purple-100 rounded-xl p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                            <Terminal className="w-3 h-3 text-[#8b75f6]" /> Device ID (Pareamento)
                          </span>
                          <button 
                            onClick={() => copyToClipboard(d.id)} 
                            className="text-xs text-[#8b75f6] hover:underline font-semibold flex items-center gap-1"
                            title="Copiar ID"
                          >
                            <Copy className="w-3 h-3" /> Copiar
                          </button>
                        </div>
                        <p className="text-xs font-mono font-bold text-zinc-800 break-all bg-white p-2 rounded border border-purple-50 select-all">
                          {d.id}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-500 border-t border-purple-50 pt-3 flex justify-between items-center">
                      <span>Plataforma: <strong>{d.type === 'android_tv' ? 'AndroidTV' : 'Windows PC'}</strong></span>
                      <button onClick={() => handleDeleteDevice(d.id)} className="text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'midias' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Biblioteca de Mídias (Supabase Storage)</h3>
                  <p className="text-sm text-zinc-500">Gerencie imagens, vídeos e a limpeza automática de arquivos antigos.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleAutoCleanOldMedia} variant="outline" className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50">
                    <Sparkles className="w-4 h-4 mr-2" /> Limpar &gt; 2 Semanas
                  </Button>
                  <Button onClick={() => setIsAddingMedia(!isAddingMedia)} className="rounded-xl bg-[#8b75f6] text-white hover:bg-[#7860f4]">
                    <Plus className="w-4 h-4 mr-2" /> Enviar Novo Arquivo
                  </Button>
                </div>
              </div>

              {isAddingMedia && (
                <Card className="rounded-2xl border border-purple-200 bg-purple-50/50 shadow-sm p-6">
                  <form onSubmit={handleCreateMedia} className="space-y-4">
                    <h4 className="font-bold text-zinc-800">Upload de Mídia para o Storage</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs font-semibold text-zinc-700">Título / Nome do Banner</Label>
                        <Input placeholder="Ex: Banner Culto Domingo" value={newMediaTitle} onChange={e => setNewMediaTitle(e.target.value)} required className="bg-white" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-zinc-700">Arquivo (Imagem ou Vídeo)</Label>
                        <Input 
                          type="file" 
                          accept="image/*,video/*" 
                          onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} 
                          required 
                          className="bg-white file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-[#8b75f6] hover:file:bg-purple-100" 
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-zinc-700">Vincular Automaticamente à Playlist</Label>
                        <select 
                          value={targetPlaylistForUpload} 
                          onChange={e => setTargetPlaylistForUpload(e.target.value)} 
                          className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm mt-1"
                        >
                          <option value="none">-- Nenhuma (Apenas salvar na biblioteca) --</option>
                          {playlists.map(pl => (
                            <option key={pl.id} value={pl.id}>📋 {pl.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddingMedia(false)}>Cancelar</Button>
                      <Button type="submit" className="bg-[#8b75f6] text-white" disabled={loading}>
                        {loading ? 'Enviando...' : 'Salvar no Storage'}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {media.map(m => (
                  <Card key={m.id} className="rounded-2xl border border-purple-100 bg-white shadow-sm overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="h-44 bg-zinc-100 flex items-center justify-center relative overflow-hidden group">
                        {m.type === 'image' && m.url ? (
                          <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                        ) : m.type === 'video' && m.url ? (
                          <video src={m.url} className="w-full h-full object-cover" muted />
                        ) : (
                          <div className="flex flex-col items-center text-zinc-400">
                            {m.type === 'video' ? <Film className="w-10 h-10 text-purple-400 mb-1" /> : <FileImage className="w-10 h-10 text-blue-400 mb-1" />}
                            <span className="text-xs uppercase font-medium">{m.type}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <a href={m.url} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white text-zinc-800 flex items-center justify-center shadow hover:bg-purple-50 transition-colors" title="Visualizar em nova aba">
                            <Eye className="w-5 h-5" />
                          </a>
                          <button onClick={() => handleDeleteMedia(m.id, m.storage_path)} className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow hover:bg-red-700 transition-colors" title="Excluir arquivo">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-5 space-y-1">
                        <h4 className="font-bold text-zinc-900 truncate">{m.title}</h4>
                        <p className="text-xs text-zinc-400">Enviado em: {new Date(m.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="px-5 pb-5 pt-0 text-xs text-zinc-500 border-t border-purple-50 pt-3 flex justify-between items-center">
                      <span>Tipo: <strong>{m.type === 'video' ? 'Vídeo' : 'Imagem'}</strong></span>
                      <button onClick={() => handleDeleteMedia(m.id, m.storage_path)} className="text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'playlists' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Gerenciamento de Playlists</h3>
                  <p className="text-sm text-zinc-500">Crie sequências com loop infinito e configure playlists de fallback.</p>
                </div>
                <Button onClick={openNewPlaylist} className="rounded-xl bg-[#8b75f6] text-white hover:bg-[#7860f4]">
                  <Plus className="w-4 h-4 mr-2" /> Criar Playlist
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {playlists.map(pl => (
                  <Card key={pl.id} className="rounded-2xl border border-purple-100 bg-white shadow-sm p-6 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#8b75f6] flex items-center justify-center font-bold">
                            <ListMusic className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-zinc-900">{pl.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              {pl.is_fallback && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-semibold">
                                  <Shield className="w-3 h-3" /> Fallback Global
                                </span>
                              )}
                              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${pl.loop !== false ? 'bg-indigo-50 text-indigo-700' : 'bg-zinc-100 text-zinc-600'}`}>
                                <Repeat className="w-3 h-3" /> {pl.loop !== false ? 'Loop Ativo' : 'Sem Loop'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-purple-50 pt-3 flex justify-between items-center text-xs">
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ativa
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditPlaylist(pl)} className="p-1.5 rounded-lg hover:bg-purple-50 text-zinc-600 hover:text-[#8b75f6] transition-colors" title="Editar Playlist">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => forceRefreshDevices(pl.id, pl.name)} className="p-1.5 rounded-lg hover:bg-purple-50 text-zinc-600 hover:text-[#8b75f6] transition-colors" title="Forçar atualização nos players">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeletePlaylist(pl.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-600 hover:text-red-600 transition-colors" title="Excluir Playlist">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {isPlaylistModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-purple-100 my-8">
                    <div className="flex justify-between items-center border-b border-purple-50 pb-4">
                      <h3 className="text-lg font-bold text-zinc-900">
                        {editingPlaylistId ? 'Editar Playlist' : 'Nova Playlist'}
                      </h3>
                      <button onClick={() => setIsPlaylistModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs font-semibold text-zinc-700">Nome da Playlist</Label>
                        <Input placeholder="Ex: Programação Padrão" value={playlistForm.name} onChange={e => setPlaylistForm(f => ({ ...f, name: e.target.value }))} className="bg-white mt-1" />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/50 border border-purple-100">
                        <div className="flex items-center gap-2">
                          <Repeat className="w-4 h-4 text-[#8b75f6]" />
                          <div>
                            <Label className="text-xs font-semibold text-zinc-800">Loop Infinito</Label>
                            <p className="text-[11px] text-zinc-500">Repetir a sequência indefinidamente para evitar tela preta</p>
                          </div>
                        </div>
                        <input type="checkbox" checked={playlistForm.loop} onChange={e => setPlaylistForm(f => ({ ...f, loop: e.target.checked }))} className="w-4 h-4 rounded text-[#8b75f6] focus:ring-[#8b75f6]" />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/50 border border-purple-100">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-[#8b75f6]" />
                          <div>
                            <Label className="text-xs font-semibold text-zinc-800">Playlist de Fallback Global</Label>
                            <p className="text-[11px] text-zinc-500">Exibida automaticamente se faltar agendamento</p>
                          </div>
                        </div>
                        <input type="checkbox" checked={playlistForm.is_fallback} onChange={e => setPlaylistForm(f => ({ ...f, is_fallback: e.target.checked }))} className="w-4 h-4 rounded text-[#8b75f6] focus:ring-[#8b75f6]" />
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-zinc-700 mb-2 block">Adicionar Mídias da Biblioteca</Label>
                        <div className="space-y-1 max-h-40 overflow-y-auto border border-purple-100 rounded-xl p-3 bg-zinc-50">
                          {media.filter(m => !playlistForm.orderedMedia.includes(m.id)).map(m => (
                            <div key={m.id} onClick={() => toggleMediaSelection(m.id)} className="flex items-center justify-between text-sm cursor-pointer hover:bg-purple-100/50 rounded-lg px-3 py-2 transition-colors">
                              <span className="text-zinc-800 font-medium truncate">{m.title}</span>
                              <span className="text-xs text-[#8b75f6] font-semibold">+ Adicionar</span>
                            </div>
                          ))}
                          {media.filter(m => !playlistForm.orderedMedia.includes(m.id)).length === 0 && (
                            <p className="text-xs text-zinc-400 text-center py-4">Todas as mídias já foram adicionadas.</p>
                          )}
                        </div>
                      </div>

                      {playlistForm.orderedMedia.length > 0 && (
                        <div>
                          <Label className="text-xs font-semibold text-zinc-700 mb-2 block">Ordem de Reprodução</Label>
                          <div className="space-y-2 border border-purple-100 rounded-xl p-3 bg-zinc-50 max-h-44 overflow-y-auto">
                            {playlistForm.orderedMedia.map((mediaId, index) => (
                              <div key={mediaId} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-purple-100 shadow-sm">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-xs font-mono font-bold text-zinc-400">{index + 1}.</span>
                                  <span className="text-sm font-medium text-zinc-800 truncate">{getMediaTitle(mediaId)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => moveMediaOrder(index, 'up')} disabled={index === 0} className="p-1 rounded hover:bg-purple-50 disabled:opacity-30 text-zinc-600">
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button type="button" onClick={() => moveMediaOrder(index, 'down')} disabled={index === playlistForm.orderedMedia.length - 1} className="p-1 rounded hover:bg-purple-50 disabled:opacity-30 text-zinc-600">
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button type="button" onClick={() => toggleMediaSelection(mediaId)} className="p-1 rounded hover:bg-red-50 text-red-500">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-purple-50">
                      <Button type="button" variant="outline" onClick={() => setIsPlaylistModalOpen(false)}>Cancelar</Button>
                      <Button onClick={handleSavePlaylist} className="bg-[#8b75f6] text-white hover:bg-[#7860f4]" disabled={loading}>
                        {loading ? 'Salvando...' : 'Salvar Playlist'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'agendamentos' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Grade de Programação</h3>
                  <p className="text-sm text-zinc-500">Gerencie os blocos de exibição por horário, dia da semana ou eventos únicos nos totens.</p>
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
                  <Button onClick={openNewBlock} size="sm" className="rounded-xl bg-[#8b75f6] text-white hover:bg-[#7860f4]" disabled={!deviceSchedule}>
                    <Plus className="w-4 h-4 mr-2" /> Adicionar Bloco
                  </Button>
                </div>
              </div>

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
                                <Switch checked={b.active} onCheckedChange={() => toggleActiveStatusBlock(b)} />
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
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 hover:text-[#8b75f6]" onClick={() => openEditBlock(b)}>
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
            </div>
          )}
        </div>
      </main>

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
            <Button onClick={handleSaveBlock} disabled={savingBlock} className="rounded-xl bg-[#8b75f6] text-white hover:bg-[#7860f4]">
              {savingBlock ? 'Salvando...' : 'Salvar Bloco'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja excluir este bloco?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação removerá o agendamento deste totem permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBlock} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <Button onClick={handleCopySchedule} disabled={copying || copyTargets.length === 0} className="rounded-xl bg-[#8b75f6] text-white hover:bg-[#7860f4]">
              {copying ? 'Copiando...' : `Copiar para (${copyTargets.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}