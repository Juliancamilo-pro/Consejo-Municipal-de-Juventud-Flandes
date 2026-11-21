interface TabOption<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  options: TabOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}

export function Tabs<T extends string>({
  options,
  activeId,
  onChange,
  ariaLabel = 'Secciones',
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-1 rounded-lg bg-stone-100 p-1 dark:bg-slate-800/90"
    >
      {options.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-medium transition-colors duration-150 sm:text-sm ${
              isActive
                ? 'bg-white text-stone-950 shadow-xs dark:bg-slate-900 dark:text-[#D9B245]'
                : 'text-stone-600 hover:text-stone-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
