import React from 'react';

type UseGlobalKeydownOptions = {
  enabled?: boolean;
  onKeyDown: (event: KeyboardEvent) => void;
};

export const useGlobalKeydown = ({
  enabled = true,
  onKeyDown,
}: UseGlobalKeydownOptions): void => {
  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, onKeyDown]);
};
