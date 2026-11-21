import { render } from '@testing-library/react';
import axe from 'axe-core';
import { FileText } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { EmptyState } from '../src/components/ui/EmptyState';
import { FilterToolbar } from '../src/components/ui/FilterToolbar';
import { Input, Select } from '../src/components/ui/Input';
import { AuthCredentialsForm } from '../src/pages/auth/AuthCredentialsForm';
import { ProfileChecklistBanner } from '../src/pages/private/ProfileChecklistBanner';
import { ProfilePrivacyAndConsent } from '../src/pages/private/ProfilePrivacyAndConsent';
import { ProfilePublishTimeline } from '../src/pages/private/ProfilePublishTimeline';
import { HomeHeroSection } from '../src/pages/public/HomeHeroSection';
import { DEFAULT_SITE_APPEARANCE } from '../src/types/siteContent';
import { evaluateProfileCompleteness } from '../src/utils/profileCompleteness';

describe('Accesibilidad WCAG AA de componentes base, filtros, hero y autenticación', () => {
  it('renderiza formularios, tarjetas y botones sin violaciones críticas en axe-core', async () => {
    const { container } = render(
      <main aria-label="Prueba de accesibilidad CMJ">
        <Card>
          <h1>Consejo Municipal de Juventud de Flandes</h1>
          <h2>Formulario institucional</h2>
          <form>
            <Input label="Correo institucional" type="email" value="" onChange={() => undefined} />
            <Select label="Categoría" value="acta" onChange={() => undefined}>
              <option value="acta">Actas</option>
              <option value="informe">Informes</option>
            </Select>
            <Button type="submit">Guardar cambio</Button>
          </form>
        </Card>
        <EmptyState
          icon={FileText}
          title="Sin registros todavía"
          description="Los registros institucionales aparecerán aquí en cuanto sean publicados."
        />
      </main>,
    );

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toHaveLength(0);
  });

  it('mantiene switches, barra de progreso y línea de tiempo de Mi perfil sin violaciones en axe-core', async () => {
    const completeness = evaluateProfileCompleteness({
      photoUrl: '',
      positionTitle: 'Consejero',
      shortBio: 'Reseña de prueba con longitud suficiente.',
      fullBio: '',
      motivation: '',
      proposals: '',
      socialLinks: { instagram: '@cmjflandes' },
      habeasDataAccepted: true,
    });

    const { container, getAllByRole } = render(
      <main aria-label="Editor de perfil CMJ">
        <h1>Mi perfil y ficha pública</h1>
        <ProfileChecklistBanner completeness={completeness} onJumpToField={() => undefined} />
        <ProfilePublishTimeline
          reviewStatus="borrador"
          reviewComment="Agrega al menos un eje de trabajo."
          reviewedByName="Secretaría General"
          saving={false}
          unpublishing={false}
          hasUnsavedChanges={false}
          onSaveDraft={() => undefined}
          onRequestPublish={() => undefined}
          onUnpublish={() => undefined}
        />
        <ProfilePrivacyAndConsent
          visibility={{
            photo: true,
            shortBio: true,
            fullBio: true,
            education: true,
            motivation: true,
            proposals: true,
            projects: true,
            socials: true,
            workAxes: true,
            achievements: true,
            skills: true,
            featuredQuote: true,
            publicEmail: false,
          }}
          onToggleVisibility={() => undefined}
          isMinor={false}
          onChangeIsMinor={() => undefined}
          emailNotifications={true}
          onChangeEmailNotifications={() => undefined}
          habeasDataAccepted={true}
          habeasDataAcceptedAt="2026-03-01T10:00:00.000Z"
          onChangeHabeasData={() => undefined}
        />
      </main>,
    );

    expect(getAllByRole('switch').length).toBeGreaterThanOrEqual(15);

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toHaveLength(0);
  });

  it('oculta contadores en 0 en la portada vacía, muestra orientación y cumple axe-core', async () => {
    const emptyPortal = {
      loading: false,
      error: null,
      councilInfo: null,
      commissions: [],
      news: [],
      projects: [],
      documents: [],
      sessions: [],
      events: [],
      directory: [],
      reload: vi.fn(),
    };

    const { container, queryByText, getByText } = render(
      <main aria-label="Hero CMJ Flandes">
        <HomeHeroSection
          portal={emptyPortal}
          siteContent={DEFAULT_SITE_APPEARANCE}
          onNavigate={vi.fn()}
        />
      </main>,
    );

    expect(queryByText('Consejeros en directorio')).toBeNull();
    expect(getByText('Misión 2026–2029')).toBeTruthy();

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toHaveLength(0);
  });

  it('renderiza FilterToolbar y AuthCredentialsForm sin textos 2FA ni violaciones axe-core', async () => {
    const { container, getByText } = render(
      <main aria-label="Filtros y acceso">
        <h1>Pruebas UI CMJ</h1>
        <FilterToolbar
          searchLabel="Buscar consejero"
          searchPlaceholder="Nombre o comisión..."
          searchValue="Juventud"
          onSearchChange={vi.fn()}
          activeChips={[{ id: 'q', label: 'Búsqueda: Juventud', onRemove: vi.fn() }]}
          onClearAll={vi.fn()}
          secondaryFilters={
            <Select label="Ordenar por" value="az" onChange={vi.fn()}>
              <option value="az">Nombre (A–Z)</option>
            </Select>
          }
        />
        <AuthCredentialsForm
          view="login"
          onChangeView={vi.fn()}
          onLogin={vi.fn()}
          onRegister={vi.fn()}
          onResetPassword={vi.fn()}
        />
      </main>,
    );

    expect(getByText('Ingreso al portal')).toBeTruthy();
    expect(getByText('Limpiar todo')).toBeTruthy();
    expect(container.textContent).not.toMatch(/Paso 1|TOTP|SMS|Recaptcha/i);

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toHaveLength(0);
  });
});
