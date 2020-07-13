import { ExampleArguments, fetchAllFinishedData, fetchPeriodOfStrikesAsTheyAreFinalised, fetchLargePeriodOfData, fetchHistoricData } from './examples';
import { CredentialType } from '../src';

/**
 * This is for manually verifying that things work as expected. It will take a long time.
 * These may eventually become integration/end-to-end tests.
 */

const defaultArguments: ExampleArguments = {
	credentials: {
		type: CredentialType.apiKey,
		token: '',
	},
	folderToDownloadStrikesTo: './dist/bin/example-output',
};

fetchAllFinishedData(defaultArguments);
