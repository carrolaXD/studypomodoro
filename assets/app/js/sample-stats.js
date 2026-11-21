// The synthetic sample prepared for the V11 trailer, independent of the timer clock.
(() => {
  const days = {};
  const dailyMinutes = [50, 75, 100, 75, 125, 100, 150];

  for (let day = 0; day < 75; day++) {
    const date = new Date(Date.UTC(2026, 8, 1 + day));
    const minutes = date.getUTCDay() === 0 ? 0 : dailyMinutes[day % dailyMinutes.length];
    days[date.toISOString().slice(0, 10)] = { minutes };
  }
  days['2026-11-15'] = { minutes: 75 };

  window.App.sampleStats = {
    date: '2026-11-15',
    firstUse: '2026-09-01',
    days,
    totalMinutes: Object.values(days).reduce((total, day) => total + day.minutes, 0)
  };
})();
