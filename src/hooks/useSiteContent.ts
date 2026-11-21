import { useCallback, useEffect, useState } from 'react';
import { fetchPublicSiteAppearance } from '../services/siteContentService';
import { DEFAULT_SITE_APPEARANCE, SiteAppearanceConfig } from '../types/siteContent';

export function useSiteAppearance() {
  const [siteContent, setSiteContent] = useState<SiteAppearanceConfig>(DEFAULT_SITE_APPEARANCE);

  const reloadSiteContent = useCallback(async () => {
    const loaded = await fetchPublicSiteAppearance();
    setSiteContent(loaded);
  }, []);

  useEffect(() => {
    void reloadSiteContent();
  }, [reloadSiteContent]);

  return {
    siteContent,
    reloadSiteContent,
  };
}
