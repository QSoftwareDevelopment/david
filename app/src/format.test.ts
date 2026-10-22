import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { campaignTiming, dateShort, fullName, initials, nights, prettyPhone, timeAgo } from './format';
import { addDays, isDate, localDate } from './dates';

describe('format', () => {
  test('names fall back to the phone number', () => {
    assert.equal(fullName({ firstName: 'Sam', lastName: 'Rivera', phone: '+14165550111' }), 'Sam Rivera');
    assert.equal(fullName({ firstName: null, lastName: null, phone: '+14165550111' }), '(416) 555-0111');
  });
  test('initials', () => {
    assert.equal(initials('Sam Rivera'), 'SR');
    assert.equal(initials('Cher'), 'C');
    assert.equal(initials(''), '?');
  });
  test('phones: North American numbers are prettied, others left alone', () => {
    assert.equal(prettyPhone('+14165550111'), '(416) 555-0111');
    assert.equal(prettyPhone('+447700900123'), '+447700900123');
  });
  test('time ago', () => {
    const now = new Date('2026-03-10T12:00:00Z');
    assert.equal(timeAgo('2026-03-10T11:59:50Z', now), 'just now');
    assert.equal(timeAgo('2026-03-10T11:30:00Z', now), '30 min ago');
    assert.equal(timeAgo('2026-03-10T09:00:00Z', now), '3 h ago');
    assert.equal(timeAgo('2026-03-09T11:00:00Z', now), 'yesterday');
    assert.equal(timeAgo('2026-03-05T12:00:00Z', now), '5 days ago');
  });
  test('dates and nights', () => {
    assert.match(dateShort('2026-03-13'), /Fri/);
    assert.equal(nights('2026-03-13', '2026-03-16'), 3);
  });
  test('campaign timing in words', () => {
    assert.equal(campaignTiming('pre_arrival', -3, 10), '3 days before arrival, 10:00 am');
    assert.equal(campaignTiming('arrival_day', 0, 11), 'Day of arrival, 11:00 am');
    assert.equal(campaignTiming('post_stay', 1, 17), '1 day after departure, 5:00 pm');
    assert.equal(campaignTiming('mid_stay', 1, 12), '1 day after arrival, 12:00 pm');
  });
});

describe('dates', () => {
  test('local date follows the zone', () => {
    assert.equal(localDate(new Date('2026-03-10T03:30:00Z'), 'America/Toronto'), '2026-03-09');
    assert.equal(localDate(new Date('2026-03-10T03:30:00Z'), 'Asia/Kolkata'), '2026-03-10');
  });
  test('addDays and isDate', () => {
    assert.equal(addDays('2026-02-27', 3), '2026-03-02');
    assert.equal(isDate('2026-03-10'), true);
    assert.equal(isDate('2026-3-10'), false);
    assert.equal(isDate('nope'), false);
  });
});
