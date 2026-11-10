import {
  getNowInSAST,
  formatDateISO,
  parseDateISO,
  calculateCutoffDate,
  generateWeekdayOptions,
  generate14WeekdayOptions,
  groupWeekdaysByWeek,
} from '../sastTime';

describe('sastTime utilities', () => {
  describe('getNowInSAST', () => {
    it('returns a valid Date object', () => {
      const now = getNowInSAST();
      expect(now).toBeInstanceOf(Date);
      expect(isNaN(now.getTime())).toBe(false);
    });
  });

  describe('formatDateISO & parseDateISO', () => {
    it('formats date to YYYY-MM-DD correctly', () => {
      const d = new Date(2026, 8, 5); // Sep 5, 2026
      expect(formatDateISO(d)).toBe('2026-09-05');
    });

    it('parses YYYY-MM-DD string into a valid Date object', () => {
      const parsed = parseDateISO('2026-09-05');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(8); // 0-indexed September
      expect(parsed.getDate()).toBe(5);
    });
  });

  describe('calculateCutoffDate', () => {
    it('calculates 2 business days prior at 9:00 AM for Wednesday delivery (Monday 9 AM)', () => {
      // Wednesday Sep 9, 2026
      const wednesday = new Date(2026, 8, 9, 12, 0, 0);
      const cutoff = calculateCutoffDate(wednesday);

      expect(cutoff.getDay()).toBe(1); // Monday
      expect(cutoff.getDate()).toBe(7);
      expect(cutoff.getHours()).toBe(9);
      expect(cutoff.getMinutes()).toBe(0);
    });

    it('skips weekends for Monday delivery cutoff (Thursday 9 AM)', () => {
      // Monday Sep 7, 2026
      const monday = new Date(2026, 8, 7, 12, 0, 0);
      const cutoff = calculateCutoffDate(monday);

      expect(cutoff.getDay()).toBe(4); // Thursday
      expect(cutoff.getDate()).toBe(3);
      expect(cutoff.getHours()).toBe(9);
    });

    it('skips weekends for Tuesday delivery cutoff (Friday 9 AM)', () => {
      // Tuesday Sep 8, 2026
      const tuesday = new Date(2026, 8, 8, 12, 0, 0);
      const cutoff = calculateCutoffDate(tuesday);

      expect(cutoff.getDay()).toBe(5); // Friday
      expect(cutoff.getDate()).toBe(4);
      expect(cutoff.getHours()).toBe(9);
    });
  });

  describe('generateWeekdayOptions', () => {
    it('generates next 5 weekdays excluding weekends', () => {
      // Friday Sep 4, 2026 at 8:00 AM
      const reference = new Date(2026, 8, 4, 8, 0, 0);
      const options = generateWeekdayOptions(reference, 5);

      expect(options.length).toBe(5);
      // None of the options should be Saturday (6) or Sunday (0)
      options.forEach(opt => {
        expect(opt.dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const d = parseDateISO(opt.dateString);
        expect(d.getDay()).not.toBe(0);
        expect(d.getDay()).not.toBe(6);
        expect(opt.cutoffDeadlineFormatted).toContain('9:00 AM SAST');
      });
    });

    it('generates next 10 weekdays by default (2 weeks max) excluding weekends', () => {
      // Friday Sep 4, 2026 at 8:00 AM
      const reference = new Date(2026, 8, 4, 8, 0, 0);
      const options = generateWeekdayOptions(reference);

      expect(options.length).toBe(10);
      options.forEach(opt => {
        expect(opt.dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const d = parseDateISO(opt.dateString);
        expect(d.getDay()).not.toBe(0);
        expect(d.getDay()).not.toBe(6);
      });
    });

    it('provides backward compatible alias generate14WeekdayOptions', () => {
      expect(generate14WeekdayOptions).toBe(generateWeekdayOptions);
    });
  });

  describe('groupWeekdaysByWeek', () => {
    it('groups orderable weekdays correctly on Thursday 10 Sep after 9 AM cutoff', () => {
      // Thursday Sep 10, 2026 at 10:00 AM SAST
      const reference = new Date(2026, 8, 10, 10, 0, 0);
      const allDays = generateWeekdayOptions(reference, 14);

      // Verify Friday 11 and Monday 14 are locked
      const fri11 = allDays.find(d => d.dateString === '2026-09-11');
      const mon14 = allDays.find(d => d.dateString === '2026-09-14');
      expect(fri11?.isLocked).toBe(true);
      expect(mon14?.isLocked).toBe(true);

      const availableDays = allDays.filter(d => d.isAvailable && !d.isLocked);
      expect(availableDays.some(d => d.dateString === '2026-09-11')).toBe(false);
      expect(availableDays.some(d => d.dateString === '2026-09-14')).toBe(false);

      const groups = groupWeekdaysByWeek(availableDays, reference, 2);

      // Group 1: NEXT WEEK -> Tue 15, Wed 16, Thu 17, Fri 18 (4 days)
      expect(groups.length).toBe(2);
      expect(groups[0].label).toBe('NEXT WEEK');
      expect(groups[0].days.map(d => d.dateString)).toEqual([
        '2026-09-15',
        '2026-09-16',
        '2026-09-17',
        '2026-09-18',
      ]);

      // Group 2: IN 2 WEEKS -> Mon 21, Tue 22, Wed 23, Fri 25 (Thu 24 is SA Heritage Day holiday)
      expect(groups[1].label).toBe('IN 2 WEEKS');
      expect(groups[1].days.map(d => d.dateString)).toEqual([
        '2026-09-21',
        '2026-09-22',
        '2026-09-23',
        '2026-09-25',
      ]);
    });
  });
});
