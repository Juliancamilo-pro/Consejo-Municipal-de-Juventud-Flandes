import { CounselorAchievement, ProjectItem, PublicFieldVisibility } from '../../types/models';
import { Input, Textarea } from '../../components/ui/Input';
import { ProfileExtendedFields } from './ProfileExtendedFields';

export const DEFAULT_PROFILE_VISIBILITY: PublicFieldVisibility = {
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
};

interface ProfileNarrativeFieldsProps {
  displayName: string;
  onChangeDisplayName: (v: string) => void;
  positionTitle: string;
  onChangePositionTitle: (v: string) => void;
  sector: string;
  onChangeSector: (v: string) => void;
  educationOccupation: string;
  onChangeEducationOccupation: (v: string) => void;
  shortBio: string;
  onChangeShortBio: (v: string) => void;
  fullBio: string;
  onChangeFullBio: (v: string) => void;
  motivation: string;
  onChangeMotivation: (v: string) => void;
  proposals: string;
  onChangeProposals: (v: string) => void;
  featuredQuote: string;
  onChangeFeaturedQuote: (v: string) => void;
  workAxes: string[];
  onChangeWorkAxes: (v: string[]) => void;
  skills: string[];
  onChangeSkills: (v: string[]) => void;
  achievements: CounselorAchievement[];
  onChangeAchievements: (v: CounselorAchievement[]) => void;
  projects: ProjectItem[];
  projectIds: string[];
  onToggleProject: (id: string) => void;
}

export function ProfileNarrativeFields(props: ProfileNarrativeFieldsProps) {
  const nameTooShort = props.displayName.trim().length > 0 && props.displayName.trim().length < 2;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="profile-display-name"
          label="Nombre completo"
          required
          minLength={2}
          maxLength={120}
          value={props.displayName}
          onChange={(e) => props.onChangeDisplayName(e.target.value)}
          error={nameTooShort ? 'Ingresa al menos 2 caracteres.' : undefined}
        />
        <Input
          id="profile-position-title"
          label="Cargo o dignidad"
          maxLength={120}
          value={props.positionTitle}
          onChange={(e) => props.onChangePositionTitle(e.target.value)}
          placeholder="Ej. Consejero Sector Independiente · Educación"
          hint={`${props.positionTitle.length}/120 caracteres`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="profile-sector"
          label="Sector, barrio o lista representada"
          maxLength={120}
          value={props.sector}
          onChange={(e) => props.onChangeSector(e.target.value)}
          placeholder="Ej. Lista Independiente Juventud Flaminense"
          hint={`${props.sector.length}/120 caracteres`}
        />
        <Input
          id="profile-education"
          label="Formación / ocupación actual"
          maxLength={240}
          value={props.educationOccupation}
          onChange={(e) => props.onChangeEducationOccupation(e.target.value)}
          placeholder="Ej. Estudiante de Derecho · Gestor cultural"
          hint={`${props.educationOccupation.length}/240 caracteres`}
        />
      </div>

      <Textarea
        id="profile-short-bio"
        label="Reseña corta para tarjeta pública"
        rows={2}
        maxLength={280}
        value={props.shortBio}
        onChange={(e) => props.onChangeShortBio(e.target.value)}
        placeholder="Ej. Joven líder de Flandes enfocado en acceso universitario, deporte barrial y veeduría."
        hint={`${props.shortBio.length}/280 caracteres · Mínimo 15 caracteres recomendados`}
      />

      <Textarea
        id="profile-full-bio"
        label="Biografía completa"
        rows={3}
        maxLength={3000}
        value={props.fullBio}
        onChange={(e) => props.onChangeFullBio(e.target.value)}
        placeholder="Cuenta tu trayectoria comunitaria, procesos juveniles o experiencia en tu barrio o vereda."
        hint={`${props.fullBio.length}/3000 caracteres`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Textarea
          id="profile-motivation"
          label="¿Por qué estoy en el CMJ Flandes?"
          rows={3}
          maxLength={1500}
          value={props.motivation}
          onChange={(e) => props.onChangeMotivation(e.target.value)}
          placeholder="Ej. Representar la voz de las juventudes de Flandes con transparencia y resultados."
          hint={`${props.motivation.length}/1500 caracteres`}
        />
        <Textarea
          id="profile-proposals"
          label="Propuestas o plan de trabajo"
          rows={3}
          maxLength={2500}
          value={props.proposals}
          onChange={(e) => props.onChangeProposals(e.target.value)}
          placeholder="Ej. 1. Escuelas de formación artística. 2. Ruta de primer empleo juvenil."
          hint={`${props.proposals.length}/2500 caracteres`}
        />
      </div>

      <ProfileExtendedFields
        featuredQuote={props.featuredQuote}
        onChangeFeaturedQuote={props.onChangeFeaturedQuote}
        workAxes={props.workAxes}
        onChangeWorkAxes={props.onChangeWorkAxes}
        skills={props.skills}
        onChangeSkills={props.onChangeSkills}
        achievements={props.achievements}
        onChangeAchievements={props.onChangeAchievements}
        projects={props.projects}
        projectIds={props.projectIds}
        onToggleProject={props.onToggleProject}
      />
    </div>
  );
}
