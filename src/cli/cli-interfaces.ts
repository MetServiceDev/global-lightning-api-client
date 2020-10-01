import { prompt } from 'enquirer';
import { DateTime, Duration } from 'luxon';
import { formatters, diff } from 'jsondiffpatch';
import { FINALISED_HISTORY_TIME } from '../friendly-api';
import { CredentialType, CredentialsDetails, SupportedMimeType, LightningStrikeDirection } from "../api-client/strike-api";
import { Command, OutputTokens, OutputTypes, OutputDetails, commandDescriptions } from './commands';
import { ClientConfiguration, DEFAULT_DIRECTORY, DEFAULT_TIME_FORMAT, DEFAULT_FILE_NAME_FORMAT } from './config';
import { validateBbox, runValidationAsEnquirerPrompt, validateDateTime, getValidationAsEnquirerResult, validateLimit, validateParallelQueries, validateDuration, validateTimeFormat } from './input-validation';
import { LightningDataNetworkProviders } from '../index';
import chalk from 'chalk';

const INITIAL_ISO = '2020-01-22T01:22:33.456Z';

const askForCommand = async () => {
	const { command } = (await prompt({
		type: 'select',
		choices: [
			{
				name: Command.QUERY,
				message: `${Command.QUERY} - ${commandDescriptions[Command.QUERY]}`
			}, {
				name: Command.POLL,
				message: `${Command.POLL} - ${commandDescriptions[Command.POLL]}`
			},
			{
				name: Command.STREAM,
				message: `${Command.STREAM} - ${commandDescriptions[Command.STREAM]}`
			}
		],
		message: 'What would you like to do?',
		// initial: Command.QUERY,
		name: 'command'
	} as any) as { command: Command });
	return command;
}

const askForStrikeFormat = async (configuration: ClientConfiguration) => {
	const { format } = (await prompt({
		type: 'autocomplete',
		choices: Object.entries(SupportedMimeType).map(([key, value]) => ({
			name: value,
			message: `${chalk.bold(key)} - ${value}`
		})),
		message: 'What format would you like the strikes in?',
		initial: configuration.format,
		name: 'format'
	} as any) as { format: SupportedMimeType });
	return format;
};

type TimeQuestion = {
	type: 'from',
	configuration: ClientConfiguration
} | { type: 'to' }
const askForTime = async (question: TimeQuestion): Promise<string> => {
	const { time } = await prompt({
		type: 'input',
		message: `When do you want lightning data ${question.type}?`,
		name: 'time',
		initial: question.type === 'from' ? question.configuration.from : DateTime.utc().minus(Duration.fromISO(FINALISED_HISTORY_TIME)).toISO(),
		validate: runValidationAsEnquirerPrompt(validateDateTime)
	}) as { time: string };
	return time;
}

const askForDuration = async (configuration: ClientConfiguration): Promise<string> => {
	const { duration } = await prompt({
		type: 'input',
		message: 'What period of time would you like break the queries into?',
		name: 'duration',
		initial: configuration.chunkDuration,
		validate: runValidationAsEnquirerPrompt(validateDuration),
		footer: `${chalk.red('Warning:')} Increasing this will increase the delay between fetches in the "${Command.POLL}" and "${Command.STREAM}" commands and will adversely affect performance`
	} as any) as { duration: string };
	return duration;
}

const askForDirections = async (configuration: ClientConfiguration) => {
	const { directions } = (await prompt({
		type: 'multiselect',
		choices: [
			{
				name: LightningStrikeDirection.CLOUD,
				message: "Cloud to Cloud strikes"
			}, {
				name: LightningStrikeDirection.GROUND,
				message: "Cloud to Ground strikes"
			}
		],
		message: 'What directions would you like the strikes from?',
		initial: configuration.directions,
		name: 'directions'
	} as any) as { directions: LightningStrikeDirection[] });
	return directions;
};

const askForProviders = async (configuration: ClientConfiguration) => {
	const { providers } = (await prompt({
		type: 'multiselect',
		choices: [
			{
				name: LightningDataNetworkProviders.toa,
				message: `${LightningDataNetworkProviders.toa} - Global lightning data network`
			},
			{
				name: LightningDataNetworkProviders.transpower,
				message: `${LightningDataNetworkProviders.transpower} - NZ specific lightning data`
			},
			{
				name: LightningDataNetworkProviders.mock,
				message: `${LightningDataNetworkProviders.mock} - Mock data for testing purposes`
			}
		],
		message: 'Which providers would you like the strikes from?',
		initial: configuration.providers,
		name: 'providers'
	} as any) as { providers: LightningDataNetworkProviders[] });
	return providers;
};

const askForLimit = async (configuration: ClientConfiguration): Promise<number> => {
	const { limit } = await prompt({
		type: 'input',
		message: `Maximum strikes to fetch in one query?`,
		name: 'limit',
		initial: configuration.limit,
		validate: runValidationAsEnquirerPrompt(validateLimit)
	}) as { limit: string };
	return validateLimit(limit);
}

const askForParallelQueries = async (configuration: ClientConfiguration): Promise<number> => {
	const { parallelQueries } = await prompt({
		type: 'input',
		message: `Maximum queries to run in parallel?`,
		name: 'parallelQueries',
		initial: configuration.parallelQueries,
		validate: runValidationAsEnquirerPrompt(validateParallelQueries)
	}) as { parallelQueries: string };
	return validateParallelQueries(parallelQueries);
}

const askForBoundingBox = async (configuration: ClientConfiguration): Promise<[number, number, number, number]> => {
	const [llon, llat, ulon, ulat] = configuration.bbox;
	const { bbox } = await prompt({
		type: 'input',
		message: `What bounding box would you like data in?`,
		name: 'bbox',
		initial: `${llon},${llat} ${ulon},${ulat}`,
		validate: (value: string): string | boolean => {
			const bbox = value.split(/[,\s]/);
			return getValidationAsEnquirerResult(() => validateBbox(bbox));
		},
	}) as { bbox: string };
	return validateBbox(bbox.split(/[,\s]/));
}

const queryWhetherToUpdateAuthenticationDetails = async (currentCredentials: CredentialsDetails | undefined): Promise<boolean> => {
	if (!currentCredentials) {
		return true;
	}
	const { updateCredentials } = (await prompt({
		type: 'toggle',
		message: 'Do you want to update your credentials?',
		name: 'updateCredentials',
		initial: false
	}) as { updateCredentials: boolean });
	return updateCredentials;
}

const askForAuthenticationDetails = async (currentCredentials: CredentialsDetails | undefined): Promise<CredentialsDetails> => {
	const warningFooter = `${chalk.redBright.bold('WARNING:')} While we will attempt to securely store these credentials, you should ${chalk.yellow.bold.underline('only')} enter them on trusted and secure systems!`
	const { credentialType } = (await prompt({
		type: 'select',
		choices: [
			{
				name: CredentialType.jwt,
				value: CredentialType.jwt,
				message: 'A non-renewable time-limited cryptographically secure token'
			},
			{
				name: CredentialType.apiKey,
				message: 'An API Key'
			},
			{
				name: CredentialType.clientCredentials,
				message: 'Secure client id and secret that will be periodically exchanged for a JWT'
			}
		],
		initial: currentCredentials?.type || CredentialType.clientCredentials,
		footer: warningFooter,
		message: 'What type of authentication credentials do you have?',
		name: 'credentialType'
	} as any) as { credentialType: CredentialType });
	if (credentialType === CredentialType.apiKey || credentialType === CredentialType.jwt) {
		const { token } = await prompt({
			type: 'input',
			message: `What is your ${credentialType}?`,
			name: 'token',
			footer: warningFooter,
			initial: currentCredentials?.type === credentialType ? currentCredentials.token : ''
		} as any) as { token: string };
		return {
			type: credentialType,
			token
		}
	}
	const { clientId } = await prompt({
		type: 'input',
		message: `What is your client id?`,
		name: 'clientId',
		initial: currentCredentials?.type === credentialType ? currentCredentials.clientId : '',
		footer: warningFooter,
	} as any) as { clientId: string };
	const { clientSecret } = await prompt({
		type: 'input',
		message: `What is your client secret?`,
		name: 'clientSecret',
		initial: currentCredentials?.type === credentialType ? currentCredentials.clientSecret : '',
		footer: warningFooter,
	} as any) as { clientSecret: string };
	return {
		type: credentialType,
		clientId,
		clientSecret
	};
}

const askForOutputType = async (outputDetails: OutputDetails): Promise<OutputTypes> => {
	const { outputType } = (await prompt({
		type: 'select',
		choices: [
			{
				name: OutputTypes.STDOUT,
				message: 'The terminal you ran this in'
			}, {
				name: OutputTypes.FILE,
				message: 'A file on disk'
			}
		],
		message: 'Where would you like the output?',
		name: 'outputType',
		initial: outputDetails.type
	} as any) as { outputType: keyof typeof OutputTypes });
	return OutputTypes[outputType];
}

const askForTimeFormat = async (outputDetails: OutputDetails): Promise<string> => {
	const DEFAULT_FORMATTING = outputDetails.type === OutputTypes.FILE ? outputDetails.timeFormat : DEFAULT_TIME_FORMAT;
	const { timeFormat } = await prompt({
		type: 'input',
		message: `How do you want to format the time string?`,
		name: 'timeFormat',
		initial: DEFAULT_FORMATTING,
		header: `See https://moment.github.io/luxon/docs/manual/parsing.html#table-of-tokens for a list of tokens you can use in formatting the time string`,
		footer: `The initial value would transform "${INITIAL_ISO}" to "${DateTime.fromISO(INITIAL_ISO, { zone: 'utc' }).toFormat(DEFAULT_FORMATTING)}"`,
		validate: runValidationAsEnquirerPrompt(validateTimeFormat)
	} as any) as { timeFormat: string };
	return timeFormat;
}

const askForFileNameFormat = async (outputDetails: OutputDetails): Promise<string> => {
	const { fileNameFormat } = await prompt({
		type: 'input',
		name: 'fileNameFormat',
		message: `File name format? ${Object.values(OutputTokens).join(', ')} will be replaced with their actual value`,
		footer: 'Files will be overwritten if they share the same name',
		initial: outputDetails.type === OutputTypes.FILE ? outputDetails.fileNameFormat : DEFAULT_FILE_NAME_FORMAT,
	} as any) as { fileNameFormat: string };
	return fileNameFormat;
}

const askForDirectory = async (outputDetails: OutputDetails): Promise<string> => {
	const { directory } = await prompt({
		type: 'input',
		name: 'directory',
		message: `What directory do you want the output files in?`,
		initial: outputDetails.type === OutputTypes.FILE ? outputDetails.directory : DEFAULT_DIRECTORY,
	}) as { directory: string };
	return directory;
}

const confirmOverwriteOfConfiguration = async (oldConfiguration: ClientConfiguration | undefined, newConfiguration: ClientConfiguration): Promise<boolean> => {
	if (!oldConfiguration) {
		return true;
	}
	const difference = diff(oldConfiguration, newConfiguration);
	if (!difference) {
		return false;
	}
	const { updateConfiguration } = (await prompt({
		type: 'toggle',
		message: 'Do you want to update your configuration?',
		name: 'updateConfiguration',
		initial: false,
		footer: JSON.stringify((formatters as any).jsonpatch.format(difference, newConfiguration), null, 2)
	} as any) as { updateConfiguration: boolean });
	return updateConfiguration;
}

export {
	askForAuthenticationDetails,
	askForBoundingBox,
	askForCommand,
	askForDirections,
	askForDirectory,
	askForDuration,
	askForFileNameFormat,
	askForLimit,
	askForOutputType,
	askForParallelQueries,
	askForProviders,
	askForStrikeFormat,
	askForTime,
	askForTimeFormat,
	confirmOverwriteOfConfiguration,
	queryWhetherToUpdateAuthenticationDetails
}