import i18n from 'i18next';
import * as yup from 'yup';
import state from './view.js';
import resources from './locales/index.js';

const urlSchema = (validatedLinks) => yup.string().required().url().notOneOf(validatedLinks);

export default () => {
  const i18nextInstance = i18n.createInstance();
  i18nextInstance.init({
    lng: 'ru',
    debug: false,
    resources,
  });

  yup.setLocale({
    mixed: {
      notOneOf: 'formFeedback.errors.duplicateUrl',
    },
    string: {
      required: 'formFeedback.errors.emptyField',
      url: 'formFeedback.errors.invalidUrl',
    },
  });

  const elements = {
    form: document.querySelector('.rss-form'),
    input: document.getElementById('url-input'),
    submitButton: document.querySelector('button[type="submit"]'),
    feedback: document.querySelector('.feedback'),
  };

  const initialState = {
    processState: 'initialized',
    form: {
      feedback: null,
      processState: 'filling',
      link: null,
    },
    validatedLinks: [],
    data: {
      feeds: [],
      posts: [],
    },
  };

  const watchedState = state(initialState, elements, i18nextInstance);

  elements.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const formData = new FormData(ev.target);
    const url = formData.get('url');

    const schema = urlSchema(watchedState.validatedLinks);

    schema.validate(url)
      .then(() => {
        watchedState.form.feedback = 'formFeedback.success';
        watchedState.validatedLinks.push(url);
        console.log(watchedState.validatedLinks);
        watchedState.form.processState = 'filling';
        watchedState.processState = 'added';
      })
      .catch((e) => {
        switch (e.name) {
          case 'ValidationError': {
            const [errorCode] = e.errors;
            console.log(errorCode)
            watchedState.form.feedback = errorCode;
            watchedState.form.processState = 'error';
            watchedState.processState = 'error';
            console.log(e.name)
            break;
          }
          default:
            throw new Error(`Unknown error ${e}`);
        }
      });
  });
  console.log(watchedState.validatedLinks.join())
};
