import React from 'react';
import ReactDOM from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Entry } from './components/Entry';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

/**
 * The first render is flushed SYNCHRONOUSLY, before the browser's readyState
 * leaves "loading".
 *
 * Why this matters, and it is not a micro-optimisation:
 *
 * 1. NO FLASH OF EMPTY PAGE. `createRoot().render()` in React 18+ is
 *    CONCURRENT — the work is scheduled, not done inline. The browser can
 *    reach readyState="interactive" and paint an empty #root before the first
 *    frame of the interface exists. On a cold load the reader sees a black
 *    rectangle, then the app arrives. flushSync performs that first render
 *    inline, so the DOM is complete before the browser can paint anything.
 *
 * 2. THE DOCUMENT IS HONEST WHEN IT IS MEASURED. A measurement instrument
 *    that reads the DOM once readyState leaves "loading" reads an EMPTY
 *    PAGE on a client-rendered app, and then reports "no spatial problems
 *    found" — a clean bill of health for a page that was never measured.
 *    Flushing the first render inline means the DOM a measurement tool sees
 *    is the DOM a reader sees.
 *
 * Later renders stay concurrent; only this first one is forced.
 */
flushSync(() => {
  root.render(
    <React.StrictMode>
      <Entry />
    </React.StrictMode>
  );
});
