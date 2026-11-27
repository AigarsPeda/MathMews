import { createContext } from 'react';

/** What picture help tells a proof: it fills the sheet's model area with big pieces at an unhurried pace. */
export type HelpProof = Readonly<{
  /** The most height the model may use, its equation and the playback row excluded. */
  height: number;
}>;

/** A HelpProof inside picture help, false everywhere else. Play never provides it. */
export const HelpProofContext = createContext<HelpProof | false>(false);
