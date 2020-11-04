import { Interval } from 'luxon';
import { getJwtFromClientCredentials } from '@metservice/metraweather-client-credentials';
import 'isomorphic-fetch';
import {
	StrikeCollection,
	StrikeCollectionType,
	KMLStrikeCollection,
	KML,
	CSVStrikeCollection,
	StrikeCollections,
	GeoJsonStrikeCollection,
	BlitzenStrikeCollection,
	CSV,
} from './strike-collections';
import parseLinkHeader from 'parse-link-header';
import { LightningFeatureCollectionV3, LightningFeatureCollectionV2, BlitzenCollectionV3, BlitzenCollectionV2, BlitzenCollectionV1 } from './model/models';

const MAXIMUM_NUMBER_OF_ATTEMPTS = 3;

export enum LightningDataNetworkProvider {
	toa = 'toa',
	transpower = 'transpower',
	mock = 'mock',
}
export enum LightningStrikeDirection {
	CLOUD = 'CLOUD',
	GROUND = 'GROUND',
}

/**
 * NOTE: This library does not support vector tiles as those are lossy and better suited to visualisation than data aggregation.
 * We also do not support GeoBufs at this point in time
 */
export enum SupportedMimeType {
	// GeoBuf = 'application/octet-stream',
	KML = 'application/vnd.google-earth.kml+xml',
	CSV = 'text/csv',
	Blitzen = 'application/vnd.metraweather.blitzen',
	BlitzenV3 = 'application/vnd.metraweather.blitzen.v3',
	BlitzenV2 = 'application/vnd.metraweather.blitzen.v2',
	BlitzenV1 = 'application/vnd.metraweather.blitzen.v1',
	GeoJson = 'application/vnd.geo+json',
	GeoJsonV3 = 'application/vnd.metraweather.lightning.geo+json.v3',
	GeoJsonV2 = 'application/vnd.metraweather.lightning.geo+json.v2',
}

export enum SupportedVersion {
	Four = 'v4',
}
export enum CredentialType {
	jwt = 'jwt',
	apiKey = 'apiKey',
	clientCredentials = 'clientCredentials'
}
type TokenCredentials = {
	type: CredentialType.jwt | CredentialType.apiKey,
	token: string;
}
type ClientCredentials = {
	type: CredentialType.clientCredentials,
	clientId: string;
	clientSecret: string;
};
export type CredentialsDetails = TokenCredentials | ClientCredentials

const assertUnreachable = (x: never, customErrorMessage: string = `Unreachable code reached, handling for value '${x}' is not defined.`): never => {
	throw new Error(customErrorMessage);
};


const getAuthorizationHeader = async (credentials: CredentialsDetails): Promise<{ [key: string]: string }> => {
	switch (credentials.type) {
		case CredentialType.jwt: {
			return { Authorization: `Bearer ${credentials.token}` };
		}
		case CredentialType.apiKey: {
			return { Authorization: `ApiKey ${credentials.token}` };
		}
		case CredentialType.clientCredentials: {
			return getAuthorizationHeader({
				type: CredentialType.jwt,
				token: await getJwtFromClientCredentials(credentials)
			});
		}
		default: {
			return assertUnreachable(credentials, `Credentials '${JSON.stringify(credentials)}' is not understood/supported.`);
		}
	}
};

export type Bbox = [number, number, number, number];

export interface StrikeQueryParameters {
	credentials: CredentialsDetails;
	apiVersion: SupportedVersion;
	time: Interval;
	bbox: Bbox;
	limit: number;
	offset: number;
	providers?: LightningDataNetworkProvider[];
	directions?: LightningStrikeDirection[];
}
export interface ApiResponse<SC extends StrikeCollectionType> {
	strikeCollection: StrikeCollection<SC>;
	strikesRemaining: boolean;
}

async function fetchAndFormatStrikes(format: SupportedMimeType.GeoJson, params: StrikeQueryParameters): Promise<ApiResponse<LightningFeatureCollectionV3>>;
async function fetchAndFormatStrikes(format: SupportedMimeType.GeoJsonV3, params: StrikeQueryParameters): Promise<ApiResponse<LightningFeatureCollectionV3>>;
async function fetchAndFormatStrikes(format: SupportedMimeType.GeoJsonV2, params: StrikeQueryParameters): Promise<ApiResponse<LightningFeatureCollectionV2>>;
async function fetchAndFormatStrikes(format: SupportedMimeType.Blitzen, params: StrikeQueryParameters): Promise<ApiResponse<BlitzenCollectionV3>>;
async function fetchAndFormatStrikes(format: SupportedMimeType.BlitzenV3, params: StrikeQueryParameters): Promise<ApiResponse<BlitzenCollectionV3>>;
async function fetchAndFormatStrikes(format: SupportedMimeType.BlitzenV2, params: StrikeQueryParameters): Promise<ApiResponse<BlitzenCollectionV2>>;
async function fetchAndFormatStrikes(format: SupportedMimeType.BlitzenV1, params: StrikeQueryParameters): Promise<ApiResponse<BlitzenCollectionV1>>;
async function fetchAndFormatStrikes(format: SupportedMimeType.CSV, params: StrikeQueryParameters): Promise<ApiResponse<CSV>>;
async function fetchAndFormatStrikes(format: SupportedMimeType.KML, params: StrikeQueryParameters): Promise<ApiResponse<KML>>;
async function fetchAndFormatStrikes<T extends StrikeCollectionType>(format: SupportedMimeType, params: StrikeQueryParameters): Promise<ApiResponse<T>>;
async function fetchAndFormatStrikes(
	format: SupportedMimeType,
	{ credentials, apiVersion, time, bbox, limit, offset, providers, directions }: StrikeQueryParameters
): Promise<ApiResponse<StrikeCollectionType>> {
	const providerString = providers ? `&providers=${providers.join(',')}` : '';
	const directionsString = directions ? `&direction=${directions.join(',')}` : '';
	const timeString = `${time.start.setZone('utc').toISO()}--${time.end.setZone('utc').toISO()}`;
	const url = `https://lightning.api.metraweather.com/${apiVersion}/strikes?time=${timeString}&bbox=${bbox}&limit=${limit}&offset=${offset}${providerString}${directionsString}`;
	process.env.debug === 'true' && console.debug(`Making request for ${url} with Accept: "${format}"`);
	const authorizationHeader = await getAuthorizationHeader(credentials);
	const response = await fetch(url, {
		headers: {
			Accept: `${format.toString()}`,
			...authorizationHeader
		},
	});
	if (!response.ok) {
		const bodyAsText = await response.text();
		console.error(`The API returned an error`, response.status, response.statusText, bodyAsText);
		throw new Error(`The API return ${response.status} - "${response.statusText}" - "${bodyAsText}"`);
	}
	let strikesRemaining = false;
	const linkHeader = response.headers.get('link');
	if (linkHeader !== null) {
		const links = parseLinkHeader(linkHeader);
		strikesRemaining = links?.next !== undefined && links?.next !== null;
	}
	const strikeCollection = await getFormattedStrikes(format, response);
	return {
		strikeCollection,
		strikesRemaining,
	};
}
async function fetchAndFormatStrikesAndFormatRetryingOnFail(
	format: SupportedMimeType.GeoJson,
	params: StrikeQueryParameters
): Promise<ApiResponse<LightningFeatureCollectionV3>>;
async function fetchAndFormatStrikesAndFormatRetryingOnFail(
	format: SupportedMimeType.GeoJsonV3,
	params: StrikeQueryParameters
): Promise<ApiResponse<LightningFeatureCollectionV3>>;
async function fetchAndFormatStrikesAndFormatRetryingOnFail(
	format: SupportedMimeType.GeoJsonV2,
	params: StrikeQueryParameters
): Promise<ApiResponse<LightningFeatureCollectionV2>>;
async function fetchAndFormatStrikesAndFormatRetryingOnFail(
	format: SupportedMimeType.Blitzen,
	params: StrikeQueryParameters
): Promise<ApiResponse<BlitzenCollectionV3>>;
async function fetchAndFormatStrikesAndFormatRetryingOnFail(
	format: SupportedMimeType.BlitzenV3,
	params: StrikeQueryParameters
): Promise<ApiResponse<BlitzenCollectionV3>>;
async function fetchAndFormatStrikesAndFormatRetryingOnFail(
	format: SupportedMimeType.BlitzenV2,
	params: StrikeQueryParameters
): Promise<ApiResponse<BlitzenCollectionV2>>;
async function fetchAndFormatStrikesAndFormatRetryingOnFail(
	format: SupportedMimeType.BlitzenV1,
	params: StrikeQueryParameters
): Promise<ApiResponse<BlitzenCollectionV1>>;
async function fetchAndFormatStrikesAndFormatRetryingOnFail(format: SupportedMimeType.CSV, params: StrikeQueryParameters): Promise<ApiResponse<CSV>>;
async function fetchAndFormatStrikesAndFormatRetryingOnFail(format: SupportedMimeType.KML, queryParameters: StrikeQueryParameters): Promise<ApiResponse<KML>>;
async function fetchAndFormatStrikesAndFormatRetryingOnFail<T extends StrikeCollectionType>(
	format: SupportedMimeType,
	queryParameters: StrikeQueryParameters
): Promise<ApiResponse<T>>;
async function fetchAndFormatStrikesAndFormatRetryingOnFail(
	format: SupportedMimeType,
	queryParameters: StrikeQueryParameters
): Promise<ApiResponse<StrikeCollectionType>> {
	let numberOfAttempts = 0;
	while (true) {
		try {
			return await fetchAndFormatStrikes(format, queryParameters);
		} catch (error) {
			numberOfAttempts++;
			await sleepForBackoffTime(numberOfAttempts);
			if (numberOfAttempts === MAXIMUM_NUMBER_OF_ATTEMPTS) {
				throw error;
			}
		}
	}
}
/**
 * Waits for an additional 5 seconds for each number of attempts that have failed
 */
const sleepForBackoffTime = async (numberOfAttempts: number) => {
	const numberOfSecondsToWait = 5 * numberOfAttempts;
	new Promise((resolve) => setTimeout(resolve, numberOfSecondsToWait * 1000));
};

async function getFormattedStrikes(format: SupportedMimeType.GeoJson, response: Response): Promise<GeoJsonStrikeCollection<LightningFeatureCollectionV3>>;
async function getFormattedStrikes(format: SupportedMimeType.GeoJsonV3, response: Response): Promise<GeoJsonStrikeCollection<LightningFeatureCollectionV3>>;
async function getFormattedStrikes(format: SupportedMimeType.GeoJsonV2, response: Response): Promise<GeoJsonStrikeCollection<LightningFeatureCollectionV2>>;
async function getFormattedStrikes(format: SupportedMimeType.Blitzen, response: Response): Promise<BlitzenStrikeCollection<BlitzenCollectionV3>>;
async function getFormattedStrikes(format: SupportedMimeType.BlitzenV3, response: Response): Promise<BlitzenStrikeCollection<BlitzenCollectionV3>>;
async function getFormattedStrikes(format: SupportedMimeType.BlitzenV2, response: Response): Promise<BlitzenStrikeCollection<BlitzenCollectionV2>>;
async function getFormattedStrikes(format: SupportedMimeType.BlitzenV1, response: Response): Promise<BlitzenStrikeCollection<BlitzenCollectionV1>>;
async function getFormattedStrikes(format: SupportedMimeType.KML, response: Response): Promise<KMLStrikeCollection>;
async function getFormattedStrikes(format: SupportedMimeType.CSV, response: Response): Promise<CSVStrikeCollection>;
async function getFormattedStrikes<T extends StrikeCollectionType>(format: SupportedMimeType, response: Response): Promise<StrikeCollection<T>>;
async function getFormattedStrikes(format: SupportedMimeType, response: Response): Promise<StrikeCollections> {
	switch (format) {
		case SupportedMimeType.GeoJson: {
			return new GeoJsonStrikeCollection<LightningFeatureCollectionV3>(response);
		}
		case SupportedMimeType.GeoJsonV3: {
			return new GeoJsonStrikeCollection<LightningFeatureCollectionV3>(response);
		}
		case SupportedMimeType.GeoJsonV2: {
			return new GeoJsonStrikeCollection<LightningFeatureCollectionV2>(response);
		}
		case SupportedMimeType.Blitzen: {
			return new BlitzenStrikeCollection<BlitzenCollectionV3>(response);
		}
		case SupportedMimeType.BlitzenV3: {
			return new BlitzenStrikeCollection<BlitzenCollectionV3>(response);
		}
		case SupportedMimeType.BlitzenV2: {
			return new BlitzenStrikeCollection<BlitzenCollectionV2>(response);
		}
		case SupportedMimeType.BlitzenV1: {
			return new BlitzenStrikeCollection<BlitzenCollectionV1>(response);
		}
		case SupportedMimeType.KML: {
			return new KMLStrikeCollection(response);
		}
		case SupportedMimeType.CSV: {
			return new CSVStrikeCollection(response);
		}
		default: {
			return assertUnreachable(format, `Format '${format}' is not supported.`);
		}
		// case SupportedMimeType.GeoBuf: {
		// TODO: The API does not appear to implement GeoBufs correctly. They are more than just a buffer of JSON.
		// 	geobuf.decode(new Pbf(data));
		// }
	}
}

export { getAuthorizationHeader, fetchAndFormatStrikes, getFormattedStrikes, fetchAndFormatStrikesAndFormatRetryingOnFail };
