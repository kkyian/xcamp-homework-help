import {FORM_URL, buildCodeReport, buildPayload} from './submission.js';

const $ = id => document.getElementById(id);
const form = $('help-form');
const steps = [...document.querySelectorAll('.form-step')];
const indicators = [...document.querySelectorAll('.stepper li')];
const stepNames = ['Your details', 'Your code', 'Review & send'];
const buttonLabels = ['Continue to your code', 'Review your request', 'Send to the TA team'];
const requiredFields = [['student-name', 'student-id', 'class-name', 'email'], ['problem-id', 'code']];
let step = 0;
let sending = false;
form.hidden = false;

function values() {
  return {name: $('student-name').value, studentId: $('student-id').value, className: $('class-name').value,
    email: $('email').value, problemId: $('problem-id').value, code: $('code').value,
    language: $('language').value, issue: $('issue').value, context: $('context').value};
}
function fieldError(id, message) {
  $(id).setAttribute('aria-invalid', String(Boolean(message)));
  $(`${id}-error`).textContent = message;
}
function validate(stepNumber) {
  let firstError;
  for (const id of requiredFields[stepNumber] || []) {
    const field = $(id);
    let error = '';
    if (!field.value.trim()) error = id === 'code' ? 'Paste your complete source code or load a file.' : `Enter your ${({'student-name':'name', 'student-id':'student ID', 'class-name':'class', email:'contact email', 'problem-id':'problem ID'})[id]}.`;
    else if (id === 'email' && field.validity.typeMismatch) error = 'Enter a valid email address, such as you@example.com.';
    else if (field.maxLength > 0 && field.value.length > field.maxLength) error = `Keep this under ${field.maxLength.toLocaleString()} characters.`;
    fieldError(id, error);
    if (error && !firstError) firstError = field;
  }
  if (stepNumber === 1 && buildCodeReport(values()).length > 49000) {
    fieldError('code', 'The code and context together are too long. Shorten them to under 49,000 characters.');
    firstError ||= $('code');
  }
  if (firstError) {
    $('error-summary').textContent = 'A few details need your attention. Check the highlighted fields below.';
    $('error-summary').hidden = false;
    firstError.focus();
    return false;
  }
  $('error-summary').hidden = true;
  return true;
}
function showStep(nextStep, focus = true) {
  step = nextStep;
  steps.forEach((panel, i) => {panel.hidden = i !== step;});
  indicators.forEach((indicator, i) => {
    if (i === step) indicator.setAttribute('aria-current', 'step');
    else indicator.removeAttribute('aria-current');
    indicator.classList.toggle('is-complete', i < step);
    indicator.querySelector('.step-number').textContent = i < step ? '✓' : i + 1;
  });
  $('progress-fill').style.width = `${(step + 1) / 3 * 100}%`;
  $('back').hidden = step === 0;
  $('required-note').hidden = step !== 0;
  $('next-label').textContent = buttonLabels[step];
  $('step-caption').textContent = `Step ${step + 1} of 3 · ${stepNames[step]}`;
  $('error-summary').hidden = true;
  if (step === 2) populateReview();
  if (focus) {
    const heading = steps[step].querySelector('h3');
    heading.tabIndex = -1;
    heading.focus({preventScroll:true});
    $('request').scrollIntoView({behavior:'instant', block:'start'});
  }
}
function populateReview() {
  const data = values();
  for (const [id, value] of Object.entries({'review-name': data.name.trim(), 'review-id':data.studentId.trim(), 'review-class':data.className.trim(), 'review-email':data.email.trim(), 'review-problem':`Problem ${data.problemId.trim()}`, 'review-language':data.language, 'review-code':data.code})) $(id).textContent = value;
  $('review-context').textContent = [data.issue, data.context.trim()].filter(Boolean).join('\n\n');
  $('review-context-wrap').hidden = !data.issue && !data.context.trim();
}
function updateEditor() {
  const code = $('code').value;
  const count = code ? code.split('\n').length : 0;
  $('line-numbers').textContent = Array.from({length:Math.max(1,count)}, (_,i) => i+1).join('\n');
  $('line-count').textContent = `${count.toLocaleString()} ${count === 1 ? 'line' : 'lines'}`;
  $('char-count').textContent = `${code.length.toLocaleString()} / 45,000 characters`;
  $('line-numbers').scrollTop = $('code').scrollTop;
}
$('code').addEventListener('input', updateEditor);
$('code').addEventListener('scroll', () => {$('line-numbers').scrollTop = $('code').scrollTop;});
// Keep Tab available for keyboard navigation; the editor preserves pasted indentation.
for (const id of requiredFields.flat()) $(id).addEventListener('input', () => {if ($(id).getAttribute('aria-invalid') === 'true') fieldError(id, '');});
$('back').addEventListener('click', () => showStep(step - 1));
document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.edit))));

$('code-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  const status = $('file-status');
  if (file.size > 250000) {status.textContent = 'That file is too large. Choose a source file smaller than 250 KB.'; event.target.value = ''; return;}
  const supported = /\.(cpp|cc|cxx|c|h|hpp|py|java|js|ts|cs|go|rs|txt)$/i;
  if (!supported.test(file.name)) {status.textContent = 'Choose a plain-text source code file, such as .cpp, .py, .java, or .txt.'; event.target.value = ''; return;}
  try {
    const text = await file.text();
    if (text.includes('\0')) throw new Error('This looks like a binary file. Choose a plain-text source file.');
    if (text.length > 45000) throw new Error('This file exceeds 45,000 characters. Paste the relevant complete source file instead.');
    $('code').value = text;
    $('editor-filename').textContent = file.name;
    const extension = file.name.split('.').pop().toLowerCase();
    const language = {cpp:'C++', cc:'C++', cxx:'C++', hpp:'C++', c:'C', py:'Python', java:'Java', js:'JavaScript', ts:'TypeScript', cs:'C#', go:'Go', rs:'Rust'}[extension];
    if (language) $('language').value = language;
    fieldError('code', '');
    updateEditor();
    status.textContent = `Loaded ${file.name}. The file was read on your device.`;
  } catch (error) {status.textContent = error.message || 'Could not read this file. Try pasting the code instead.';}
  event.target.value = '';
});

$('download-copy').addEventListener('click', () => {
  const data = values();
  const copy = `X-Camp homework debugging request\n\nStudent name: ${data.name.trim()}\nStudent ID: ${data.studentId.trim()}\nClass: ${data.className.trim()}\nContact email: ${data.email.trim()}\nProblem ID: ${data.problemId.trim()}\n\n${buildCodeReport(data)}\n`;
  const url = URL.createObjectURL(new Blob([copy], {type:'text/plain;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url; link.download = 'xcamp-debugging-request.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

form.addEventListener('submit', event => {
  event.preventDefault();
  if (sending) return;
  if (!validate(Math.min(step,1))) return;
  if (step < 2) {showStep(step + 1); return;}
  // Revalidate both panels before creating a real browser POST. No fake success state.
  for (let i = 0; i < 2; i++) {
    const invalidId = requiredFields[i].find(id => !$(id).value.trim() || !$(id).validity.valid);
    if (invalidId) {showStep(i); validate(i); return;}
  }
  const payload = buildPayload(values());
  const submission = document.createElement('form');
  submission.method = 'POST'; submission.action = FORM_URL; submission.target = '_self';
  submission.acceptCharset = 'UTF-8';
  for (const [name,value] of Object.entries(payload)) {
    const field = document.createElement('input'); field.type = 'hidden'; field.name = name; field.value = value; submission.append(field);
  }
  document.body.append(submission);
  sending = true;
  $('next').disabled = true;
  $('next-label').textContent = 'Opening Google Forms…';
  submission.submit();
});
// Restore controls if the visitor returns from Google Forms via the Back button.
window.addEventListener('pageshow', () => {sending = false; $('next').disabled = false; $('next-label').textContent = buttonLabels[step];});
showStep(0, false);
