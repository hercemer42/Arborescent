import { useEffect, useState } from 'react';

export function useFlashMessage() {
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCollaborationAccepted = () => {
      setFlashMessage('Feedback accepted');
      setTimeout(() => setFlashMessage(null), 2000);
    };

    const handleCollaborationCanceled = () => {
      setFlashMessage('Collaboration canceled');
      setTimeout(() => setFlashMessage(null), 2000);
    };

    window.addEventListener('collaboration-accepted', handleCollaborationAccepted);
    window.addEventListener('collaboration-canceled', handleCollaborationCanceled);

    return () => {
      window.removeEventListener('collaboration-accepted', handleCollaborationAccepted);
      window.removeEventListener('collaboration-canceled', handleCollaborationCanceled);
    };
  }, []);

  return flashMessage;
}
