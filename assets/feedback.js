(() => {
  const form = document.querySelector('[data-feedback-form]');
  if (!form) return;
  const status = form.querySelector('[data-feedback-status]');
  const submit = form.querySelector('button[type="submit"]');
  const message = form.elements.message;
  const messageError = form.querySelector('#message-error');
  const maxLength = Number(message.dataset.maxLength);
  const messages = {
    sending: 'Sending your message…',
    received: 'Message received. Thank you for your feedback!',
    invalid: 'Check the category, email and message (10 to 2,980 characters).',
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

  function validateMessage(required = false) {
    const length = message.value.trim().length;
    let error = '';
    if (message.value.length > maxLength) {
      error = 'Your message exceeds the 2,980 character limit.';
    } else if ((message.value || required) && length < message.minLength) {
      error = 'Your message is too short. Enter at least 10 characters.';
    }

    message.setCustomValidity(error);
    message.setAttribute('aria-invalid', String(Boolean(error)));
    messageError.hidden = !error;
    if (messageError.textContent !== error) messageError.textContent = error;
    return !error;
  }

  message.addEventListener('input', () => validateMessage());
  message.addEventListener('invalid', event => {
    event.preventDefault();
    validateMessage(true);
    message.focus();
  });

  function fields() {
    const values = new FormData(form);
    return Object.fromEntries(['category', 'message', 'email', 'website'].map(name =>
      [name, String(values.get(name) || '').trim()]));
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    validateMessage(true);
    if (!form.reportValidity()) return;
    const data = fields();
    const key = JSON.stringify(data);
    // Keep help requests identifiable in the existing D1 general-feedback category.
    if (data.category === 'help') {
      data.category = 'general';
      data.message = '[App help] ' + data.message;
    }
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
      if (key === JSON.stringify(fields())) {
        form.reset();
        validateMessage();
      }
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
