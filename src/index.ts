/**
 * Fetches strikes from the lightning API over the given time and area in a resilient fashion until all strikes have been received.
 * For use fetching data older than 10 minutes ago.
 * - If toTime > now():
 * 		- Throw error, cannot get all strikes
 * - Fetch strikes for given values
 * 		- if link, fetch again
 * 		- Aggregate strikes
 * - return
 * NOTE: If the provider is not global, there may not be data in the given area
 */
const fetchAllHistoricStrikesOverAreaAndTime = () => {};
/**
 * Saves the strikes to a file
 */
const persistStrikesToFile = () => {};

/**
 * Creates a WebSocket to listen to all new strikes
 */
const getAllNewStrikesInArea = () => {};

const pollForNewStrikesInArea = () => {};

export {};
