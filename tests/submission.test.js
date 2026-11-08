import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {FORM_URL, FIELD_IDS, buildCodeReport, buildPayload} from '../submission.js';

const sample = {
  name: '  Ada Student  ', studentId: '  001234  ', className: '  101A  ',
  email: '  ada@example.com  ', problemId: '  8542  ',
  code: '\t#include <iostream>\r\nint main() {\r\n  std::cout << "<script> & 中文";\r\n}\r\n',
  language: '', issue: '', context: '',
};
const expectedIds = {
  name: 'entry.1679946789', studentId: 'entry.1770002306', className: 'entry.260883238',
  email: 'entry.1376076637', problemId: 'entry.713144818', code: 'entry.329652226',
};

test('payload keeps the original six Google Form entry mappings and destination', () => {
  assert.deepEqual(FIELD_IDS, expectedIds);
  assert.equal(FORM_URL, 'https://docs.google.com/forms/d/e/1FAIpQLSc-zySIcvKUak4uienMrc5xT09eYZ7OWTo8YUaXvr0ctuU-PQ/formResponse');
  const result = buildPayload(sample);
  assert.deepEqual(Object.keys(result).sort(), [...Object.values(expectedIds), 'fvv', 'pageHistory'].sort());
  assert.equal(result[expectedIds.name], 'Ada Student');
  assert.equal(result[expectedIds.studentId], '001234');
  assert.equal(result[expectedIds.className], '101A');
  assert.equal(result[expectedIds.email], 'ada@example.com');
  assert.equal(result[expectedIds.problemId], '8542');
  assert.equal(result[expectedIds.code], sample.code);
});

test('plain source is unchanged, including indentation, CRLF, Unicode and trailing newline', () => {
  assert.equal(buildCodeReport(sample), sample.code);
  assert.equal(buildCodeReport({...sample, context: '\n  \t'}), sample.code);
});

test('optional debugging context is labeled and source code remains an exact suffix', () => {
  const result = buildCodeReport({...sample, language:'C++', issue:'Wrong answer', context:'  Expected 4\nActual 3  '});
  assert.equal(result, `Language: C++\n\nIssue: Wrong answer\n\nDebugging context:\nExpected 4\nActual 3\n\n--- Source code ---\n${sample.code}`);
  assert.ok(result.endsWith(sample.code));
});

test('script-like input stays literal in serialized form values', () => {
  const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const result = buildPayload({...sample, name: hostile, code: hostile, context: hostile});
  assert.equal(result[expectedIds.name], hostile);
  assert.ok(result[expectedIds.code].includes(`Debugging context:\n${hostile}`));
  assert.ok(result[expectedIds.code].endsWith(hostile));
});

test('HTML fields use the verified original names, accessible labels and error descriptions', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const ids = {name:'student-name', studentId:'student-id', className:'class-name', email:'email', problemId:'problem-id', code:'code'};
  for (const [key, id] of Object.entries(ids)) {
    const control = html.match(new RegExp(`<(?:input|textarea)\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
    assert.ok(control, `${id} control exists`);
    assert.ok(control.includes(`name="${expectedIds[key]}"`), `${id} maps to the original form`);
    assert.match(control, /\brequired\b/);
    assert.ok(control.includes(`${id}-error`));
    assert.ok(html.includes(`for="${id}"`));
    assert.ok(html.includes(`id="${id}-error"`));
  }
  assert.ok(html.includes('type="email"'));
  assert.ok(html.includes('<noscript>'));
  assert.ok(html.includes('Source code preview'));
});

function createHarness() {
  const elements = new Map();
  const submitted = [];
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, value:'', textContent:'', hidden:false, disabled:false, maxLength:-1,
      validity:{valid:true, typeMismatch:false}, attributes:{}, events:{}, children:[],
      style:{}, scrollTop:0, dataset:{},
      addEventListener(type, callback) {this.events[type] = callback;},
      setAttribute(name, value) {this.attributes[name] = value;},
      getAttribute(name) {return this.attributes[name] ?? null;},
      removeAttribute(name) {delete this.attributes[name];},
      focus() {this.focused = true;}, scrollIntoView() {},
      querySelector() {return element(`${id}-child`);},
      classList:{toggle() {}}, append(child) {this.children.push(child);},
      submit() {submitted.push(this);},
      set innerHTML(value) {throw new Error(`Unsafe HTML insertion into ${id}: ${value}`);},
    });
    return elements.get(id);
  }
  const panels = [0,1,2].map(i => element(`panel-${i}`));
  const indicators = [0,1,2].map(i => element(`indicator-${i}`));
  let serial = 0;
  const document = {
    getElementById: element,
    querySelectorAll(selector) {
      if (selector === '.form-step') return panels;
      if (selector === '.stepper li') return indicators;
      if (selector === '[data-edit]') return [];
      throw new Error(`Unexpected selector ${selector}`);
    },
    createElement(tag) {return element(`generated-${tag}-${serial++}`);},
    body:{append() {}},
  };
  return {elements, element, submitted, document, window:{addEventListener() {}}};
}

async function loadApp(harness) {
  const source = (await readFile(new URL('../app.js', import.meta.url), 'utf8'))
    .replace(/^import[^\n]+\n/, '');
  vm.runInNewContext(source, {document:harness.document, window:harness.window, FORM_URL, buildCodeReport, buildPayload, setTimeout}, {filename:'app.js'});
}
function setValidValues(harness, data = sample) {
  const ids = {name:'student-name', studentId:'student-id', className:'class-name', email:'email', problemId:'problem-id', code:'code', language:'language', issue:'issue', context:'context'};
  for (const [key,id] of Object.entries(ids)) harness.element(id).value = data[key];
}
function submit(harness) {
  let prevented = false;
  harness.element('help-form').events.submit({preventDefault() {prevented = true;}});
  assert.ok(prevented);
}

test('guided form prevents missing identity or code before reaching submission', async () => {
  const h = createHarness();
  await loadApp(h);
  submit(h);
  assert.equal(h.element('student-name').getAttribute('aria-invalid'), 'true');
  assert.ok(h.element('student-name').focused);
  assert.equal(h.submitted.length, 0);
  setValidValues(h);
  h.element('code').value = '   ';
  submit(h);
  submit(h);
  assert.equal(h.element('code').getAttribute('aria-invalid'), 'true');
  assert.equal(h.submitted.length, 0);
});

test('review renders hostile input as text and sends a native POST only on the final step', async () => {
  const hostile = '<img src=x onerror="alert(1)">';
  const h = createHarness();
  await loadApp(h);
  setValidValues(h, {...sample, name:hostile, code:hostile, context:hostile});
  submit(h);
  assert.equal(h.submitted.length, 0);
  submit(h);
  assert.equal(h.submitted.length, 0);
  assert.equal(h.element('review-name').textContent, hostile);
  assert.equal(h.element('review-code').textContent, hostile);
  assert.equal(h.element('review-context').textContent, hostile);
  submit(h);
  assert.equal(h.submitted.length, 1);
  const posted = h.submitted[0];
  assert.equal(posted.method, 'POST');
  assert.equal(posted.action, FORM_URL);
  assert.equal(posted.target, '_self');
  const fields = Object.fromEntries(posted.children.map(input => [input.name,input.value]));
  assert.equal(fields[expectedIds.name], hostile);
  assert.ok(fields[expectedIds.code].endsWith(hostile));
  submit(h);
  assert.equal(h.submitted.length, 1, 'duplicate sends are blocked');
});

test('invalid contact email is stopped before the code step', async () => {
  const h = createHarness();
  await loadApp(h);
  setValidValues(h);
  h.element('email').value = 'not-an-email';
  h.element('email').validity = {valid:false, typeMismatch:true};
  submit(h);
  assert.equal(h.element('email').getAttribute('aria-invalid'), 'true');
  assert.ok(h.element('email').focused);
  assert.equal(h.element('panel-0').hidden, false);
  assert.equal(h.submitted.length, 0);
});

test('final send rechecks identity values and rejects an oversized code report', async () => {
  const h = createHarness();
  await loadApp(h);
  setValidValues(h);
  submit(h);
  submit(h);
  h.element('student-name').value = '  ';
  submit(h);
  assert.equal(h.element('panel-0').hidden, false);
  assert.equal(h.submitted.length, 0);
  h.element('student-name').value = sample.name;
  submit(h);
  h.element('code').value = 'x'.repeat(49001);
  submit(h);
  assert.equal(h.element('code').getAttribute('aria-invalid'), 'true');
  assert.equal(h.submitted.length, 0);
});
