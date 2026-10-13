import { FAMILIES } from '../../cards/types';
import { REMINDER_SENTENCE, isNativeApp, parseTime } from '../../reminder/reminder';
import { projectedReviewsPerDay, totalNewPerDay, warningAboveTwenty, type Settings } from '../../settings/load';
import { loadCards } from '../../session/deck';
import { getReminder, getSettings, listSkipped, saveReminder, saveSettings, unskipCard } from '../../store/db';
import { exportFileName, exportText, importSummary, importText } from '../../store/file';
import { FAMILY_LABEL, type Nav } from '../app';
import { button, el, heading, panel, stat, stepper, textField, toggle } from '../kit';

export const WARNING_TEXT =
  'Above twenty new cards a day the review pile grows to about two hundred a day. It is allowed; it is a lot.';

/** Per-family switches and daily new cards, the load they add up to, then export and import. */
export async function settingsScreen(nav: Nav): Promise<HTMLElement> {
  const settings = await getSettings();

  const totals = el('dl', { class: 'gv-stats gv-stats--summary' });
  const warning = el('p', { class: 'gv-warning' });
  const load = el('div', { class: 'gv-load', attrs: { role: 'status' } }, [totals, warning]);
  const showLoad = () => {
    totals.replaceChildren(stat('New per day', totalNewPerDay(settings)), stat('Reviews per day', `about ${projectedReviewsPerDay(settings)}`));
    warning.textContent = warningAboveTwenty(settings) ? WARNING_TEXT : '';
  };
  const change = () => {
    showLoad();
    void saveSettings(settings);
  };

  const families = el('div', { class: 'gv-stack gv-settings' });
  const showFamilies = (current: Settings) => {
    families.replaceChildren(
      ...FAMILIES.map((family) =>
        el('div', { class: 'gv-family', attrs: { role: 'group', 'aria-label': FAMILY_LABEL[family] } }, [
          toggle(FAMILY_LABEL[family], current.families[family].enabled, (on) => {
            current.families[family].enabled = on;
            change();
          }),
          stepper('New cards per day', current.families[family].newPerDay, {
            min: 0,
            max: 50,
            onChange: (value) => {
              current.families[family].newPerDay = value;
              change();
            },
          }),
        ]),
      ),
    );
  };
  showFamilies(settings);
  showLoad();

  const skipped = el('div', { class: 'gv-stack' });
  const skippedHeading = heading('Skipped cards');
  skippedHeading.tabIndex = -1;
  const showSkipped = async () =>
    skipped.replaceChildren(
      ...(await skippedList(async () => {
        await showSkipped();
        // The Undo button is gone; keep keyboard focus in this section.
        (skipped.querySelector<HTMLElement>('button') ?? skippedHeading).focus();
      })),
    );
  await showSkipped();

  const data = dataSection(async () => {
    Object.assign(settings, await getSettings());
    showFamilies(settings);
    showLoad();
    await showSkipped();
  });

  // The Android package only; the web version has no way to wake the phone (decision 25).
  const reminder = isNativeApp() ? await reminderSection() : null;

  return el('div', { class: 'gv-screen' }, [
    panel([heading('Settings'), families, load], { class: 'gv-stack' }),
    reminder,
    panel([skippedHeading, skipped], { class: 'gv-stack gv-skipped' }),
    data,
    el('nav', { class: 'gv-links', attrs: { 'aria-label': 'Back' } }, [button('Back', { variant: 'secondary', onClick: () => nav.start() })]),
  ]);
}

/**
 * The daily reminder (decisions 25, 27): on/off, a time (default 20:00) and Exact time, which opens
 * Android's exact-alarm setting and shows what Android allows. Turning it on asks for the
 * notification permission when Android has not asked yet.
 */
async function reminderSection(): Promise<HTMLElement> {
  const native = await import('../../reminder/native');
  const reminder = await getReminder();
  const result = el('p', { class: 'gv-result', attrs: { role: 'status' } });
  const apply = async () => {
    await saveReminder(reminder);
    try {
      await native.applyReminder(reminder);
    } catch (error) {
      result.textContent = `The reminder could not be set. ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  const onSwitch = toggle('Daily reminder', reminder.on, async (on) => {
    if (on && (await native.askNotificationPermission()) === 'denied') {
      onSwitch.setAttribute('aria-checked', 'false');
      result.textContent = 'Notifications are off for this app. Turn them on in the phone’s Settings, under Apps › Godot Vocabulary › Notifications, then try again.';
      return;
    }
    reminder.on = on;
    result.textContent = on ? `Reminder on, every day at about ${reminder.time}.` : 'Reminder off.';
    await apply();
  });

  const time = textField({ label: 'Time', value: reminder.time, time: true });
  time.input.addEventListener('change', async () => {
    if (!parseTime(time.input.value)) {
      time.input.value = reminder.time;
      return;
    }
    reminder.time = time.input.value;
    if (reminder.on) result.textContent = `Reminder on, every day at about ${reminder.time}.`;
    await apply();
  });

  const exact = toggle('Exact time', await native.exactAllowed(), async () => {
    // Android decides: show what it allows once the learner comes back from its setting.
    exact.setAttribute('aria-checked', String(await native.openExactSetting()));
    await apply();
  });
  exact.setAttribute('aria-describedby', 'reminder-help');

  return panel(
    [heading('Reminder'), onSwitch, time.root, el('p', { class: 'gv-note', text: REMINDER_SENTENCE, attrs: { id: 'reminder-help' } }), exact, result],
    { class: 'gv-stack' },
  );
}

/** Cards skipped from a card screen (decision 26), oldest first, each with Undo. */
async function skippedList(afterUndo: () => Promise<void>): Promise<HTMLElement[]> {
  const [list, cards] = await Promise.all([listSkipped(), loadCards()]);
  if (list.length === 0) return [el('p', { class: 'gv-note', text: 'No skipped cards. “Skip this card” on a card puts it here.' })];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const items = list.map((s) => {
    const card = byId.get(s.cardId);
    const title = card?.answer ?? s.cardId;
    const undo = button('Undo', {
      variant: 'secondary',
      ariaLabel: `Undo skip: ${title}`,
      onClick: async () => {
        undo.disabled = true;
        await unskipCard(s.cardId);
        await afterUndo();
      },
    });
    return el('li', { class: 'gv-custom gv-skipped__item' }, [
      el('div', { class: 'gv-skipped__text' }, [
        el('p', { class: 'gv-custom__answer', text: title }),
        el('p', { class: 'gv-note', text: `${card ? FAMILY_LABEL[card.family] : 'Unknown card'} · skipped ${s.at.toLocaleDateString()}` }),
        el('p', { class: 'gv-skipped__reason', text: s.reason ? `“${s.reason}”` : 'No reason given.' }),
      ]),
      undo,
    ]);
  });
  return [
    el('p', { class: 'gv-note', text: 'These cards are left out of every session. Undo puts one back.' }),
    el('ul', { class: 'gv-custom-list', attrs: { 'aria-label': 'Skipped cards' } }, items),
  ];
}

/** Export as one JSON file; import from one, merging or replacing. */
function dataSection(afterImport: () => Promise<void>): HTMLElement {
  const result = el('p', { class: 'gv-result', attrs: { role: 'status' } });
  const say = (text: string, kind: 'note' | 'error' = 'note') => {
    result.textContent = text;
    result.classList.toggle('gv-error', kind === 'error');
  };

  const exportButton = button('Export', {
    variant: 'secondary',
    describedBy: 'export-help',
    onClick: async () => {
      const now = new Date();
      const url = URL.createObjectURL(new Blob([await exportText(now)], { type: 'application/json' }));
      const link = el('a', { attrs: { href: url, download: exportFileName(now) } });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(`Saved ${exportFileName(now)}.`);
    },
  });

  // The native file picker, opened by the Import button; hidden because the button names it.
  const picker = el('input', { attrs: { type: 'file', accept: '.json,application/json', hidden: '' } });
  const choice = el('div', { class: 'gv-stack', attrs: { hidden: '' } });
  let text = '';

  const run = async (mode: 'merge' | 'replace') => {
    choice.hidden = true;
    try {
      say(importSummary(await importText(text, mode)));
      await afterImport();
    } catch (error) {
      say(`Nothing was imported. ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
    importButton.focus();
  };

  const option = (label: string, help: string, mode: 'merge' | 'replace') => {
    const id = `import-${mode}-help`;
    return el('div', { class: 'gv-option' }, [
      button(label, { variant: 'secondary', describedBy: id, onClick: () => void run(mode) }),
      el('p', { class: 'gv-note', text: help, attrs: { id } }),
    ]);
  };
  const cancel = button('Cancel', {
    variant: 'flat',
    onClick: () => {
      choice.hidden = true;
      importButton.focus();
    },
  });
  choice.append(
    el('p', { class: 'gv-label', attrs: { id: 'import-file' } }),
    option('Merge with this device', 'Keeps your settings here. Adds the file’s custom cards. For each card, keeps whichever progress was reviewed last.', 'merge'),
    option('Replace everything on this device', 'Deletes the progress and custom cards on this device, then restores the file’s progress, settings and custom cards.', 'replace'),
    cancel,
  );

  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    text = await file.text();
    say('');
    choice.querySelector('#import-file')!.textContent = `${file.name}: how should it be imported?`;
    choice.hidden = false;
    choice.querySelector<HTMLButtonElement>('button')?.focus();
  });

  const importButton = button('Import', { variant: 'secondary', describedBy: 'import-help', onClick: () => picker.click() });

  return panel(
    [
      heading('Data'),
      el('div', { class: 'gv-option' }, [
        exportButton,
        el('p', { class: 'gv-note', text: 'Saves your progress, settings, custom cards and skipped cards as one JSON file in Downloads.', attrs: { id: 'export-help' } }),
      ]),
      el('div', { class: 'gv-option' }, [
        importButton,
        el('p', { class: 'gv-note', text: 'Restores from a file saved with Export.', attrs: { id: 'import-help' } }),
        result,
      ]),
      picker,
      choice,
    ],
    { class: 'gv-stack' },
  );
}
