import { useAuth } from './state/auth';
import { SettingsProvider } from './state/settings';
import { AuthScreen } from './views/AuthScreen';
import { Shell } from './components/Shell';
import { IslandMark } from './components/Logo';

export function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: 'var(--surface)' }}>
        <div className="animate-pulse">
          <IslandMark size={56} />
        </div>
      </div>
    );
  }

  if (status === 'anon') return <AuthScreen />;

  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}
