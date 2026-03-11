/// <reference types="vite/client" />

// Fix NodeJS.Timeout compatibility with browser clearTimeout
declare function clearTimeout(id: number | NodeJS.Timeout | undefined): void;
declare function clearInterval(id: number | NodeJS.Timeout | undefined): void;

declare namespace NodeJS {
  type Timeout = number;
  type Timer = number;
}
