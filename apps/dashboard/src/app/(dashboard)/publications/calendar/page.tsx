'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Play,
  MapPin,
  AlertCircle,
} from 'lucide-react';

interface PublicationEvent {
  id: string;
  videoId: string;
  scheduledFor: string;
  description: string;
  platforms: string[];
  status: string;
  thumbnail?: string;
}

interface CalendarDay {
  date: Date;
  publications: PublicationEvent[];
  isCurrentMonth: boolean;
}

export default function PublicationsCalendarPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [publications, setPublications] = useState<PublicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedPublication, setSelectedPublication] = useState<PublicationEvent | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleViewVideo = () => {
    if (selectedPublication) {
      router.push(`/editor/${selectedPublication.videoId}`);
    }
  };

  const handlePublishNow = async () => {
    if (!selectedPublication) return;

    try {
      const response = await fetch(
        `/api/meta/publications/${selectedPublication.id}/publish`,
        { method: 'POST' },
      );

      if (response.ok) {
        // Recarregar publicações
        const result = await fetch('/api/meta/publications?limit=1000');
        const data = await result.json();
        setPublications(data.data || []);
        setSelectedPublication(null);
      }
    } catch (error) {
      console.error('Error publishing:', error);
    }
  };

  const handleCancelSchedule = async () => {
    if (!selectedPublication) return;

    try {
      const response = await fetch(
        `/api/meta/publications/${selectedPublication.id}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        const error = await response.json();
        alert(`Erro ao cancelar: ${error.error}`);
        return;
      }

      // Recarregar publicações
      const result = await fetch('/api/meta/publications?limit=1000');
      const data = await result.json();
      setPublications(data.data || []);
      setSelectedPublication(null);
      alert('Agendamento cancelado com sucesso!');
    } catch (error) {
      console.error('Error canceling:', error);
      alert('Erro ao cancelar agendamento');
    }
  };

  const handleCancelAllForDay = async () => {
    if (!selectedDay) return;

    const dayPublications = calendarDays.find(
      (d) => d.date.toDateString() === selectedDay.toDateString(),
    )?.publications;

    if (!dayPublications || dayPublications.length === 0) {
      alert('Nenhuma publicação agendada para este dia');
      return;
    }

    const confirm = window.confirm(
      `Deseja cancelar ${dayPublications.length} agendamento(ns) deste dia?`,
    );

    if (!confirm) return;

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const pub of dayPublications) {
        try {
          const response = await fetch(`/api/meta/publications/${pub.id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          errorCount++;
        }
      }

      // Recarregar publicações
      const result = await fetch('/api/meta/publications?limit=1000');
      const data = await result.json();
      setPublications(data.data || []);
      setSelectedPublication(null);

      alert(`${successCount} cancelado(s), ${errorCount} erro(s)`);
    } catch (error) {
      console.error('Error canceling all:', error);
      alert('Erro ao cancelar agendamentos');
    }
  };

  // Load publications
  useEffect(() => {
    const loadPublications = async () => {
      try {
        const response = await fetch('/api/meta/publications?limit=1000');
        const result = await response.json();
        setPublications(result.data || []);
      } catch (error) {
        console.error('Error loading publications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPublications();
  }, []);

  // Generate calendar days
  const generateCalendar = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: CalendarDay[] = [];

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        publications: [],
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayPublications = publications.filter((pub) => {
        const pubDate = new Date(pub.scheduledFor);
        return (
          pubDate.getFullYear() === year &&
          pubDate.getMonth() === month &&
          pubDate.getDate() === day
        );
      });

      days.push({
        date,
        publications: dayPublications,
        isCurrentMonth: true,
      });
    }

    // Next month days
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        publications: [],
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const calendarDays = generateCalendar();
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100';
      case 'SCHEDULED':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100';
      case 'FAILED':
        return 'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return 'Publicado';
      case 'SCHEDULED':
        return 'Agendado';
      case 'FAILED':
        return 'Falha';
      default:
        return status;
    }
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600 dark:text-gray-400">Carregando calendário...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Calendário de Publicações
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Visualize todos os seus vídeos agendados
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
              {/* Month Navigation */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {currentDate.toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handlePreviousMonth}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Hoje
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Week Days Header */}
              <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="p-4 text-center font-semibold text-gray-900 dark:text-white"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedDay(day.date)}
                    className={`min-h-32 p-3 border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      !day.isCurrentMonth
                        ? 'bg-gray-50 dark:bg-gray-900/50'
                        : ''
                    } ${
                      selectedDay &&
                      day.date.toDateString() === selectedDay.toDateString()
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400'
                        : ''
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold mb-2 ${
                        day.isCurrentMonth
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-600'
                      }`}
                    >
                      {day.date.getDate()}
                    </div>

                    <div className="space-y-1">
                      {day.publications.slice(0, 2).map((pub, i) => (
                        <button
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPublication(pub);
                          }}
                          className="w-full text-left text-xs bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-2 py-1 rounded truncate hover:opacity-80 transition-opacity"
                          title={pub.description}
                        >
                          {formatTime(pub.scheduledFor)}
                        </button>
                      ))}
                      {day.publications.length > 2 && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 px-2">
                          +{day.publications.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Selected Day Details */}
            {selectedDay && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {formatDate(selectedDay)}
                  </h3>
                  {calendarDays.find(
                    (d) => d.date.toDateString() === selectedDay.toDateString(),
                  )?.publications.length! > 0 && (
                    <button
                      onClick={handleCancelAllForDay}
                      className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded font-medium hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                    >
                      Cancelar Todos
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {calendarDays
                    .find((d) => d.date.toDateString() === selectedDay.toDateString())
                    ?.publications.map((pub) => (
                      <button
                        key={pub.id}
                        onClick={() => setSelectedPublication(pub)}
                        className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">
                            {formatTime(pub.scheduledFor)}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(
                              pub.status,
                            )}`}
                          >
                            {getStatusLabel(pub.status)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {pub.description || 'Sem descrição'}
                        </p>
                      </button>
                    )) || (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Nenhum vídeo agendado para este dia
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Publication Details Modal */}
            {selectedPublication && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
                <button
                  onClick={() => setSelectedPublication(null)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
                >
                  ← Voltar
                </button>

                {/* Thumbnail */}
                {selectedPublication.thumbnail && (
                  <img
                    src={selectedPublication.thumbnail}
                    alt="Video"
                    className="w-full h-40 object-cover rounded-lg mb-4"
                  />
                )}

                {/* Status */}
                <div className="mb-4">
                  <span
                    className={`text-sm font-medium px-3 py-1 rounded-full ${getStatusColor(
                      selectedPublication.status,
                    )}`}
                  >
                    {getStatusLabel(selectedPublication.status)}
                  </span>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Descrição
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white line-clamp-4">
                    {selectedPublication.description || 'Sem descrição'}
                  </p>
                </div>

                {/* Time */}
                <div className="mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Agendado para
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedPublication.scheduledFor).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                {/* Platforms */}
                <div className="mb-6 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Plataformas
                    </p>
                    <div className="flex gap-2 mt-1">
                      {selectedPublication.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded"
                        >
                          {platform === 'FACEBOOK' ? 'Facebook' : 'Instagram'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={handleViewVideo}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Visualizar Vídeo
                  </button>
                  {selectedPublication.status === 'SCHEDULED' && (
                    <>
                      <button
                        onClick={handlePublishNow}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                      >
                        Publicar Agora
                      </button>
                      <button
                        onClick={handleCancelSchedule}
                        className="w-full px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Cancelar Agendamento
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Estatísticas</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Total Agendado
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {publications.filter((p) => p.status === 'SCHEDULED').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Publicados
                  </span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {publications.filter((p) => p.status === 'PUBLISHED').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Falhas</span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {publications.filter((p) => p.status === 'FAILED').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
