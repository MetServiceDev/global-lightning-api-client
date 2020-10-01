import yargs, { Options } from 'yargs';
import { SupportedMimeType, LightningDataNetworkProvider, LightningStrikeDirection } from '../api-client/strike-api';
import { validateBbox, validateDateTime, validateParallelQueries, validateLimit, validateTimeFormat, validateFileNameFormat, validateChoiceCaseInsensitive, validateMultipleChoiceCaseInsensitive } from '../cli/input-validation';
import { OutputTypes, Command, commandDescriptions } from '../cli/commands';
import { interactiveCli, authenticate, configure, query, latestBatch, streamLatestBatch } from '../cli/cli-runner';

const OPEN_ENDED_QUERY_ARGS: { [key: string]: Options } = {
	from: {
		type: 'string',
		describe: 'ISO-8601 date to start fetching strikes from',
		coerce: validateDateTime,
	},
	format: {
		type: 'string',
		describe: 'The format you want strikes back in',
		choices: Object.keys(SupportedMimeType),
		coerce: validateChoiceCaseInsensitive(Object.keys(SupportedMimeType))
	},
	bbox: {
		type: 'array',
		describe: 'The bbox you want strikes inside. Format: lower-left-longitude lower-left-latitude upper-right-longitude upper-right-latitude',
		coerce: validateBbox
	},
	providers: {
		type: 'array',
		describe: 'The Lightning Detection Network provider you want data from',
		choices: Object.keys(LightningDataNetworkProvider),
		coerce: validateMultipleChoiceCaseInsensitive(Object.keys(LightningDataNetworkProvider))
	},
	directions: {
		type: 'array',
		describe: 'The type/direction of lightning data you want',
		choices: Object.keys(LightningStrikeDirection),
		coerce: validateMultipleChoiceCaseInsensitive(Object.keys(LightningStrikeDirection))
	},
	limit: {
		type: 'number',
		describe: 'The maximum amount of strikes you want to fetch in one',
		coerce: validateLimit
	},
	parallelQueries: {
		type: 'number',
		alias: ['parallel-queries', 'p'],
		describe: 'The maximum amount of queries than can run at once',
		coerce: validateParallelQueries
	},
	jwt: {
		type: 'string',
		describe: 'A JWT for running this command. All other credential options must run the "authenticate" command first'
	},
	outputType: {
		type: 'string',
		describe: 'Where you want the strikes to be sent',
		choices: Object.keys(OutputTypes),
		coerce: validateChoiceCaseInsensitive(Object.keys(OutputTypes))
	},
	fileNameTimeFormat: {
		type: 'string',
		describe: 'How to format time strings in the file name',
		coerce: validateTimeFormat
	},
	fileNameFormat: {
		type: 'string',
		describe: 'How to format the file names',
		coerce: validateFileNameFormat
	},
	outputDirectory: {
		type: 'string',
		describe: 'The directory you want files to go into'
	},
	interactive: {
		type: 'boolean',
		describe: 'Shows progress bars and instead of failing if a required parameter is missing, it will ask for it instead.',
		default: false,
	},
	reconfirm: {
		type: 'boolean',
		describe: 'Reconfirms the configuration with you before running the command (must be in interactive mode)'
	}
};

const TO_OPTION: { [key: string]: Options } = {
	to: {
		global: false,
		type: 'string',
		describe: 'ISO-8601 date to stop fetching strikes at',
		coerce: validateDateTime
	}
}

yargs
	.command('*', 'Interactively discover options and configure the client', (yargs) => {
		yargs.options({
			...OPEN_ENDED_QUERY_ARGS
		})
	}, interactiveCli)
	.command('authenticate', 'Store your client credentials or API Key', (yargs) => {
		yargs.options({});
	}, authenticate)
	.command('configure', 'Update the configuration (authentication, bbox, from time, etc)', (yargs) => {
		yargs.options({
			...OPEN_ENDED_QUERY_ARGS,
			interactive: {
				...OPEN_ENDED_QUERY_ARGS.interactive,
				default: true
			},
		});
	}, configure)
	.command(Command.QUERY, commandDescriptions[Command.QUERY], (yargs) => {
		yargs.options({
			...OPEN_ENDED_QUERY_ARGS,
			interactive: {
				...OPEN_ENDED_QUERY_ARGS.interactive,
				default: true
			},
			...TO_OPTION
		})
	}, query)
	.command(Command.POLL, commandDescriptions[Command.POLL], (yargs) => {
		yargs.options(OPEN_ENDED_QUERY_ARGS);
	}, latestBatch)
	.command(Command.STREAM, commandDescriptions[Command.STREAM], (yargs) => {
		yargs.options(OPEN_ENDED_QUERY_ARGS);
	}, streamLatestBatch).argv;