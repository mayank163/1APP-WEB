const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bookingIdSearch } = require('../src/utils/bookingIdSearch');
test('matches full, shortened and formatted admin IDs', () => {
  const id = '6aceb338f941f9d247dbf3ca';
  for (const input of [id, '47DBF3CA', 'JB-DBF3CA', '#47DBF3CA', ' BK-47DBF3CA ']) {
    const expression = bookingIdSearch(input).$expr.$regexMatch;
    assert.equal(new RegExp(expression.regex, expression.options).test(id), true);
    assert.equal(expression.input.$toString, '$_id');
  }
});
test('ordinary searches and regex characters are not treated as IDs', () => {
  for (const input of ['Harry', 'Home Theater Setup', '.*', '', '12345', 'a'.repeat(25)]) assert.equal(bookingIdSearch(input), null);
});
