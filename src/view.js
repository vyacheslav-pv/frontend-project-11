import onChange from 'on-change';

const handleFormProcessState = (elements, processState) => {
  const { input } = elements;
  switch (processState) {
    case 'error':
      input.classList.add('is-invalid');
      break;

    case 'filling':
      input.classList.remove('is-invalid');
      break;

    default:
      throw new Error(`Unknown process state: ${processState}`);
  }
};

const handleProcessState = (elements, processState) => {
  const { form, input } = elements;
  switch (processState) {
    case 'added':
      form.reset();
      input.focus();
      break;

    case 'error':
    case 'initialized':
      break;

    default:
      throw new Error(`Unknown process state: ${processState}`);
  }
};

const renderFeedback = (elements, value, i18nextInstance) => {
  const { feedback } = elements;
  feedback.textContent = i18nextInstance.t(value);

  switch (value) {
    case 'formFeedback.success':
      feedback.classList.remove('text-danger');
      feedback.classList.add('text-success');
      break;

    case 'formFeedback.errors.emptyField':
    case 'formFeedback.errors.duplicateUrl':
    case 'formFeedback.errors.invalidUrl':
      feedback.classList.remove('text-success');
      feedback.classList.add('text-danger');
      break;

    default:
      throw new Error(`Unknown feedback code "${value}"`);
  }
};

const render = (elements, initialState, i18nextInstance) => (path, value) => {
  switch (path) {
    case 'form.processState':
      handleFormProcessState(elements, value);
      break;

    case 'processState':
      handleProcessState(elements, value);
      break;

    case 'form.feedback':
      renderFeedback(elements, value, i18nextInstance);
      break;

    default:
      break;
  }
};

export default (initialState, elements, i18nextInstance) => onChange(initialState, render(elements, initialState, i18nextInstance));
