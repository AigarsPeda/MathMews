import { createContext } from 'react';

/**
 * A help proof that narrates itself while it plays puts that beat caption here instead of drawing its own,
 * so the sheet shows one line of text at a time: the beat while playing, the rule once settled.
 */
export const HelpCaptionContext = createContext<((caption: string | null) => void) | null>(null);
