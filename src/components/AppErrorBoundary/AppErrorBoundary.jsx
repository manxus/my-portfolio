import { Component } from 'react';
import styles from './AppErrorBoundary.module.css';

/**
 * Last line of defence for a render error, so the visitor gets a way out
 * instead of an empty page. A stale chunk after a deploy is normally handled
 * by the reload in index.html; this catches the case where that already ran.
 */
export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className={styles.screen} role="alert">
        <div className={styles.panel}>
          <h1 className={styles.title}>SIGNAL LOST</h1>
          <div className={styles.divider} />
          <p className={styles.message}>
            Something failed to load, possibly because the site was updated
            since this tab was opened. Reloading should fix it.
          </p>
          <button
            type="button"
            className={styles.reload}
            onClick={() => window.location.reload()}
          >
            RELOAD
          </button>
        </div>
      </div>
    );
  }
}
