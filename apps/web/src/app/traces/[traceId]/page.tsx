import { Suspense } from 'react';
import TraceDetailContent from './TraceDetailContent';

export default function TraceDetailPage() {
  return (
    <Suspense fallback={<div className="py-lg text-center text-on-surface-variant font-body-md">Loading...</div>}>
      <TraceDetailContent />
    </Suspense>
  );
}
