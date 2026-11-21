export type AppRoute =
  | '/'
  | '/consejo'
  | '/comisiones'
  | `/comisiones/${string}`
  | '/consejeros'
  | `/consejeros/${string}`
  | '/gestion'
  | '/actualidad'
  | '/participacion'
  | `/participacion?${string}`
  | '/verificar'
  | `/verificar/${string}`
  | '/contacto'
  | '/portal';

export interface NavItem {
  label: string;
  path: AppRoute;
  description: string;
}

export const PUBLIC_NAV_ITEMS: NavItem[] = [
  {
    label: 'Inicio',
    path: '/',
    description: 'Página principal institucional del CMJ Flandes',
  },
  {
    label: 'Consejo',
    path: '/consejo',
    description: 'Misión, visión, marco normativo y estructura del Consejo',
  },
  {
    label: 'Comisiones',
    path: '/comisiones',
    description: 'Comisiones temáticas de trabajo, metas y participación juvenil',
  },
  {
    label: 'Consejeros',
    path: '/consejeros',
    description: 'Directorio de consejeros electos, Mesa Directiva y hojas de vida',
  },
  {
    label: 'Gestión',
    path: '/gestion',
    description: 'Proyectos, sesiones, calendario, actas e informes',
  },
  {
    label: 'Actualidad',
    path: '/actualidad',
    description: 'Noticias, comunicados, galería y datos abiertos',
  },
  {
    label: 'Participación',
    path: '/participacion',
    description: 'Buzón de participación juvenil y seguimiento ciudadano',
  },
];
