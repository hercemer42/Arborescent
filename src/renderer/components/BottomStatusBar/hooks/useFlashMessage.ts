import { useEffect, useState } from 'react';

/**
 * Hook to manage flash messages displayed after review actions
 * Listens for review-accepted and review-canceled events
 */
export function useFlashMessage() {
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleReviewAccepted = () => {
      setFlashMessage('Review accepted');
      setTimeout(() => setFlashMessage(null), 2000);
    };

    const handleReviewCanceled = () => {
      setFlashMessage('Review canceled');
      setTimeout(() => setFlashMessage(null), 2000);
    };

    window.addEventListener('review-accepted', handleReviewAccepted);
    window.addEventListener('review-canceled', handleReviewCanceled);

    return () => {
      window.removeEventListener('review-accepted', handleReviewAccepted);
      window.removeEventListener('review-canceled', handleReviewCanceled);
    };
  }, []);

  return flashMessage;
}
