import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tripsApi, claimLinesApi, type ClaimLineBody, type CreateTripBody } from '../../api/endpoints.js';
import type { TripDetail } from '../../api/types.js';

export function tripDetailKey(id: string) {
  return ['trip', id] as const;
}

export function useTripDetail(id: string) {
  return useQuery({
    queryKey: tripDetailKey(id),
    queryFn: () => tripsApi.get(id),
    enabled: Boolean(id),
  });
}

/**
 * Trip mutations. Each one refetches the canonical `GET /trips/:id` on success
 * (via invalidate) so the workspace always renders a complete TripDetail — never
 * a partial payload.
 */
export function useTripAction(id: string) {
  const qc = useQueryClient();
  const refetchDetail = () => qc.invalidateQueries({ queryKey: tripDetailKey(id) });
  const seed = (data: TripDetail) => {
    if (data && typeof data === 'object' && 'trip' in data) {
      qc.setQueryData(tripDetailKey(id), data);
    }
    void refetchDetail();
  };

  return {
    updateTrip: useMutation({
      mutationFn: (body: CreateTripBody) => tripsApi.update(id, body),
      onSuccess: (d) => {
        seed(d);
        qc.invalidateQueries({ queryKey: ['trips'] });
      },
    }),
    deleteTrip: useMutation({
      mutationFn: () => tripsApi.remove(id),
      onSuccess: () => {
        qc.removeQueries({ queryKey: tripDetailKey(id) });
        qc.invalidateQueries({ queryKey: ['trips'] });
      },
    }),
    ingest: useMutation({
      mutationFn: (files: File[]) => {
        const form = new FormData();
        files.forEach((f) => form.append('files', f, f.name));
        return tripsApi.ingest(id, form);
      },
      onSuccess: refetchDetail,
    }),
    removeDocument: useMutation({
      mutationFn: (docId: string) => tripsApi.removeDocument(id, docId),
      onSuccess: refetchDetail,
    }),
    removeLine: useMutation({
      mutationFn: (lineId: string) => claimLinesApi.remove(lineId),
      onSuccess: refetchDetail,
    }),
    addLine: useMutation({
      mutationFn: (body: ClaimLineBody) => tripsApi.addLine(id, body),
      onSuccess: refetchDetail,
    }),
    editLine: useMutation({
      mutationFn: ({ lineId, body }: { lineId: string; body: Partial<ClaimLineBody> }) =>
        claimLinesApi.update(lineId, body),
      onSuccess: refetchDetail,
    }),
    recompute: useMutation({
      mutationFn: () => tripsApi.recompute(id),
      onSuccess: seed,
    }),
    submit: useMutation({
      mutationFn: () => tripsApi.submit(id),
      onSuccess: (d) => {
        seed(d);
        qc.invalidateQueries({ queryKey: ['trips'] });
        qc.invalidateQueries({ queryKey: ['queue'] });
      },
    }),
  };
}
