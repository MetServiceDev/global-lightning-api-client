import { promisify } from "util";
import { readFile, writeFile, mkdir, readdir } from "fs";
import { homedir } from "os";

const readFilePromise = promisify(readFile);
const readdirPromise = promisify(readdir);
const writeFilePromise = promisify(writeFile);
const mkdirPromise = promisify(mkdir);
const METRAWEATHER_FOLDER = `${homedir()}/.metraweather`;
enum ConfigType {
	Credentials = 'credentials',
	Configuration = 'configuration',
}
const CONFIGURATION_PATH = (configType: ConfigType) => `${METRAWEATHER_FOLDER}/${configType}`;

async function readConfig<T>(configType: ConfigType): Promise<T | undefined> {
	try {
		const file = await readFilePromise(CONFIGURATION_PATH(configType));
		const configDetails = file.toString()
		if (configDetails.length > 0) {
			return JSON.parse(configDetails) as T;
		}
		return undefined;
	} catch (error) {
		return undefined;
	}
}

async function writeConfig<T>(configType: ConfigType, configuration: T) {
	await mkdirPromise(METRAWEATHER_FOLDER, { recursive: true });
	await writeFilePromise(CONFIGURATION_PATH(configType), JSON.stringify(configuration, null, 2));
}

const listFilesInDirectory = async (directory: string) => {
	await mkdirPromise(directory, { recursive: true });
	const files = await readdirPromise(directory);
	return files;
}

export {
	ConfigType,
	readConfig,
	writeConfig,
	listFilesInDirectory
}