export const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc-zySIcvKUak4uienMrc5xT09eYZ7OWTo8YUaXvr0ctuU-PQ/formResponse';
export const FIELD_IDS = Object.freeze({
  name: 'entry.1679946789', studentId: 'entry.1770002306', className: 'entry.260883238',
  email: 'entry.1376076637', problemId: 'entry.713144818', code: 'entry.329652226',
});
export function buildCodeReport({code, language, issue, context}) {
  const details = [];
  if (language) details.push(`Language: ${language}`);
  if (issue) details.push(`Issue: ${issue}`);
  if (context?.trim()) details.push(`Debugging context:\n${context.trim()}`);
  return details.length ? `${details.join('\n\n')}\n\n--- Source code ---\n${code}` : code;
}
export function buildPayload(data) {
  return {
    [FIELD_IDS.name]: data.name.trim(), [FIELD_IDS.studentId]: data.studentId.trim(),
    [FIELD_IDS.className]: data.className.trim(), [FIELD_IDS.email]: data.email.trim(),
    [FIELD_IDS.problemId]: data.problemId.trim(), [FIELD_IDS.code]: buildCodeReport(data),
    fvv: '1', pageHistory: '0',
  };
}
