import type {
  AccessTier,
  AuditComparisonRow,
  GrantedPermission,
  PermissionDurationType,
  PermissionKey,
  PermissionRiskLevel,
  PrivateModule,
  RoleLabel,
} from '../types/cmj.ts';

export interface PermissionCatalogItem {
  key: PermissionKey;
  module: PrivateModule;
  moduleLabel: string;
  label: string;
  description: string;
  riskLevel: PermissionRiskLevel;
  commissionScoped?: boolean;
  requestable: boolean;
}

export const PERMISSIONS_CATALOG: PermissionCatalogItem[] = [
  // Usuarios y Mesa Directiva
  {
    key: 'usuarios.ver',
    module: 'usuarios',
    moduleLabel: 'Usuarios y Mesa',
    label: 'Ver directorio interno y cuentas',
    description: 'Consultar listado de cuentas autorizadas, estados de activación y roles.',
    riskLevel: 'bajo',
    requestable: true,
  },
  {
    key: 'usuarios.crear',
    module: 'usuarios',
    moduleLabel: 'Usuarios y Mesa',
    label: 'Autorizar nuevos consejeros',
    description: 'Registrar correos en la lista autorizada para activar cuentas del CMJ.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'usuarios.editar',
    module: 'usuarios',
    moduleLabel: 'Usuarios y Mesa',
    label: 'Editar cargos y comisiones de usuarios',
    description: 'Modificar cargo, comisión asignada, filiación y datos de otros consejeros.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'usuarios.desactivar',
    module: 'usuarios',
    moduleLabel: 'Usuarios y Mesa',
    label: 'Activar o suspender cuentas',
    description: 'Suspender temporalmente el acceso interno de consejeros (no aplica a Presidencia).',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'usuarios.eliminar',
    module: 'usuarios',
    moduleLabel: 'Usuarios y Mesa',
    label: 'Eliminar cuentas del portal',
    description: 'Borrar cuentas de consejeros y desvincular su coordinación si aplica.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'usuarios.asignar_presidencia',
    module: 'usuarios',
    moduleLabel: 'Usuarios y Mesa',
    label: 'Asignar o modificar cargo de Presidente',
    description: 'Autorizar cambios sobre el cargo de Presidente del CMJ.',
    riskLevel: 'alto',
    requestable: false,
  },
  {
    key: 'usuarios.credenciales_rotar',
    module: 'usuarios',
    moduleLabel: 'Usuarios y Mesa',
    label: 'Rotar código de invitación y clave inicial',
    description: 'Actualizar las credenciales institucionales de activación de nuevas cuentas.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'usuarios.purgar_ejemplos',
    module: 'usuarios',
    moduleLabel: 'Usuarios y Mesa',
    label: 'Purgar datos de ejemplo',
    description: 'Eliminar registros demostrativos precargados en el portal.',
    riskLevel: 'medio',
    requestable: true,
  },

  // Comisiones
  {
    key: 'comision.ver_todas',
    module: 'comisiones',
    moduleLabel: 'Comisiones',
    label: 'Ver las 5 comisiones y tableros',
    description: 'Consultar integrantes, tareas y resumen de todas las comisiones.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'comision.coordinador_asignar',
    module: 'comisiones',
    moduleLabel: 'Comisiones',
    label: 'Asignar coordinadores de comisión',
    description: 'Designar o relevar al consejero coordinador de cualquiera de las 5 comisiones.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'comision.editar_todas',
    module: 'comisiones',
    moduleLabel: 'Comisiones',
    label: 'Editar todas las comisiones',
    description: 'Editar descripción, portada y resumen del plan en cualquiera de las 5 comisiones.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'comision.editar_propia',
    module: 'comisiones',
    moduleLabel: 'Comisiones',
    label: 'Administrar comisión propia (Coordinador)',
    description: 'Editar información, portada y plan de trabajo de la comisión asignada.',
    riskLevel: 'medio',
    commissionScoped: true,
    requestable: true,
  },
  {
    key: 'comision.miembros_gestionar',
    module: 'comisiones',
    moduleLabel: 'Comisiones',
    label: 'Gestionar miembros de comisión',
    description: 'Vincular o retirar consejeros activos dentro de una comisión.',
    riskLevel: 'medio',
    commissionScoped: true,
    requestable: true,
  },
  {
    key: 'comision.tareas_gestionar',
    module: 'comisiones',
    moduleLabel: 'Comisiones',
    label: 'Gestionar tareas de comisión',
    description: 'Crear, reasignar, completar o eliminar tareas dentro de la comisión.',
    riskLevel: 'medio',
    commissionScoped: true,
    requestable: true,
  },
  {
    key: 'comision.reportes_exportar',
    module: 'comisiones',
    moduleLabel: 'Comisiones',
    label: 'Exportar reportes de comisiones',
    description: 'Generar reportes en Excel del estado de comisiones, metas y tareas.',
    riskLevel: 'bajo',
    commissionScoped: true,
    requestable: true,
  },

  // Sesiones
  {
    key: 'sesiones.ver',
    module: 'sesiones',
    moduleLabel: 'Sesiones',
    label: 'Consultar sesiones y agendas',
    description: 'Ver calendario de sesiones ordinarias, extraordinarias y quórum.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'sesiones.crear',
    module: 'sesiones',
    moduleLabel: 'Sesiones',
    label: 'Convocar nuevas sesiones',
    description: 'Crear sesiones oficiales del CMJ y fijar orden del día.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'sesiones.editar',
    module: 'sesiones',
    moduleLabel: 'Sesiones',
    label: 'Modificar sesiones y estado',
    description: 'Actualizar fecha, lugar, agenda y estado (programada/en curso/finalizada).',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'sesiones.asistencia_gestionar',
    module: 'sesiones',
    moduleLabel: 'Sesiones',
    label: 'Gestionar llamado a lista y código QR',
    description: 'Registrar asistencia manual de consejeros y rotar el código QR de ingreso.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'sesiones.autoregistro',
    module: 'sesiones',
    moduleLabel: 'Sesiones',
    label: 'Registrar asistencia propia o excusa',
    description: 'Confirmar asistencia con código de sesión o radicar excusa justificada.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'sesiones.eliminar',
    module: 'sesiones',
    moduleLabel: 'Sesiones',
    label: 'Eliminar sesiones',
    description: 'Borrar registros de sesiones creadas en el sistema.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'sesiones.exportar',
    module: 'sesiones',
    moduleLabel: 'Sesiones',
    label: 'Exportar planillas de asistencia',
    description: 'Descargar consolidados de asistencia y excusas en Excel.',
    riskLevel: 'bajo',
    requestable: true,
  },

  // Actas
  {
    key: 'actas.ver',
    module: 'actas',
    moduleLabel: 'Actas',
    label: 'Consultar actas oficiales',
    description: 'Leer actas de sesiones en borrador, revisión, aprobadas o firmadas.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'actas.crear',
    module: 'actas',
    moduleLabel: 'Actas',
    label: 'Redactar nuevas actas',
    description: 'Crear actas con consecutivo automático y borrador asistido.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'actas.editar',
    module: 'actas',
    moduleLabel: 'Actas',
    label: 'Editar contenido de actas',
    description: 'Modificar desarrollo, proposiciones y compromisos de actas no firmadas.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'actas.comentar',
    module: 'actas',
    moduleLabel: 'Actas',
    label: 'Comentar actas en revisión',
    description: 'Agregar observaciones antes de la aprobación y firma definitiva.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'actas.firmar',
    module: 'actas',
    moduleLabel: 'Actas',
    label: 'Firmar electrónicamente actas',
    description: 'Registrar firma institucional y huella de verificación sobre actas aprobadas.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'actas.aprobar',
    module: 'actas',
    moduleLabel: 'Actas',
    label: 'Aprobación final de actas oficiales',
    description: 'Aprobar definitivamente actas para firma y archivo oficial.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'actas.eliminar',
    module: 'actas',
    moduleLabel: 'Actas',
    label: 'Eliminar actas',
    description: 'Borrar actas en borrador del archivo.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'actas.exportar',
    module: 'actas',
    moduleLabel: 'Actas',
    label: 'Exportar actas a Word o Excel',
    description: 'Descargar documentos oficiales y resúmenes de actas.',
    riskLevel: 'bajo',
    requestable: true,
  },

  // Votaciones y Compromisos
  {
    key: 'votaciones.ver',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Consultar votaciones del CMJ',
    description: 'Ver estado, quórum y resultados de votaciones nominales o secretas.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'votaciones.crear',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Abrir votaciones oficiales',
    description: 'Crear proposiciones sometidas a votación nominal o secreta.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'votaciones.editar',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Editar votaciones',
    description: 'Ajustar descripción, quórum o regla de mayoría antes del cierre.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'votaciones.cerrar',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Cerrar votaciones y certificar mayoría',
    description: 'Dar por cerrada una votación y consolidar el resultado oficial.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'votaciones.eliminar',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Eliminar votaciones',
    description: 'Retirar registros de votaciones del sistema.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'votaciones.votar',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Emitir voto en plenaria',
    description: 'Registrar voto nominal o secreto en votaciones abiertas.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'compromisos.ver',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Consultar compromisos asignados',
    description: 'Ver matriz de compromisos del consejo y fechas límite.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'compromisos.crear',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Asignar compromisos institucionales',
    description: 'Crear nuevos compromisos con responsable y fecha objetivo.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'compromisos.editar_todos',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Validar y editar cualquier compromiso',
    description: 'Modificar avance, estado o responsable de todos los compromisos.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'compromisos.actualizar_propio',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Actualizar avance de compromisos propios',
    description: 'Reportar progreso sobre compromisos en los que es responsable.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'compromisos.eliminar',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Eliminar compromisos',
    description: 'Borrar compromisos del tablero institucional.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'compromisos.exportar',
    module: 'votaciones',
    moduleLabel: 'Votaciones y Compromisos',
    label: 'Exportar compromisos a Excel',
    description: 'Generar informe descargable de cumplimiento de compromisos.',
    riskLevel: 'bajo',
    requestable: true,
  },

  // Documentos
  {
    key: 'documentos.ver',
    module: 'documentos',
    moduleLabel: 'Documentos',
    label: 'Consultar archivo documental',
    description: 'Acceder a carpetas y versiones almacenadas en el repositorio interno.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'documentos.subir',
    module: 'documentos',
    moduleLabel: 'Documentos',
    label: 'Subir documentos y versiones',
    description: 'Cargar archivos PDF/Office al repositorio interno o de comisión.',
    riskLevel: 'medio',
    commissionScoped: true,
    requestable: true,
  },
  {
    key: 'documentos.editar',
    module: 'documentos',
    moduleLabel: 'Documentos',
    label: 'Editar metadatos y carpetas',
    description: 'Reclasificar documentos o cambiar su carpeta organizacional.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'documentos.aprobar',
    module: 'documentos',
    moduleLabel: 'Documentos',
    label: 'Aprobar y publicar documentos al portal público',
    description: 'Autorizar firma de Presidencia y visibilidad ciudadana de un documento.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'documentos.eliminar',
    module: 'documentos',
    moduleLabel: 'Documentos',
    label: 'Eliminar documentos',
    description: 'Borrar archivos del repositorio institucional.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'documentos.exportar',
    module: 'documentos',
    moduleLabel: 'Documentos',
    label: 'Exportar inventario documental',
    description: 'Descargar listado maestro de documentos y versiones en Excel.',
    riskLevel: 'bajo',
    requestable: true,
  },

  // Planillas
  {
    key: 'planillas.ver',
    module: 'planillas',
    moduleLabel: 'Planillas',
    label: 'Consultar planillas consolidadas',
    description: 'Visualizar tablas consolidadas de directorio, sesiones, compromisos y actas.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'planillas.importar',
    module: 'planillas',
    moduleLabel: 'Planillas',
    label: 'Importar datos masivos desde Excel',
    description: 'Cargar registros masivos de consejeros, tareas o metas mediante XLSX.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'planillas.exportar',
    module: 'planillas',
    moduleLabel: 'Planillas',
    label: 'Exportar planillas oficiales en Excel',
    description: 'Generar libros completos con formato institucional en XLSX.',
    riskLevel: 'medio',
    requestable: true,
  },

  // Portal, Noticias y Galería
  {
    key: 'portal.editar',
    module: 'portal_editor',
    moduleLabel: 'Editor del Portal',
    label: 'Configurar portal público y temas festivos',
    description: 'Editar portada, misión, visión, contacto y tema visual activo del sitio público.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'noticias.crear',
    module: 'portal_editor',
    moduleLabel: 'Editor del Portal',
    label: 'Gestionar noticias y eventos',
    description: 'Crear y editar noticias o agenda pública del CMJ.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'noticias.proponer',
    module: 'portal_editor',
    moduleLabel: 'Editor del Portal',
    label: 'Proponer borradores de noticias',
    description: 'Enviar propuestas de noticias/eventos para revisión de Mesa Directiva.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'noticias.publicar',
    module: 'portal_editor',
    moduleLabel: 'Editor del Portal',
    label: 'Aprobar y publicar noticias en portada',
    description: 'Cambiar estado a publicado para mostrar noticias y eventos al público.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'noticias.eliminar',
    module: 'portal_editor',
    moduleLabel: 'Editor del Portal',
    label: 'Eliminar noticias y eventos',
    description: 'Retirar publicaciones informativas del sistema.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'galeria.gestionar',
    module: 'portal_editor',
    moduleLabel: 'Editor del Portal',
    label: 'Gestionar álbumes y galería multimedia',
    description: 'Crear álbumes, ordenar fotos/videos y aprobar material público.',
    riskLevel: 'medio',
    commissionScoped: true,
    requestable: true,
  },
  {
    key: 'galeria.subir_propia',
    module: 'portal_editor',
    moduleLabel: 'Editor del Portal',
    label: 'Subir fotografías de eventos propios',
    description: 'Cargar registros fotográficos como evidencia de actividades.',
    riskLevel: 'bajo',
    requestable: false,
  },

  // Encuestas, Buzón e Ideas
  {
    key: 'encuestas.ver',
    module: 'encuestas',
    moduleLabel: 'Encuestas y Participación',
    label: 'Consultar encuestas y convocatorias',
    description: 'Ver convocatorias juveniles y conteo general de encuestas.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'encuestas.crear',
    module: 'encuestas',
    moduleLabel: 'Encuestas y Participación',
    label: 'Crear y cerrar encuestas/convocatorias',
    description: 'Publicar nuevas convocatorias o consultas ciudadanas y cerrar su vigencia.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'encuestas.ver_respuestas',
    module: 'encuestas',
    moduleLabel: 'Encuestas y Participación',
    label: 'Ver respuestas detalladas con datos de contacto',
    description: 'Consultar respuestas individuales y correos registrados en consultas.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'encuestas.exportar',
    module: 'encuestas',
    moduleLabel: 'Encuestas y Participación',
    label: 'Exportar resultados de consultas',
    description: 'Descargar resultados y respuestas de encuestas en Excel.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'buzon.ver',
    module: 'buzon',
    moduleLabel: 'Buzón y Banco de Ideas',
    label: 'Leer mensajes ciudadanos del buzón',
    description: 'Acceder a PQRS, mensajes ciudadanos y datos de contacto remitidos.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'buzon.responder',
    module: 'buzon',
    moduleLabel: 'Buzón y Banco de Ideas',
    label: 'Gestionar estado de mensajes del buzón',
    description: 'Marcar mensajes ciudadanos como en proceso o respondidos.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'ideas.crear',
    module: 'buzon',
    moduleLabel: 'Buzón y Banco de Ideas',
    label: 'Registrar propuestas en el Banco de Ideas',
    description: 'Proponer iniciativas juveniles para consideración de comisiones.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'ideas.votar',
    module: 'buzon',
    moduleLabel: 'Buzón y Banco de Ideas',
    label: 'Respaldar ideas del consejo',
    description: 'Sumar voto de apoyo a propuestas del Banco de Ideas.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'ideas.moderar',
    module: 'buzon',
    moduleLabel: 'Buzón y Banco de Ideas',
    label: 'Moderar o aprobar ideas juveniles',
    description: 'Cambiar estado de ideas a en revisión o aprobada, o retirarlas.',
    riskLevel: 'medio',
    requestable: true,
  },

  // Plan de Trabajo y Plantillas
  {
    key: 'plan_trabajo.ver',
    module: 'plan_trabajo',
    moduleLabel: 'Plan de Trabajo y Certificados',
    label: 'Consultar plan de trabajo y certificados',
    description: 'Ver avances de metas del CMJ y descargar certificado propio.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'plan_trabajo.crear',
    module: 'plan_trabajo',
    moduleLabel: 'Plan de Trabajo y Certificados',
    label: 'Crear metas en el Plan de Trabajo',
    description: 'Registrar nuevas líneas o metas trimestrales por eje y comisión.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'plan_trabajo.editar',
    module: 'plan_trabajo',
    moduleLabel: 'Plan de Trabajo y Certificados',
    label: 'Actualizar avance del Plan de Trabajo',
    description: 'Modificar progreso y evidencias del plan (global o de su propia comisión).',
    riskLevel: 'medio',
    commissionScoped: true,
    requestable: true,
  },
  {
    key: 'plan_trabajo.eliminar',
    module: 'plan_trabajo',
    moduleLabel: 'Plan de Trabajo y Certificados',
    label: 'Eliminar metas del Plan de Trabajo',
    description: 'Retirar metas registradas en el plan de acción.',
    riskLevel: 'alto',
    requestable: true,
  },
  {
    key: 'plantillas.ver',
    module: 'plantillas',
    moduleLabel: 'Plantillas de Cartas',
    label: 'Usar plantillas de oficios y cartas',
    description: 'Consultar y generar oficios institucionales con encabezados del CMJ.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'plantillas.gestionar',
    module: 'plantillas',
    moduleLabel: 'Plantillas de Cartas',
    label: 'Crear y editar plantillas oficiales',
    description: 'Diseñar y modificar formatos institucionales de cartas y oficios.',
    riskLevel: 'medio',
    requestable: true,
  },

  // Auditoría y Permisos Especiales
  {
    key: 'auditoria.ver',
    module: 'auditoria',
    moduleLabel: 'Auditoría',
    label: 'Consultar bitácora de auditoría',
    description: 'Revisar historial inmutable de acciones críticas realizadas en el portal.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'auditoria.exportar',
    module: 'auditoria',
    moduleLabel: 'Auditoría',
    label: 'Exportar bitácora de auditoría',
    description: 'Descargar el registro completo de trazabilidad en formato Excel.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'permisos.solicitar',
    module: 'permisos',
    moduleLabel: 'Solicitudes de Permisos',
    label: 'Solicitar permisos especiales',
    description: 'Enviar solicitudes justificadas de acceso especial temporal o permanente.',
    riskLevel: 'bajo',
    requestable: false,
  },
  {
    key: 'permisos.aprobar_presidencia',
    module: 'permisos',
    moduleLabel: 'Solicitudes de Permisos',
    label: 'Aprobar Paso 1 — Presidencia',
    description: 'Emitir decisión de primer nivel sobre solicitudes de permisos especiales.',
    riskLevel: 'alto',
    requestable: false,
  },
  {
    key: 'permisos.aprobar_vicepresidencia',
    module: 'permisos',
    moduleLabel: 'Solicitudes de Permisos',
    label: 'Aprobar Paso 2 — Vicepresidencia',
    description: 'Emitir decisión de segundo nivel sobre solicitudes de permisos especiales.',
    riskLevel: 'alto',
    requestable: false,
  },
  {
    key: 'permisos.aprobar_secretaria',
    module: 'permisos',
    moduleLabel: 'Solicitudes de Permisos',
    label: 'Aprobar Paso 3 — Secretaría',
    description: 'Emitir decisión final (tercer paso) que activa permisos especiales.',
    riskLevel: 'alto',
    requestable: false,
  },
  {
    key: 'permisos.delegar',
    module: 'permisos',
    moduleLabel: 'Solicitudes de Permisos',
    label: 'Delegar aprobaciones por ausencia',
    description: 'Reasignar un paso pendiente a un directivo suplente cuando el titular está ausente o inactivo.',
    riskLevel: 'alto',
    requestable: false,
  },
  {
    key: 'permisos.revocar',
    module: 'permisos',
    moduleLabel: 'Solicitudes de Permisos',
    label: 'Revocar permisos especiales activos',
    description: 'Desactivar inmediatamente un permiso especial otorgado registrando motivo.',
    riskLevel: 'alto',
    requestable: false,
  },
  {
    key: 'permisos.exportar',
    module: 'permisos',
    moduleLabel: 'Solicitudes de Permisos',
    label: 'Exportar historial de permisos',
    description: 'Descargar reporte completo de solicitudes, flujos y permisos otorgados.',
    riskLevel: 'bajo',
    requestable: true,
  },

  // Gestión Departamental y Proposición de Agenda (Ley 1622 / Ley 1885)
  {
    key: 'sesiones.proponer_agenda',
    module: 'sesiones',
    moduleLabel: 'Sesiones y Asistencia',
    label: 'Proponer puntos al orden del día',
    description: 'Radicar propuestas de temas para sesiones plenarias, sujetas a aprobación de la Mesa Directiva.',
    riskLevel: 'bajo',
    requestable: true,
  },
  {
    key: 'departamental.ver',
    module: 'departamental',
    moduleLabel: 'Gestión Departamental',
    label: 'Consultar módulo de Gestión Departamental',
    description: 'Ver propuestas ante la administración, veeduría juvenil e informes de interlocución departamental.',
    riskLevel: 'bajo',
    requestable: true,
  },
  {
    key: 'departamental.propuestas_crear',
    module: 'departamental',
    moduleLabel: 'Gestión Departamental',
    label: 'Crear y gestionar propuestas e interlocución',
    description: 'Formular planes, programas e iniciativas juveniles dirigidas a autoridades municipales y departamentales.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'departamental.veeduria_gestionar',
    module: 'departamental',
    moduleLabel: 'Gestión Departamental',
    label: 'Registrar veeduría y control social',
    description: 'Documentar hallazgos, alertas y recomendaciones de control social sobre planes y políticas de juventud.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'departamental.informes_gestionar',
    module: 'departamental',
    moduleLabel: 'Gestión Departamental',
    label: 'Gestionar informes de interlocución departamental',
    description: 'Elaborar reportes periódicos de representación ante el Consejo Departamental de Juventud del Tolima.',
    riskLevel: 'medio',
    requestable: true,
  },
  {
    key: 'departamental.publicacion_aprobar',
    module: 'departamental',
    moduleLabel: 'Gestión Departamental',
    label: 'Aprobar publicación pública de gestión departamental',
    description: 'Validar y publicar en el portal ciudadano propuestas, veedurías o informes departamentales (exclusivo Presidencia).',
    riskLevel: 'alto',
    requestable: false,
  },
];

export const PERMISSION_CATALOG_MAP: Record<PermissionKey, PermissionCatalogItem> =
  PERMISSIONS_CATALOG.reduce(
    (acc, item) => {
      acc[item.key] = item;
      return acc;
    },
    {} as Record<PermissionKey, PermissionCatalogItem>
  );

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS_CATALOG.map((p) => p.key);

// Permisos base estrictos por cargo (Ley Estatutaria 1622 de 2013 y Ley 1885 de 2018)
export const BASE_ROLE_PERMISSIONS: Record<RoleLabel, PermissionKey[]> = {
  Presidente: [...ALL_PERMISSION_KEYS],

  Vicepresidente: [
    'usuarios.ver',
    'comision.ver_todas',
    'comision.coordinador_asignar',
    'comision.editar_todas',
    'comision.editar_propia',
    'comision.miembros_gestionar',
    'comision.tareas_gestionar',
    'comision.reportes_exportar',
    'sesiones.ver',
    'sesiones.crear',
    'sesiones.editar',
    'sesiones.asistencia_gestionar',
    'sesiones.autoregistro',
    'sesiones.exportar',
    'sesiones.proponer_agenda',
    'actas.ver',
    'actas.crear',
    'actas.editar',
    'actas.comentar',
    'actas.firmar',
    'actas.exportar',
    'votaciones.ver',
    'votaciones.crear',
    'votaciones.editar',
    'votaciones.cerrar',
    'votaciones.votar',
    'compromisos.ver',
    'compromisos.crear',
    'compromisos.editar_todos',
    'compromisos.actualizar_propio',
    'compromisos.exportar',
    'documentos.ver',
    'documentos.subir',
    'documentos.editar',
    'documentos.exportar',
    'planillas.ver',
    'planillas.exportar',
    'noticias.proponer',
    'galeria.subir_propia',
    'encuestas.ver',
    'encuestas.ver_respuestas',
    'encuestas.exportar',
    'buzon.ver',
    'ideas.crear',
    'ideas.votar',
    'ideas.moderar',
    'plan_trabajo.ver',
    'plan_trabajo.crear',
    'plan_trabajo.editar',
    'plantillas.ver',
    'auditoria.ver',
    'auditoria.exportar',
    'permisos.solicitar',
    'permisos.aprobar_vicepresidencia',
    'permisos.delegar',
    'permisos.exportar',
    'departamental.ver',
  ],

  Secretario: [
    'usuarios.ver',
    'usuarios.crear',
    'usuarios.editar',
    'usuarios.desactivar',
    'usuarios.credenciales_rotar',
    'usuarios.purgar_ejemplos',
    'comision.ver_todas',
    'comision.reportes_exportar',
    'sesiones.ver',
    'sesiones.crear',
    'sesiones.editar',
    'sesiones.asistencia_gestionar',
    'sesiones.autoregistro',
    'sesiones.eliminar',
    'sesiones.exportar',
    'sesiones.proponer_agenda',
    'actas.ver',
    'actas.crear',
    'actas.editar',
    'actas.comentar',
    'actas.firmar',
    'actas.eliminar',
    'actas.exportar',
    'votaciones.ver',
    'votaciones.crear',
    'votaciones.editar',
    'votaciones.votar',
    'compromisos.ver',
    'compromisos.crear',
    'compromisos.editar_todos',
    'compromisos.actualizar_propio',
    'compromisos.exportar',
    'documentos.ver',
    'documentos.subir',
    'documentos.editar',
    'documentos.exportar',
    'planillas.ver',
    'planillas.importar',
    'planillas.exportar',
    'portal.editar',
    'noticias.crear',
    'noticias.proponer',
    'noticias.publicar',
    'noticias.eliminar',
    'galeria.gestionar',
    'galeria.subir_propia',
    'encuestas.ver',
    'encuestas.crear',
    'encuestas.ver_respuestas',
    'encuestas.exportar',
    'buzon.ver',
    'buzon.responder',
    'ideas.crear',
    'ideas.votar',
    'ideas.moderar',
    'plan_trabajo.ver',
    'plan_trabajo.crear',
    'plan_trabajo.editar',
    'plantillas.ver',
    'plantillas.gestionar',
    'auditoria.ver',
    'auditoria.exportar',
    'permisos.solicitar',
    'permisos.aprobar_secretaria',
    'permisos.exportar',
    'departamental.ver',
  ],

  'Consejero Departamental': [
    'comision.ver_todas',
    'sesiones.ver',
    'sesiones.autoregistro',
    'sesiones.proponer_agenda',
    'actas.ver',
    'actas.comentar',
    'votaciones.ver',
    'votaciones.votar',
    'compromisos.ver',
    'compromisos.actualizar_propio',
    'documentos.ver',
    'documentos.subir',
    'planillas.ver',
    'noticias.proponer',
    'galeria.subir_propia',
    'encuestas.ver',
    'ideas.crear',
    'ideas.votar',
    'plan_trabajo.ver',
    'plantillas.ver',
    'permisos.solicitar',
    'departamental.ver',
    'departamental.propuestas_crear',
    'departamental.veeduria_gestionar',
    'departamental.informes_gestionar',
  ],

  Consejero: [
    'comision.ver_todas',
    'sesiones.ver',
    'sesiones.autoregistro',
    'actas.ver',
    'actas.comentar',
    'votaciones.ver',
    'votaciones.votar',
    'compromisos.ver',
    'compromisos.actualizar_propio',
    'documentos.ver',
    'documentos.subir',
    'planillas.ver',
    'noticias.proponer',
    'galeria.subir_propia',
    'encuestas.ver',
    'ideas.crear',
    'ideas.votar',
    'plan_trabajo.ver',
    'plantillas.ver',
    'permisos.solicitar',
  ],
};

// Permisos otorgados dinámicamente mientras el usuario es coordinador activo de una comisión
export const COORDINATOR_SCOPED_PERMISSIONS: PermissionKey[] = [
  'comision.editar_propia',
  'comision.miembros_gestionar',
  'comision.tareas_gestionar',
  'comision.reportes_exportar',
  'plan_trabajo.editar',
  'documentos.subir',
  'galeria.gestionar',
];

export function roleLabelToAccessTier(roleLabel: RoleLabel): AccessTier {
  if (roleLabel === 'Presidente') return 'tier_1_pres';
  if (roleLabel === 'Vicepresidente') return 'tier_2_vp';
  if (roleLabel === 'Secretario') return 'tier_3_sec';
  if (roleLabel === 'Consejero Departamental') return 'tier_5_dept';
  return 'tier_4_member';
}

export function normalizeRoleLabel(raw: unknown): RoleLabel {
  if (
    raw === 'Presidente' ||
    raw === 'Vicepresidente' ||
    raw === 'Secretario' ||
    raw === 'Consejero Departamental' ||
    raw === 'Consejero'
  ) {
    return raw;
  }
  return 'Consejero';
}

export function isGrantActive(grant: GrantedPermission, nowMs = Date.now()): boolean {
  if (!grant.active) return false;
  if (grant.revokedAt) return false;
  if (grant.durationType === 'temporal' && grant.expiresAt) {
    const exp = Date.parse(grant.expiresAt);
    if (!Number.isNaN(exp) && exp <= nowMs) {
      return false;
    }
  }
  return true;
}

export interface PermissionResolutionContext {
  roleLabel: RoleLabel;
  active?: boolean;
  coordinatorCommissionIds?: string[];
  grantedPermissions?: GrantedPermission[];
  nowMs?: number;
}

export function resolveEffectivePermissions(ctx: PermissionResolutionContext): PermissionKey[] {
  if (ctx.active === false) return [];
  const nowMs = ctx.nowMs ?? Date.now();
  const perms = new Set<PermissionKey>(BASE_ROLE_PERMISSIONS[ctx.roleLabel] || BASE_ROLE_PERMISSIONS.Consejero);

  if ((ctx.coordinatorCommissionIds || []).length > 0) {
    for (const p of COORDINATOR_SCOPED_PERMISSIONS) {
      perms.add(p);
    }
  }

  for (const grant of ctx.grantedPermissions || []) {
    if (isGrantActive(grant, nowMs)) {
      perms.add(grant.permissionKey);
    }
  }

  return Array.from(perms);
}

export function hasPermission(
  ctx: PermissionResolutionContext & { effectivePermissions?: PermissionKey[] },
  permission: PermissionKey,
  targetCommissionId?: string
): boolean {
  if (ctx.active === false) return false;
  const nowMs = ctx.nowMs ?? Date.now();
  const base = new Set<PermissionKey>(BASE_ROLE_PERMISSIONS[ctx.roleLabel] || BASE_ROLE_PERMISSIONS.Consejero);

  // Permisos globales base del cargo
  if (base.has(permission)) {
    // Si es un permiso scoped y pide explícitamente editar otra comisión sin tener *_todas
    if (permission === 'comision.editar_propia' && targetCommissionId) {
      const isCoord = (ctx.coordinatorCommissionIds || []).includes(targetCommissionId);
      if (isCoord || base.has('comision.editar_todas')) return true;
      return false;
    }
    return true;
  }

  // Permisos especiales otorgados vía flujo de aprobación
  const matchingGrants = (ctx.grantedPermissions || []).filter(
    (g) => g.permissionKey === permission && isGrantActive(g, nowMs)
  );
  for (const grant of matchingGrants) {
    if (!grant.targetCommissionId || !targetCommissionId) {
      return true;
    }
    if (grant.targetCommissionId === targetCommissionId) {
      return true;
    }
  }

  // Permisos dinámicos de coordinador estrictamente sobre SU comisión asignada
  if (COORDINATOR_SCOPED_PERMISSIONS.includes(permission)) {
    const coordIds = ctx.coordinatorCommissionIds || [];
    if (coordIds.length === 0) return false;
    if (!targetCommissionId) {
      // Sin comisión específica en la consulta (ej. visibilidad de botones generales), tiene el permiso en al menos una
      return true;
    }
    return coordIds.includes(targetCommissionId);
  }

  return false;
}

export function getPermissionMeta(key: PermissionKey): PermissionCatalogItem {
  return (
    PERMISSION_CATALOG_MAP[key] || {
      key,
      module: 'permisos',
      moduleLabel: 'Permisos',
      label: key,
      description: 'Permiso del sistema CMJ.',
      riskLevel: 'medio',
      requestable: true,
    }
  );
}

// Validación estricta de justificación (mínimo 100 caracteres, sin relleno repetitivo ni incoherente)
export interface JustificationValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePermissionJustification(input: {
  reason: string;
  purpose: string;
  targetModule: string;
  durationType: PermissionDurationType;
  expiresAt?: string;
}): JustificationValidationResult {
  const reason = (input.reason || '').trim();
  const purpose = (input.purpose || '').trim();
  const targetModule = (input.targetModule || '').trim();

  if (!targetModule) {
    return { valid: false, error: 'Debes indicar el módulo o alcance al que aplica la solicitud.' };
  }
  if (purpose.length < 15) {
    return {
      valid: false,
      error: 'Describe concretamente para qué necesitas este permiso (mínimo 15 caracteres).',
    };
  }
  if (reason.length < 100) {
    return {
      valid: false,
      error: `La justificación debe tener al menos 100 caracteres reales (faltan ${100 - reason.length}).`,
    };
  }

  // Rechazar repetición de un mismo carácter (ej: "aaaaaaaaa" o "11111111")
  if (/(.)\1{4,}/i.test(reason)) {
    return {
      valid: false,
      error: 'La justificación contiene secuencias repetitivas no válidas. Explica el motivo real.',
    };
  }

  // Exigir vocabulario mínimo variado (>= 12 palabras reales y >= 8 únicas)
  const words = reason
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const uniqueWords = new Set(words);
  if (words.length < 12 || uniqueWords.size < 8) {
    return {
      valid: false,
      error:
        'La justificación es demasiado repetitiva o carece de contexto suficiente (se requieren al menos 12 palabras con sentido).',
    };
  }

  // Verificar proporción de letras reales frente a símbolos/números sin sentido
  const letterCount = (reason.match(/\p{L}/gu) || []).length;
  if (letterCount / reason.length < 0.55) {
    return {
      valid: false,
      error: 'La justificación debe estar redactada en texto claro y comprensible en español.',
    };
  }

  if (input.durationType === 'temporal') {
    if (!input.expiresAt) {
      return {
        valid: false,
        error: 'Los permisos temporales requieren una fecha de expiración obligatoria.',
      };
    }
    const expMs = Date.parse(input.expiresAt);
    if (Number.isNaN(expMs) || expMs <= Date.now() + 60 * 60 * 1000) {
      return {
        valid: false,
        error: 'La fecha de expiración debe ser posterior al día y hora actual (mínimo +1 hora).',
      };
    }
  }

  return { valid: true };
}

export const AUDIT_COMPARISON_MATRIX: AuditComparisonRow[] = [
  {
    module: 'Usuarios y Mesa',
    action: 'Asignar o modificar Presidente / escalación de rol',
    currentState: 'BRECHA CRÍTICA: VP o Secretario podían auto-ascenderse a Presidente en PATCH /api/councilors/:uid.',
    proposedPresidente: 'Permitido',
    proposedVicepresidente: 'Bloqueado (solo Presidencia)',
    proposedSecretario: 'Bloqueado (solo Presidencia o bootstrap inicial)',
    proposedConsejeroDepartamental: 'Bloqueado',
    proposedConsejero: 'Bloqueado',
    proposedCoordinador: 'Bloqueado',
    specialRequestable: false,
    permissionKey: 'usuarios.asignar_presidencia',
  },
  {
    module: 'Usuarios y Mesa',
    action: 'Autorizar, editar o suspender consejeros',
    currentState: 'Presidente, VP y Secretario compartían el mismo acceso sin distinción.',
    proposedPresidente: 'Permitido',
    proposedVicepresidente: 'Solo lectura (solicitable)',
    proposedSecretario: 'Permitido (sin tocar Presidencia)',
    proposedConsejeroDepartamental: 'Bloqueado (solicitable)',
    proposedConsejero: 'Bloqueado (solicitable)',
    proposedCoordinador: 'Bloqueado',
    specialRequestable: true,
    permissionKey: 'usuarios.editar',
  },
  {
    module: 'Usuarios y Mesa',
    action: 'Eliminar cuentas y rotar credenciales institucionales',
    currentState: 'Cualquier miembro de Mesa podía eliminar o rotar sin restricción.',
    proposedPresidente: 'Permitido',
    proposedVicepresidente: 'Bloqueado (solicitable)',
    proposedSecretario: 'Rotar credenciales permitido; eliminar restringido/solicitable',
    proposedConsejeroDepartamental: 'Bloqueado',
    proposedConsejero: 'Bloqueado',
    proposedCoordinador: 'Bloqueado',
    specialRequestable: true,
    permissionKey: 'usuarios.eliminar',
  },
  {
    module: 'Comisiones',
    action: 'Designar coordinadores de las 5 comisiones',
    currentState: 'No validaba si coordinatorUid era un usuario activo.',
    proposedPresidente: 'Permitido',
    proposedVicepresidente: 'Permitido (supervisión)',
    proposedSecretario: 'Solo lectura (solicitable)',
    proposedConsejeroDepartamental: 'Bloqueado (solicitable)',
    proposedConsejero: 'Bloqueado (solicitable)',
    proposedCoordinador: 'Bloqueado',
    specialRequestable: true,
    permissionKey: 'comision.coordinador_asignar',
  },
  {
    module: 'Comisiones',
    action: 'Editar comisión, gestionar miembros y tareas',
    currentState: 'BRECHA ALTA: cualquier consejero podía crear/editar tareas en cualquier comisión.',
    proposedPresidente: 'Todas las comisiones',
    proposedVicepresidente: 'Todas las comisiones',
    proposedSecretario: 'Solo lectura (solicitable)',
    proposedConsejeroDepartamental: 'Solo lectura y tareas propias',
    proposedConsejero: 'Solo lectura y tareas propias',
    proposedCoordinador: 'Control total SOLO de su comisión asignada',
    specialRequestable: true,
    permissionKey: 'comision.tareas_gestionar',
  },
  {
    module: 'Sesiones',
    action: 'Convocar sesiones, editar y gestionar asistencia/QR',
    currentState: 'Permitido para los 3 cargos directivos por igual; sin permiso granular.',
    proposedPresidente: 'Control total',
    proposedVicepresidente: 'Crear, editar y gestionar asistencia',
    proposedSecretario: 'Control total incluyendo eliminar',
    proposedConsejeroDepartamental: 'Autoregistro QR + proponer orden del día',
    proposedConsejero: 'Solo autoregistro QR y excusa',
    proposedCoordinador: 'Igual a Consejero',
    specialRequestable: true,
    permissionKey: 'sesiones.crear',
  },
  {
    module: 'Sesiones',
    action: 'Proponer puntos al orden del día (sujeto a aprobación de Mesa)',
    currentState: 'NO EXISTÍA: la representación departamental requería canal formal para agendar temas sin editar sesiones.',
    proposedPresidente: 'Proponer y aprobar',
    proposedVicepresidente: 'Proponer y aprobar',
    proposedSecretario: 'Proponer y aprobar',
    proposedConsejeroDepartamental: 'Permitido (Mesa decide incorporación)',
    proposedConsejero: 'Bloqueado (solicitable)',
    proposedCoordinador: 'Igual a Consejero',
    specialRequestable: true,
    permissionKey: 'sesiones.proponer_agenda',
  },
  {
    module: 'Actas',
    action: 'Redactar, comentar, firmar y aprobar actas',
    currentState: 'BRECHA MEDIA: /ai-draft no validaba rol; Secretario y VP podían aprobar igual que Presidente.',
    proposedPresidente: 'Control total y aprobación final',
    proposedVicepresidente: 'Crear, editar y firmar (sin aprobación final)',
    proposedSecretario: 'Redactar, editar y firmar (sin aprobación final)',
    proposedConsejeroDepartamental: 'Consultar y comentar en revisión',
    proposedConsejero: 'Consultar y comentar en revisión',
    proposedCoordinador: 'Igual a Consejero',
    specialRequestable: true,
    permissionKey: 'actas.aprobar',
  },
  {
    module: 'Votaciones',
    action: 'Crear, editar, cerrar votaciones y votar',
    currentState: 'Solo Mesa creaba/cerraba; ahora se separa cierre oficial de creación.',
    proposedPresidente: 'Control total + voto',
    proposedVicepresidente: 'Crear, editar, cerrar + voto',
    proposedSecretario: 'Crear, editar + voto (cierre solicitable)',
    proposedConsejeroDepartamental: 'Ver y emitir su voto',
    proposedConsejero: 'Ver y emitir su voto',
    proposedCoordinador: 'Igual a Consejero',
    specialRequestable: true,
    permissionKey: 'votaciones.cerrar',
  },
  {
    module: 'Compromisos',
    action: 'Crear, validar todos o actualizar propios',
    currentState: 'Diferenciación básica; faltaba granularidad de validación vs avance propio.',
    proposedPresidente: 'Control total',
    proposedVicepresidente: 'Crear, editar/validar todos',
    proposedSecretario: 'Crear, editar todos',
    proposedConsejeroDepartamental: 'Solo actualizar avance propio',
    proposedConsejero: 'Solo actualizar avance propio',
    proposedCoordinador: 'Igual a Consejero (solicitable)',
    specialRequestable: true,
    permissionKey: 'compromisos.editar_todos',
  },
  {
    module: 'Documentos',
    action: 'Subir, editar y aprobar visibilidad pública',
    currentState: 'BRECHA MEDIA: VP o Secretario podían aprobar/publicar vía PATCH saltándose al Presidente.',
    proposedPresidente: 'Subir, editar, eliminar y aprobación final',
    proposedVicepresidente: 'Subir y editar (sin aprobación pública)',
    proposedSecretario: 'Subir y editar (sin aprobación pública)',
    proposedConsejeroDepartamental: 'Subir privados y consultar',
    proposedConsejero: 'Subir privados y consultar',
    proposedCoordinador: 'Subir documentos para su comisión',
    specialRequestable: true,
    permissionKey: 'documentos.aprobar',
  },
  {
    module: 'Planillas',
    action: 'Consultar, exportar e importar masivo XLSX',
    currentState: 'Importación no estaba separada de exportación.',
    proposedPresidente: 'Ver, exportar e importar',
    proposedVicepresidente: 'Ver y exportar (importar solicitable)',
    proposedSecretario: 'Ver, exportar e importar',
    proposedConsejeroDepartamental: 'Solo lectura (exportar/importar solicitable)',
    proposedConsejero: 'Solo lectura (exportar/importar solicitable)',
    proposedCoordinador: 'Exportar reportes de su comisión',
    specialRequestable: true,
    permissionKey: 'planillas.importar',
  },
  {
    module: 'Portal Público',
    action: 'Configurar portal, publicar noticias y moderar galería',
    currentState: 'VP tenía acceso igual a Secretaría/Presidencia en edición del portal.',
    proposedPresidente: 'Control total',
    proposedVicepresidente: 'Proponer noticias/subir fotos (edición solicitable)',
    proposedSecretario: 'Editar portal, publicar noticias y galería',
    proposedConsejeroDepartamental: 'Proponer borradores y subir fotos propias',
    proposedConsejero: 'Proponer borradores y subir fotos propias',
    proposedCoordinador: 'Gestionar galería de su comisión',
    specialRequestable: true,
    permissionKey: 'portal.editar',
  },
  {
    module: 'Encuestas y Buzón',
    action: 'Ver respuestas PII y responder mensajes ciudadanos',
    currentState: 'BRECHA MEDIA: GET /api/survey-responses permitía a cualquier consejero leer correos.',
    proposedPresidente: 'Control total',
    proposedVicepresidente: 'Ver encuestas/buzón y moderar ideas',
    proposedSecretario: 'Control total',
    proposedConsejeroDepartamental: 'Solo crear/votar ideas y ver encuestas abiertas',
    proposedConsejero: 'Solo crear/votar ideas y ver encuestas abiertas',
    proposedCoordinador: 'Igual a Consejero',
    specialRequestable: true,
    permissionKey: 'encuestas.ver_respuestas',
  },
  {
    module: 'Plan de Trabajo',
    action: 'Actualizar metas y evidencias trimestrales',
    currentState: 'BRECHA ALTA: cualquier consejero podía editar cualquier meta en PATCH /api/work-plans/:id.',
    proposedPresidente: 'Control total',
    proposedVicepresidente: 'Crear y editar metas',
    proposedSecretario: 'Crear y editar metas',
    proposedConsejeroDepartamental: 'Solo lectura y certificado propio',
    proposedConsejero: 'Solo lectura y certificado propio',
    proposedCoordinador: 'Editar avances de su comisión',
    specialRequestable: true,
    permissionKey: 'plan_trabajo.editar',
  },
  {
    module: 'Gestión Departamental',
    action: 'Consultar propuestas, veeduría juvenil e informes departamentales',
    currentState: 'NO EXISTÍA: no existía módulo dedicado para interlocución ante el CDJ Tolima y veeduría.',
    proposedPresidente: 'Ver y supervisar',
    proposedVicepresidente: 'Solo lectura (edición solicitable)',
    proposedSecretario: 'Solo lectura (edición solicitable)',
    proposedConsejeroDepartamental: 'Acceso completo de lectura',
    proposedConsejero: 'Bloqueado (solicitable)',
    proposedCoordinador: 'Igual a Consejero',
    specialRequestable: true,
    permissionKey: 'departamental.ver',
  },
  {
    module: 'Gestión Departamental',
    action: 'Crear propuestas ante administración, veeduría e informes CDJ',
    currentState: 'NO EXISTÍA: el delegado departamental no tenía flujo propio ni separado de Mesa.',
    proposedPresidente: 'Control total',
    proposedVicepresidente: 'Bloqueado (solicitable)',
    proposedSecretario: 'Bloqueado (solicitable)',
    proposedConsejeroDepartamental: 'Crear y gestionar sus registros (privados)',
    proposedConsejero: 'Bloqueado (solicitable)',
    proposedCoordinador: 'Igual a Consejero',
    specialRequestable: true,
    permissionKey: 'departamental.propuestas_crear',
  },
  {
    module: 'Gestión Departamental',
    action: 'Registrar veeduría y control social sobre políticas de juventud',
    currentState: 'NO EXISTÍA: faltaba trazabilidad formal de veeduría (Ley 1622 / Ley 1885).',
    proposedPresidente: 'Control total',
    proposedVicepresidente: 'Bloqueado (solicitable)',
    proposedSecretario: 'Bloqueado (solicitable)',
    proposedConsejeroDepartamental: 'Crear y actualizar hallazgos',
    proposedConsejero: 'Bloqueado (solicitable)',
    proposedCoordinador: 'Igual a Consejero',
    specialRequestable: true,
    permissionKey: 'departamental.veeduria_gestionar',
  },
  {
    module: 'Gestión Departamental',
    action: 'Emitir informes periódicos de interlocución departamental',
    currentState: 'NO EXISTÍA: no había bitácora formal de informes del delegado ante el CDJ Tolima.',
    proposedPresidente: 'Control total',
    proposedVicepresidente: 'Bloqueado (solicitable)',
    proposedSecretario: 'Bloqueado (solicitable)',
    proposedConsejeroDepartamental: 'Crear y gestionar informes',
    proposedConsejero: 'Bloqueado (solicitable)',
    proposedCoordinador: 'Igual a Consejero',
    specialRequestable: true,
    permissionKey: 'departamental.informes_gestionar',
  },
  {
    module: 'Gestión Departamental',
    action: 'Aprobar publicación ciudadana de propuestas, veedurías e informes',
    currentState: 'Restricción estricta: el Consejero Departamental nunca auto-publica en el portal público.',
    proposedPresidente: 'Aprobación final exclusiva',
    proposedVicepresidente: 'Bloqueado (exclusivo Presidencia)',
    proposedSecretario: 'Bloqueado (exclusivo Presidencia)',
    proposedConsejeroDepartamental: 'Solo solicitar publicación',
    proposedConsejero: 'Bloqueado',
    proposedCoordinador: 'Bloqueado',
    specialRequestable: false,
    permissionKey: 'departamental.publicacion_aprobar',
  },
  {
    module: 'Auditoría',
    action: 'Consultar y exportar historial inmutable',
    currentState: 'Todos los líderes accedían; ahora queda trazado por permiso granular.',
    proposedPresidente: 'Ver y exportar',
    proposedVicepresidente: 'Ver y exportar',
    proposedSecretario: 'Ver y exportar',
    proposedConsejeroDepartamental: 'Bloqueado (solicitable)',
    proposedConsejero: 'Bloqueado (solicitable)',
    proposedCoordinador: 'Bloqueado (solicitable)',
    specialRequestable: true,
    permissionKey: 'auditoria.ver',
  },
  {
    module: 'Permisos Especiales',
    action: 'Solicitar, aprobar (1→2→3), delegar y revocar',
    currentState: 'NO EXISTÍA: no había flujo para otorgar excepciones justificadas ni revocarlas.',
    proposedPresidente: 'Paso 1 + Delegar + Revocar',
    proposedVicepresidente: 'Paso 2 + Delegar por ausencia',
    proposedSecretario: 'Paso 3 (activación final)',
    proposedConsejeroDepartamental: 'Solicitar con justificación >= 100 chars',
    proposedConsejero: 'Solicitar con justificación >= 100 chars',
    proposedCoordinador: 'Solicitar para su comisión u otros módulos',
    specialRequestable: false,
    permissionKey: 'permisos.solicitar',
  },
];
