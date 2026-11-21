import { useCallback, useEffect, useState } from 'react';
import { trackPrivacyFirstPageView } from '../services/analyticsService';
import { AppRoute } from '../types/navigation';

const STATIC_ROUTES = new Set([
  '/',
  '/consejo',
  '/comisiones',
  '/consejeros',
  '/gestion',
  '/actualidad',
  '/participacion',
  '/verificar',
  '/contacto',
  '/portal',
]);

interface ParsedLocation {
  route: AppRoute;
  pathname: string;
  councilorSlug: string | null;
  commissionSlug: string | null;
  verifyCode: string | null;
  search: string;
}

function parseLocation(pathname: string, search = ''): ParsedLocation {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean.startsWith('/consejeros/')) {
    const slug = decodeURIComponent(clean.slice('/consejeros/'.length)).trim();
    if (slug) {
      return {
        route: `/consejeros/${slug}`,
        pathname: clean,
        councilorSlug: slug,
        commissionSlug: null,
        verifyCode: null,
        search,
      };
    }
  }
  if (clean.startsWith('/comisiones/')) {
    const slug = decodeURIComponent(clean.slice('/comisiones/'.length)).trim();
    if (slug) {
      return {
        route: `/comisiones/${slug}`,
        pathname: clean,
        councilorSlug: null,
        commissionSlug: slug,
        verifyCode: null,
        search,
      };
    }
  }
  if (clean.startsWith('/verificar/')) {
    const code = decodeURIComponent(clean.slice('/verificar/'.length)).trim().toUpperCase();
    if (code) {
      return {
        route: `/verificar/${code}`,
        pathname: clean,
        councilorSlug: null,
        commissionSlug: null,
        verifyCode: code,
        search,
      };
    }
  }
  if (STATIC_ROUTES.has(clean)) {
    return {
      route: clean as AppRoute,
      pathname: clean,
      councilorSlug: null,
      commissionSlug: null,
      verifyCode: null,
      search,
    };
  }
  return {
    route: '/',
    pathname: '/',
    councilorSlug: null,
    commissionSlug: null,
    verifyCode: null,
    search: '',
  };
}

export function useRouter() {
  const [locationState, setLocationState] = useState<ParsedLocation>(() =>
    typeof window !== 'undefined'
      ? parseLocation(window.location.pathname, window.location.search)
      : {
          route: '/',
          pathname: '/',
          councilorSlug: null,
          commissionSlug: null,
          verifyCode: null,
          search: '',
        },
  );

  useEffect(() => {
    const handlePopState = () => {
      setLocationState(parseLocation(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    void trackPrivacyFirstPageView(locationState.pathname);
  }, [locationState.pathname]);

  const navigate = useCallback(
    (path: AppRoute) => {
      const [rawPath, rawSearch] = path.split('?');
      const searchStr = rawSearch ? `?${rawSearch}` : '';
      const next = parseLocation(rawPath || '/', searchStr);

      if (next.pathname === locationState.pathname && next.search === locationState.search) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      window.history.pushState({}, '', `${next.pathname}${next.search}`);
      setLocationState(next);
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [locationState.pathname, locationState.search],
  );

  return {
    currentRoute: locationState.route,
    currentPathname: locationState.pathname,
    councilorSlug: locationState.councilorSlug,
    commissionSlug: locationState.commissionSlug,
    verifyCode: locationState.verifyCode,
    searchParams: new URLSearchParams(locationState.search),
    navigate,
  };
}
