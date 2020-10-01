import { DateTime } from "luxon";
import { ConfigType, readConfig, writeConfig } from './file-utils';
import { SupportedMimeType, LightningDataNetworkProvider, LightningStrikeDirection } from "../api-client/strike-api";
import { MAXIMUM_QUERIES_AT_ONCE, MAXIMUM_STRIKES_IN_ONE_QUERY } from "../friendly-api";
import { OutputDetails, OutputTypes, OutputTokens } from "./commands";

interface ClientConfiguration {
	from: string;
	format: SupportedMimeType;
	bbox: [number, number, number, number],
	providers: LightningDataNetworkProvider[];
	directions: LightningStrikeDirection[];
	limit: number;
	parallelQueries: number;
	chunkDuration: string;
	outputDetails: OutputDetails;
}

const DEFAULT_TIME_FORMAT = `yyyy_LL_dd'T'HH_mm_ss_SSS'Z'`;
const DEFAULT_FILE_NAME_FORMAT = `${OutputTokens.START_DATE_TOKEN}--${OutputTokens.END_DATE_TOKEN}`
const DEFAULT_DIRECTORY = '.';
const DEFAULT_CONFIGURATION: ClientConfiguration = {
	from: DateTime.utc().startOf('hour').toISO(),
	format: SupportedMimeType.GeoJsonV3,
	bbox: [-180, -90, 180, 90],
	providers: [LightningDataNetworkProvider.toa],
	directions: [LightningStrikeDirection.CLOUD, LightningStrikeDirection.GROUND],
	limit: MAXIMUM_STRIKES_IN_ONE_QUERY,
	parallelQueries: MAXIMUM_QUERIES_AT_ONCE,
	chunkDuration: 'PT15M',
	outputDetails: {
		type: OutputTypes.FILE,
		directory: DEFAULT_DIRECTORY,
		fileNameFormat: DEFAULT_FILE_NAME_FORMAT,
		timeFormat: DEFAULT_TIME_FORMAT
	}
}

const loadStoredConfiguration = async (): Promise<ClientConfiguration | undefined> => {
	return await readConfig<ClientConfiguration>(ConfigType.Configuration);
}

const storeConfiguration = async (configuration: ClientConfiguration) => {
	await writeConfig<ClientConfiguration>(ConfigType.Configuration, configuration);
}

export {
	DEFAULT_CONFIGURATION,
	DEFAULT_TIME_FORMAT,
	DEFAULT_FILE_NAME_FORMAT,
	DEFAULT_DIRECTORY,
	ClientConfiguration,
	loadStoredConfiguration,
	storeConfiguration
}