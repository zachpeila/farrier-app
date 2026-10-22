import { DueList } from '@/components/due-list';
import { HorseList } from '@/components/horse-list';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { mode } = useAuth();
  return mode === 'farrier' ? <DueList /> : <HorseList />;
}
