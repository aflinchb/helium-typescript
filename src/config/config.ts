import { ILoggingProvider } from "../logging/iLoggingProvider";
import { KeyVaultProvider } from "../secrets/keyvaultprovider";
import {
    keyVaultName, cosmosCollection, cosmosDatabase, cosmosKey, cosmosUrl,
    appInsightsKey, portConstant,
} from "./constants";

// Gets configuration details needed to connect to KeyVault, CosmosDB, and AppInsights.
export async function getConfigValues(
    log: ILoggingProvider): Promise<{
        port: number, cosmosDbKey: string, cosmosDbUrl: string,
        database: string, collection: string, insightsKey: string,
    }> {
    // port comes from keyvault or default value if not set
    let port: number;
    const PORT_DEFAULT: number = 4120;
    // cosmosDbKey comes from KeyVault
    let cosmosDbKey: string;
    let cosmosDbUrl: string;
    let database: string;
    let collection: string;
    // insightsKey comes from KeyVault
    let insightsKey: string;

    log.Trace("Getting configuration values");

    let keyVaultUrl: string = process.env[keyVaultName];
    if (keyVaultUrl && !keyVaultUrl.startsWith("https://")) {
        keyVaultUrl = "https://" + keyVaultUrl + ".vault.azure.net/";
    }

    if (!keyVaultUrl) {
        log.Trace("Key Vault name missing: " + keyVaultUrl);
        process.exit(1);
    }

    log.Trace("Trying to read from keyvault " + keyVaultUrl);
    const keyvault: KeyVaultProvider = new KeyVaultProvider(keyVaultUrl, log);
    try {
        try {
            port = parseInt(await keyvault.getSecret(portConstant), 10);
        } catch (e) {
            log.Trace("Port not stored in keyvault.");
        }

        if (isNaN(port)) {
            log.Trace("Using default port 4120.");
            port = PORT_DEFAULT;
        } else {
            log.Trace("Got port from keyvault");
        }

        cosmosDbKey = await keyvault.getSecret(cosmosKey);
        log.Trace("Got cosmosDBKey from keyvault");

        insightsKey = await keyvault.getSecret(appInsightsKey);
        log.Trace("Got AppInsightsInstrumentationKey from keyvault");

        cosmosDbUrl = await keyvault.getSecret(cosmosUrl);
        log.Trace("Got CosmosUrl from keyvault");

        database = await keyvault.getSecret(cosmosDatabase);
        log.Trace("Got CosmosDatabase from keyvault");

        collection = await keyvault.getSecret(cosmosCollection);
        log.Trace("Got CosmosCollection from keyvault");

    } catch {
        log.Error(Error(), "Failed to get secrets from KeyVault. Falling back to env vars for secrets");
    }

    log.Trace("Returning config values");
    return {
        port,
        cosmosDbKey,
        cosmosDbUrl,
        database,
        collection,
        insightsKey,
    };
}
