/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Public web app URL, used for invite links shared from the Android app */
  readonly VITE_PUBLIC_WEB_URL?: string;
  /** Set to "true" in dev/self-host builds to show the server picker in the navbar */
  readonly VITE_ENABLE_SERVER_CONFIG?: string;
}
