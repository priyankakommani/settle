import type { ReactNode } from 'react';
import { ApiError } from '../api/client.js';
import { EmptyState, Notice, SkeletonRows } from './primitives.js';
import { Icon } from './icons.js';

interface AsyncSectionProps<T> {
  loading: boolean;
  error: unknown;
  data: T | undefined;
  /** treat this as "no data" and show the empty slot */
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  skeletonRows?: number;
  children: (data: T) => ReactNode;
}

/**
 * One place that renders the loading / error / empty / ready states for an
 * async read, so every screen handles them the same way. A 501 from a
 * not-yet-built endpoint gets a friendly explanation instead of a red error.
 */
export function AsyncSection<T>({
  loading,
  error,
  data,
  isEmpty,
  empty,
  skeletonRows = 5,
  children,
}: AsyncSectionProps<T>) {
  if (loading && data === undefined) return <SkeletonRows rows={skeletonRows} />;

  if (error) {
    if (error instanceof ApiError && error.isNotImplemented) {
      return (
        <EmptyState icon={<Icon.Clock size={20} />} title="Not available yet">
          This screen is wired to the API, but the backend endpoint is still being built
          (code phase). The layout and navigation are final.
        </EmptyState>
      );
    }
    const message =
      error instanceof ApiError ? error.message : 'Something went wrong loading this section.';
    return (
      <Notice tone="danger">
        <Icon.Alert size={16} />
        <span>{message}</span>
      </Notice>
    );
  }

  if (data === undefined) return null;
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;

  return <>{children(data)}</>;
}
