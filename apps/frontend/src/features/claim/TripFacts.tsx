import type { ReactNode } from 'react';
import type { TripDetail } from '../../api/types.js';
import { DescriptionList } from '../../ui/primitives.js';
import { Money } from '../../ui/domain.js';
import { shortDate } from '../../lib/format.js';

/** The trip's request-side facts (Travel Request + advance). */
export function TripFacts({ trip }: { trip: TripDetail['trip'] }) {
  const items: Array<[ReactNode, ReactNode]> = [
    ['Travel request', <span className="u-mono">{trip.travelRequestId}</span>],
    ['Purpose', trip.purpose ?? '—'],
    ['Route', [trip.originCity, trip.destCity].filter(Boolean).join(' → ') || '—'],
    ['City class', trip.destTier ?? '—'],
    ['Dates', `${shortDate(trip.startDate)} – ${shortDate(trip.endDate)}`],
    ['Estimated cost', trip.estimatedCost != null ? <Money value={trip.estimatedCost} /> : '—'],
    [
      'Advance requested',
      trip.advanceRequested != null ? <Money value={trip.advanceRequested} /> : '—',
    ],
    ['Advance drawn', <Money value={trip.advanceAmount} />],
    ['Advance ref', trip.advanceRef ? <span className="u-mono">{trip.advanceRef}</span> : '—'],
  ];
  return <DescriptionList items={items} />;
}
