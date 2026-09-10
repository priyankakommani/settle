import { cx } from './primitives.js';

export interface TabDef {
  id: string;
  label: string;
}

/** Controlled tab strip. State lives in the parent (usually a URL search param). */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === active}
          className={cx('tabs__tab', t.id === active && 'is-active')}
          onClick={() => onChange(t.id)}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
