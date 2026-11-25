import React from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CalendarClock,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  FolderKanban,
  History,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Palette,
  ShieldCheck,
  Users,
  Vote,
} from 'lucide-react';
import type { PrivateModule } from '../../../types/cmj';

export interface NavItemDef {
  id: PrivateModule;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  leaderOnly?: boolean;
}

export interface NavGroupDef {
  id: string;
  label: string;
  items: NavItemDef[];
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: 'general',
    label: 'Gestión',
    items: [
      {
        id: 'resumen',
        label: 'Mi Tablero',
        shortLabel: 'Tablero',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        id: 'agenda',
        label: 'Agenda y Calendario',
        shortLabel: 'Agenda',
        icon: <Calendar className="h-4 w-4" />,
      },
      {
        id: 'comisiones',
        label: 'Comisiones (1–5)',
        shortLabel: 'Comisiones',
        icon: <FolderKanban className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'plenaria',
    label: 'Sesiones y Actas',
    items: [
      {
        id: 'sesiones',
        label: 'Sesiones y Asistencia',
        shortLabel: 'Sesiones',
        icon: <CalendarClock className="h-4 w-4" />,
      },
      {
        id: 'actas',
        label: 'Actas Oficiales',
        shortLabel: 'Actas',
        icon: <FileCheck2 className="h-4 w-4" />,
      },
      {
        id: 'votaciones',
        label: 'Votos y Compromisos',
        shortLabel: 'Votos',
        icon: <Vote className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'participacion',
    label: 'Participación',
    items: [
      {
        id: 'buzon',
        label: 'Banco de Ideas',
        shortLabel: 'Ideas',
        icon: <Lightbulb className="h-4 w-4" />,
      },
      {
        id: 'encuestas',
        label: 'Encuestas y Mensajes',
        shortLabel: 'Mensajes',
        icon: <MessageSquare className="h-4 w-4" />,
      },
      {
        id: 'plan_trabajo',
        label: 'Plan de Trabajo y Certs.',
        shortLabel: 'Plan',
        icon: <Award className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'documentos',
    label: 'Documentos y Planillas',
    items: [
      {
        id: 'documentos',
        label: 'Documentos y Archivo',
        shortLabel: 'Archivo',
        icon: <FolderArchive className="h-4 w-4" />,
      },
      {
        id: 'planillas',
        label: 'Planillas y Excel',
        shortLabel: 'Excel',
        icon: <FileSpreadsheet className="h-4 w-4" />,
      },
      {
        id: 'plantillas',
        label: 'Plantillas de Oficios',
        shortLabel: 'Oficios',
        icon: <FileText className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    items: [
      {
        id: 'permisos',
        label: 'Permisos y Solicitudes',
        shortLabel: 'Permisos',
        icon: <ShieldCheck className="h-4 w-4" />,
      },
      {
        id: 'portal_editor',
        label: 'Editor Portal y Galería',
        shortLabel: 'Portal',
        icon: <Palette className="h-4 w-4" />,
      },
      {
        id: 'usuarios',
        label: 'Usuarios y Mesa',
        shortLabel: 'Usuarios',
        icon: <Users className="h-4 w-4" />,
        leaderOnly: true,
      },
      {
        id: 'auditoria',
        label: 'Auditoría',
        shortLabel: 'Auditoría',
        icon: <History className="h-4 w-4" />,
        leaderOnly: true,
      },
      {
        id: 'guia',
        label: 'Guía de Roles CMJ',
        shortLabel: 'Guía',
        icon: <BookOpen className="h-4 w-4" />,
      },
    ],
  },
];

export const MOBILE_QUICK_MODULES: PrivateModule[] = [
  'resumen',
  'sesiones',
  'actas',
  'votaciones',
];
