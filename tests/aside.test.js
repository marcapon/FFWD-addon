// Labels van de studenten in de assessment-aside (assessment-aside.js).
// Draaien: node --test (vanuit de map ffwd-addon)

const test = require('node:test');
const assert = require('node:assert/strict');
const { labelVoor } = require('../extensie/assessment-aside.js');

test('label: de naam als ffwd die kent', () => {
  assert.equal(labelVoor({ name: 'Daan Jansen', studentId: '5000102' }, 0), 'Daan Jansen');
});

test('label: naam onbekend, dan het studentnummer', () => {
  assert.equal(labelVoor({ name: 'Onbekend', studentId: '5000199' }, 0), 'Student 5000199');
  assert.equal(labelVoor({ name: '', studentId: '5000199' }, 2), 'Student 5000199');
});

test('label: naam en nummer onbekend, dan de plek in ffwd', () => {
  assert.equal(labelVoor({ name: 'Onbekend', studentId: null }, 0), 'Student 1');
  assert.equal(labelVoor({ name: 'Onbekend', studentId: null }, 2), 'Student 3');
  assert.equal(labelVoor(null, 1), 'Student 2');
});
