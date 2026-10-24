import test from 'node:test';
import assert from 'node:assert/strict';

const ROLES = new Set(['Admin', 'Teacher', 'Student', 'Parent']);

function hasRole(role, allowed) {
  return typeof role === 'string' && ROLES.has(role) && allowed.includes(role);
}

test('role policy accepts only exact application roles', () => {
  assert.equal(hasRole('Admin', ['Admin']), true);
  assert.equal(hasRole('Teacher', ['Teacher']), true);
  assert.equal(hasRole('Student', ['Teacher']), false);
  assert.equal(hasRole('Parent', ['Admin']), false);
  assert.equal(hasRole(undefined, ['Admin']), false);
  assert.equal(hasRole('Owner', ['Admin']), false);
});
