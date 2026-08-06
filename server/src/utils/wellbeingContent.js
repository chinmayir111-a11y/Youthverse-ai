/**
 * SRS Module 11 - Productivity Tips and Digital Wellness Challenges.
 *
 * Both are curated constants rather than generated or user-submitted. Two
 * reasons: this is the one part of the app where bad advice does real harm, so
 * it should be reviewable in a diff; and it means the whole module still works
 * with no API key and no network, which matters most for the students least
 * able to rely on either.
 */

const TIPS = Object.freeze([
  {
    key: 'one-thing',
    tag: 'focus',
    title: 'Decide the one thing before you open anything',
    body: 'Pick the single task that would make today count, and write it down before you open a browser or a chat. A list of six is a way of deciding nothing.',
  },
  {
    key: 'start-badly',
    tag: 'starting',
    title: 'Give yourself permission to start badly',
    body: 'Most of the resistance is to starting well. Write the bad first paragraph, the ugly first function. It is far easier to fix something than to face a blank page.',
  },
  {
    key: 'two-minute',
    tag: 'starting',
    title: 'If it takes two minutes, do it now',
    body: 'Small undone things cost more in the space they take up in your head than in the time they take to do.',
  },
  {
    key: 'stop-mid-sentence',
    tag: 'focus',
    title: 'Stop while you still know the next step',
    body: 'Ending a session mid-thought rather than at a natural break makes the next one far easier to start — you pick up a thread instead of choosing one.',
  },
  {
    key: 'phone-another-room',
    tag: 'attention',
    title: 'Distance beats willpower',
    body: 'A phone in another room costs a decision to fetch it. A phone face-down on the desk costs nothing to check. Change the distance, not your resolve.',
  },
  {
    key: 'single-tab',
    tag: 'attention',
    title: 'Close the tabs you are "keeping for later"',
    body: 'Every open tab is an unfinished decision you re-make each time you scan the bar. Bookmark them and close them; you will reopen almost none.',
  },
  {
    key: 'sleep-first',
    tag: 'energy',
    title: 'Protect sleep before you optimise anything else',
    body: 'Nothing on a productivity list survives a run of five-hour nights. If one thing has to give this week, make it the last hour of scrolling rather than the first hour of sleep.',
  },
  {
    key: 'walk-it-out',
    tag: 'energy',
    title: 'Walk when you are stuck, not when you give up',
    body: 'Ten minutes of walking after an honest attempt at a hard problem is a legitimate part of solving it. The stuck feeling usually loosens somewhere in minute six.',
  },
  {
    key: 'done-list',
    tag: 'motivation',
    title: 'Keep a done list, not just a to-do list',
    body: 'On the days that felt like nothing happened, a done list is the only honest evidence. It is also the cure for the sense that you are permanently behind.',
  },
  {
    key: 'compare-yesterday',
    tag: 'motivation',
    title: 'Compare against your own last month',
    body: 'Comparing against a classmate measures their circumstances as much as your effort. Comparing against your own last month measures the only variable you control.',
  },
  {
    key: 'ask-earlier',
    tag: 'study',
    title: 'Set a timer before you ask for help',
    body: 'Twenty-five minutes of real attempt, then ask. It stops both failure modes: giving up in three minutes, and losing a day to pride.',
  },
  {
    key: 'test-yourself',
    tag: 'study',
    title: 'Testing beats re-reading, every time',
    body: 'Re-reading feels productive because it feels easy, which is exactly why it does not work. Close the notes and write down what you remember; the gaps are the study plan.',
  },
]);

/**
 * `days` is the length of the challenge, and `dailyPrompt` is what a person
 * ticks off each day. Every one of these is small, reversible, and framed as an
 * experiment rather than a rule — a challenge you fail on day two teaches you
 * to distrust the whole idea.
 */
const CHALLENGES = Object.freeze([
  {
    key: 'phone-free-morning',
    title: 'Phone-free first hour',
    days: 7,
    summary: 'Leave the phone alone for the first hour after you wake up.',
    why: 'The first hour sets what your attention expects for the rest of the day. Starting it on someone else’s feed makes a slow morning feel like your fault.',
    dailyPrompt: 'Did the first hour of today happen without your phone?',
  },
  {
    key: 'bedroom-charging',
    title: 'Charge it outside the bedroom',
    days: 7,
    summary: 'The phone charges in another room overnight.',
    why: 'This is the single change with the largest effect on sleep for most students, and it takes one evening to set up.',
    dailyPrompt: 'Did the phone spend last night outside the bedroom?',
  },
  {
    key: 'screen-free-meals',
    title: 'Screen-free meals',
    days: 5,
    summary: 'Eat one meal a day with no screen in front of you.',
    why: 'One meal a day where nothing is competing for your attention is a small, reliable break — and it is easier to keep than a full detox.',
    dailyPrompt: 'Did you eat at least one meal today with no screen?',
  },
  {
    key: 'notification-cull',
    title: 'One app a day, notifications off',
    days: 5,
    summary: 'Each day, turn off notifications for one more app.',
    why: 'Every notification is a decision someone else scheduled in your day. Five days of this removes most of them permanently.',
    dailyPrompt: 'Did you turn off notifications for one more app today?',
  },
  {
    key: 'one-screen-study',
    title: 'One screen while studying',
    days: 5,
    summary: 'While studying: one device, one window, phone elsewhere.',
    why: 'Switching costs are invisible and large. A single window is the cheapest concentration you will ever buy.',
    dailyPrompt: 'Did you keep to one screen during today’s study block?',
  },
  {
    key: 'offline-afternoon',
    title: 'One offline afternoon',
    days: 3,
    summary: 'Three afternoons with no feeds — messaging for real plans is fine.',
    why: 'Long enough to notice the reflex to check, short enough that nothing important is missed.',
    dailyPrompt: 'Did you get through this afternoon without opening a feed?',
  },
]);

const CHALLENGE_KEYS = CHALLENGES.map((c) => c.key);
const findChallenge = (key) => CHALLENGES.find((c) => c.key === key) ?? null;

module.exports = { TIPS, CHALLENGES, CHALLENGE_KEYS, findChallenge };
