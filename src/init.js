import i18n from 'i18next';
import axios from 'axios';
import * as yup from 'yup';
import uniqueId from 'lodash/uniqueId.js';
import state from './view.js';
import resources from './locales/index.js';
import parse from './parser.js';

const urlSchema = (validatedLinks) => yup.string().required().url().notOneOf(validatedLinks);

const getUrlProxy = (url) => {
  const href = new URL('/get', 'https://allorigins.hexlet.app');
  href.searchParams.set('disableCache', 'true');
  href.searchParams.set('url', url);
  return href;
};

const updateRSS = (watchedState, urlProx, feedId) => {
  axios.get(urlProx)
    .then((response) => response.data.contents)
    .then((content) => {
      const parsedContent = parse(content);
      const { currentPosts } = parsedContent;
      if (!currentPosts) {
        throw new Error('Parser Error');
      }
      return currentPosts;
    })
    .then((currentPosts) => {
      const receivedPosts = watchedState.data.posts.filter((post) => post.feedId === feedId);
      const receivedPostsGuids = receivedPosts.map((post) => post.guid);
      const receivedGuids = new Set(receivedPostsGuids);
      const newPosts = currentPosts.filter(({ guid }) => !receivedGuids.has(guid));

      if (newPosts.length === 0) {
        return false;
      }

      newPosts.forEach((post) => {
        // eslint-disable-next-line no-param-reassign
        post.feedId = feedId;
        // eslint-disable-next-line no-param-reassign
        post.id = uniqueId();
      });
      watchedState.data.posts.push(...newPosts);
      return newPosts;
    })
    .finally(() => setTimeout(() => updateRSS(watchedState, urlProx, feedId), 5000));
};

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
    posts: document.querySelector('.posts'),
    feeds: document.querySelector('.feeds'),
    input: document.getElementById('url-input'),
    submitButton: document.querySelector('button[type="submit"]'),
    feedback: document.querySelector('.feedback'),
    modalTitle: document.querySelector('.modal-title'),
    modalDescription: document.querySelector('.modal-body'),
    modalFullArticle: document.querySelector('.full-article'),
  };

  const initialState = {
    processState: 'initialized',
    form: {
      feedback: null,
      processState: 'filling',
    },
    validatedLinks: [],
    uiState: {
      readPostsId: new Set(),
      modalPostId: null,
    },
    data: {
      feeds: [],
      posts: [],
    },
  };

  const watchedState = state(initialState, elements, i18nextInstance);

  elements.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    watchedState.form.processState = 'validating';
    const formData = new FormData(ev.target);
    const url = formData.get('url');

    let urlProx;

    const schema = urlSchema(watchedState.validatedLinks);

    schema.validate(url)
      .then(() => {
        watchedState.form.processState = 'validated';
        watchedState.processState = 'loading';
        watchedState.validatedLinks.push(url);
        urlProx = getUrlProxy(url);
        return axios.get(urlProx);
      })
      .then((response) => response.data.contents)
      .then((content) => {
        const parsedContent = parse(content);
        const { currentFeed, currentPosts } = parsedContent;

        if (!currentFeed || !currentPosts) {
          throw new Error('Parser Error');
        }

        currentFeed.id = uniqueId();
        currentPosts.forEach((post) => {
          // eslint-disable-next-line no-param-reassign
          post.feedId = currentFeed.id;
          // eslint-disable-next-line no-param-reassign
          post.id = uniqueId();
        });

        watchedState.data.feeds.push(currentFeed);
        watchedState.data.posts.push(...currentPosts);

        watchedState.processState = 'added';
        watchedState.form.processState = 'filling';
        watchedState.form.feedback = 'formFeedback.success';
        return currentFeed.id;
      })
      .then((feedId) => {
        watchedState.processState = 'monitoring';
        return setTimeout(() => updateRSS(watchedState, urlProx, feedId), 5000);
      })
      .catch((e) => {
        switch (e.name) {
          case 'ValidationError': {
            const [errorCode] = e.errors;
            watchedState.form.feedback = errorCode;
            watchedState.form.processState = 'invalidated';
            break;
          }

          case 'AxiosError':
            if (e.message === 'Network Error') {
              watchedState.processState = 'networkError';
              watchedState.form.feedback = 'formFeedback.errors.network';
            }
            break;

          case 'Error':
            if (e.message === 'Parser Error') {
              watchedState.processState = 'parserError';
              watchedState.form.feedback = 'formFeedback.errors.parserError';
            }
            break;

          default:
            throw new Error(`Unknown error ${e}`);
        }
      });
  });
  elements.posts.addEventListener('click', (e) => {
    if (e.target.dataset.id) {
      const readPostsId = e.target.dataset.id;
      watchedState.uiState.modalPostId = readPostsId;
      watchedState.uiState.readPostsId.add(readPostsId);
    }
  });
};
