// Fixed synthetic focus minutes, in calendar order from 1 September to 15 November.
(() => {
  const weeklyMinutes = [
    [35, 0, 65, 20, 105, 40], // The snapshot starts on a Tuesday.
    [70, 125, 45, 90, 80, 0, 55],
    [0, 50, 25, 0, 110, 45, 0],
    [115, 155, 85, 180, 95, 130, 35],
    [45, 70, 120, 20, 160, 65, 0],
    [80, 25, 0, 40, 90, 0, 50],
    [120, 75, 55, 95, 145, 50, 75],
    [25, 95, 65, 0, 85, 105, 20],
    [30, 40, 20, 125, 55, 0, 25],
    [65, 130, 100, 0, 45, 145, 0],
    [90, 35, 140, 70, 0, 115, 75]
  ];

  const days = Object.fromEntries(weeklyMinutes.flat().map((minutes, index) => {
    const date = new Date(Date.UTC(2026, 8, 1 + index));
    return [date.toISOString().slice(0, 10), { minutes }];
  }));

  window.App.sampleStats = {
    date: '2026-11-15',
    firstUse: '2026-09-01',
    days,
    totalMinutes: Object.values(days).reduce((total, day) => total + day.minutes, 0)
  };
})();
