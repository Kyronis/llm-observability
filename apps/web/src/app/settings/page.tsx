import { Suspense } from 'react';
import SettingsContent from './SettingsContent';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="py-lg text-center text-on-surface-variant font-body-md">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
