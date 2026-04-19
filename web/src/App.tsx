import { useState } from 'react';
import { StoreProvider } from './hooks/useStore';
import { Workspace } from './components/Workspace';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <StoreProvider>
      <Workspace openSettings={() => setShowSettings(true)} />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </StoreProvider>
  );
}
