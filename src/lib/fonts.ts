import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadBangers } from "@remotion/google-fonts/Bangers";
import { loadFont as loadPermanentMarker } from "@remotion/google-fonts/PermanentMarker";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadPlayfairDisplay } from "@remotion/google-fonts/PlayfairDisplay";

export type GoogleFontName = 
  | 'Montserrat'
  | 'Roboto'
  | 'Bangers'
  | 'Permanent Marker'
  | 'Anton'
  | 'Oswald'
  | 'Playfair Display'
  | 'system-ui, -apple-system, sans-serif';

export const loadGoogleFont = (fontFamily: string) => {
  try {
    switch (fontFamily) {
      case 'Montserrat':
        loadMontserrat('normal', { weights: ['400', '800'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
        break;
      case 'Roboto':
        loadRoboto('normal', { weights: ['400', '700'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
        break;
      case 'Bangers':
        loadBangers('normal', { weights: ['400'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
        break;
      case 'Permanent Marker':
        loadPermanentMarker('normal', { weights: ['400'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
        break;
      case 'Anton':
        loadAnton('normal', { weights: ['400'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
        break;
      case 'Oswald':
        loadOswald('normal', { weights: ['400', '700'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
        break;
      case 'Playfair Display':
        loadPlayfairDisplay('normal', { weights: ['400', '800'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
        break;
      default:
        // System font or unknown, do nothing
        break;
    }
  } catch (error) {
    console.warn(`Failed to load font: ${fontFamily}`, error);
  }
};
