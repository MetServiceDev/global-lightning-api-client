import yargs, { Options, string, config } from 'yargs';
import { SupportedMimeType, LightningDataNetworkProvider, LightningStrikeDirection, CredentialsDetails } from '../api-client/strike-api';
import { loadStoredAuthenticationDetails, storeAuthenticationDetails } from '../cli/auth-config';
import { validateBbox, validateDateTime, validateParallelQueries, validateLimit, validateTimeFormat, validateFileNameFormat, validateChoiceCaseInsensitive, validateMultipleChoiceCaseInsensitive } from '../cli/input-validation';
import {
	askForBoundingBox,
	askForTime,
	askForStrikeFormat,
	askForParallelQueries,
	askForLimit,
	askForDirections,
	askForAuthenticationDetails,
	askForCommand,
	askForProviders,
	askForDuration,
	askForOutputType,
	askForDirectory,
	askForFileNameFormat,
	askForTimeFormat,
	confirmOverwriteOfConfiguration,
	queryWhetherToUpdateAuthenticationDetails
} from '../cli/cli-interfaces'
import { ClientConfiguration, DEFAULT_CONFIGURATION, loadStoredConfiguration, storeConfiguration } from '../cli/config';
import { OutputTypes, queryForLightningData, getLatestStrikeBatches, streamLatestStrikeBatches, OutputDetails, Command } from '../cli/commands';
import { LightningDataNetworkProviders } from '..';

interface OpenEndedQueryCliArguments {
	_: string[];
	from?: string;
	format?: (keyof typeof SupportedMimeType);
	bbox?: [number, number, number, number];
	providers?: (keyof typeof LightningDataNetworkProvider)[],
	directions?: (keyof typeof LightningStrikeDirection)[],
	limit?: number;
	parallelQueries?: number;
	chunkDuration?: string;
	interactive: boolean;
	reconfirm?: boolean;
	outputType?: (keyof typeof OutputTypes);
	outputTimeFormat?: string;
	fileNameFormat?: string;
	outputDirectory?: string;
}
interface CloseEndedQueryCliArguments extends OpenEndedQueryCliArguments {
	to?: string;
}

const getOrThrowAuthentication = async (args: OpenEndedQueryCliArguments, credentials: CredentialsDetails | undefined): Promise<CredentialsDetails> => {
	if (!credentials) {
		if (!args.interactive) {
			throw new Error('Credentials are not configured and not in interactive mode');
		}
		return await askForAuthenticationDetails(credentials);
	}
	return credentials;
}

/**
 * Produces a unified client configuration giving the arguments precedence over a saved configuration.
 * If in interactive mode, double checks configuration with the user.
 * If not in interactive mode, throws an error if there is not a saved configuration and there are any missing arguments
 */
const getOrThrowConfigurationUsingArgs = async (args: OpenEndedQueryCliArguments, savedConfiguration: ClientConfiguration | undefined): Promise<ClientConfiguration> => {
	const configurationToUse = savedConfiguration ? JSON.parse(JSON.stringify(savedConfiguration)) : DEFAULT_CONFIGURATION;
	let undefinedKeys: string[] = [];
	const SHOULD_ASK = args.interactive && (!savedConfiguration || args.reconfirm);
	if (args.from) {
		configurationToUse.from = args.from;
	} else {
		if (SHOULD_ASK) {
			configurationToUse.from = await askForTime({ type: 'from', configuration: configurationToUse });
		} else if (!savedConfiguration) {
			undefinedKeys.push('from');
		}
	}

	if (args.bbox) {
		configurationToUse.bbox = args.bbox;
	} else {
		if (SHOULD_ASK) {
			configurationToUse.bbox = await askForBoundingBox(configurationToUse);
		} else if (!savedConfiguration) {
			undefinedKeys.push('bbox');
		}
	}

	if (args.directions) {
		configurationToUse.directions = args.directions.map((direction) => LightningStrikeDirection[direction])
	} else {
		if (SHOULD_ASK) {
			configurationToUse.directions = await askForDirections(configurationToUse);
		} else if (!savedConfiguration) {
			undefinedKeys.push('directions')
		}
	}

	if (args.format) {
		configurationToUse.format = SupportedMimeType[args.format];
	} else {
		if (SHOULD_ASK) {
			configurationToUse.format = await askForStrikeFormat(configurationToUse);
		} else if (!savedConfiguration) {
			undefinedKeys.push('format');
		}
	}
	if (args.limit) {
		configurationToUse.limit = args.limit;
	} else {
		if (SHOULD_ASK) {
			configurationToUse.limit = await askForLimit(configurationToUse);
		} else if (!savedConfiguration) {
			undefinedKeys.push('limit');
		}
	}
	if (args.parallelQueries) {
		configurationToUse.parallelQueries = args.parallelQueries;
	} else {
		if (SHOULD_ASK) {
			configurationToUse.parallelQueries = await askForParallelQueries(configurationToUse);
		} else if (!savedConfiguration) {
			undefinedKeys.push('parallelQueries');
		}
	}
	if (args.chunkDuration) {
		configurationToUse.chunkDuration = args.chunkDuration;
	} else {
		if (SHOULD_ASK) {
			configurationToUse.chunkDuration = await askForDuration(configurationToUse);
		} else if (!savedConfiguration) {
			undefinedKeys.push('chunkDuration');
		}
	}
	if (args.providers) {
		configurationToUse.providers = args.providers.map((provider) => LightningDataNetworkProviders[provider]);
	} else {
		if (SHOULD_ASK) {
			configurationToUse.providers = await askForProviders(configurationToUse);
		} else if (!savedConfiguration) {
			undefinedKeys.push('providers');
		}
	}
	const outputDetails: OutputDetails = configurationToUse.outputDetails;
	if (args.outputType) {
		outputDetails.type = OutputTypes[args.outputType];
	} else {
		if (SHOULD_ASK) {
			outputDetails.type = await askForOutputType(outputDetails);
		} else if (!savedConfiguration) {
			undefinedKeys.push('outputType');
		}
	}
	if (outputDetails.type !== OutputTypes.STDOUT) {
		if (args.outputDirectory) {
			outputDetails.directory = args.outputDirectory;
		} else {
			if (SHOULD_ASK) {
				outputDetails.directory = await askForDirectory(outputDetails);
			} else if (!savedConfiguration) {
				undefinedKeys.push('outputDirectory');
			}
		}
		if (args.outputTimeFormat) {
			outputDetails.timeFormat = args.outputTimeFormat;
		} else {
			if (SHOULD_ASK) {
				outputDetails.timeFormat = await askForTimeFormat(outputDetails);
			} else if (!savedConfiguration) {
				undefinedKeys.push('outputTimeFormat');
			}
		}
		if (args.fileNameFormat) {
			outputDetails.fileNameFormat = args.fileNameFormat;
		} else {
			if (SHOULD_ASK) {
				outputDetails.fileNameFormat = await askForFileNameFormat(outputDetails);
			} else if (!savedConfiguration) {
				undefinedKeys.push('fileNameFormat');
			}
		}
	}
	configurationToUse.outputDetails = outputDetails;
	if (undefinedKeys.length > 0) {
		throw new Error(`No configuration defined, and missing the following arguments "${undefinedKeys.join('", "')}"`)
	}
	process.env.showProgress = `${true}`;
	return configurationToUse;
}

interface RunningConfiguration {
	credentials: CredentialsDetails,
	loadedConfiguration: undefined | ClientConfiguration,
	runningConfiguration: ClientConfiguration
}
const getRunningConfiguration = async (args: OpenEndedQueryCliArguments): Promise<RunningConfiguration> => {
	let credentials = await loadStoredAuthenticationDetails();
	credentials = await getOrThrowAuthentication(args, credentials);
	const loadedConfiguration = await loadStoredConfiguration();
	const runningConfiguration = await getOrThrowConfigurationUsingArgs(args, loadedConfiguration);
	return {
		credentials,
		loadedConfiguration,
		runningConfiguration
	}
}

const getToTime = async (args: CloseEndedQueryCliArguments) => {
	let to = args.to;
	if (!to) {
		if (args.interactive) {
			to = await askForTime({ type: 'to' });
		} else {
			throw new Error('Not in interactive mode and "to" was not passed in');
		}
	}
	return to;
}

const interactiveCli = async (args: CloseEndedQueryCliArguments) => {
	const command = await askForCommand();
	const reconfirm = args.reconfirm === undefined ? args._.length === 0 || command === Command.QUERY : args.reconfirm;
	const updatedArgs = {
		...args,
		interactive: true,
		reconfirm
	}
	// Double check values if no script was called or we are querying. Use the user-provided value
	const { runningConfiguration, loadedConfiguration, credentials } = await getRunningConfiguration(updatedArgs);
	const overwrite = await confirmOverwriteOfConfiguration(loadedConfiguration, runningConfiguration);
	if (overwrite) {
		await storeConfiguration(runningConfiguration);
	}
	switch (command) {
		case Command.QUERY: {
			const to = await getToTime(updatedArgs);
			return await queryForLightningData(credentials, {
				...runningConfiguration,
				to
			})
		}
		case Command.POLL: {
			return await getLatestStrikeBatches(credentials, runningConfiguration);
		}
		case Command.STREAM: {
			return await streamLatestStrikeBatches(credentials, runningConfiguration);
		}
	}
}

const authenticate = async () => {
	let credentials = await loadStoredAuthenticationDetails();
	credentials = await askForAuthenticationDetails(credentials);
	storeAuthenticationDetails(credentials);
}

const configure = async (args: OpenEndedQueryCliArguments) => {
	let configuration = await loadStoredConfiguration();
	let credentials = await loadStoredAuthenticationDetails();
	const updateCredentials = await queryWhetherToUpdateAuthenticationDetails(credentials);
	if (updateCredentials) {
		credentials = await askForAuthenticationDetails(credentials);
		storeAuthenticationDetails(credentials);
	}
	const updatedConfiguration = await getOrThrowConfigurationUsingArgs({ ...args, interactive: true }, configuration);
	const overwrite = await confirmOverwriteOfConfiguration(configuration, updatedConfiguration);
	if (overwrite) {
		await storeConfiguration(updatedConfiguration);
	}
}
const query = async (args: CloseEndedQueryCliArguments) => {
	const { credentials, runningConfiguration } = await getRunningConfiguration({
		...args,
		reconfirm: args.reconfirm === undefined ? true : args.reconfirm
	});
	const to = await getToTime(args);
	await queryForLightningData(credentials, {
		...runningConfiguration,
		to
	})
}
const latestBatch = async (args: OpenEndedQueryCliArguments) => {
	const { credentials, runningConfiguration } = await getRunningConfiguration(args);
	await getLatestStrikeBatches(credentials, runningConfiguration);
}
const streamLatestBatch = async (args: OpenEndedQueryCliArguments) => {
	const { credentials, runningConfiguration } = await getRunningConfiguration(args);
	await streamLatestStrikeBatches(credentials, runningConfiguration);
}

export {
	interactiveCli,
	authenticate,
	configure,
	query,
	latestBatch,
	streamLatestBatch
}