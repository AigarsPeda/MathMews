import { reportAppError } from '@/lib/app-diagnostics';

type ErrorHandler = (error: Error, fatal?: boolean) => void;
const runtime = globalThis as typeof globalThis & {
  ErrorUtils?: { getGlobalHandler(): ErrorHandler; setGlobalHandler(handler: ErrorHandler): void };
  mathMewsErrorReportingInstalled?: boolean;
};
if (runtime.ErrorUtils && !runtime.mathMewsErrorReportingInstalled) {
  runtime.mathMewsErrorReportingInstalled = true;
  const previous = runtime.ErrorUtils.getGlobalHandler();
  runtime.ErrorUtils.setGlobalHandler((error, fatal) => {
    reportAppError('javascript', error, fatal === true);
    // Unknown errors still use React Native's normal handler. Do not hide a
    // fatal error and keep running with possibly corrupted application state.
    previous(error, fatal);
  });
}
