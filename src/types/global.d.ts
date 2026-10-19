interface Window {
  __MUSE__: {
    appId: string;
    appVersionId: string;
    domain: string;
    env: string;
  };
  __TERN__: {
    user?: {
      clientUser: {
        avatarUrl: string;
        displayName: string;
        userId: string;
        userName: string;
        nickName: string;
      };
      outUserNo: string;
    };
  };
  __MUSE_PREVIEW_ERROR_CAPTURE__?: {
    reportError: (
      error: unknown,
      options?: {
        kind?: "manual" | "react-error-boundary";
        severity?: "error" | "fatal";
      },
    ) => void;
  };
}
