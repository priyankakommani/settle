import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId, useState } from 'react';
import { cx } from './primitives.js';
import { Icon } from './icons.js';

/** label + control + hint/error, wired with a generated id. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: (id: string, invalid: boolean) => ReactNode;
}) {
  const id = useId();
  const invalid = Boolean(error);
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? <span className="u-subtle"> *</span> : null}
      </label>
      {children(id, invalid)}
      {error ? (
        <span className="field__error">{error}</span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

/** Defaults to `autoComplete="off"` so the browser doesn't autofill unrelated fields (e.g. the login email) into a plain text input — pass an explicit `autoComplete` to opt back in. */
export function Input({
  className,
  autoComplete = 'off',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('input', className)} autoComplete={autoComplete} {...rest} />;
}

/**
 * Password input with a show/hide toggle. Drop-in for `<Input type="password" />`.
 */
export function PasswordInput({
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-affix">
      <input
        type={visible ? 'text' : 'password'}
        className={cx('input', 'input--affixed', className)}
        {...rest}
      />
      <button
        type="button"
        className="input-affix__toggle"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <Icon.EyeOff size={16} /> : <Icon.Eye size={16} />}
      </button>
    </div>
  );
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx('select', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('textarea', className)} {...rest} />;
}
