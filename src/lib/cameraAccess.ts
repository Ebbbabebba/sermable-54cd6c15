/** Invalidate pending permission requests when a camera view closes. */
export function createCameraRequestGuard() {
  let generation = 0;
  return {
    begin: () => ++generation,
    cancel: () => { generation++; },
    accept(request: number, stream: {getTracks: () => {stop: () => void}[]}) {
      if (request === generation) return true;
      stream.getTracks().forEach(track => track.stop());
      return false;
    },
    current: (request: number) => request === generation,
  };
}

export function isCameraPermissionError(error: unknown) {
  return error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' || /permission|denied|not authorized/i.test(error.message));
}