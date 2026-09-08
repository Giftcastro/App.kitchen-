// Checks the 8-week cycle-menu rotation math in src/utils/deliveryHelpers.ts.
//
// The rotation is what decides which week of cycleMenu.json a customer is
// shown, so getting it wrong serves the wrong food on the wrong day — and it
// is pure date arithmetic with wrap-around and a manual-override shift, which
// is exactly the kind of thing that breaks silently. deliveryHelpers.ts has no
// imports of its own, so it compiles standalone and can be exercised directly.
//
//   node tools/verify-cycle-rotation.js
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP = path.join(__dirname, '..', 'Kitchen_APP');
const SRC = path.join(APP, 'src', 'utils', 'deliveryHelpers.ts');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-'));

// Shell form: npx resolves through a .cmd shim on Windows, which execFileSync
// cannot spawn directly.
execSync(
  ['npx tsc', JSON.stringify(SRC), '--outDir', JSON.stringify(OUT),
   '--module commonjs --target es2019 --skipLibCheck --ignoreConfig'].join(' '),
  { cwd: APP, stdio: 'inherit' }
);

const h = require(path.join(OUT, 'deliveryHelpers.js'));
const d = (s) => new Date(s + 'T00:00:00');

let failures = 0;
function eq(name, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`[cyc] ${ok ? 'PASS' : 'FAIL'} - ${name} (got ${got}, want ${want})`);
}

// CYCLE_ANCHOR_MONDAY is 2026-09-07. Every day of that week is Week 1.
eq('anchor Monday is Week 1', h.getCycleWeekForDate(d('2026-09-07')), 1);
eq('anchor Friday is Week 1', h.getCycleWeekForDate(d('2026-09-11')), 1);
eq('anchor Sunday is Week 1', h.getCycleWeekForDate(d('2026-09-13')), 1);

// It advances one week per calendar week with no admin action — the whole
// point of the change.
eq('one week on is Week 2', h.getCycleWeekForDate(d('2026-09-14')), 2);
eq('two weeks on is Week 3', h.getCycleWeekForDate(d('2026-09-21')), 3);
eq('seven weeks on is Week 8', h.getCycleWeekForDate(d('2026-10-26')), 8);

// ...and wraps back to the start after the eighth.
eq('eight weeks on wraps to Week 1', h.getCycleWeekForDate(d('2026-11-02')), 1);
eq('nine weeks on is Week 2', h.getCycleWeekForDate(d('2026-11-09')), 2);

// Dates before the anchor must stay in 1..8 rather than going negative.
eq('one week before is Week 8', h.getCycleWeekForDate(d('2026-08-31')), 8);
eq('nine weeks before is Week 8', h.getCycleWeekForDate(d('2026-07-06')), 8);

// A manual "this week is Week 3" override is stored as a shift, so it moves
// the whole rotation and future dates keep projecting correctly.
const off = h.getCycleOffsetForWeek(3, d('2026-09-07'));
eq('offset needed to reach Week 3', off, 2);
eq('override makes this week Week 3', h.getCycleWeekForDate(d('2026-09-07'), off), 3);
eq('override makes next week Week 4', h.getCycleWeekForDate(d('2026-09-14'), off), 4);
eq('override still wraps correctly', h.getCycleWeekForDate(d('2026-10-19'), off), 1);

// Choosing the week the calendar already gives means no shift is stored.
eq('re-picking the natural week stores no shift', h.getCycleOffsetForWeek(1, d('2026-09-07')), 0);

fs.rmSync(OUT, { recursive: true, force: true });

console.log(`\n[cyc] ${failures === 0 ? 'all checks passed' : failures + ' FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
