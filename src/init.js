import i18n from 'i18next';
import axios from 'axios';
import * as yup from 'yup';
import _ from 'lodash';
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

const updateRSS = (watchedState) => {
  const promises = watchedState.data.feeds.map((feed) => {
    const proxyURL = new URL(getUrlProxy(feed.url));
    return axios.get(proxyURL)
      .then((responce) => {
        const content = responce.data.contents;
        const { currentPosts } = parse(content);
        const posts = watchedState.data.posts.filter((post) => post.feedId === feed.id);
        const newPosts = _.differenceBy(currentPosts, posts, 'title');
        newPosts.forEach((newpost) => {
          const post = newpost;
          post.feedId = feed.id;
          post.id = _.uniqueId();
        });
        const initialState = { ...watchedState };
        initialState.data.posts = [...newPosts, ...watchedState.data.posts];
      })
      .catch(() => []);
  });
  Promise.all(promises)
    .finally(() => {
      setTimeout(updateRSS, 5000, watchedState);
    });
};

export default () => {
  yup.setLocale({
    mixed: {
      notOneOf: 'formFeedback.errors.duplicateUrl',
    },
    string: {
      required: 'formFeedback.errors.emptyField',
      url: 'formFeedback.errors.invalidUrl',
    },
  });

  const i18nextInstance = i18n.createInstance();
  i18nextInstance.init({
    lng: 'ru',
    debug: false,
    resources,
  })
    .then(() => {
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

            currentFeed.id = _.uniqueId();
            currentFeed.url = url;
            currentPosts.forEach((post) => {
            // eslint-disable-next-line no-param-reassign
              post.feedId = currentFeed.id;
              // eslint-disable-next-line no-param-reassign
              post.id = _.uniqueId();
            });

            watchedState.data.feeds.push(currentFeed);
            watchedState.data.posts.push(...currentPosts);

            watchedState.processState = 'added';
            watchedState.form.processState = 'filling';
            watchedState.form.feedback = 'formFeedback.success';
            return currentFeed.id;
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
      updateRSS(watchedState);
    });
};
