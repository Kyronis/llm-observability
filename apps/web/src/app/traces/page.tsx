import { Suspense } from 'react';
import TraceExplorerContent from './TraceExplorerContent';

export default function TracesPage() {
  return (
    <Suspense fallback={<div className="py-lg text-center text-on-surface-variant font-body-md">Loading...</div>}>
      <TraceExplorerContent />
    </Suspense>
  );
}
