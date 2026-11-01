import { pruneCache, writeCache } from './offline-cache';
import {
  fetchDayStops,
  fetchDueList,
  fetchHorses,
  fetchHorseScreen,
  fetchUpcomingAppointments,
} from './queries';
import { addDays, startOfDay, toDateString } from './schedule';

/**
 * While there's signal, saves the next two days of visits and every horse
 * on them, so the farrier can open the route, the visit and the horse's
 * history at a barn with no signal. Keys match the ones the screens use
 * with useQuery, so each screen finds its saved copy.
 */

const DAYS_AHEAD = 2;
const EVERY_MS = 30 * 60 * 1000;
let lastRun = 0;
let running = false;

export async function warmOfflineCache(userId: string) {
  if (running || Date.now() - lastRun < EVERY_MS) return;
  running = true;
  try {
    const today = startOfDay(new Date());
    const until = addDays(today, DAYS_AHEAD + 1);

    const appointments = (await fetchUpcomingAppointments()).filter(
      (a) => a.provider_id === userId && new Date(a.scheduled_start) < until,
    );
    await Promise.all(appointments.map((a) => writeCache('appointment', a.id, a)));

    for (let i = 0; i <= DAYS_AHEAD; i++) {
      const day = addDays(today, i);
      writeCache('route', `${userId}:${toDateString(day)}`, await fetchDayStops(userId, day));
    }
    writeCache('due', userId, await fetchDueList(userId));
    writeCache('horses', '', await fetchHorses());

    const horseIds = [...new Set(appointments.flatMap((a) => a.appointment_horses.map((h) => h.horse_id)))];
    // A few at a time, so a long day doesn't flood a weak connection.
    for (let i = 0; i < horseIds.length; i += 3) {
      await Promise.all(
        horseIds.slice(i, i + 3).map(async (id) => {
          writeCache('horse', `${id}:${userId}`, await fetchHorseScreen(id, userId));
        }),
      );
    }

    lastRun = Date.now();
    await pruneCache(30);
  } catch {
    // No signal or a hiccup: the screens still work, just with less saved. Try again next time.
  } finally {
    running = false;
  }
}
