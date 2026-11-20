(() => {
  const form = document.querySelector('[data-feedback-form]');
  if (!form) return;
  const status = form.querySelector('[data-feedback-status]');
  const submit = form.querySelector('button[type="submit"]');
  const messages = {
    sending: 'Sending your message…',
    received: 'Message received. Thank you for your feedback!',
    invalid: 'Check the category, email and message (10 to 3000 characters).',
    rate: 'Too many attempts. Please wait a minute before trying again.',
    unavailable: 'We could not confirm receipt. Your message is still here so you can retry.',
    offline: 'Direct submission is temporarily unavailable.'
  };
  const endpoint = form.dataset.endpoint;
  if (!endpoint) {
    submit.disabled = true;
    status.textContent = messages.offline;
    return;
  }
  submit.disabled = false;
  let previous = '';
  let id;
  let sending = false;

  function fields() {
    const values = new FormData(form);
    return Object.fromEntries(['category', 'message', 'email', 'website'].map(name =>
      [name, String(values.get(name) || '').trim()]));
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    const data = fields();
    if (data.message.length < 10 || data.message.length > 3000) {
      status.textContent = messages.invalid;
      form.elements.message.focus();
      return;
    }
    const key = JSON.stringify(data);
    if (previous !== key) {
      id = crypto.randomUUID();
      previous = key;
    }
    sending = true;
    submit.disabled = true;
    status.textContent = messages.sending;
    form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, language: 'en', id }),
        signal: controller.signal
      });
      if (!response.ok) {
        if (response.status === 409) previous = '';
        status.textContent = response.status === 429 ? messages.rate :
          response.status === 422 ? messages.invalid : messages.unavailable;
        return;
      }
      const result = await response.json();
      if (!result.received || result.id !== id) throw new Error('Missing receipt');
      if (key === JSON.stringify(fields())) form.reset();
      previous = '';
      status.textContent = messages.received;
    } catch {
      status.textContent = messages.unavailable;
    } finally {
      clearTimeout(timeout);
      form.removeAttribute('aria-busy');
      submit.disabled = false;
      sending = false;
    }
  });
})();
