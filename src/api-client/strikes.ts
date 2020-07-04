import { FeatureCollection, Point } from '@turf/helpers';
import { BBox2d } from '@turf/helpers/lib/geojson';
import { LightningFeatureCollectionV3, LightningFeatureCollectionV2, BlitzenVersion3, BlitzenVersion2, BlitzenVersion1 } from './model/models';
import { parseString, parseStringPromise } from 'xml2js';
import 'isomorphic-fetch';
import { kml } from './model/kml';

export enum LightningDataNetworkProviders {
	toa = 'toa',
	transpower = 'transpower',
	mock = 'mock',
}
export enum LightningStrikeDirection {
	CLOUD = 'CLOUD',
	GROUND = 'GROUND',
}

export interface LightningStrikeProperties {
	GDOP?: number;
	dateTime: string;
	unixTime?: number;
	ellipse_bearing?: number;
	ellipse_major_axis?: number;
	ellipse_minor_axis?: number;
	kA?: number;
	source: LightningDataNetworkProviders;
	strike_type: LightningStrikeDirection;
	nanoseconds_remainder?: number;
	sensor_chi_squared?: number;
	sensor_degrees_freedom?: number;
	sensor_information?: string;
	sensor_peak_time?: number;
	sensor_range_normalised_signal?: number;
	sensor_reporting_sensors?: number;
	sensor_rise_time?: number;
}

interface Csv {
	header: string;
	body: string[];
}

class CSV {
	public header: string;
	public body: string[];
	constructor(text: string) {
		const [header, ...body] = text.split('\n');
		this.header = header;
		this.body = body;
	}
}
/**
 * NOTE: This library does not support vector tiles as those are lossy and better suited to visualisation than data aggregation.
 * We also do not support GeoBufs at this point in time
 */
export enum SupportedMimeType {
	GeoJson = 'application/vnd.geo+json',
	// GeoBuf = 'application/octet-stream',
	KML = 'application/vnd.google-earth.kml+xml',
	CSV = 'text/csv',
	Blitzen = 'application/vnd.metraweather.blitzen',
	BlitzenV1 = 'application/vnd.metraweather.blitzen.v1',
	BlitzenV2 = 'application/vnd.metraweather.blitzen.v2',
	BlitzenV3 = 'application/vnd.metraweather.blitzen.v3',
	GeoJsonV2 = 'application/vnd.metraweather.lightning.geo+json.v2',
	GeoJsonV3 = 'application/vnd.metraweather.lightning.geo+json.v3',
}

type SupportedMimeTypeTypes = LightningFeatureCollectionV3 | LightningFeatureCollectionV2 | BlitzenVersion3 | BlitzenVersion2 | BlitzenVersion1 | kml | Csv;
// const x: SupportedMimeTypeToType<SupportedMimeType.KML> = '' as any as kml;
export enum SupportedVersion {
	Four = 'v4',
}
export enum CredentialType {
	jwt = 'jwt',
	apiKey = 'apiKey',
}

export type LightningStrikeFeatureCollection = FeatureCollection<Point, LightningStrikeProperties>;
const assertUnreachable = (x: never, customErrorMessage: string = `Unreachable code reached, handling for value '${x}' is not defined.`): never => {
	throw new Error(customErrorMessage);
};

const getAuthorizationPrefix = (type: CredentialType) => {
	switch (type) {
		case CredentialType.jwt: {
			return 'Bearer';
		}
		case CredentialType.apiKey: {
			return 'ApiKey';
		}
		default: {
			return assertUnreachable(type, `Credential Type '${type}' is not understood/supported.`);
		}
	}
};

interface StrikeQueryParameters {
	credentials: {
		type: CredentialType;
		token: string;
	};
	apiVersion: SupportedVersion;
	time: Date;
	bbox: BBox2d;
	limit: number;
	offset: number;
}

// async function fetchStrikes(format: SupportedMimeType.GeoJson, params: StrikeQueryParameters): Promise<LightningFeatureCollectionV3>;
// async function fetchStrikes(format: SupportedMimeType.GeoJsonV3, params: StrikeQueryParameters): Promise<LightningFeatureCollectionV3>;
// async function fetchStrikes(format: SupportedMimeType.GeoJsonV2, params: StrikeQueryParameters): Promise<LightningFeatureCollectionV2>;
// async function fetchStrikes(format: SupportedMimeType.Blitzen, params: StrikeQueryParameters): Promise<BlitzenVersion3>;
// async function fetchStrikes(format: SupportedMimeType.BlitzenV3, params: StrikeQueryParameters): Promise<BlitzenVersion3>;
// async function fetchStrikes(format: SupportedMimeType.BlitzenV2, params: StrikeQueryParameters): Promise<BlitzenVersion2>;
// async function fetchStrikes(format: SupportedMimeType.BlitzenV1, params: StrikeQueryParameters): Promise<BlitzenVersion1>;
// async function fetchStrikes(format: SupportedMimeType.KML, params: StrikeQueryParameters): Promise<kml>;
// async function fetchStrikes(format: SupportedMimeType.CSV, params: StrikeQueryParameters): Promise<Csv>;
async function fetchStrikes(
	format: SupportedMimeType,
	{ credentials, apiVersion, time, bbox, limit, offset }: StrikeQueryParameters
): Promise<SupportedMimeTypeTypes> {
	const response = await fetch(`https://lightning.api.metraweather.com/${apiVersion}/strikes?time=${time}&bbox=${bbox}&limit=${limit}&offset=${offset}`, {
		headers: {
			Accept: format,
			Authorization: `${getAuthorizationPrefix(credentials.type)} ${credentials.token}`,
		},
	});
	return await getFormattedStrikes(format, response);
	//GET
}
async function fetchAndFormatRetryingOnFail(format: SupportedMimeType.GeoJson, params: StrikeQueryParameters): Promise<LightningFeatureCollectionV3>;
async function fetchAndFormatRetryingOnFail(format: SupportedMimeType.GeoJsonV3, params: StrikeQueryParameters): Promise<LightningFeatureCollectionV3>;
async function fetchAndFormatRetryingOnFail(format: SupportedMimeType.GeoJsonV2, params: StrikeQueryParameters): Promise<LightningFeatureCollectionV2>;
async function fetchAndFormatRetryingOnFail(format: SupportedMimeType.Blitzen, params: StrikeQueryParameters): Promise<BlitzenVersion3>;
async function fetchAndFormatRetryingOnFail(format: SupportedMimeType.BlitzenV3, params: StrikeQueryParameters): Promise<BlitzenVersion3>;
async function fetchAndFormatRetryingOnFail(format: SupportedMimeType.BlitzenV2, params: StrikeQueryParameters): Promise<BlitzenVersion2>;
async function fetchAndFormatRetryingOnFail(format: SupportedMimeType.BlitzenV1, params: StrikeQueryParameters): Promise<BlitzenVersion1>;
async function fetchAndFormatRetryingOnFail(format: SupportedMimeType.KML, params: StrikeQueryParameters): Promise<kml>;
async function fetchAndFormatRetryingOnFail(format: SupportedMimeType.CSV, params: StrikeQueryParameters): Promise<Csv>;
async function fetchAndFormatRetryingOnFail(format: SupportedMimeType, queryParameters: StrikeQueryParameters) {
	let numberOfRetries = 3;
	while (true) {
		try {
			return await fetchStrikes(format, queryParameters);
		} catch (error) {
			numberOfRetries--;
			if (numberOfRetries === 0) {
				throw error;
			}
		}
	}
}
// async function getFormattedStrikes(format: SupportedMimeType.GeoJson, response: Response): Promise<LightningFeatureCollectionV3>;
// async function getFormattedStrikes(format: SupportedMimeType.GeoJsonV3, response: Response): Promise<LightningFeatureCollectionV3>;
// async function getFormattedStrikes(format: SupportedMimeType.GeoJsonV2, response: Response): Promise<LightningFeatureCollectionV2>;
// async function getFormattedStrikes(format: SupportedMimeType.Blitzen, response: Response): Promise<BlitzenVersion3>;
// async function getFormattedStrikes(format: SupportedMimeType.BlitzenV3, response: Response): Promise<BlitzenVersion3>;
// async function getFormattedStrikes(format: SupportedMimeType.BlitzenV2, response: Response): Promise<BlitzenVersion2>;
// async function getFormattedStrikes(format: SupportedMimeType.BlitzenV1, response: Response): Promise<BlitzenVersion1>;
// async function getFormattedStrikes(format: SupportedMimeType.KML, response: Response): Promise<kml>;
// async function getFormattedStrikes(format: SupportedMimeType.CSV, response: Response): Promise<Csv>;
async function getFormattedStrikes(format: SupportedMimeType, response: Response): Promise<SupportedMimeTypeTypes> {
	switch (format) {
		case SupportedMimeType.GeoJson: {
			// Fallthrough
		}
		case SupportedMimeType.GeoJsonV3: {
			return response.json() as Promise<LightningFeatureCollectionV3>;
		}
		case SupportedMimeType.GeoJsonV2: {
			return response.json() as Promise<LightningFeatureCollectionV2>;
		}
		case SupportedMimeType.Blitzen: {
			// Fallthrough
		}
		case SupportedMimeType.BlitzenV3: {
			return response.json() as Promise<BlitzenVersion3>;
		}
		case SupportedMimeType.BlitzenV2: {
			return response.json() as Promise<BlitzenVersion2>;
		}
		case SupportedMimeType.BlitzenV1: {
			return response.json() as Promise<BlitzenVersion1>;
		}
		case SupportedMimeType.KML: {
			const kml = await response.text();
			const x = (await parseStringPromise(kml, {})) as kml;
			return x;
		}
		case SupportedMimeType.CSV: {
			const [header, ...body] = (await response.text()).split('\n');
			return {
				header,
				body,
			};
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

function mergeStrikes(
	format: SupportedMimeType.GeoJsonV3,
	strikeCollectionOne: LightningFeatureCollectionV3,
	strikeCollectionTwo: LightningFeatureCollectionV3
): LightningFeatureCollectionV3;
function mergeStrikes(
	format: SupportedMimeType.GeoJsonV3,
	strikeCollectionOne: LightningFeatureCollectionV2,
	strikeCollectionTwo: LightningFeatureCollectionV2
): LightningFeatureCollectionV2;
function mergeStrikes(format: SupportedMimeType.Blitzen, strikeCollectionOne: BlitzenVersion3, strikeCollectionTwo: BlitzenVersion3): BlitzenVersion3;
function mergeStrikes(format: SupportedMimeType.BlitzenV3, strikeCollectionOne: BlitzenVersion3, strikeCollectionTwo: BlitzenVersion3): BlitzenVersion3;
function mergeStrikes(format: SupportedMimeType.BlitzenV2, strikeCollectionOne: BlitzenVersion2, strikeCollectionTwo: BlitzenVersion2): BlitzenVersion2;
function mergeStrikes(format: SupportedMimeType.BlitzenV1, strikeCollectionOne: BlitzenVersion1, strikeCollectionTwo: BlitzenVersion1): BlitzenVersion1;
function mergeStrikes(format: SupportedMimeType.KML, strikeCollectionOne: kml, strikeCollectionTwo: kml): kml;
function mergeStrikes(format: SupportedMimeType.CSV, strikeCollectionOne: Csv, strikeCollectionTwo: Csv): Csv;
function mergeStrikes<T extends SupportedMimeTypeTypes>(format: SupportedMimeType, strikeCollectionOne: T, strikeCollectionTwo: T): T {
	switch (format) {
		case SupportedMimeType.CSV: {
			((strikeCollectionOne as any) as string[]).concat(((strikeCollectionTwo as any) as string[]).slice(1));
		}
		case SupportedMimeType.GeoJsonV3: {
			return strikeCollectionOne;
		}
	}
	return strikeCollectionOne;
}

export { getAuthorizationPrefix, fetchStrikes, getFormattedStrikes, mergeStrikes };
