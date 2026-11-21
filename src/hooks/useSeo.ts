import { useEffect } from 'react';
import { Commission, PublicDirectoryMember, ROLE_LABELS } from '../types/models';
import { AppRoute } from '../types/navigation';

const ROUTE_SEO: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'CMJ Flandes · Consejo Municipal de Juventud (2026–2029)',
    description:
      'Portal institucional del Consejo Municipal de Juventud de Flandes, Tolima (2026–2029). Participación juvenil, gestión pública y transparencia.',
  },
  '/consejo': {
    title: 'Conoce nuestro Consejo · CMJ Flandes',
    description:
      'Misión, visión, marco normativo (Leyes 1622 de 2013 y 1885 de 2018), Mesa Directiva, directorio de consejeros y comisiones.',
  },
  '/comisiones': {
    title: 'Comisiones de Trabajo · CMJ Flandes',
    description:
      'Conoce las comisiones temáticas del Consejo Municipal de Juventud de Flandes, sus planes de trabajo, metas, proyectos y documentos.',
  },
  '/consejeros': {
    title: 'Directorio de Consejeros · CMJ Flandes',
    description:
      'Conoce a los consejeros municipales de juventud de Flandes, Tolima (2026–2029), sus comisiones, trayectorias y propuestas.',
  },
  '/gestion': {
    title: 'Gestión Institucional y Rendición de Cuentas · CMJ Flandes',
    description:
      'Consulta proyectos juveniles, sesiones del pleno, calendario público descargable, actas aprobadas e informes de gestión.',
  },
  '/actualidad': {
    title: 'Actualidad, Encuestas y Transparencia · CMJ Flandes',
    description:
      'Noticias oficiales, comunicados, encuestas ciudadanas, convocatorias y datos abiertos descargables del CMJ Flandes.',
  },
  '/participacion': {
    title: 'Buzón de Participación Juvenil · CMJ Flandes',
    description:
      'Radica propuestas, inquietudes o denuncias ciudadanas con opción anónima y consulta el estado por código de seguimiento.',
  },
  '/verificar': {
    title: 'Verificación de Certificados · CMJ Flandes',
    description:
      'Consulta la autenticidad y vigencia de certificados y constancias emitidas por el Consejo Municipal de Juventud de Flandes.',
  },
  '/contacto': {
    title: 'Contacto y PQRSD · CMJ Flandes',
    description:
      'Canales oficiales de atención ciudadana y radicación de PQRSD ante el Consejo Municipal de Juventud de Flandes.',
  },
  '/portal': {
    title: 'Portal de Consejeros · CMJ Flandes',
    description:
      'Acceso autenticado para consejeros municipales de juventud, Mesa Directiva y administración institucional.',
  },
};

export function useSeo(
  route: AppRoute,
  activeCouncilor?: PublicDirectoryMember | null,
  activeCommission?: Commission | null,
) {
  useEffect(() => {
    const basePath = route.split('?')[0];
    let title = ROUTE_SEO[basePath]?.title || ROUTE_SEO['/'].title;
    let description = ROUTE_SEO[basePath]?.description || ROUTE_SEO['/'].description;
    let ogImage: string | undefined;

    const canonicalUrl = `${window.location.origin}${basePath}`;
    const defaultOgImage = `${window.location.origin}/icons/icon-512x512.png`;
    let personSchema: Record<string, unknown> | null = null;

    if (basePath.startsWith('/verificar')) {
      title = ROUTE_SEO['/verificar'].title;
      description = ROUTE_SEO['/verificar'].description;
    } else if (basePath.startsWith('/consejeros/') && activeCouncilor) {
      const roleLabel = activeCouncilor.positionTitle || ROLE_LABELS[activeCouncilor.role];
      title = `${activeCouncilor.displayName} · ${roleLabel} · CMJ Flandes`;
      description =
        activeCouncilor.shortBio ||
        activeCouncilor.bio ||
        activeCouncilor.featuredQuote ||
        `Perfil institucional de ${activeCouncilor.displayName}, ${roleLabel} del Consejo Municipal de Juventud de Flandes (2026–2029).`;
      if (activeCouncilor.photoUrl) {
        ogImage = activeCouncilor.photoUrl;
      }
      const sameAs = Object.values(activeCouncilor.socialLinks || {}).filter(Boolean);
      personSchema = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: activeCouncilor.displayName,
        jobTitle: roleLabel,
        description,
        url: canonicalUrl,
        ...(ogImage ? { image: ogImage } : {}),
        ...(sameAs.length > 0 ? { sameAs } : {}),
        memberOf: {
          '@type': 'GovernmentOrganization',
          name: 'Consejo Municipal de Juventud de Flandes',
        },
      };
    } else if (basePath.startsWith('/comisiones/') && activeCommission) {
      title = `${activeCommission.name} · Comisiones CMJ Flandes`;
      description = activeCommission.mission || activeCommission.description;
      if (activeCommission.coverImageUrl) {
        ogImage = activeCommission.coverImageUrl;
      }
    }

    document.title = title;

    const updateMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', content);
    };

    const resolvedImage = ogImage || defaultOgImage;
    updateMeta('meta[name="description"]', description);
    updateMeta('meta[property="og:title"]', title);
    updateMeta('meta[property="og:description"]', description);
    updateMeta('meta[property="og:url"]', canonicalUrl);
    updateMeta('meta[property="og:image"]', resolvedImage);
    updateMeta('meta[name="twitter:title"]', title);
    updateMeta('meta[name="twitter:description"]', description);
    updateMeta('meta[name="twitter:image"]', resolvedImage);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    const jsonLdId = 'cmj-dynamic-jsonld';
    let jsonLdScript = document.getElementById(jsonLdId) as HTMLScriptElement | null;
    if (personSchema) {
      if (!jsonLdScript) {
        jsonLdScript = document.createElement('script');
        jsonLdScript.id = jsonLdId;
        jsonLdScript.type = 'application/ld+json';
        document.head.appendChild(jsonLdScript);
      }
      jsonLdScript.textContent = JSON.stringify(personSchema);
    } else if (jsonLdScript) {
      jsonLdScript.remove();
    }
  }, [route, activeCouncilor, activeCommission]);
}
