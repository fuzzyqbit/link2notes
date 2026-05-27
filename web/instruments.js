// Instrument config: transposition (concert -> written) + written-pitch MIDI range.
// Ranges are conservative "playable by an intermediate student" bounds.
// Comfort range biases the octave-folding so notes land in the easy register.

export const INSTRUMENTS = {
  flute: {
    label: "Flute",
    transposeSemitones: 0,         // concert pitch instrument
    loMidi: 60,                    // C4
    hiMidi: 96,                    // C7
    comfortLo: 62,                 // D4
    comfortHi: 86,                 // D6
  },
  clarinet: {
    label: "Clarinet (Bb)",
    transposeSemitones: 2,         // sounds M2 lower than written
    loMidi: 52,                    // written E3
    hiMidi: 89,                    // written F6
    comfortLo: 55,                 // written G3
    comfortHi: 79,                 // written G5
  },
  bassClarinet: {
    label: "Bass Clarinet (Bb)",
    transposeSemitones: 14,        // sounds M9 lower
    loMidi: 52,                    // written E3
    hiMidi: 84,                    // written C6
    comfortLo: 55,                 // written G3
    comfortHi: 76,                 // written E5
  },
  altoSax: {
    label: "Alto Saxophone (Eb)",
    transposeSemitones: 9,         // sounds M6 lower
    loMidi: 58,                    // written Bb3
    hiMidi: 78,                    // written F#6
    comfortLo: 65,                 // written F4
    comfortHi: 80,                 // written G#5
  },
  tenorSax: {
    label: "Tenor Saxophone (Bb)",
    transposeSemitones: 14,        // sounds M9 lower
    loMidi: 58,                    // written Bb3
    hiMidi: 78,                    // written F#6
    comfortLo: 65,                 // written F4
    comfortHi: 80,                 // written G#5
  },
  bariSax: {
    label: "Baritone Saxophone (Eb)",
    transposeSemitones: 21,        // sounds octave + M6 lower
    loMidi: 58,                    // written Bb3
    hiMidi: 78,                    // written F#6
    comfortLo: 65,                 // written F4
    comfortHi: 80,                 // written G#5
  },
};

export const INSTRUMENT_ORDER = [
  "flute",
  "clarinet",
  "bassClarinet",
  "altoSax",
  "tenorSax",
  "bariSax",
];
