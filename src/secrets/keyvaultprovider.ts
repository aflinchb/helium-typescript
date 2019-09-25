import * as keyvault from "@azure/keyvault";
import { inject, injectable, named } from "inversify";
import * as msrestazure from "ms-rest-azure";
import { ILoggingProvider } from "../logging/iLoggingProvider";
import { AzureCliCredentials } from "@azure/ms-rest-nodeauth";

/**
 * Handles accessing secrets from Azure Key vault.
 */
@injectable()
export class KeyVaultProvider {
    private client: keyvault.KeyVaultClient;

    /**
     * Creates a new instance of the KeyVaultProvider class.
     * @param url The KeyVault URL
     */
    constructor(private url: string,
                @inject("ILoggingProvider") private logger: ILoggingProvider) {
        this.url = url;
        this.logger = logger;
    }

    /**
     * Returns the latest version of the names secret.
     * @param name The name of the secret.
     */
    public async getSecret(name: string): Promise<string> {
        this.logger.Trace("In getSecret from KeyVault");
        if (this.client == null) {
            await this._initialize();
        }
        // An empty string for 'secretVersion' returns the latest version
        const secret: string = await this.client.getSecret(this.url, name, "")
            .then((s) =>  (s.value) as string)
            .catch((_) => {
                this.logger.Error(Error(), "Unable to find secret " + name);
                throw new Error(`Unable to find secret ${name}`);
            });
        this.logger.Trace("Got secret " + name + " from KeyVault");
        return secret;
    }

    /**
     * Initialized the KeyVault client.
     * This is handled in a separate method to avoid calling async operations in the constructor.
     */
    private async _initialize() {

        this.logger.Trace("Initializing KeyVault");
        const devString: string = "ISDEV";
        const creds: any = process.env[devString] === "false" ?
                            await msrestazure.loginWithAppServiceMSI({resource: "https://vault.azure.net"}) :
                                await AzureCliCredentials.create({ resource: "https://vault.azure.net" });

        this.client = new keyvault.KeyVaultClient(creds);
    }
}
